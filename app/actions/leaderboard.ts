"use server";

import { prisma } from "@/lib/prisma";

export type LeaderboardTimeframe = "Daily" | "Weekly" | "Monthly" | "All Time";

export async function getLeaderboardData(timeframe: LeaderboardTimeframe) {
    try {
        // 1. Get the latest snapshot timestamp for this timeframe
        const latestSnapshot = await prisma.walletLeaderboardSnapshot.findFirst({
            where: { period: timeframe },
            orderBy: { snapshotAt: "desc" },
            select: { snapshotAt: true },
        });

        if (!latestSnapshot) {
            return [];
        }

        const snapshotAt = latestSnapshot.snapshotAt;

        // 2. Fetch leaderboard rows for this snapshot
        const leaderboardRows = await prisma.walletLeaderboardSnapshot.findMany({
            where: {
                period: timeframe,
                snapshotAt,
            },
            orderBy: { rank: "asc" },
        });

        // 3. Fetch positions for these wallets in this snapshot
        const walletAddresses = leaderboardRows.map((row) => row.walletAddress);

        const positions = await prisma.whalePositionSnapshot.findMany({
            where: {
                timeframe,
                snapshotAt,
                proxyWallet: { in: walletAddresses },
            },
            orderBy: [
                { proxyWallet: "asc" },
                { positionRank: "asc" }
            ]
        });

        // 4. Group positions by wallet
        const positionsByWallet = positions.reduce((acc, pos) => {
            if (!acc[pos.proxyWallet]) {
                acc[pos.proxyWallet] = [];
            }
            acc[pos.proxyWallet].push(pos);
            return acc;
        }, {} as Record<string, typeof positions>);

        // 5. Merge data
        const result = leaderboardRows.map((row) => ({
            ...row,
            positions: positionsByWallet[row.walletAddress] || [],
        }));

        return result;

    } catch (error) {
        console.error("Error fetching leaderboard data:", error);
        return [];
    }
}
