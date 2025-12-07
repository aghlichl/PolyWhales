import { MarketMeta, AssetOutcome, PolymarketMarket, DataAPITrade, DataAPIActivity, WalletEnrichmentResult, Anomaly, AnomalyType } from './types';
import { CONFIG } from './config';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function normalizeMarketResponse(data: any): PolymarketMarket[] {
    if (Array.isArray(data)) {
        return data;
    } else if (data && Array.isArray(data.data)) {
        return data.data;
    } else {
        console.error('Unexpected markets payload shape:', JSON.stringify(data, null, 2));
        return [];
    }
}

// Simple in-memory cache
let marketsCache: {
    data: PolymarketMarket[];
    timestamp: number;
} | null = null;

const CACHE_TTL = CONFIG.CONSTANTS.METADATA_REFRESH_INTERVAL; // 5 minutes

export async function fetchMarketsFromGamma(init?: RequestInit): Promise<PolymarketMarket[]> {
    // Check cache first
    if (marketsCache && (Date.now() - marketsCache.timestamp < CACHE_TTL)) {
        return marketsCache.data;
    }

    const response = await fetch(CONFIG.URLS.GAMMA_API, {
        ...init,
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'OddsGods/1.0',
            ...init?.headers
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }

    const data = await response.json();
    const normalizedData = normalizeMarketResponse(data);

    // Update cache
    marketsCache = {
        data: normalizedData,
        timestamp: Date.now()
    };

    return normalizedData;
}

export function parseMarketData(markets: PolymarketMarket[]): {
    marketsByCondition: Map<string, MarketMeta>;
    assetIdToOutcome: Map<string, AssetOutcome>;
    allAssetIds: string[];
} {
    const marketsByCondition = new Map<string, MarketMeta>();
    const assetIdToOutcome = new Map<string, AssetOutcome>();
    const allAssetIds: string[] = [];

    markets.forEach(market => {
        if (!market.conditionId || !market.clobTokenIds || !market.outcomes) return;

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

            const event = market.events && market.events.length > 0 ? market.events[0] : undefined;
            const eventTitle = event?.title || 'Unknown Event';

            // Extract image URL (prioritize twitterCardImage > image > icon)
            // Check market level first, then event level
            let imageUrl = market.twitterCardImage || market.image || market.icon;

            if (!imageUrl && event) {
                imageUrl = event.image || event.icon;
            }

            // Numeric helpers
            const numOrNull = (val: any): number | null => {
                if (val === undefined || val === null) return null;
                const n = Number(val);
                return Number.isFinite(n) ? n : null;
            };

            // Tags
            const tagIds = Array.isArray(market.tags) ? market.tags.map((t: any) => t.id).filter(Boolean) : [];
            const tagNames = Array.isArray(market.tags) ? market.tags.map((t: any) => t.name || t.slug).filter(Boolean) : [];

            const meta: MarketMeta = {
                conditionId: market.conditionId,
                eventId: event?.id || '',
                eventTitle,
                question: market.question,
                marketType: market.marketType,
                outcomes,
                clobTokenIds: tokenIds,
                image: imageUrl ?? null,
                outcomePrices: typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices,
                closed: market.closed,
                category: market.category,
                formatType: market.formatType,
                feeBps: numOrNull((market as any).fee),
                denominationToken: market.denominationToken || null,
                liquidity: numOrNull(market.liquidity),
                volume24h: numOrNull((market as any).volume24hr ?? (market as any).volume24h),
                openTime: (market as any).openTime || null,
                closeTime: (market as any).endDate || null,
                resolutionTime: market.resolutionTime || null,
                resolutionSource: market.resolutionSource || null,
                sponsor: market.sponsor || null,
                tagIds: tagIds.length ? tagIds : undefined,
                tagNames: tagNames.length ? tagNames : undefined,
                sport: event?.sport || null,
                league: event?.league || null,
                eventSlug: event?.slug || null,
                eventStartTime: event?.startTime || null,
                eventEndTime: event?.endTime || null,
                eventImage: event?.image || event?.icon || null,
                relatedMarketIds: Array.isArray(market.relatedMarkets) ? market.relatedMarkets : undefined,
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
        } catch {
            // console.warn(`Error parsing market ${market.conditionId}:`, error);
        }
    });

    return { marketsByCondition, assetIdToOutcome, allAssetIds };
}

type ParsedMarketCache = {
    marketsByCondition: Map<string, MarketMeta>;
    assetIdToOutcome: Map<string, AssetOutcome>;
    allAssetIds: string[];
    fetchedAt: number;
};

let parsedMarketCache: ParsedMarketCache | null = null;

const isCacheFresh = (cache: { fetchedAt: number } | null): boolean => {
    if (!cache) return false;
    return (Date.now() - cache.fetchedAt) < CACHE_TTL;
};

export function getCachedMarketMetadata(): ParsedMarketCache | null {
    if (isCacheFresh(parsedMarketCache)) {
        return parsedMarketCache;
    }
    return null;
}

export async function getMarketMetadata(init?: RequestInit): Promise<ParsedMarketCache> {
    if (isCacheFresh(parsedMarketCache)) {
        return parsedMarketCache!;
    }

    const markets = await fetchMarketsFromGamma(init);
    const parsed = parseMarketData(markets);

    parsedMarketCache = {
        ...parsed,
        fetchedAt: Date.now()
    };

    return parsedMarketCache;
}

/**
 * Query parameters for Data-API /trades endpoint
 */
export interface DataAPITradeQuery {
    asset_id?: string;
    maker?: string;
    after?: number;  // Unix timestamp in seconds
    before?: number; // Unix timestamp in seconds
    limit?: number;
}

/**
 * Fetches trades from Polymarket Data-API /trades endpoint
 * Rate limit: 75 requests per 10 seconds
 */
export async function fetchTradesFromDataAPI(params: DataAPITradeQuery): Promise<DataAPITrade[]> {
    try {
        const url = new URL(CONFIG.URLS.DATA_API_TRADES);

        if (params.asset_id) url.searchParams.set('asset_id', params.asset_id);
        if (params.maker) url.searchParams.set('maker', params.maker);
        if (params.after) url.searchParams.set('after', params.after.toString());
        if (params.before) url.searchParams.set('before', params.before.toString());
        if (params.limit) url.searchParams.set('limit', params.limit.toString());

        const response = await fetch(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'OddsGods/1.0',
            }
        });

        if (!response.ok) {
            console.warn(`[DataAPI] Failed to fetch trades: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('[DataAPI] Error fetching trades:', error);
        return [];
    }
}

// Query parameters for Data-API /activity endpoint
export interface DataAPIActivityQuery {
    user: string; // Wallet address (required) - may be user or proxy wallet
    limit?: number;
    offset?: number;
    market?: string; // conditionId
    eventId?: string;
    type?: 'TRADE' | 'SPLIT' | 'MERGE' | 'REDEEM' | 'REWARD' | 'CONVERSION';
    side?: 'BUY' | 'SELL';
    sortBy?: 'TIMESTAMP' | 'SIZE' | 'PRICE';
    sortDirection?: 'ASC' | 'DESC';
    start?: number; // Unix timestamp
    end?: number;   // Unix timestamp
}

/**
 * Attempts to resolve proxy wallet address for a user address
 * Polymarket uses proxy wallets (1-of-1 multisigs) for trading
 */
export async function resolveProxyWallet(userAddress: string): Promise<string | null> {
    try {
        // First, try fetching positions to see if we can get proxy wallet info
        const positionsUrl = `https://data-api.polymarket.com/positions?user=${userAddress}`;
        const response = await fetch(positionsUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'OddsGods/1.0',
            }
        });

        if (!response.ok) {
            return null;
        }

        const positions = await response.json();
        if (!Array.isArray(positions) || positions.length === 0) {
            return null;
        }

        // Check if any position has proxy wallet info
        // Some Polymarket APIs might include proxy wallet in position data
        // For now, if positions exist, the user address might work directly
        return userAddress; // Assume user address works, proxy resolution can be added later

    } catch (error) {
        console.warn('[DataAPI] Error resolving proxy wallet:', error);
        return null;
    }
}

