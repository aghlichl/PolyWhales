import "dotenv/config";
import { prisma } from "../lib/prisma";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import WebSocket from "ws";
import {
  getTraderProfile,
  analyzeMarketImpact,
  getWalletsFromTx, // Only used in deprecated processTrade function
} from "../lib/intelligence";
import {
  fetchMarketsFromGamma,
  parseMarketData,
  enrichTradeWithDataAPI, // Only used in deprecated processTrade function
} from "../lib/polymarket";
import {
  MarketMeta,
  AssetOutcome,
  PolymarketTrade,
  EnrichmentStatus,
  EnrichedTrade,
  RTDSTradePayload,
  RTDSMessage,
} from "../lib/types";
import { formatDiscordAlert } from "../lib/alerts/formatters";
import { fetchPortfolio } from "../lib/gamma";
import { CONFIG } from "../lib/config";
import { load } from "cheerio";
import fetch from "node-fetch";

// ---- LEADERBOARD SCRAPER TYPES ----
type LeaderboardRow = {
  timeframe: string;      // "Daily" | "Weekly" | "Monthly" | "All Time"
  rank: number;
  displayName: string;
  wallet: string;
  profitLabel: string;
  volumeLabel: string;
};

type PositionResponse = {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  percentRealizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  mergeable: boolean;
  title: string;
  slug: string;
  icon: string;
  eventId: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  oppositeOutcome: string;
  oppositeAsset: string;
  endDate: string;
  negativeRisk: boolean;
};

/**
 * Adaptive rate limiter that adjusts delays based on API response times and error rates
 */
class AdaptiveRateLimiter {
  private lastRequestTime = 0;
  private errorCount = 0;
  private baseDelay = 200;

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const adaptiveDelay = Math.max(
      this.baseDelay,
      this.errorCount * 100,  // Increase delay on errors
      this.baseDelay - timeSinceLastRequest  // Don't wait if enough time passed
    );

    if (adaptiveDelay > 0) {
      await delay(adaptiveDelay);
    }

    this.lastRequestTime = Date.now();
  }

  recordError(): void {
    this.errorCount = Math.min(this.errorCount + 1, 5); // Cap at 5
  }

  recordSuccess(): void {
    this.errorCount = Math.max(this.errorCount - 1, 0); // Decay on success
  }
}

/**
 * Bounded Map with automatic cleanup to prevent memory accumulation
 */
class BoundedMap<K, V> extends Map<K, V> {
  private readonly maxSize: number;

  constructor(maxSize: number = 10000) {
    super();
    this.maxSize = maxSize;
  }

  set(key: K, value: V): this {
    if (this.size >= this.maxSize) {
      // Remove oldest 10% of entries
      const keysToDelete = Array.from(this.keys()).slice(0, Math.floor(this.maxSize * 0.1));
      keysToDelete.forEach(k => this.delete(k));
    }
    return super.set(key, value);
  }
}

const LEADERBOARD_URLS = [
  { url: "https://polymarket.com/leaderboard/overall/today/profit", timeframe: "Daily" },
  { url: "https://polymarket.com/leaderboard/overall/weekly/profit", timeframe: "Weekly" },
  { url: "https://polymarket.com/leaderboard/overall/monthly/profit", timeframe: "Monthly" },
  { url: "https://polymarket.com/leaderboard/overall/all/profit", timeframe: "All Time" },
];

function parseCurrency(label: string): number | null {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "—") return null;

  const normalized = trimmed
    .replace(/[$,]/g, "")
    .replace(/^\+/, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Fetch top positions for a wallet
 */
async function fetchWhalePositions(walletAddress: string): Promise<PositionResponse[]> {
  try {
    const url = `https://data-api.polymarket.com/positions?sizeThreshold=1&limit=10&sortBy=CURRENT&sortDirection=DESC&user=${walletAddress}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Worker] Failed to fetch positions for ${walletAddress}: ${response.statusText}`);
      return [];
    }
    const data = await response.json() as PositionResponse[];
    return data;
  } catch (error) {
    console.error(`[Worker] Error fetching positions for ${walletAddress}:`, error);
    return [];
  }
}

/**
 * Scrapes Polymarket leaderboard and saves to DB
 */
