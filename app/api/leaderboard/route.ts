import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'snapshots'; // 'snapshots' or 'legacy'

    // If legacy format requested, return the old behavior
    if (format === 'legacy') {
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
    }

    // New format: Return latest leaderboard snapshots for all periods
    const periods = ['Daily', 'Weekly', 'Monthly', 'All Time'];
    const result: Record<string, Array<{ period: string; rank: number; totalPnl: number; accountName?: string | null }>> = {};

    for (const period of periods) {
      // Get the latest snapshot timestamp for this period
      const latestSnapshot = await prisma.walletLeaderboardSnapshot.findFirst({
        where: { period },
        orderBy: { snapshotAt: 'desc' },
        select: { snapshotAt: true },
      });

      if (!latestSnapshot) {
        continue; // Skip if no snapshot exists for this period
      }

      // Fetch top 20 rows for this snapshot
      const snapshots = await prisma.walletLeaderboardSnapshot.findMany({
        where: {
          period,
          snapshotAt: latestSnapshot.snapshotAt,
          rank: { lte: 20 }, // Top 20 only
        },
        orderBy: { rank: 'asc' },
        select: {
          walletAddress: true,
          rank: true,
          accountName: true,
          totalPnl: true,
        },
      });

      // Group by wallet address (normalize to lowercase for lookup)
      for (const snapshot of snapshots) {
        const walletKey = snapshot.walletAddress.toLowerCase();
        if (!result[walletKey]) {
          result[walletKey] = [];
        }
        result[walletKey].push({
          period,
          rank: snapshot.rank,
          totalPnl: snapshot.totalPnl,
          accountName: snapshot.accountName,
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

