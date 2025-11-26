import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchActivityFromDataAPI, fetchMarketsFromGamma, parseMarketData } from '@/lib/polymarket';

// Simple in-memory caches
let marketCache: { data: Map<string, any>; timestamp: number } | null = null;
const MARKET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let walletCache: { [key: string]: { data: any[]; timestamp: number } } = {};
const WALLET_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const question = searchParams.get('question');
    const outcome = searchParams.get('outcome');
    const walletAddress = searchParams.get('walletAddress');
    const tradeTimestamp = searchParams.get('tradeTimestamp');

    if (!question || !outcome) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    try {
        // Fetch market metadata for conditionId -> market name mapping (with cache)
        let marketsByCondition = new Map<string, any>();
        try {
            if (!marketCache || Date.now() - marketCache.timestamp > MARKET_CACHE_TTL) {
                const markets = await fetchMarketsFromGamma();
                const result = parseMarketData(markets);
                marketCache = { data: result.marketsByCondition, timestamp: Date.now() };
            }
            marketsByCondition = marketCache.data;
        } catch (metaError) {
            console.warn('[MarketHistory] Failed to fetch market metadata:', metaError);
            // Use stale cache if available
            if (marketCache) marketsByCondition = marketCache.data;
        }

        // 1. Fetch Price History (trades within time window of the trade)
        const whereClause: any = {
            question: question,
            outcome: outcome,
        };
        let takeLimit = 100;

        // If we have a trade timestamp, fetch trades around that time
        if (tradeTimestamp) {
            const tradeTime = new Date(parseInt(tradeTimestamp));
            const windowHours = 24; // 24 hour window around the trade
            const startTime = new Date(tradeTime.getTime() - (windowHours / 2) * 60 * 60 * 1000);
            const endTime = new Date(tradeTime.getTime() + (windowHours / 2) * 60 * 60 * 1000);

            whereClause.timestamp = {
                gte: startTime,
                lte: endTime,
            };
            takeLimit = 500; // Allow more trades within the time window
        }

        const priceHistory = await prisma.trade.findMany({
            where: whereClause,
            orderBy: {
                timestamp: 'desc',
            },
            take: takeLimit,
            select: {
                timestamp: true,
                price: true,
                tradeValue: true,
                side: true,
            },
        });

        // 2. Fetch Wallet History from Polymarket Data-API instead of DB
        let walletHistory: Array<{
            timestamp: Date;
            question: string;
            outcome: string;
            side: string;
            price: number;
            tradeValue: number;
            conditionId?: string;
        }> = [];

        if (walletAddress) {
            try {
                // Check cache first
                let activities;
                const cached = walletCache[walletAddress];
                if (cached && Date.now() - cached.timestamp < WALLET_CACHE_TTL) {
                    activities = cached.data;
                } else {
                    // Fetch fresh data
                    activities = await fetchActivityFromDataAPI({
                        user: walletAddress,
                        type: 'TRADE', // Only trade activities
                        limit: 50, // Last 50 trades
                        sortBy: 'TIMESTAMP',
                        sortDirection: 'DESC',
                    });
                    walletCache[walletAddress] = { data: activities, timestamp: Date.now() };
                }

                // Transform to match our expected format
                walletHistory = activities.map(activity => {
                    // Try to get market name from conditionId
                    const marketMeta = marketsByCondition.get(activity.conditionId);
                    const marketName = marketMeta?.question || activity.market || 'Unknown Market';

                    return {
                        timestamp: new Date(activity.timestamp * 1000), // Convert unix to Date
                        question: marketName,
                        outcome: activity.outcome || 'Unknown',
                        side: activity.side,
                        price: parseFloat(activity.price),
                        tradeValue: parseFloat(activity.usdcSize),
                        conditionId: activity.conditionId,
                    };
                });
            } catch (apiError) {
                console.warn('[MarketHistory] Data-API fetch failed:', apiError);
                // Use cached data if available, otherwise fallback to DB
                const cached = walletCache[walletAddress];
                if (cached) {
                    const activities = cached.data;
                    console.log('[MarketHistory] Using cached wallet data');
                    walletHistory = activities.map(activity => {
                        // Try to get market name from conditionId
                        const marketMeta = marketsByCondition.get(activity.conditionId);
                        const marketName = marketMeta?.question || activity.market || 'Unknown Market';

                        return {
                            timestamp: new Date(activity.timestamp * 1000), // Convert unix to Date
                            question: marketName,
                            outcome: activity.outcome || 'Unknown',
                            side: activity.side,
                            price: parseFloat(activity.price),
                            tradeValue: parseFloat(activity.usdcSize),
                            conditionId: activity.conditionId,
                        };
                    });
                } else {
                    // Fallback to database if no cache either
                    const dbTrades = await prisma.trade.findMany({
                        where: {
                            walletAddress: walletAddress.toLowerCase(),
                        },
                        orderBy: {
                            timestamp: 'desc',
                        },
                        take: 50,
                        select: {
                            timestamp: true,
                            question: true,
                            outcome: true,
                            side: true,
                            price: true,
                            tradeValue: true,
                        },
                    });

                    walletHistory = dbTrades.map(t => ({
                        ...t,
                        question: t.question || 'Unknown',
                        outcome: t.outcome || 'Unknown',
                        conditionId: undefined
                    }));
                }
            }
        }

        // Reverse to chronological order for charts
        const sortedPriceHistory = priceHistory.reverse().map(t => ({
            ...t,
            timestamp: t.timestamp.getTime(),
            price: t.price * 100, // Convert to cents
        }));

        const sortedWalletHistory = walletHistory.slice().reverse().map(t => ({
            ...t,
            timestamp: t.timestamp.getTime(),
            price: t.price * 100,
        }));

        return NextResponse.json({
            priceHistory: sortedPriceHistory,
            walletHistory: sortedWalletHistory,
            stats: calculateStats(walletHistory, marketsByCondition),
        });

    } catch (error) {
        console.error('[API] Error fetching market history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch market history' },
            { status: 500 }
        );
    }
}

