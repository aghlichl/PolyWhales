import Redis from 'ioredis';
import { createPublicClient, http, decodeEventLog, parseAbi } from 'viem';
import { polygon } from 'viem/chains';
import { WalletEnrichmentResult } from './types';

// Initialize Redis with error handling
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: true, // Don't connect immediately
});

redis.on('error', (err) => {
  // console.warn('[Intelligence] Redis connection error:', err.message);
});

// Attempt to connect (will fail gracefully if Redis is not available)
redis.connect().catch(() => {
  console.warn('[Intelligence] Redis not available, caching disabled');
});

// Polygon RPC client for checking wallet freshness
export const publicClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
});


export interface TraderProfile {
  address: string;
  label: string | null;
  totalPnl: number;
  winRate: number;
  isFresh: boolean;
  isSmartMoney: boolean;
  isWhale: boolean;
  txCount: number;
  maxTradeValue: number;
  activityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

interface PolymarketPosition {
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  currentValue: number;
}

/**
 * Fetches trader profile from Polymarket Data API
 */
async function fetchTraderProfileFromAPI(address: string): Promise<Partial<TraderProfile>> {
  try {
    console.log(`[Intelligence] Fetching trader profile for ${address}`);
    const url = `https://data-api.polymarket.com/positions?user=${address}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[Intelligence] Failed to fetch positions for ${address}: ${response.statusText}`);
      return { totalPnl: 0, winRate: 0, isWhale: false };
    }

    const positions: PolymarketPosition[] = await response.json();

    if (!positions || positions.length === 0) {
      return { totalPnl: 0, winRate: 0, isWhale: false };
    }

    // Aggregate stats
    const totalPnl = positions.reduce((acc, pos) => acc + (pos.cashPnl || 0), 0);
    const winningPositions = positions.filter(p => (p.percentPnl || 0) > 0);
    const winRate = positions.length > 0 ? winningPositions.length / positions.length : 0;

    // Check if they have any large positions
    const isWhale = positions.some(p => (p.currentValue || 0) > 10000);

    // Determine label
    let label: string | null = null;
    if (totalPnl > 50000 && winRate > 0.60) {
      label = 'Smart Whale';
    } else if (totalPnl > 50000) {
      label = 'Whale';
    } else if (winRate > 0.60 && totalPnl > 0) {
      label = 'Smart Money';
    } else if (totalPnl < -10000) {
      label = 'Degen';
    }

    return {
      totalPnl,
      winRate,
      isWhale,
      isSmartMoney: totalPnl > 50000 && winRate > 0.60,
      label,
    };
  } catch (error) {
    console.error(`[Intelligence] Error fetching profile for ${address}:`, error);
    return { totalPnl: 0, winRate: 0, isWhale: false };
  }
}

/**
 * Checks if a wallet is "fresh" (< 10 transactions)
 */
async function checkWalletFreshness(address: `0x${string}`): Promise<number> {
  try {
    const txCount = await publicClient.getTransactionCount({
      address,
    });
    return txCount;
  } catch (error) {
    console.error(`[Intelligence] Error checking freshness for ${address}:`, error);
    return 0;
  }
}

/**
 * Gets trader profile with caching
 * Checks Redis first, then fetches from API if needed
 */
export async function getTraderProfile(address: string): Promise<TraderProfile> {
  const cacheKey = `wallet:${address.toLowerCase()}`;
  const cacheTTL = 24 * 60 * 60; // 24 hours

  try {
    // Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      const profile = JSON.parse(cached) as TraderProfile;
      return profile;
    }
  } catch (error) {
    // Cache miss or Redis error - continue to API fetch
    // This is expected if Redis is not available
  }

  // Cache miss - fetch from API
  const [apiProfile, txCount] = await Promise.all([
    fetchTraderProfileFromAPI(address),
    checkWalletFreshness(address as `0x${string}`),
  ]);

  // Determine activity level
  let activityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (txCount > 500) activityLevel = 'HIGH';
  else if (txCount > 50) activityLevel = 'MEDIUM';

  const profile: TraderProfile = {
    address: address.toLowerCase(),
    label: apiProfile.label || null,
    totalPnl: apiProfile.totalPnl || 0,
    winRate: apiProfile.winRate || 0,
    isFresh: txCount < 10,
    txCount,
    maxTradeValue: 0, // Will be updated by worker
    activityLevel,
    isSmartMoney: apiProfile.isSmartMoney || false,
    isWhale: apiProfile.isWhale || false,
  };

  // Cache in Redis
  try {
    await redis.setex(cacheKey, cacheTTL, JSON.stringify(profile));
  } catch (error) {
    // Silently fail if Redis is not available
  }

  return profile;
}

/**
 * Analyze market impact by checking if trade swept order book levels
 */
