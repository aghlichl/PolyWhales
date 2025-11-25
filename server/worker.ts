import 'dotenv/config';
import { prisma } from '../lib/prisma';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import WebSocket from 'ws';
import { getTraderProfile, analyzeMarketImpact, getWalletsFromTx } from '../lib/intelligence';
import { fetchMarketsFromGamma, parseMarketData, enrichTradeWithDataAPI } from '../lib/polymarket';
import { MarketMeta, AssetOutcome, PolymarketTrade, EnrichmentStatus } from '../lib/types';
import { CONFIG } from '../lib/config';
import { safeParseDate } from '../lib/utils';

// Helper function for rate limiting delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize services
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Socket.io server on port 3001
const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

if (process.argv[1].endsWith('worker.ts')) {
  httpServer.listen(3001, () => {
    console.log('[Worker] Socket.io server listening on port 3001');
  });
}

// Add connection handling for Socket.io clients
io.on('connection', (socket) => {
  console.log(`[Worker] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Worker] Client disconnected: ${socket.id}`);
  });
});

// Market metadata cache
// We use mutable maps to store state
let marketsByCondition = new Map<string, MarketMeta>();
let assetIdToOutcome = new Map<string, AssetOutcome>();

/**
 * Fetch market metadata and update local cache
 */
async function updateMarketMetadata(): Promise<string[]> {
  try {
    const markets = await fetchMarketsFromGamma();

    const result = parseMarketData(markets);

    // Update globals
    marketsByCondition = result.marketsByCondition;
    assetIdToOutcome = result.assetIdToOutcome;

    console.log(`[Worker] Mapped ${marketsByCondition.size} markets and ${assetIdToOutcome.size} assets`);
    return result.allAssetIds;
  } catch (error) {
    console.error('[Worker] Error fetching metadata:', error);
    return [];
  }
}

