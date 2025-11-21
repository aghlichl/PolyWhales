import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Aggregate top wallets by volume from last 7 days
    const topWallets = await prisma.trade.groupBy({
      by: ['walletAddress'],
      where: {
        timestamp: {
          gte: sevenDaysAgo,
        },
      },
      _sum: {
        tradeValue: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          tradeValue: 'desc',
        },
      },
      take: 10,
    });

    // Enrich with wallet profile data
    const enriched = await Promise.all(
      topWallets.map(async (wallet) => {
        const profile = await prisma.walletProfile.findUnique({
          where: { id: wallet.walletAddress },
        });

        return {
          address: wallet.walletAddress,
          volume: wallet._sum.tradeValue || 0,
          tradeCount: wallet._count.id || 0,
          label: profile?.label || null,
          totalPnl: profile?.totalPnl || 0,
          winRate: profile?.winRate || 0,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('[API] Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

