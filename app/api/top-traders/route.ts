import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CONFIG } from '@/lib/config';

export type TraderData = {
    walletAddress: string;
    accountName: string | null;
    rank: number;
    totalPnl: number;
    rankChange: number | null;
    pnlHistory: { date: string; pnl: number }[];
};

export type TopTradersResponse = {
    traders: TraderData[];
    period: string;
    snapshotAt: string | null;
};

const LOOKBACK_DAYS: Record<string, number | null> = {
    Daily: 1,
    Weekly: 7,
    Monthly: 30,
    "All Time": 30,
};

function getSinceDate(period: string): Date | null {
    const days = LOOKBACK_DAYS[period] ?? LOOKBACK_DAYS["Daily"];
    if (!days) return null;
    const now = new Date();
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'Daily';

        // Calculate date range based on period
        const sinceDate = getSinceDate(period);

        // Build snapshot query with date filter
        const snapshotWhere = sinceDate
            ? { period, snapshotAt: { gte: sinceDate } }
            : { period };

        // Get recent snapshots for this period
        const recentSnapshots = await prisma.walletLeaderboardSnapshot.findMany({
            where: snapshotWhere,
            orderBy: { snapshotAt: 'desc' },
            select: { snapshotAt: true },
            distinct: ['snapshotAt'],
        });

        if (recentSnapshots.length === 0) {
            return NextResponse.json({
                traders: [],
                period,
                snapshotAt: null,
            });
        }

        const latestSnapshotAt = recentSnapshots[0].snapshotAt;
        const previousSnapshotAt = recentSnapshots.length > 1 ? recentSnapshots[1].snapshotAt : null;

        // Fetch top-N traders from the latest snapshot (deduplicate by wallet address)
        const latestTraders = await prisma.walletLeaderboardSnapshot.findMany({
            where: {
                period,
                snapshotAt: latestSnapshotAt,
                rank: { lte: CONFIG.LEADERBOARD.FETCH_LIMIT },
            },
            orderBy: [
                { rank: 'asc' },
                { walletAddress: 'asc' } // Secondary sort for deterministic ordering of duplicates
            ],
            distinct: ['walletAddress'], // Ensure no duplicate wallet addresses
            select: {
                walletAddress: true,
                accountName: true,
                rank: true,
                totalPnl: true,
            },
        });

        // Build previous ranks map for rank change calculation
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

        // Get all historical P&L data for these wallets
        const walletAddresses = latestTraders.map(t => t.walletAddress);
        const snapshotDates = recentSnapshots.map(s => s.snapshotAt);

        const historicalData = await prisma.walletLeaderboardSnapshot.findMany({
            where: {
                period,
                walletAddress: { in: walletAddresses },
                snapshotAt: { in: snapshotDates },
            },
            select: {
                walletAddress: true,
                snapshotAt: true,
                totalPnl: true,
            },
            orderBy: { snapshotAt: 'asc' },
        });

        // Group historical data by wallet
        const historyByWallet: Record<string, { date: string; pnl: number }[]> = {};
        for (const h of historicalData) {
            const key = h.walletAddress.toLowerCase();
            if (!historyByWallet[key]) {
                historyByWallet[key] = [];
            }
            historyByWallet[key].push({
                date: h.snapshotAt.toISOString(),
                pnl: h.totalPnl,
            });
        }

        // Build response
        const traders: TraderData[] = latestTraders.map(trader => {
            const walletKey = trader.walletAddress.toLowerCase();
            const previousRank = previousRanks[walletKey];
            const rankChange = previousRank !== undefined ? previousRank - trader.rank : null;
            const pnlHistory = (historyByWallet[walletKey] || []).sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            return {
                walletAddress: trader.walletAddress,
                accountName: trader.accountName,
                rank: trader.rank,
                totalPnl: trader.totalPnl,
                rankChange,
                pnlHistory,
            };
        });

        return NextResponse.json({
            traders,
            period,
            snapshotAt: latestSnapshotAt.toISOString(),
        });
    } catch (error) {
        console.error('[API] Error fetching top traders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch top traders' },
            { status: 500 }
        );
    }
}
