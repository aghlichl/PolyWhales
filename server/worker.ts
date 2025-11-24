import 'dotenv/config';
import { prisma } from '../lib/prisma';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import WebSocket from 'ws';
import { getTraderProfile, analyzeMarketImpact, getWalletsFromTx } from '../lib/intelligence';
import { fetchMarketsFromGamma, parseMarketData } from '../lib/polymarket';
import { MarketMeta, AssetOutcome } from '../lib/types';
import { CONFIG } from '../lib/config';

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
    // console.log('[Worker] Socket.io server listening on port 3001');
  });
}

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
 * Process and enrich a trade
 */
export async function processTrade(trade: any) {
  try {
    if (!trade.price || !trade.size || !trade.asset_id) return;

    const price = Number(trade.price);
    const size = Number(trade.size);
    const value = price * size;

    // Filter noise
    if (value < CONFIG.THRESHOLDS.MIN_VALUE) return;

    // Filter out very likely outcomes
    if (price > CONFIG.CONSTANTS.ODDS_THRESHOLD) return;

    // Get wallet address
    let walletAddress = trade.user || trade.maker || trade.taker || trade.wallet || '';

    // If no wallet address is found, we can't profile the trader
    if (!walletAddress && trade.transaction_hash) {
      // Fallback: Try to get wallet from transaction hash
      // console.log(`[Worker] Fetching wallet from tx ${trade.transaction_hash}...`);
      const { maker, taker } = await getWalletsFromTx(trade.transaction_hash);
      // Prefer taker as the active trader, but use maker if taker is null
      walletAddress = taker || maker || '';

      if (walletAddress) {
        // console.log(`[Worker] Found wallet ${walletAddress} from tx`);
      }
    }


    if (!walletAddress) {
      // console.log('[Worker] Trade missing wallet address, skipping profile enrichment');
      // We can still process the trade, but without wallet context
    }

    // Lookup market metadata
    const assetInfo = assetIdToOutcome.get(trade.asset_id);
    if (!assetInfo) {
      // console.warn(`[Worker] Unknown asset_id: ${trade.asset_id}`);
      return;
    }

    const marketMeta = marketsByCondition.get(assetInfo.conditionId);
    if (!marketMeta) {
      // console.warn(`[Worker] Unknown conditionId: ${assetInfo.conditionId}`);
      return;
    }

    // Determine side (BUY or SELL)
    const side = trade.side || (trade.type === 'buy' ? 'BUY' : 'SELL') || 'BUY';

    // Enrich with trader profile
    const profile = await getTraderProfile(walletAddress);

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
        timestamp: new Date(trade.timestamp || Date.now()),
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
      // Ensure wallet profile exists
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

      // Save trade
      await prisma.trade.create({
        data: {
          assetId: trade.asset_id,
          side,
          size,
          price,
          tradeValue: value,
          timestamp: new Date(),
          walletAddress: walletAddress.toLowerCase(),
          isWhale,
          isSmartMoney,
          isFresh,
          isSweeper,
          conditionId: assetInfo.conditionId,
          outcome: assetInfo.outcomeLabel,
          question: marketMeta.question,
          image: marketMeta.image,
        },
      });
    } catch (dbError) {
      console.error('[Worker] Database error:', dbError);
    }

    // Broadcast to Socket.io clients
    io.emit('trade', enrichedTrade);

    console.log(`[Worker] Processed trade: $${value.toFixed(2)} from ${walletAddress.slice(0, 8)}... (${enrichedTrade.analysis.tags.join(', ')})`);
  } catch (error) {
    console.error('[Worker] Error processing trade:', error);
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
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.event_type === 'last_trade_price' || parsed.event_type === 'trade') {
          const trades = Array.isArray(parsed) ? parsed : [parsed];

          trades.forEach((trade: any) => {
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