function calculateStats(trades: any[], markets: Map<string, any>) {
    // Pre-compute market lookups for better performance
    const marketLookups = new Map();

    const calculatePeriodStats = (periodTrades: any[]) => {
        let wins = 0, totalPnL = 0, totalVolume = 0, validTrades = 0;

        for (const trade of periodTrades) {
            if (trade.side !== 'BUY') continue;

            let market = marketLookups.get(trade.conditionId);
            if (market === undefined) {
                market = markets.get(trade.conditionId) || null;
                marketLookups.set(trade.conditionId, market);
            }
            if (!market) continue;

            validTrades++;
            totalVolume += trade.tradeValue;

            let currentPrice = trade.price; // Default fallback
            let isWin = false;

            // Fast path for outcome price lookup
            if (market.outcomePrices && market.outcomes) {
                const outcomeIndex = market.outcomes.indexOf(trade.outcome);
                if (outcomeIndex !== -1) {
                    currentPrice = parseFloat(market.outcomePrices[outcomeIndex]);
                    isWin = market.closed ? currentPrice > 0.5 : currentPrice > trade.price;
                }
            }

            const pnl = (trade.tradeValue / trade.price) * currentPrice - trade.tradeValue;
            totalPnL += pnl;
            if (isWin) wins++;
        }

        return {
            winRate: validTrades > 0 ? (wins / validTrades) * 100 : 0,
            pnlPercent: totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0,
            totalPnL,
            totalVolume,
            tradeCount: validTrades
        };
    };

    return {
        last5: calculatePeriodStats(trades.slice(0, 5)),
        last10: calculatePeriodStats(trades.slice(0, 10)),
        last50: calculatePeriodStats(trades.slice(0, 50))
    };
}
