import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get top whale profiles by total volume
    const whales = await prisma.walletProfile.findMany({
      orderBy: {
        totalPnl: 'desc'
      },
      take: 20,
      select: {
        id: true,
        label: true,
        totalPnl: true,
        winRate: true,
        txCount: true,
        maxTradeValue: true,
        activityLevel: true,
        lastUpdated: true,
        _count: {
          select: {
            trades: true
          }
        }
      }
    });

    // Format the response
    const formattedWhales = whales.map(whale => ({
      address: whale.id,
      label: whale.label,
      totalPnl: whale.totalPnl,
      winRate: whale.winRate,
      txCount: whale.txCount,
      maxTradeValue: whale.maxTradeValue,
      activityLevel: whale.activityLevel,
      tradeCount: whale._count.trades,
      lastUpdated: whale.lastUpdated
    }));

    return NextResponse.json(formattedWhales);
  } catch (error) {
    console.error('[API] Error fetching top whales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top whales' },
      { status: 500 }
    );
  }
}