async function scrapeLeaderboard() {
  console.log("[Worker] Starting leaderboard scrape...");
  const allRows: LeaderboardRow[] = [];

  try {
    for (const { url, timeframe } of LEADERBOARD_URLS) {
      // console.log(`[Worker] Scraping ${timeframe} leaderboard...`);
      const html = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }).then((r) => r.text());

      const $ = load(html);
      const rows: LeaderboardRow[] = [];

      // each row is wrapped in this exact container:
      $(".flex.flex-col.gap-2.py-5.border-b").each((i, row) => {
        if (i >= 20) return; // Top 20

        const $row = $(row);

        // USERNAME + WALLET
        const usernameAnchor = $row.find('a[href^="/profile/"]').last();
        const displayName = usernameAnchor.text().trim();
        const wallet = usernameAnchor.attr("href")!.replace("/profile/", "");

        // PROFIT
        const profitLabel = $row.find("p.text-text-primary").text().trim();

        // VOLUME
        const volumeLabel = $row.find("p.text-text-secondary").text().trim();

        rows.push({
          timeframe,
          rank: i + 1,
          displayName,
          wallet,
          profitLabel,
          volumeLabel,
        });
      });

      allRows.push(...rows);
    }

    console.log(`[Worker] Scraped ${allRows.length} leaderboard rows`);

    if (allRows.length > 0) {
      const snapshotAt = new Date();

      // Insert into DB using Prisma
      // We do this in a transaction to ensure consistency
      await prisma.$transaction(async (tx) => {
        for (const row of allRows) {
          const totalPnl = parseCurrency(row.profitLabel) ?? 0;
          const totalVolume = parseCurrency(row.volumeLabel) ?? 0;

          await tx.walletLeaderboardSnapshot.create({
            data: {
              walletAddress: row.wallet,
              period: row.timeframe,
              rank: row.rank,
              totalPnl,
              totalVolume,
              winRate: 0, // Not available in this view
              snapshotAt,
              accountName: row.displayName,
            }
          });

          // Fetch and insert positions
          // Add adaptive delay to respect rate limits
          await rateLimiter.wait();
          let positions: PositionResponse[] = [];
          try {
            positions = await fetchWhalePositions(row.wallet);
            rateLimiter.recordSuccess();
          } catch (error) {
            console.warn(`[Worker] Failed to fetch positions for ${row.wallet}:`, error);
            rateLimiter.recordError();
          }

          let positionRank = 1;
          for (const pos of positions) {
            await tx.whalePositionSnapshot.create({
              data: {
                snapshotAt,
                timeframe: row.timeframe,
                walletRank: row.rank,
                positionRank: positionRank++,
                proxyWallet: pos.proxyWallet,
                conditionId: pos.conditionId,
                assetId: pos.asset,
                eventId: pos.eventId,
                eventSlug: pos.eventSlug,
                marketTitle: pos.title,
                marketSlug: pos.slug,
                iconUrl: pos.icon,
                outcome: pos.outcome,
                outcomeIndex: pos.outcomeIndex,
                oppositeOutcome: pos.oppositeOutcome,
                oppositeAssetId: pos.oppositeAsset,
                endDate: pos.endDate ? new Date(pos.endDate) : null,
                negativeRisk: pos.negativeRisk,
                redeemable: pos.redeemable,
                size: pos.size,
                avgPrice: pos.avgPrice,
                curPrice: pos.curPrice,
                initialValue: pos.initialValue,
                currentValue: pos.currentValue,
                totalBought: pos.totalBought,
                cashPnl: pos.cashPnl,
                percentPnl: pos.percentPnl,
                realizedPnl: pos.realizedPnl,
                percentRealizedPnl: pos.percentRealizedPnl,
              }
            });
          }
        }
      });
      console.log("[Worker] Successfully saved leaderboard snapshots and positions");
    }

  } catch (error) {
    console.error("[Worker] Leaderboard scraping failed:", error);
  }
}

// Cache user alert preferences to avoid repeated database queries
async function getUserAlertPreferences(alertType: "WHALE_MOVEMENT" | "SMART_MONEY_ENTRY") {
  const cacheKey = `alert_${alertType}`;
  const cached = userAlertCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.prefs;
  }

  const users = await prisma.user.findMany({
    where: {
      alertSettings: {
        is: { alertTypes: { has: alertType } }
      }
    },
    include: { alertSettings: true }
  }) as any[];

  userAlertCache.set(cacheKey, {
    prefs: users,
    expires: Date.now() + 5 * 60 * 1000  // 5 minute TTL
  });

  return users;
}

// Direct alert sending functions (replaces queue system)
// Direct alert sending function (replaces queue system)
async function sendDiscordAlert(trade: EnrichedTrade, alertType: "WHALE_MOVEMENT" | "SMART_MONEY_ENTRY") {
  // Get all users who should receive this type of alert (cached)
  const users = await getUserAlertPreferences(alertType);

  // Format the payload once
  const embed = formatDiscordAlert(trade);
  const payload = {
    content: null,
    embeds: [embed]
  };

  // Send to each user's Discord webhook
  await Promise.all(users.map(async (user) => {
    const webhookUrl = user.alertSettings?.discordWebhook;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Fail silently - alerts are not critical
      console.log(`[WORKER] Failed to send ${alertType} alert to user ${user.email}: ${(error as Error).message}`);
    }
  }));
}

// Helper function for rate limiting delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Adaptive rate limiter instance
const rateLimiter = new AdaptiveRateLimiter();

// User alert preferences cache with TTL
const userAlertCache = new Map<string, { prefs: Awaited<ReturnType<typeof prisma.user.findMany>>; expires: number }>();

// Error tracking and metrics
const errorMetrics = {
  websocketErrors: 0,
  apiErrors: 0,
  dbErrors: 0,
  enrichmentFailures: 0,
  lastReset: Date.now()
};

