import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchMarketsFromGamma, parseMarketData } from '@/lib/polymarket';

type Period = 'today' | 'weekly' | 'monthly' | 'yearly' | 'max';

function getDateFilter(period: Period): Date | null {
  const now = new Date();

  switch (period) {
    case 'today':
      // Start of today
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'weekly':
      // 7 days ago
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      // 30 days ago
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'yearly':
      // 365 days ago
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'max':
      // No date filter (beginning of time)
      return null;
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to weekly
  }
}

export async function GET(request: Request) {
  try {
    // Fetch current market metadata to get images
    const markets = await fetchMarketsFromGamma();
    const { marketsByCondition } = parseMarketData(markets);

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as Period) || 'weekly';
    const cursor = searchParams.get('cursor'); // ID of the last item in previous page
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get date filter based on period
    const dateFilter = getDateFilter(period);

    // Build where clause
    const whereClause: {
      tradeValue: { gt: number };
      timestamp?: { gte: Date };
    } = {
      tradeValue: {
        gt: 1000, // Only show meaningful trades
      },
    };

    // Add date filter if not 'max'
    if (dateFilter) {
      whereClause.timestamp = {
        gte: dateFilter,
      };
    }

    // Fetch trades with cursor-based pagination
    const trades = await prisma.trade.findMany({
      where: whereClause,
      orderBy: {
        tradeValue: 'desc',
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
      const nextItem = trades.pop(); // Remove the extra item
      nextCursor = nextItem?.id; // Use the *previous* last item as cursor? No, wait.
      // If we fetched limit + 1, the last one is the start of next page.
      // Actually, if we pop, the one we popped is the next cursor?
      // No, cursor-based pagination usually uses the ID of the last item *returned* to fetch the *next* page.
      // If we fetched 101 items, and limit is 100.
      // The 101st item is the first item of the next page.
      // So we return 100 items. The cursor for the next request should be the ID of the 100th item?
      // Prisma `cursor` points to the item to start *after* (if skip: 1).
      // So if we return 100 items, the last item's ID is the cursor for the next page.
      // But we need to know if there *is* a next page.
      // So fetching limit + 1 is correct.
      // If we have 101 items, we have a next page.
      // The cursor for the next call should be the ID of the 100th item (the last one in this batch).
      // And the next call will use that cursor and skip: 1.
      nextCursor = trades[trades.length - 1].id;
    }

    // Transform to Anomaly interface format (matching market-stream.ts and history)
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

      return {
        id: trade.id,
        type,
        event: trade.question || 'Unknown Market',
        outcome: trade.outcome || 'Unknown',
        odds: Math.round(price * 100),
        value,
        timestamp: trade.timestamp.getTime(),
        side: trade.side as 'BUY' | 'SELL',
        image,
        wallet_context: {
          address: (trade.walletProfile?.id && trade.walletProfile.id.trim()) || (trade.walletAddress && trade.walletAddress.trim()) || null,
          label: (trade.walletProfile?.label && trade.walletProfile.label.trim()) || 'Unknown',
          pnl_all_time: trade.walletProfile?.totalPnl ? `$${trade.walletProfile.totalPnl.toLocaleString()}` : '$0',
          win_rate: trade.walletProfile?.winRate ? `${(trade.walletProfile.winRate * 100).toFixed(0)}%` : '0%',
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
            (trade.walletProfile?.activityLevel === 'LOW' && (trade.walletProfile?.winRate || 0) > 0.7 && (trade.walletProfile?.totalPnl || 0) > 10000) && 'INSIDER',
          ].filter(Boolean) as string[],
        },
      };
    });

    return NextResponse.json({
      period,
      count: anomalies.length,
      nextCursor,
      trades: anomalies,
    });
  } catch (error) {
    console.error('[API] Error fetching top trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top trades' },
      { status: 500 }
    );
  }
}
