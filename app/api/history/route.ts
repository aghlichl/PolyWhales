import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchMarketsFromGamma, parseMarketData } from '@/lib/polymarket';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Calculate timestamp for 24 hours ago (1440 minutes)
    const twentyFourHoursAgo = new Date(Date.now() - 1440 * 60 * 1000);

    // Fetch current market metadata to get images
    const markets = await fetchMarketsFromGamma();
    const { marketsByCondition } = parseMarketData(markets);

    // Fetch whale trades with cursor-based pagination
    const trades = await prisma.trade.findMany({
      where: {
        tradeValue: {
          gt: 5000,
        },
        timestamp: {
          gte: twentyFourHoursAgo,
        },
        walletAddress: {
          not: "", // Only include trades with valid wallet addresses
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit + 1, // Fetch one extra to determine if there are more
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0, // Skip the cursor itself
      include: {
        walletProfile: true,
      },
    });

    let nextCursor: string | undefined = undefined;
    if (trades.length > limit) {
      const nextItem = trades.pop();
      nextCursor = trades[trades.length - 1].id;
    }

    // Transform to Anomaly interface format (matching market-stream.ts)
    const anomalies = trades.map(trade => {
      const value = trade.tradeValue;
      const price = trade.price;

      // Determine anomaly type based on trade value (matching market-stream.ts logic)
      let type: 'GOD_WHALE' | 'SUPER_WHALE' | 'MEGA_WHALE' | 'WHALE' | 'STANDARD' = 'STANDARD';
      if (value > 100000) type = 'GOD_WHALE';
      else if (value > 50000) type = 'SUPER_WHALE';
      else if (value > 15000) type = 'MEGA_WHALE';
      else if (value > 8000) type = 'WHALE';

      // Get image from current market metadata
      const marketMeta = trade.conditionId ? marketsByCondition.get(trade.conditionId) : undefined;
      const image = marketMeta?.image || trade.image || undefined;

      const marketContext = {
        category: marketMeta?.category || trade.marketCategory || null,
        sport: marketMeta?.sport || trade.sport || null,
        league: marketMeta?.league || trade.league || null,
        feeBps: marketMeta?.feeBps ?? trade.feeBps ?? null,
        // Prioritize fresh stats from marketMeta
        liquidity: marketMeta?.liquidity ?? trade.liquidity ?? null,
        volume24h: marketMeta?.volume24h ?? trade.volume24h ?? null,
        closeTime: marketMeta?.closeTime || trade.closeTime?.toISOString() || null,
        openTime: marketMeta?.openTime || trade.openTime?.toISOString() || null,
        resolutionTime: marketMeta?.resolutionTime || trade.resolutionTime?.toISOString() || null,
        resolutionSource: marketMeta?.resolutionSource || trade.resolutionSource || null,
        denominationToken: marketMeta?.denominationToken || trade.denominationToken || null,
        liquidity_bucket: trade.marketDepthBucket || null, // Keep snapshot buckets for now, or re-compute if needed
        time_to_close_bucket: trade.timeToCloseBucket || null,
      };

      const eventContext = {
        id: trade.eventId || undefined,
        title: trade.eventTitle || undefined,
        slug: trade.eventSlug || null,
      };

      return {
        id: trade.id, // Use actual trade ID instead of random
        type,
        event: trade.question || 'Unknown Market',
        outcome: trade.outcome || 'Unknown',
        odds: Math.round(price * 100),
        value,
        timestamp: trade.timestamp.getTime(), // Convert to number
        side: trade.side as 'BUY' | 'SELL', // Include the side from the trade
        image,
        category: trade.marketCategory || null,
        sport: trade.sport || null,
        league: trade.league || null,
        feeBps: trade.feeBps ?? null,
        liquidity: trade.liquidity ?? null,
        volume24h: trade.volume24h ?? null,
        closeTime: trade.closeTime?.toISOString() || null,
        openTime: trade.openTime?.toISOString() || null,
        resolutionTime: trade.resolutionTime?.toISOString() || null,
        resolutionSource: trade.resolutionSource || null,
        denominationToken: trade.denominationToken || null,
        liquidity_bucket: trade.marketDepthBucket || null,
        time_to_close_bucket: trade.timeToCloseBucket || null,
        eventId: trade.eventId || null,
        eventTitle: trade.eventTitle || null,
        tags: trade.tags || [],
        wallet_context: {
          address: trade.walletProfile?.id || trade.walletAddress,
          label: trade.walletProfile?.label || 'Unknown',
          pnl_all_time: `$${(trade.walletProfile?.totalPnl || 0).toLocaleString()}`,
          win_rate: `${((trade.walletProfile?.winRate || 0) * 100).toFixed(0)}%`,
          is_fresh_wallet: trade.walletProfile?.isFresh || false,
        },
        trader_context: {
          tx_count: trade.walletProfile?.txCount || 0,
          max_trade_value: trade.walletProfile?.maxTradeValue || 0,
          activity_level: trade.walletProfile?.activityLevel || null,
        },
        analysis: {
          tags: [
            trade.isWhale && 'WHALE',
            trade.isSmartMoney && 'SMART_MONEY',
            trade.isFresh && 'FRESH_WALLET',
            trade.isSweeper && 'SWEEPER',
            // Reconstruct INSIDER tag logic since it's not stored directly on trade
            (trade.walletProfile?.activityLevel === 'LOW' && (trade.walletProfile?.winRate || 0) > 0.7 && (trade.walletProfile?.totalPnl || 0) > 10000) && 'INSIDER',
            ...(trade.tags || []),
          ].filter(Boolean) as string[],
          event: eventContext,
          market_context: marketContext,
          crowding: {
            top5_share: trade.holderTop5Share ?? null,
            top10_share: trade.holderTop10Share ?? null,
            holder_count: trade.holderCount ?? null,
            smart_holder_count: trade.smartHolderCount ?? null,
            label: trade.holderTop5Share ? 'crowding' : null,
          },
        },
      };
    });

    return NextResponse.json({
      trades: anomalies,
      nextCursor
    });
  } catch (error) {
    console.error('[API] Error fetching history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