function logError(category: keyof typeof errorMetrics, error: Error, context?: any): void {
  errorMetrics[category]++;

  console.error(`[${category.toUpperCase()}]`, {
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
    count: errorMetrics[category]
  });
}

// Initialize services
// Socket.io server on port 3001
const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

if (process.argv[1].endsWith("worker.ts")) {
  httpServer.listen(3001, () => {
    console.log("[Worker] Socket.io server listening on port 3001");
  });
}

// Add connection handling for Socket.io clients
io.on("connection", (socket) => {
  console.log(`[Worker] Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`[Worker] Client disconnected: ${socket.id}`);
  });

  // Health check endpoint
  socket.on("health", (callback) => {
    callback({
      status: "healthy",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      errorMetrics,
      activeConnections: io.engine.clientsCount,
      lastMetadataRefresh: marketsByCondition.size > 0 ? "recent" : "unknown"
    });
  });
});

// Market metadata cache with bounds to prevent memory accumulation
let marketsByCondition = new BoundedMap<string, MarketMeta>(5000);
let assetIdToOutcome = new BoundedMap<string, AssetOutcome>(10000);

/**
 * Fetch market metadata and update local cache
 */
async function updateMarketMetadata(): Promise<string[]> {
  try {
    const markets = await fetchMarketsFromGamma();

    const result = parseMarketData(markets);

    // Update bounded maps (clear and repopulate to maintain bounds)
    marketsByCondition.clear();
    for (const [key, value] of result.marketsByCondition) {
      marketsByCondition.set(key, value);
    }

    assetIdToOutcome.clear();
    for (const [key, value] of result.assetIdToOutcome) {
      assetIdToOutcome.set(key, value);
    }

    console.log(
      `[Worker] Mapped ${marketsByCondition.size} markets and ${assetIdToOutcome.size} assets`
    );
    return result.allAssetIds;
  } catch (error) {
    console.error("[Worker] Error fetching metadata:", error);
    return [];
  }
}

/**
 * Enriches wallet with portfolio data from Gamma
 * Rate limited to once every 5 minutes per wallet
 */
async function enrichWalletPortfolio(walletAddress: string) {
  try {
    // Check if we have a recent snapshot (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentSnapshot = await prisma.walletPortfolioSnapshot.findFirst({
      where: {
        walletAddress: walletAddress,
        timestamp: {
          gt: fiveMinutesAgo,
        },
      },
    });

    if (recentSnapshot) {
      return; // Skip if we have fresh data
    }

    // Fetch from Gamma
    // console.log(`[Worker] Fetching portfolio for ${walletAddress}...`);
    const portfolio = await fetchPortfolio(walletAddress);

    if (portfolio) {
      // Save snapshot
      await prisma.walletPortfolioSnapshot.create({
        data: {
          walletAddress: walletAddress,
          totalValue: portfolio.totalValue,
          totalPnl: portfolio.totalPnl,
          positions: portfolio.positions as any, // Cast to any for JSON compatibility
          timestamp: new Date(),
        },
      });

      // Optionally update wallet profile stats if Gamma data is more authoritative
      // For now, we just store the snapshot
    }
  } catch (error) {
    console.error(`[Worker] Error enriching portfolio for ${walletAddress}:`, error);
  }
}

/**
 * Process RTDS trade with proxyWallet already available
 * No enrichment needed - wallet is provided directly from RTDS
 */
export async function processRTDSTrade(payload: RTDSTradePayload) {
  try {
    if (!payload.price || !payload.size || !payload.asset) return;

    const price = payload.price;
    const size = payload.size;
    const value = price * size;

    // Filter noise
    if (value < CONFIG.THRESHOLDS.MIN_VALUE) return;

    // Filter out very likely outcomes
    if (price > CONFIG.CONSTANTS.ODDS_THRESHOLD) return;

    // Lookup market metadata first (early exit if unknown asset)
    const assetInfo = assetIdToOutcome.get(payload.asset);
    if (!assetInfo) {
      return;
    }

    const marketMeta = marketsByCondition.get(payload.conditionId || assetInfo.conditionId);
    if (!marketMeta) {
      return;
    }

    // Determine side (BUY or SELL)
    const side = payload.side || "BUY";

    // Initial classification (based on value only)
    const isWhale = value >= CONFIG.THRESHOLDS.WHALE;
    const isMegaWhale = value >= CONFIG.THRESHOLDS.MEGA_WHALE;
    const isSuperWhale = value >= CONFIG.THRESHOLDS.SUPER_WHALE;
    const isGodWhale = value >= CONFIG.THRESHOLDS.GOD_WHALE;

    // Wallet is already available from RTDS
    const walletAddress = payload.proxyWallet?.toLowerCase() || "";
    if (!walletAddress) {
      console.warn("[Worker] RTDS trade missing proxyWallet");
      return;
    }

    // Convert timestamp from seconds to Date
    const timestamp = new Date(payload.timestamp * 1000);

    // Construct initial trade object with wallet already known
    const initialEnrichedTrade: EnrichedTrade = {
      type: "UNUSUAL_ACTIVITY",
      market: {
        question: payload.title || marketMeta.question,
        outcome: payload.outcome || assetInfo.outcomeLabel,
        conditionId: payload.conditionId || assetInfo.conditionId,
        odds: Math.round(price * 100),
        image: payload.icon || marketMeta.image || null,
      },
      trade: {
        assetId: payload.asset,
        size,
        side,
        price,
        tradeValue: value,
        timestamp,
      },
      analysis: {
        tags: [
          isGodWhale && "GOD_WHALE",
          isSuperWhale && "SUPER_WHALE",
          isMegaWhale && "MEGA_WHALE",
          isWhale && "WHALE",
        ].filter(Boolean) as string[],
        wallet_context: {
          address: walletAddress,
          label: payload.pseudonym || walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4),
          pnl_all_time: "...",
          win_rate: "...",
          is_fresh_wallet: false,
        },
        market_impact: {
          swept_levels: 0,
          slippage_induced: "0%",
        },
        trader_context: {
          tx_count: 0,
          max_trade_value: 0,
          activity_level: null,
        },
      },
    };

    // Emit immediately to UI with wallet already known
    io.emit("trade", initialEnrichedTrade);

    // Save initial trade to DB with wallet already known
    let dbTrade;
    try {
      dbTrade = await prisma.trade.create({
        data: {
          assetId: payload.asset,
          side,
          size,
          price,
          tradeValue: value,
          timestamp,
          walletAddress: walletAddress,
          isWhale,
          isSmartMoney: false,
          isFresh: false,
          isSweeper: false,
          conditionId: payload.conditionId || assetInfo.conditionId,
          outcome: payload.outcome || assetInfo.outcomeLabel,
          question: payload.title || marketMeta.question,
          image: payload.icon || marketMeta.image || null,
          transactionHash: payload.transactionHash || null,
          enrichmentStatus: "enriched", // Already enriched from RTDS
        },
      });
    } catch (dbError) {
      console.error("[Worker] Failed to save initial trade:", dbError);
      return; // Can't proceed without DB record
    }

    // Enrich with trader profile for intelligence flags
    const profile = await getTraderProfile(walletAddress);

    // Analyze market impact
    const impact = await analyzeMarketImpact(
      payload.asset,
      size,
      side as "BUY" | "SELL"
    );

    const isSmartMoney = profile.isSmartMoney;
    const isFresh = profile.isFresh;
    const isSweeper = impact.isSweeper;
    const isInsider =
      profile.activityLevel === "LOW" &&
      profile.winRate > 0.7 &&
      profile.totalPnl > 10000;

    // Update DB with batched transaction
    try {
      await prisma.$transaction(async (tx) => {
        await tx.walletProfile.upsert({
          where: { id: walletAddress },
          update: {
            label: profile.label || payload.pseudonym || null,
            totalPnl: profile.totalPnl,
            winRate: profile.winRate,
            isFresh: profile.isFresh,
            txCount: profile.txCount,
            maxTradeValue: Math.max(profile.maxTradeValue, value),
            activityLevel: profile.activityLevel,
            lastUpdated: new Date(),
          },
          create: {
            id: walletAddress,
            label: profile.label || payload.pseudonym || null,
            totalPnl: profile.totalPnl,
            winRate: profile.winRate,
            isFresh: profile.isFresh,
            txCount: profile.txCount,
            maxTradeValue: value,
            activityLevel: profile.activityLevel,
          },
        });

        await tx.trade.update({
          where: { id: dbTrade.id },
          data: {
            isSmartMoney,
            isFresh,
            isSweeper,
            enrichmentStatus: "enriched",
          }
        });
      });

      // Trigger portfolio enrichment for interesting wallets
      if (isWhale || isSmartMoney || isGodWhale || isSuperWhale || isMegaWhale) {
        enrichWalletPortfolio(walletAddress).catch(err =>
          console.error(`[Worker] Background portfolio enrichment failed:`, err)
        );
      }

    } catch (dbUpdateError) {
      console.error("[Worker] Failed to update enriched trade in DB:", dbUpdateError);
    }

    // Construct FULL enriched trade
    const fullEnrichedTrade: EnrichedTrade = {
      ...initialEnrichedTrade,
      analysis: {
        tags: [
          isGodWhale && "GOD_WHALE",
          isSuperWhale && "SUPER_WHALE",
          isMegaWhale && "MEGA_WHALE",
          isWhale && "WHALE",
          isSmartMoney && "SMART_MONEY",
          isFresh && "FRESH_WALLET",
          isSweeper && "SWEEPER",
          isInsider && "INSIDER",
        ].filter(Boolean) as string[],
        wallet_context: {
          address: walletAddress,
          label: profile.label || payload.pseudonym || "Unknown",
          pnl_all_time: `$${profile.totalPnl.toLocaleString()}`,
          win_rate: `${(profile.winRate * 100).toFixed(0)}%`,
          is_fresh_wallet: isFresh,
        },
        market_impact: {
          swept_levels: impact.isSweeper ? 3 : 0,
          slippage_induced: `${impact.priceImpact.toFixed(2)}%`,
        },
        trader_context: {
          tx_count: profile.txCount,
          max_trade_value: Math.max(profile.maxTradeValue, value),
          activity_level: profile.activityLevel,
        },
      }
    };

    // Emit UPDATE to UI
    io.emit("trade", fullEnrichedTrade);

    // === ALERT GENERATION ===
    try {
      if (isGodWhale || isSuperWhale || isMegaWhale || isWhale) {
        console.log(`[WORKER] 🚨 SENDING WHALE ALERT: $${value} trade`);
        await sendDiscordAlert(fullEnrichedTrade, "WHALE_MOVEMENT")
          .catch(err => logError('apiErrors', err as Error, { alertType: "WHALE_MOVEMENT", tradeValue: value, walletAddress: walletAddress.slice(0, 8) }));

      } else if (isSmartMoney) {
        console.log(`[WORKER] 🧠 SENDING SMART MONEY ALERT: $${value} trade`);
        await sendDiscordAlert(fullEnrichedTrade, "SMART_MONEY_ENTRY")
          .catch(err => logError('apiErrors', err as Error, { alertType: "SMART_MONEY_ENTRY", tradeValue: value, walletAddress: walletAddress.slice(0, 8) }));
      }
    } catch (alertError) {
      console.error("[Worker] Error generating alert:", alertError);
    }

    console.log(
      `[Worker] Processed RTDS trade: $${value.toFixed(2)} from ${walletAddress.slice(0, 8)}...`
    );

  } catch (error) {
    console.error("[Worker] Error processing RTDS trade:", error);
  }
}

/**
 * Process and enrich a trade with wallet identity
 *
 * Enrichment pipeline:
 * 1. Try WebSocket fields (fast path) - ~10-20% success
 * 2. Try Data-API matching if txHash available - primary source
 * 3. Fall back to tx log parsing - last resort
 * 
 * @deprecated Use processRTDSTrade instead
 */
export async function processTrade(trade: PolymarketTrade) {
  try {
    if (!trade.price || !trade.size || !trade.asset_id) return;

    const price = Number(trade.price);
    const size = Number(trade.size);
    const value = price * size;

    // Filter noise
    if (value < CONFIG.THRESHOLDS.MIN_VALUE) return;

    // Filter out very likely outcomes
    if (price > CONFIG.CONSTANTS.ODDS_THRESHOLD) return;

    // Lookup market metadata first (early exit if unknown asset)
    const assetInfo = assetIdToOutcome.get(trade.asset_id);
    if (!assetInfo) {
      return;
    }

    const marketMeta = marketsByCondition.get(assetInfo.conditionId);
    if (!marketMeta) {
      return;
    }

    // Determine side (BUY or SELL)
    const side = trade.side || (trade.type === "buy" ? "BUY" : "SELL") || "BUY";

    // Initial classification (based on value only)
    const isWhale = value >= CONFIG.THRESHOLDS.WHALE;
    const isMegaWhale = value >= CONFIG.THRESHOLDS.MEGA_WHALE;
    const isSuperWhale = value >= CONFIG.THRESHOLDS.SUPER_WHALE;
    const isGodWhale = value >= CONFIG.THRESHOLDS.GOD_WHALE;

    // Construct initial trade object (FAST PATH)
    const initialEnrichedTrade: EnrichedTrade = {
      type: "UNUSUAL_ACTIVITY",
      market: {
        question: marketMeta.question,
        outcome: assetInfo.outcomeLabel,
        conditionId: assetInfo.conditionId,
        odds: Math.round(price * 100),
        image: marketMeta.image ?? null,
      },
      trade: {
        assetId: trade.asset_id,
        size,
        side,
        price,
        tradeValue: value,
        timestamp: new Date(Date.now()),
      },
      analysis: {
        tags: [
          isGodWhale && "GOD_WHALE",
          isSuperWhale && "SUPER_WHALE",
          isMegaWhale && "MEGA_WHALE",
          isWhale && "WHALE",
        ].filter(Boolean) as string[],
        wallet_context: {
          address: "",
          label: "Loading...",
          pnl_all_time: "...",
          win_rate: "...",
          is_fresh_wallet: false,
        },
        market_impact: {
          swept_levels: 0,
          slippage_induced: "0%",
        },
        trader_context: {
          tx_count: 0,
          max_trade_value: 0,
          activity_level: null,
        },
      },
    };

    // Emit immediately to UI
    io.emit("trade", initialEnrichedTrade);

    // Save initial trade to DB (to get an ID and ensure persistence)
    let dbTrade;
    try {
      dbTrade = await prisma.trade.create({
        data: {
          assetId: trade.asset_id,
          side,
          size,
          price,
          tradeValue: value,
          timestamp: initialEnrichedTrade.trade.timestamp,
          walletAddress: "", // Placeholder
          isWhale,
          isSmartMoney: false,
          isFresh: false,
          isSweeper: false,
          conditionId: assetInfo.conditionId,
          outcome: assetInfo.outcomeLabel,
          question: marketMeta.question,
          image: marketMeta.image,
          transactionHash: trade.transaction_hash || null,
          enrichmentStatus: "pending",
        },
      });
    } catch (dbError) {
      console.error("[Worker] Failed to save initial trade:", dbError);
      return; // Can't proceed without DB record
    }


    // === ASYNC ENRICHMENT ===
    // We do this in the background but await it here to keep the logic contained.
    // The UI has already received the initial event.

    let walletAddress = "";
    let enrichmentStatus: EnrichmentStatus = "pending";
    let blockNumber: bigint | null = null;
    let logIndex: number | null = null;
    const transactionHash = trade.transaction_hash || null;

    // Step 1: Try WebSocket fields (fast path)
    walletAddress =
      trade.user || trade.maker || trade.taker || trade.wallet || "";
    if (walletAddress) {
      enrichmentStatus = "enriched";
    }

    // Step 2: Try Data-API matching (if has txHash and no wallet yet)
    if (!walletAddress && transactionHash) {
      try {
        const timestamp = trade.timestamp
          ? new Date(trade.timestamp)
          : new Date();

        const dataApiResult = await enrichTradeWithDataAPI({
          assetId: trade.asset_id,
          price,
          size,
          timestamp,
          transactionHash,
        });

        if (dataApiResult) {
          // Prefer taker (active trader) over maker
          walletAddress = dataApiResult.taker || dataApiResult.maker || "";
          if (walletAddress) {
            enrichmentStatus = "enriched";
          }
        }
      } catch (dataApiError) {
        console.warn("[Worker] Data-API enrichment failed:", dataApiError);
      }
    }

    // Step 3: Fall back to tx log parsing
    if (!walletAddress && transactionHash) {
      try {
        const txResult = await getWalletsFromTx(transactionHash);
        // Prefer taker as the active trader
        walletAddress = txResult.taker || txResult.maker || "";
        blockNumber = txResult.blockNumber;
        logIndex = txResult.logIndex;

        if (walletAddress) {
          enrichmentStatus = "enriched";
        }
      } catch (txError) {
        console.warn("[Worker] Tx log parsing failed:", txError);
      }
    }

    // Mark as failed if we couldn't enrich after trying all methods
    if (!walletAddress && transactionHash) {
      enrichmentStatus = "failed";
    }

    // If we found a wallet, update everything
    if (walletAddress) {
      // Enrich with trader profile
      const profile = await getTraderProfile(walletAddress);

      // Analyze market impact
      const impact = await analyzeMarketImpact(
        trade.asset_id,
        size,
        side as "BUY" | "SELL"
      );

      const isSmartMoney = profile.isSmartMoney;
      const isFresh = profile.isFresh;
      const isSweeper = impact.isSweeper;
      const isInsider =
        profile.activityLevel === "LOW" &&
        profile.winRate > 0.7 &&
        profile.totalPnl > 10000;

      // Update DB with batched transaction
      try {
        await prisma.$transaction(async (tx) => {
          await tx.walletProfile.upsert({
            where: { id: walletAddress.toLowerCase() },
            update: {
              label: profile.label || null,
              totalPnl: profile.totalPnl,
              winRate: profile.winRate,
              isFresh: profile.isFresh,
              txCount: profile.txCount,
              maxTradeValue: Math.max(profile.maxTradeValue, value),
              activityLevel: profile.activityLevel,
              lastUpdated: new Date(),
            },
            create: {
              id: walletAddress.toLowerCase(),
              label: profile.label || null,
              totalPnl: profile.totalPnl,
              winRate: profile.winRate,
              isFresh: profile.isFresh,
              txCount: profile.txCount,
              maxTradeValue: value,
              activityLevel: profile.activityLevel,
            },
          });

          await tx.trade.update({
            where: { id: dbTrade.id },
            data: {
              walletAddress: walletAddress.toLowerCase(),
              isSmartMoney,
              isFresh,
              isSweeper,
              blockNumber,
              logIndex,
              enrichmentStatus,
            }
          });
        });

        // Trigger portfolio enrichment for interesting wallets
        if (isWhale || isSmartMoney || isGodWhale || isSuperWhale || isMegaWhale) {
          enrichWalletPortfolio(walletAddress.toLowerCase()).catch(err =>
            console.error(`[Worker] Background portfolio enrichment failed:`, err)
          );
        }

      } catch (dbUpdateError) {
        console.error("[Worker] Failed to update enriched trade in DB:", dbUpdateError);
      }

      // Construct FULL enriched trade
      const fullEnrichedTrade: EnrichedTrade = {
        ...initialEnrichedTrade,
        analysis: {
          tags: [
            isGodWhale && "GOD_WHALE",
            isSuperWhale && "SUPER_WHALE",
            isMegaWhale && "MEGA_WHALE",
            isWhale && "WHALE",
            isSmartMoney && "SMART_MONEY",
            isFresh && "FRESH_WALLET",
            isSweeper && "SWEEPER",
            isInsider && "INSIDER",
          ].filter(Boolean) as string[],
          wallet_context: {
            address: walletAddress.toLowerCase(),
            label: profile.label || "Unknown",
            pnl_all_time: `$${profile.totalPnl.toLocaleString()}`,
            win_rate: `${(profile.winRate * 100).toFixed(0)}%`,
            is_fresh_wallet: isFresh,
          },
          market_impact: {
            swept_levels: impact.isSweeper ? 3 : 0,
            slippage_induced: `${impact.priceImpact.toFixed(2)}%`,
          },
          trader_context: {
            tx_count: profile.txCount,
            max_trade_value: Math.max(profile.maxTradeValue, value),
            activity_level: profile.activityLevel,
          },
        }
      };

      // Emit UPDATE to UI
      io.emit("trade", fullEnrichedTrade);

      // === ALERT GENERATION (Only after enrichment) ===
      try {
        if (isGodWhale || isSuperWhale || isMegaWhale || isWhale) {
          console.log(`[WORKER] 🚨 SENDING WHALE ALERT: $${value} trade`);
          await sendDiscordAlert(fullEnrichedTrade, "WHALE_MOVEMENT")
            .catch(err => logError('apiErrors', err as Error, { alertType: "WHALE_MOVEMENT", tradeValue: value, walletAddress: walletAddress.slice(0, 8) }));

        } else if (isSmartMoney) {
          console.log(`[WORKER] 🧠 SENDING SMART MONEY ALERT: $${value} trade`);
          await sendDiscordAlert(fullEnrichedTrade, "SMART_MONEY_ENTRY")
            .catch(err => logError('apiErrors', err as Error, { alertType: "SMART_MONEY_ENTRY", tradeValue: value, walletAddress: walletAddress.slice(0, 8) }));
        }
      } catch (alertError) {
        console.error("[Worker] Error generating alert:", alertError);
      }

      console.log(
        `[Worker] Enriched & Updated trade: $${value.toFixed(2)} from ${walletAddress.slice(0, 8)}...`
      );

    } else {
      // Enrichment failed or no wallet found
      console.log(
        `[Worker] Processed trade (No Wallet): $${value.toFixed(2)}`
      );
    }

  } catch (error) {
    console.error("[Worker] Error processing trade:", error);
  }
}

/**
 * Batch enrichment job for trades missing wallet addresses
 * Runs periodically to retry enrichment on pending/failed trades
 * 
 * @deprecated No longer needed with RTDS - all trades come with proxyWallet
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function runBatchEnrichment() {
  try {
    const maxAgeMs = CONFIG.ENRICHMENT.MAX_AGE_HOURS * 60 * 60 * 1000;

    // Find trades that need enrichment (empty wallet or pending status)
    const unenrichedTrades = await prisma.trade.findMany({
      where: {
        OR: [{ walletAddress: "" }, { enrichmentStatus: "pending" }],
        timestamp: {
          gte: new Date(Date.now() - maxAgeMs),
        },
        // Must have transaction hash to attempt enrichment
        transactionHash: { not: null },
      },
      take: CONFIG.ENRICHMENT.BATCH_SIZE,
      orderBy: { timestamp: "desc" },
    });

    if (unenrichedTrades.length === 0) {
      return;
    }

    console.log(
      `[Enrichment] Processing ${unenrichedTrades.length} unenriched trades...`
    );

    let enrichedCount = 0;
    let failedCount = 0;

    for (const trade of unenrichedTrades) {
      // Rate limit to stay under 75 req/10s with adaptive delays
      await rateLimiter.wait();

      try {
        let walletAddress = "";
        let blockNumber: bigint | null = trade.blockNumber;
        let logIndex: number | null = trade.logIndex;
        let enrichmentStatus: EnrichmentStatus = "failed";

        // Try Data-API matching first
        if (trade.transactionHash) {
          try {
            const dataApiResult = await enrichTradeWithDataAPI({
              assetId: trade.assetId,
              price: trade.price,
              size: trade.size,
              timestamp: trade.timestamp,
              transactionHash: trade.transactionHash,
            });

            if (dataApiResult) {
              walletAddress = dataApiResult.taker || dataApiResult.maker || "";
              if (walletAddress) {
                enrichmentStatus = "enriched";
              }
            }
            rateLimiter.recordSuccess();
          } catch (error) {
            console.warn("[Worker] Data-API enrichment failed:", error);
            rateLimiter.recordError();
          }
        }

        // Fall back to tx log parsing if Data-API didn't work
        if (!walletAddress && trade.transactionHash) {
          try {
            const txResult = await getWalletsFromTx(trade.transactionHash);
            walletAddress = txResult.taker || txResult.maker || "";
            blockNumber = txResult.blockNumber;
            logIndex = txResult.logIndex;

            if (walletAddress) {
              enrichmentStatus = "enriched";
            }
            rateLimiter.recordSuccess();
          } catch (error) {
            console.warn("[Worker] Tx log parsing failed:", error);
            rateLimiter.recordError();
          }
        }

        // Update trade record
        if (walletAddress) {
          // Ensure wallet profile exists
          const profile = await getTraderProfile(walletAddress);

          await prisma.walletProfile.upsert({
            where: { id: walletAddress.toLowerCase() },
            update: {
              lastUpdated: new Date(),
            },
            create: {
              id: walletAddress.toLowerCase(),
              label: profile.label || null,
              totalPnl: profile.totalPnl,
              winRate: profile.winRate,
              isFresh: profile.isFresh,
              txCount: profile.txCount,
              maxTradeValue: trade.tradeValue,
              activityLevel: profile.activityLevel,
            },
          });

          // Update trade with enriched wallet
          await prisma.trade.update({
            where: { id: trade.id },
            data: {
              walletAddress: walletAddress.toLowerCase(),
              blockNumber,
              logIndex,
              enrichmentStatus,
              // Update intelligence flags based on profile
              isWhale: trade.tradeValue > 10000 || profile.isWhale,
              isSmartMoney: profile.isSmartMoney,
              isFresh: profile.isFresh,
            },
          });

          enrichedCount++;
        } else {
          // Mark as failed after retry
          await prisma.trade.update({
            where: { id: trade.id },
            data: {
              enrichmentStatus: "failed",
              blockNumber,
              logIndex,
            },
          });
          failedCount++;
        }
      } catch (tradeError) {
        console.error(
          `[Enrichment] Error enriching trade ${trade.id}:`,
          tradeError
        );
        failedCount++;

        // Mark as failed
        await prisma.trade
          .update({
            where: { id: trade.id },
            data: { enrichmentStatus: "failed" },
          })
          .catch(() => { }); // Ignore update errors
      }
    }

    if (enrichedCount > 0 || failedCount > 0) {
      console.log(
        `[Enrichment] Batch complete: ${enrichedCount} enriched, ${failedCount} failed`
      );
    }
  } catch (error) {
    console.error("[Enrichment] Batch enrichment error:", error);
  }
}

/**
 * Main WebSocket connection to Polymarket RTDS
 */
function connectToPolymarket() {
  let ws: WebSocket | null = null;
  let heartbeatInterval: NodeJS.Timeout;

  // Exponential backoff for reconnections
  let reconnectAttempts = 0;
  const MAX_RECONNECT_DELAY = 30000; // 30 seconds

  function getReconnectDelay(): number {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    return delay;
  }

  function resetReconnectAttempts(): void {
    reconnectAttempts = 0;
  }

  const connect = async () => {
    // Initialize market metadata (needed for asset lookups)
    await updateMarketMetadata();

    ws = new WebSocket(CONFIG.URLS.WS_RTDS);

    ws.on("open", () => {
      console.log("[Worker] Connected to Polymarket RTDS WebSocket");
      resetReconnectAttempts(); // Reset on successful connection

      // Subscribe to activity trades
      const subscribeMsg = {
        action: "subscribe",
        subscriptions: [
          {
            topic: "activity",
            type: "trades",
            filters: ""
          }
        ]
      };
      console.log("[Worker] Subscribing to RTDS activity trades");
      ws?.send(JSON.stringify(subscribeMsg));

      heartbeatInterval = setInterval(() => {
        // console.log('[Worker] Heartbeat - Connected');
      }, CONFIG.CONSTANTS.HEARTBEAT_INTERVAL);

      // Refresh metadata periodically (still needed for asset lookups)
      setInterval(async () => {
        // console.log('[Worker] Refreshing metadata...');
        await updateMarketMetadata();
      }, CONFIG.CONSTANTS.METADATA_REFRESH_INTERVAL);

      // Start leaderboard scraper (every 2 hours)
      console.log("[Worker] Starting leaderboard scraper schedule (every 2h)...");
      setInterval(scrapeLeaderboard, 2 * 60 * 60 * 1000);
      // Run once on startup after a delay
      setTimeout(scrapeLeaderboard, 30000);

      // Cache cleanup interval
      setInterval(() => {
        const now = Date.now();

        // Clean user alert cache
        for (const [key, value] of userAlertCache.entries()) {
          if (value.expires < now) {
            userAlertCache.delete(key);
          }
        }

        console.log(`[Worker] Cache cleanup: ${userAlertCache.size} alert prefs cached`);
      }, 10 * 60 * 1000); // Every 10 minutes
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const parsed: RTDSMessage = JSON.parse(data.toString());

        // Only process activity/trades messages
        if (parsed.topic !== "activity" || parsed.type !== "trades" || !parsed.payload) {
          return;
        }

        const payload = parsed.payload;

        // Validate required fields
        if (!payload.asset || !payload.price || !payload.size || !payload.proxyWallet) {
          return;
        }

        // Process RTDS trade
        processRTDSTrade(payload).catch(console.error);

      } catch (error) {
        // Only log actual parsing errors, not filtered messages
        console.warn("[Worker] RTDS message parse error:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("[Worker] RTDS WebSocket error:", error);
    });

    ws.on("close", () => {
      console.log('[Worker] RTDS WebSocket closed, reconnecting...');
      clearInterval(heartbeatInterval);
      setTimeout(connect, getReconnectDelay());
    });
  };

  connect();
}

// Graceful shutdown
process.on("SIGINT", async () => {
  // console.log('[Worker] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
if (process.argv[1].endsWith("worker.ts")) {
  // console.log('[Worker] Starting Polymarket Intelligence Worker...');
  connectToPolymarket();
}