export async function analyzeMarketImpact(assetId: string, tradeSize: number, side: 'BUY' | 'SELL'): Promise<{
  isSweeper: boolean;
  liquidityAvailable: number;
  priceImpact: number;
}> {
  try {
    const url = `https://clob.polymarket.com/book?token_id=${assetId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return { isSweeper: false, liquidityAvailable: 0, priceImpact: 0 };
    }

    const book = await response.json();
    const levels = side === 'BUY' ? book.asks : book.bids;

    if (!levels || !Array.isArray(levels)) {
      return { isSweeper: false, liquidityAvailable: 0, priceImpact: 0 };
    }

    let accumulatedLiquidity = 0;
    let levelsSwept = 0;
    let priceImpact = 0;
    const initialPrice = levels[0]?.price ? parseFloat(levels[0].price) : 0;

    for (const level of levels) {
      const levelSize = parseFloat(level.size || '0');
      const levelPrice = parseFloat(level.price || '0');

      accumulatedLiquidity += levelSize;
      levelsSwept++;

      if (accumulatedLiquidity >= tradeSize) {
        // Trade was absorbed within this liquidity
        priceImpact = initialPrice > 0 ? Math.abs((levelPrice - initialPrice) / initialPrice) * 100 : 0;
        break;
      }
    }

    // If trade size exceeds all available liquidity, it's definitely a sweeper
    const isSweeper = accumulatedLiquidity < tradeSize || levelsSwept > 3;

    return {
      isSweeper,
      liquidityAvailable: accumulatedLiquidity,
      priceImpact,
    };
  } catch (error) {
    console.error(`[Intelligence] Error analyzing market impact for ${assetId}:`, error);
    return { isSweeper: false, liquidityAvailable: 0, priceImpact: 0 };
  }
}

// OrderFilled event ABI from Polymarket CTF Exchange contract
// Event signature: 0xd0a08e8c493f9c94f29311604c9de1b4e8c8d4c06bd0c789af57f2d65bfec0f6
const ORDER_FILLED_ABI = parseAbi([
  'event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled, uint256 fee)'
]);

const ORDER_FILLED_EVENT_SIGNATURE = '0xd0a08e8c493f9c94f29311604c9de1b4e8c8d4c06bd0c789af57f2d65bfec0f6';

/**
 * Extended result from transaction log parsing with additional metadata
 */
export interface TxLogWalletResult {
  maker: string | null;
  taker: string | null;
  blockNumber: bigint | null;
  logIndex: number | null;
}

/**
 * Extracts wallet addresses from transaction logs using proper ABI decoding
 * Looks for OrderFilled events and decodes them using viem
 */
export async function getWalletsFromTx(txHash: string): Promise<TxLogWalletResult> {
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    // Find all OrderFilled events in the transaction
    const orderFilledLogs = receipt.logs.filter(log =>
      log.topics[0] === ORDER_FILLED_EVENT_SIGNATURE
    );

    if (orderFilledLogs.length === 0) {
      return { maker: null, taker: null, blockNumber: null, logIndex: null };
    }

    // Use the first OrderFilled event (most transactions have one, if multiple, first is usually the primary)
    const log = orderFilledLogs[0];

    try {
      // Decode the event using viem's proper ABI decoding
      const decoded = decodeEventLog({
        abi: ORDER_FILLED_ABI,
        data: log.data,
        topics: log.topics,
      });

      // Extract maker and taker from decoded args
      const args = decoded.args as {
        orderHash: `0x${string}`;
        maker: `0x${string}`;
        taker: `0x${string}`;
        makerAssetId: bigint;
        takerAssetId: bigint;
        makerAmountFilled: bigint;
        takerAmountFilled: bigint;
        fee: bigint;
      };

      return {
        maker: args.maker?.toLowerCase() || null,
        taker: args.taker?.toLowerCase() || null,
        blockNumber: receipt.blockNumber,
        logIndex: log.logIndex,
      };
    } catch (decodeError) {
      // Fallback to manual topic parsing if ABI decoding fails
      console.warn(`[Intelligence] ABI decode failed for ${txHash}, using fallback:`, decodeError);

      // Topics: [0]=eventSig, [1]=orderHash, [2]=maker, [3]=taker
      const maker = log.topics[2] ? `0x${log.topics[2].slice(26)}`.toLowerCase() : null;
      const taker = log.topics[3] ? `0x${log.topics[3].slice(26)}`.toLowerCase() : null;

      return {
        maker,
        taker,
        blockNumber: receipt.blockNumber,
        logIndex: log.logIndex,
      };
    }
  } catch (error) {
    console.error(`[Intelligence] Error fetching tx ${txHash}:`, error);
    return { maker: null, taker: null, blockNumber: null, logIndex: null };
  }
}




