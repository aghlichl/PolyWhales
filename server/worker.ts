import 'dotenv/config';
import { prisma } from '../lib/prisma';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import WebSocket from 'ws';
import { getTraderProfile, analyzeMarketImpact } from '../lib/intelligence';

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

httpServer.listen(3001, () => {
  // console.log('[Worker] Socket.io server listening on port 3001');
});

// Market metadata cache
interface MarketMeta {
  conditionId: string;
  eventId: string;
  eventTitle: string;
  question: string;
  marketType: string;
  outcomes: string[];
  clobTokenIds: string[];
}

const marketsByCondition = new Map<string, MarketMeta>();
const assetIdToOutcome = new Map<string, { outcomeLabel: string; conditionId: string }>();

interface PolymarketMarket {
  conditionId: string;
  question: string;
  marketType: string;
  outcomes: string | string[];
  clobTokenIds: string | string[];
  events: {
    id: string;
    title: string;
  }[];
}

/**
 * Fetch market metadata from Polymarket API
 */
async function fetchMarketMetadata(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:3000/api/proxy/polymarket/markets');
    if (!response.ok) throw new Error('Failed to fetch metadata');

    const data = await response.json();

    // Check if markets is directly an array
    let markets: PolymarketMarket[];
    if (Array.isArray(data)) {
      markets = data;
    } else if (Array.isArray(data.data)) {
      markets = data.data;
    } else {
      console.error('[Worker] Unexpected markets payload shape:', JSON.stringify(data, null, 2));
      return [];
    }

    const allAssetIds: string[] = [];
    let totalMarkets = markets.length;
    let filteredOut = 0;

    markets.forEach(market => {
      if (!market.conditionId || !market.clobTokenIds || !market.outcomes) {
        filteredOut++;
        return;
      }

      let tokenIds: string[] = [];
      let outcomes: string[] = [];

      try {
        if (Array.isArray(market.clobTokenIds)) {
          tokenIds = market.clobTokenIds;
        } else if (typeof market.clobTokenIds === 'string') {
          tokenIds = JSON.parse(market.clobTokenIds);
        }

        if (Array.isArray(market.outcomes)) {
          outcomes = market.outcomes;
        } else if (typeof market.outcomes === 'string') {
          outcomes = JSON.parse(market.outcomes);
        }

        const eventTitle = market.events && market.events.length > 0 ? market.events[0].title : 'Unknown Event';
        
        const meta: MarketMeta = {
          conditionId: market.conditionId,
          eventId: market.events && market.events.length > 0 ? market.events[0].id : '',
          eventTitle,
          question: market.question,
          marketType: market.marketType,
          outcomes,
          clobTokenIds: tokenIds
        };

        marketsByCondition.set(market.conditionId, meta);

        if (tokenIds && Array.isArray(tokenIds) && outcomes && Array.isArray(outcomes)) {
          tokenIds.forEach((assetId, index) => {
            const outcomeLabel = outcomes[index] || 'Unknown';
            assetIdToOutcome.set(assetId, {
              outcomeLabel,
              conditionId: market.conditionId
            });
            allAssetIds.push(assetId);
          });
        }
      } catch (error) {
        console.warn(`[Worker] Error parsing market ${market.conditionId}:`, error);
      }
    });

    console.log(`[Worker] Mapped ${marketsByCondition.size} markets and ${assetIdToOutcome.size} assets (filtered ${filteredOut}/${totalMarkets} markets)`);
    return allAssetIds;
  } catch (error) {
    console.error('[Worker] Error fetching metadata:', error);
    return [];
  }
}

/**
 * Process and enrich a trade
 */
async function processTrade(trade: any) {
  try {
    if (!trade.price || !trade.size || !trade.asset_id) return;

    const price = Number(trade.price);
    const size = Number(trade.size);
    const value = price * size;

    // Filter noise (< $1,000)
    if (value < 1000) return;

    // Filter out very likely outcomes (price > 97% = odds > 97)
    if (price > 0.97) return;

    // Get wallet address (may be in different fields)
    // Note: Polymarket WebSocket may not always include wallet address
    // In production, you might need to query the CLOB API for full trade details
    let walletAddress = trade.user || trade.maker || trade.taker || trade.wallet || '';

    // TEMPORARY: Use mock wallet addresses for demo purposes
    // Remove this when we implement proper wallet address fetching
    if (!walletAddress) {
      const mockWallets = [
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44f',
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44a',
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44b',
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44c'
      ];
      walletAddress = mockWallets[Math.floor(Math.random() * mockWallets.length)];
      // console.log(`[Worker] Using mock wallet ${walletAddress} for asset ${trade.asset_id}`);
    }

    // Lookup market metadata
    const assetInfo = assetIdToOutcome.get(trade.asset_id);
    if (!assetInfo) {
      console.warn(`[Worker] Unknown asset_id: ${trade.asset_id}`);
      return;
    }

    const marketMeta = marketsByCondition.get(assetInfo.conditionId);
    if (!marketMeta) {
      console.warn(`[Worker] Unknown conditionId: ${assetInfo.conditionId}`);
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
        ].filter(Boolean) as string[],
        wallet_context: {
          label: profile.label || 'Unknown',
          pnl_all_time: `$${profile.totalPnl.toLocaleString()}`,
          win_rate: `${(profile.winRate * 100).toFixed(0)}%`,
          is_fresh_wallet: isFresh,
        },
        market_impact: {
          swept_levels: impact.isSweeper ? 3 : 0,
          slippage_induced: `${impact.priceImpact.toFixed(2)}%`,
        },
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
          lastUpdated: new Date(),
        },
        create: {
          id: walletAddress.toLowerCase(),
          label: profile.label || null,
          totalPnl: profile.totalPnl,
          winRate: profile.winRate,
          isFresh: profile.isFresh,
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
    const assetIds = await fetchMarketMetadata();
    if (assetIds.length === 0) {
      console.warn('[Worker] No assets found, retrying in 5s...');
      setTimeout(connect, 5000);
      return;
    }

    ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

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
      }, 30000);

      // Refresh metadata every 5 minutes
      setInterval(async () => {
        // console.log('[Worker] Refreshing metadata...');
        const latestAssetIds = await fetchMarketMetadata();
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'market',
            assets_ids: latestAssetIds,
            channel: 'trades',
          }));
        }
      }, 5 * 60 * 1000);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(data.toString());

        // Log all incoming messages for debugging
        // console.log('[Worker] Received message:', parsed.event_type || 'unknown');

        if (parsed.event_type === 'last_trade_price' || parsed.event_type === 'trade') {
          // Trades can be in an array or single object
          const trades = Array.isArray(parsed) ? parsed : [parsed];

          // console.log(`[Worker] Processing ${trades.length} trades from ${parsed.event_type}`);
          trades.forEach((trade: any) => {
            // Only process if it's actually a trade object with required fields
            if (trade.price && trade.size && trade.asset_id) {
              processTrade(trade).catch(console.error);
            } else {
              // console.log('[Worker] Skipping trade - missing required fields:', trade);
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
// console.log('[Worker] Starting Polymarket Intelligence Worker...');
connectToPolymarket();

