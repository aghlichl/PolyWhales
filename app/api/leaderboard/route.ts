import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CONFIG } from '@/lib/config';

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

    // New format: Return latest leaderboard snapshots for all periods with rank changes
    const periods = ['Daily', 'Weekly', 'Monthly', 'All Time'];
    const result: Record<string, Array<{
      period: string;
      rank: number;
      totalPnl: number;
      accountName?: string | null;
      rankChange?: number | null; // positive = moved up, negative = moved down, null = new
    }>> = {};

    for (const period of periods) {
      // Get the two most recent snapshot timestamps for this period
      const recentSnapshots = await prisma.walletLeaderboardSnapshot.findMany({
        where: { period },
        orderBy: { snapshotAt: 'desc' },
        select: { snapshotAt: true },
        distinct: ['snapshotAt'],
        take: 2,
      });

      if (recentSnapshots.length === 0) {
        continue; // Skip if no snapshot exists for this period
      }

      const latestSnapshotAt = recentSnapshots[0].snapshotAt;
      const previousSnapshotAt = recentSnapshots.length > 1 ? recentSnapshots[1].snapshotAt : null;

      // Fetch top-N rows for the latest snapshot
      const latestSnapshots = await prisma.walletLeaderboardSnapshot.findMany({
        where: {
          period,
          snapshotAt: latestSnapshotAt,
          rank: { lte: CONFIG.LEADERBOARD.FETCH_LIMIT }, // Top N (e.g., 200)
        },
        orderBy: { rank: 'asc' },
        select: {
          walletAddress: true,
          rank: true,
          accountName: true,
          totalPnl: true,
        },
      });

      // Build a map of previous ranks if we have a previous snapshot
      const previousRanks: Record<string, number> = {};
      if (previousSnapshotAt) {
        const previousSnapshots = await prisma.walletLeaderboardSnapshot.findMany({
          where: {
            period,
            snapshotAt: previousSnapshotAt,
          rank: { lte: CONFIG.LEADERBOARD.FETCH_LIMIT },
          },
          select: {
            walletAddress: true,
            rank: true,
          },
        });
        for (const prev of previousSnapshots) {
          previousRanks[prev.walletAddress.toLowerCase()] = prev.rank;
        }
      }

      // Group by wallet address (normalize to lowercase for lookup)
      for (const snapshot of latestSnapshots) {
        const walletKey = snapshot.walletAddress.toLowerCase();
        if (!result[walletKey]) {
          result[walletKey] = [];
        }

        // Calculate rank change
        const previousRank = previousRanks[walletKey];
        let rankChange: number | null = null;
        if (previousRank !== undefined) {
          // Positive means they moved UP (e.g., was #5, now #3 = +2)
          rankChange = previousRank - snapshot.rank;
        }
        // If previousRank is undefined, they're new (rankChange stays null)

        result[walletKey].push({
          period,
          rank: snapshot.rank,
          totalPnl: snapshot.totalPnl,
          accountName: snapshot.accountName,
          rankChange,
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