/**
 * Fetches user activity from Polymarket Data-API /activity endpoint
 * Rate limit: 75 requests per 10 seconds
 */
export async function fetchActivityFromDataAPI(params: DataAPIActivityQuery): Promise<DataAPIActivity[]> {
    try {
        // First try with the provided user address
        const userAddress = params.user;
        let activities = await fetchActivityWithAddress(userAddress, params);

        // If no activities found, try to resolve proxy wallet
        if (activities.length === 0) {
            const proxyWallet = await resolveProxyWallet(userAddress);
            if (proxyWallet && proxyWallet !== userAddress) {
                console.log(`[DataAPI] Retrying with proxy wallet for ${userAddress.slice(0, 8)}...`);
                activities = await fetchActivityWithAddress(proxyWallet, { ...params, user: proxyWallet });
            }
        }

        return activities;
    } catch (error) {
        console.error('[DataAPI] Error fetching activity:', error);
        return [];
    }
}

/**
 * Internal function to fetch activity with a specific address
 */
async function fetchActivityWithAddress(userAddress: string, params: DataAPIActivityQuery): Promise<DataAPIActivity[]> {
    const url = new URL('https://data-api.polymarket.com/activity');

    // Required parameter
    url.searchParams.set('user', userAddress);

    // Optional parameters
    if (params.limit) url.searchParams.set('limit', params.limit.toString());
    if (params.offset) url.searchParams.set('offset', params.offset.toString());
    if (params.market) url.searchParams.set('market', params.market);
    if (params.eventId) url.searchParams.set('eventId', params.eventId);
    if (params.type) url.searchParams.set('type', params.type);
    if (params.side) url.searchParams.set('side', params.side);
    if (params.sortBy) url.searchParams.set('sortBy', params.sortBy);
    if (params.sortDirection) url.searchParams.set('sortDirection', params.sortDirection);
    if (params.start) url.searchParams.set('start', params.start.toString());
    if (params.end) url.searchParams.set('end', params.end.toString());

    const response = await fetch(url.toString(), {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'OddsGods/1.0',
        }
    });

    if (!response.ok) {
        console.warn(`[DataAPI] Failed to fetch activity: ${response.status} ${response.statusText}`);
        return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

/**
 * Fetches closed positions for a user
 */
export interface ClosedPosition {
    asset: string;
    conditionId: string;
    payout: number;
    buyPrice: number;
    sellPrice: number;
    amount: number;
    timestamp: number;
    transactionHash: string;
    realizedPnl: number;
}

export async function fetchClosedPositions(userAddress: string): Promise<ClosedPosition[]> {
    try {
        const url = `https://data-api.polymarket.com/closed-positions?user=${userAddress}`;
        const response = await fetch(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'OddsGods/1.0',
            }
        });

        if (!response.ok) {
            console.warn(`[DataAPI] Failed to fetch closed positions: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('[DataAPI] Error fetching closed positions:', error);
        return [];
    }
}

/**
 * Input for trade enrichment - matches our Trade model fields
 */
export interface TradeForEnrichment {
    assetId: string;
    price: number;
    size: number;
    timestamp: Date;
    transactionHash?: string | null;
}

/**
 * Enriches a trade with wallet identity from Data-API
 * 
 * Matching strategy:
 * 1. If transactionHash exists, match directly by hash
 * 2. Otherwise, query by asset_id + time window + price/size tolerance
 */
export async function enrichTradeWithDataAPI(trade: TradeForEnrichment): Promise<WalletEnrichmentResult | null> {
    try {
        const timestampSec = Math.floor(trade.timestamp.getTime() / 1000);
        const timeWindow = Math.floor(CONFIG.ENRICHMENT.TIME_WINDOW_MS / 1000);

        // Query Data-API with time window around our trade
        const trades = await fetchTradesFromDataAPI({
            asset_id: trade.assetId,
            after: timestampSec - timeWindow,
            before: timestampSec + timeWindow,
            limit: 100, // Get a batch to search through
        });

        if (trades.length === 0) {
            return null;
        }

        // Strategy 1: Direct match by transaction hash (most reliable)
        if (trade.transactionHash) {
            const exactMatch = trades.find(t =>
                t.transaction_hash?.toLowerCase() === trade.transactionHash?.toLowerCase()
            );

            if (exactMatch) {
                return {
                    walletAddress: exactMatch.owner || exactMatch.maker_address,
                    maker: exactMatch.maker_address,
                    taker: exactMatch.owner,
                    source: 'data-api',
                };
            }
        }

        // Strategy 2: Match by price/size/timestamp proximity
        const priceTolerance = CONFIG.ENRICHMENT.PRICE_TOLERANCE;
        const sizeTolerance = CONFIG.ENRICHMENT.SIZE_TOLERANCE;

        const matchingTrades = trades.filter(apiTrade => {
            const apiPrice = parseFloat(apiTrade.price);
            const apiSize = parseFloat(apiTrade.size);
            const apiTimestamp = new Date(apiTrade.match_time).getTime();

            // Check price within tolerance
            const priceMatch = Math.abs(apiPrice - trade.price) / trade.price <= priceTolerance;

            // Check size within tolerance  
            const sizeMatch = Math.abs(apiSize - trade.size) / trade.size <= sizeTolerance;

            // Check timestamp within window
            const timestampMatch = Math.abs(apiTimestamp - trade.timestamp.getTime()) <= CONFIG.ENRICHMENT.TIME_WINDOW_MS;

            return priceMatch && sizeMatch && timestampMatch;
        });

        if (matchingTrades.length === 0) {
            return null;
        }

        // If multiple matches, pick the one closest in timestamp
        const bestMatch = matchingTrades.reduce((best, current) => {
            const bestTimeDiff = Math.abs(new Date(best.match_time).getTime() - trade.timestamp.getTime());
            const currentTimeDiff = Math.abs(new Date(current.match_time).getTime() - trade.timestamp.getTime());
            return currentTimeDiff < bestTimeDiff ? current : best;
        });

        return {
            walletAddress: bestMatch.owner || bestMatch.maker_address,
            maker: bestMatch.maker_address,
            taker: bestMatch.owner,
            source: 'data-api',
        };
    } catch (error) {
        console.error('[DataAPI] Error enriching trade:', error);
        return null;
    }
}

// Placeholder holder concentration cache (filled by future Data-API integration)
export interface HolderMetrics {
    top5Share: number | null;
    top10Share: number | null;
    holderCount: number | null;
    smartHolderCount: number | null;
    fetchedAt: number;
}

const holderCache = new Map<string, HolderMetrics>();

export function getCachedHolderMetrics(assetId: string): HolderMetrics | null {
    const cached = holderCache.get(assetId);
    if (!cached) return null;
    // simple TTL: 10 minutes
    if (Date.now() - cached.fetchedAt > 10 * 60 * 1000) {
        holderCache.delete(assetId);
        return null;
    }
    return cached;
}

export function setCachedHolderMetrics(assetId: string, metrics: HolderMetrics) {
    holderCache.set(assetId, metrics);
}

export function deriveAnomalyType(value: number): AnomalyType {
    if (value >= CONFIG.THRESHOLDS.GOD_WHALE) return 'GOD_WHALE';
    if (value >= CONFIG.THRESHOLDS.SUPER_WHALE) return 'SUPER_WHALE';
    if (value >= CONFIG.THRESHOLDS.MEGA_WHALE) return 'MEGA_WHALE';
    if (value >= CONFIG.THRESHOLDS.WHALE) return 'WHALE';
    return 'STANDARD';
}

export function deriveWhaleTags(value: number): string[] {
    const tags: string[] = [];
    if (value >= CONFIG.THRESHOLDS.GOD_WHALE) tags.push('GOD_WHALE');
    if (value >= CONFIG.THRESHOLDS.SUPER_WHALE) tags.push('SUPER_WHALE');
    if (value >= CONFIG.THRESHOLDS.MEGA_WHALE) tags.push('MEGA_WHALE');
    if (value >= CONFIG.THRESHOLDS.WHALE) tags.push('WHALE');
    return tags;
}

type AnalysisTagOptions = {
    value: number;
    isSmartMoney?: boolean;
    isFresh?: boolean;
    isSweeper?: boolean;
    isInsider?: boolean;
    additionalTags?: string[];
};

export function buildAnalysisTags(options: AnalysisTagOptions): string[] {
    const {
        value,
        isSmartMoney = false,
        isFresh = false,
        isSweeper = false,
        isInsider = false,
        additionalTags = [],
    } = options;

    const tags = [
        ...deriveWhaleTags(value),
        isSmartMoney && 'SMART_MONEY',
        isFresh && 'FRESH_WALLET',
        isSweeper && 'SWEEPER',
        isInsider && 'INSIDER',
        ...additionalTags,
    ].filter(Boolean) as string[];

    return Array.from(new Set(tags));
}

export type TradeWithProfile = {
    id: string;
    tradeValue: number;
    price: number;
    side: string | null;
    timestamp: Date | string | number;
    conditionId?: string | null;
    image?: string | null;
    walletAddress?: string | null;
    walletProfile?: {
        id?: string | null;
        label?: string | null;
        totalPnl?: number | null;
        winRate?: number | null;
        isFresh?: boolean | null;
        txCount?: number | null;
        maxTradeValue?: number | null;
        activityLevel?: string | null;
    } | null;
    tags?: string[] | null;
    marketCategory?: string | null;
    sport?: string | null;
    league?: string | null;
    feeBps?: number | null;
    liquidity?: number | null;
    volume24h?: number | null;
    closeTime?: Date | string | null;
    openTime?: Date | string | null;
    resolutionTime?: Date | string | null;
    resolutionSource?: string | null;
    denominationToken?: string | null;
    marketDepthBucket?: string | null;
    timeToCloseBucket?: string | null;
    eventId?: string | null;
    eventTitle?: string | null;
    eventSlug?: string | null;
    holderTop5Share?: number | null;
    holderTop10Share?: number | null;
    holderCount?: number | null;
    smartHolderCount?: number | null;
    question?: string | null;
    outcome?: string | null;
    isSmartMoney?: boolean | null;
    isFresh?: boolean | null;
    isSweeper?: boolean | null;
    isWhale?: boolean | null;
};

const toIsoString = (value?: string | Date | null): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export interface TradeToAnomalyOptions {
    marketsByCondition?: Map<string, MarketMeta>;
}

export function tradeToAnomaly(
    trade: TradeWithProfile,
    options: TradeToAnomalyOptions = {}
): Anomaly {
    const marketsByCondition = options.marketsByCondition || getCachedMarketMetadata()?.marketsByCondition;
    const marketMeta = trade.conditionId && marketsByCondition
        ? marketsByCondition.get(trade.conditionId)
        : undefined;

    const price = Number(trade.price ?? 0);
    const value = Number(trade.tradeValue ?? 0);
    const timestampMs = trade.timestamp instanceof Date
        ? trade.timestamp.getTime()
        : new Date(trade.timestamp || Date.now()).getTime();

    const marketContext = {
        category: marketMeta?.category ?? trade.marketCategory ?? null,
        sport: marketMeta?.sport ?? trade.sport ?? null,
        league: marketMeta?.league ?? trade.league ?? null,
        feeBps: marketMeta?.feeBps ?? trade.feeBps ?? null,
        liquidity: marketMeta?.liquidity ?? trade.liquidity ?? null,
        volume24h: marketMeta?.volume24h ?? trade.volume24h ?? null,
        closeTime: marketMeta?.closeTime || toIsoString(trade.closeTime),
        openTime: marketMeta?.openTime || toIsoString(trade.openTime),
        resolutionTime: marketMeta?.resolutionTime || toIsoString(trade.resolutionTime),
        resolutionSource: marketMeta?.resolutionSource || trade.resolutionSource || null,
        denominationToken: marketMeta?.denominationToken || trade.denominationToken || null,
        liquidity_bucket: trade.marketDepthBucket ?? null,
        time_to_close_bucket: trade.timeToCloseBucket ?? null,
    };

    const eventContext = {
        id: trade.eventId || marketMeta?.eventId || undefined,
        title: trade.eventTitle || marketMeta?.eventTitle || undefined,
        slug: trade.eventSlug || marketMeta?.eventSlug || null,
    };

    const hasCrowdingData = [
        trade.holderTop5Share,
        trade.holderTop10Share,
        trade.holderCount,
        trade.smartHolderCount,
    ].some((v) => v !== undefined && v !== null);

    const crowdingContext = hasCrowdingData ? {
        top5_share: trade.holderTop5Share ?? null,
        top10_share: trade.holderTop10Share ?? null,
        holder_count: trade.holderCount ?? null,
        smart_holder_count: trade.smartHolderCount ?? null,
        label: trade.holderTop5Share ? 'crowding' : null,
    } : undefined;

    const walletAddress = (trade.walletProfile?.id || trade.walletAddress || '').trim();
    const walletLabel = trade.walletProfile?.label?.trim();

    const walletContext = walletAddress ? {
        address: walletAddress,
        label: walletLabel || walletAddress,
        pnl_all_time: `$${(trade.walletProfile?.totalPnl || 0).toLocaleString()}`,
        win_rate: `${((trade.walletProfile?.winRate || 0) * 100).toFixed(0)}%`,
        is_fresh_wallet: trade.walletProfile?.isFresh ?? false,
    } : undefined;

    const traderContext = trade.walletProfile ? {
        tx_count: trade.walletProfile.txCount ?? 0,
        max_trade_value: trade.walletProfile.maxTradeValue ?? 0,
        activity_level: trade.walletProfile.activityLevel ?? null,
    } : undefined;

    const isInsider = (trade.walletProfile?.activityLevel === 'LOW'
        && (trade.walletProfile?.winRate || 0) > 0.7
        && (trade.walletProfile?.totalPnl || 0) > 10000);

    const analysisTags = buildAnalysisTags({
        value,
        isSmartMoney: !!trade.isSmartMoney,
        isFresh: !!trade.isFresh,
        isSweeper: !!trade.isSweeper,
        isInsider,
        additionalTags: trade.tags || [],
    });

    const image = marketMeta?.image || trade.image || undefined;

    return {
        id: trade.id,
        type: deriveAnomalyType(value),
        event: trade.question || 'Unknown Market',
        outcome: trade.outcome || 'Unknown',
        odds: Math.round(price * 100),
        value,
        timestamp: timestampMs,
        side: (trade.side as 'BUY' | 'SELL') || 'BUY',
        image,
        category: marketContext.category,
        sport: marketContext.sport,
        league: marketContext.league,
        feeBps: marketContext.feeBps,
        liquidity: marketContext.liquidity,
        volume24h: marketContext.volume24h,
        closeTime: marketContext.closeTime,
        openTime: marketContext.openTime,
        resolutionTime: marketContext.resolutionTime,
        resolutionSource: marketContext.resolutionSource,
        denominationToken: marketContext.denominationToken,
        liquidity_bucket: marketContext.liquidity_bucket,
        time_to_close_bucket: marketContext.time_to_close_bucket,
        eventId: eventContext.id || null,
        eventTitle: eventContext.title || null,
        tags: trade.tags || [],
        wallet_context: walletContext,
        trader_context: traderContext,
        crowding: crowdingContext,
        analysis: {
            tags: analysisTags,
            event: eventContext,
            market_context: marketContext,
            crowding: crowdingContext,
        },
    };
}
