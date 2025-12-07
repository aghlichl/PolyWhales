import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMarketMetadata, tradeToAnomaly } from '@/lib/polymarket';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Calculate timestamp for 24 hours ago (1440 minutes)
    const twentyFourHoursAgo = new Date(Date.now() - 1440 * 60 * 1000);

    // Fetch current market metadata to get images
    const { marketsByCondition } = await getMarketMetadata();

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

    // Transform to Anomaly interface format using shared helper
    const anomalies = trades.map(trade => tradeToAnomaly(trade, { marketsByCondition }));

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