/**
 * Process and enrich a trade with wallet identity
 * 
 * Enrichment pipeline:
 * 1. Try WebSocket fields (fast path) - ~10-20% success
 * 2. Try Data-API matching if txHash available - primary source
 * 3. Fall back to tx log parsing - last resort
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

    // === WALLET ENRICHMENT PIPELINE ===
    let walletAddress = '';
    let enrichmentStatus: EnrichmentStatus = 'pending';
    let blockNumber: bigint | null = null;
    let logIndex: number | null = null;
    const transactionHash = trade.transaction_hash || null;

    // Step 1: Try WebSocket fields (fast path)
    walletAddress = trade.user || trade.maker || trade.taker || trade.wallet || '';
    if (walletAddress) {
      enrichmentStatus = 'enriched';
    }

    // Step 2: Try Data-API matching (if has txHash and no wallet yet)
    if (!walletAddress && transactionHash) {
      try {
        const timestamp = safeParseDate(trade.timestamp);
        
        const dataApiResult = await enrichTradeWithDataAPI({
          assetId: trade.asset_id,
          price,
          size,
          timestamp,
          transactionHash,
        });
        
        if (dataApiResult) {
          // Prefer taker (active trader) over maker
          walletAddress = dataApiResult.taker || dataApiResult.maker || '';
          if (walletAddress) {
            enrichmentStatus = 'enriched';
            // console.log(`[Worker] Enriched wallet via Data-API: ${walletAddress.slice(0, 8)}...`);
          }
        }
      } catch (dataApiError) {
        console.warn('[Worker] Data-API enrichment failed:', dataApiError);
      }
    }

    // Step 3: Fall back to tx log parsing
    if (!walletAddress && transactionHash) {
      try {
        const txResult = await getWalletsFromTx(transactionHash);
        // Prefer taker as the active trader
        walletAddress = txResult.taker || txResult.maker || '';
        blockNumber = txResult.blockNumber;
        logIndex = txResult.logIndex;
        
        if (walletAddress) {
          enrichmentStatus = 'enriched';
          // console.log(`[Worker] Enriched wallet via tx logs: ${walletAddress.slice(0, 8)}...`);
        }
      } catch (txError) {
        console.warn('[Worker] Tx log parsing failed:', txError);
      }
    }

    // Mark as failed if we couldn't enrich after trying all methods
    if (!walletAddress && transactionHash) {
      enrichmentStatus = 'failed';
    }

    // Determine side (BUY or SELL)
    const side = trade.side || (trade.type === 'buy' ? 'BUY' : 'SELL') || 'BUY';

    // Enrich with trader profile (only if we have a wallet address)
    const profile = walletAddress ? await getTraderProfile(walletAddress) : {
      address: '',
      label: null,
      totalPnl: 0,
      winRate: 0,
      isFresh: false,
      isSmartMoney: false,
      isWhale: false,
      txCount: 0,
      maxTradeValue: 0,
      activityLevel: null as 'LOW' | 'MEDIUM' | 'HIGH' | null,
    };

    // Analyze market impact
    const impact = await analyzeMarketImpact(trade.asset_id, size, side as 'BUY' | 'SELL');

    // Tag the trade
    const isWhale = value > 10000 || profile.isWhale;
    const isSmartMoney = profile.isSmartMoney;
    const isFresh = profile.isFresh;
    const isSweeper = impact.isSweeper;
    const isInsider = profile.activityLevel === 'LOW' && profile.winRate > 0.7 && profile.totalPnl > 10000;

    // Create enriched trade object
    const enrichedTrade = {
      type: 'UNUSUAL_ACTIVITY',
      market: {
        question: marketMeta.question,
        outcome: assetInfo.outcomeLabel,
        conditionId: assetInfo.conditionId,
        odds: Math.round(price * 100),
      },
      trade: {
        assetId: trade.asset_id,
        size,
        side,
        price,
        tradeValue: value,
        timestamp: safeParseDate(trade.timestamp),
      },
      analysis: {
        tags: [
          isWhale && 'WHALE',
          isSmartMoney && 'SMART_MONEY',
          isFresh && 'FRESH_WALLET',
          isSweeper && 'SWEEPER',
          isInsider && 'INSIDER',
        ].filter(Boolean) as string[],
        wallet_context: {
          address: walletAddress.toLowerCase(),
          label: profile.label || 'Unknown',
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
        }
      },
    };

    // Persist to database
    try {
      // Only upsert wallet profile if we have a wallet address
      if (walletAddress) {
        await prisma.walletProfile.upsert({
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
      }

      // Save trade (always save, even without wallet - can be enriched later)
      await prisma.trade.create({
        data: {
          assetId: trade.asset_id,
          side,
          size,
          price,
          tradeValue: value,
          timestamp: safeParseDate(trade.timestamp),
          walletAddress: walletAddress.toLowerCase(),
          isWhale,
          isSmartMoney,
          isFresh,
          isSweeper,
          conditionId: assetInfo.conditionId,
          outcome: assetInfo.outcomeLabel,
          question: marketMeta.question,
          image: marketMeta.image,
          // New enrichment fields
          transactionHash,
          blockNumber,
          logIndex,
          enrichmentStatus,
        },
      });
    } catch (dbError) {
      console.error('[Worker] Database error:', dbError);
    }

    // Broadcast to Socket.io clients
    io.emit('trade', enrichedTrade);

    const walletDisplay = walletAddress ? walletAddress.slice(0, 8) + '...' : 'UNKNOWN';
    console.log(`[Worker] Processed trade: $${value.toFixed(2)} from ${walletDisplay} [${enrichmentStatus}] (${enrichedTrade.analysis.tags.join(', ')})`);
  } catch (error) {
    console.error('[Worker] Error processing trade:', error);
  }
}

/**
 * Batch enrichment job for trades missing wallet addresses
 * Runs periodically to retry enrichment on pending/failed trades
 */
async function runBatchEnrichment() {
  try {
    const maxAgeMs = CONFIG.ENRICHMENT.MAX_AGE_HOURS * 60 * 60 * 1000;
    
    // Find trades that need enrichment (empty wallet or pending status)
    const unenrichedTrades = await prisma.trade.findMany({
      where: {
        OR: [
          { walletAddress: '' },
          { enrichmentStatus: 'pending' },
        ],
        timestamp: { 
          gte: new Date(Date.now() - maxAgeMs) 
        },
        // Must have transaction hash to attempt enrichment
        transactionHash: { not: null },
      },
      take: CONFIG.ENRICHMENT.BATCH_SIZE,
      orderBy: { timestamp: 'desc' },
    });

    if (unenrichedTrades.length === 0) {
      return;
    }

    console.log(`[Enrichment] Processing ${unenrichedTrades.length} unenriched trades...`);
    
    let enrichedCount = 0;
    let failedCount = 0;

    for (const trade of unenrichedTrades) {
      // Rate limit to stay under 75 req/10s
      await delay(CONFIG.ENRICHMENT.RATE_LIMIT_DELAY_MS);

      try {
        let walletAddress = '';
        let blockNumber: bigint | null = trade.blockNumber;
        let logIndex: number | null = trade.logIndex;
        let enrichmentStatus: EnrichmentStatus = 'failed';

        // Try Data-API matching first
        if (trade.transactionHash) {
          const dataApiResult = await enrichTradeWithDataAPI({
            assetId: trade.assetId,
            price: trade.price,
            size: trade.size,
            timestamp: safeParseDate(trade.timestamp),
            transactionHash: trade.transactionHash,
          });

          if (dataApiResult) {
            walletAddress = dataApiResult.taker || dataApiResult.maker || '';
            if (walletAddress) {
              enrichmentStatus = 'enriched';
            }
          }
        }

        // Fall back to tx log parsing if Data-API didn't work
        if (!walletAddress && trade.transactionHash) {
          const txResult = await getWalletsFromTx(trade.transactionHash);
          walletAddress = txResult.taker || txResult.maker || '';
          blockNumber = txResult.blockNumber;
          logIndex = txResult.logIndex;
          
          if (walletAddress) {
            enrichmentStatus = 'enriched';
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
              enrichmentStatus: 'failed',
              blockNumber,
              logIndex,
            },
          });
          failedCount++;
        }
      } catch (tradeError) {
        console.error(`[Enrichment] Error enriching trade ${trade.id}:`, tradeError);
        failedCount++;
        
        // Mark as failed
        await prisma.trade.update({
          where: { id: trade.id },
          data: { enrichmentStatus: 'failed' },
        }).catch(() => {}); // Ignore update errors
      }
    }

    if (enrichedCount > 0 || failedCount > 0) {
      console.log(`[Enrichment] Batch complete: ${enrichedCount} enriched, ${failedCount} failed`);
    }
  } catch (error) {
    console.error('[Enrichment] Batch enrichment error:', error);
  }
}

/**
 * Main WebSocket connection to Polymarket
 */
function connectToPolymarket() {
  let ws: WebSocket | null = null;
  let heartbeatInterval: NodeJS.Timeout;

  const connect = async () => {
    const assetIds = await updateMarketMetadata();
    if (assetIds.length === 0) {
      console.warn('[Worker] No assets found, retrying in 5s...');
      setTimeout(connect, 5000);
      return;
    }

    ws = new WebSocket(CONFIG.URLS.WS_CLOB);

    ws.on('open', () => {
      console.log('[Worker] Connected to Polymarket WebSocket');

      const msg = {
        type: 'market',
        assets_ids: assetIds,
        channel: 'trades',
      };
      console.log('[Worker] Subscribing to', assetIds.length, 'assets');
      ws?.send(JSON.stringify(msg));

      heartbeatInterval = setInterval(() => {
        // console.log('[Worker] Heartbeat - Connected');
      }, CONFIG.CONSTANTS.HEARTBEAT_INTERVAL);

      // Refresh metadata
      setInterval(async () => {
        // console.log('[Worker] Refreshing metadata...');
        const latestAssetIds = await updateMarketMetadata();
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'market',
            assets_ids: latestAssetIds,
            channel: 'trades',
          }));
        }
      }, CONFIG.CONSTANTS.METADATA_REFRESH_INTERVAL);

      // Start batch enrichment job
      console.log('[Worker] Starting batch enrichment job...');
      setInterval(runBatchEnrichment, CONFIG.ENRICHMENT.BATCH_INTERVAL_MS);
      
      // Run initial batch enrichment after a short delay
      setTimeout(runBatchEnrichment, 10000);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.event_type === 'last_trade_price' || parsed.event_type === 'trade') {
          const trades = Array.isArray(parsed) ? parsed : [parsed];

          trades.forEach((trade: PolymarketTrade) => {
            if (trade.price && trade.size && trade.asset_id) {
              processTrade(trade).catch(console.error);
            }
          });
        }
      } catch (error) {
        console.warn('[Worker] Parse error:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('[Worker] WebSocket error:', error);
    });

    ws.on('close', () => {
      // console.log('[Worker] WebSocket closed, reconnecting...');
      clearInterval(heartbeatInterval);
      setTimeout(connect, 3000);
    });
  };

  connect();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  // console.log('[Worker] Shutting down...');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

// Start the worker
if (process.argv[1].endsWith('worker.ts')) {
  // console.log('[Worker] Starting Polymarket Intelligence Worker...');
  connectToPolymarket();
}
