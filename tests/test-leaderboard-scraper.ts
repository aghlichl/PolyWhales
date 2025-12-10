import "dotenv/config";
import { prisma } from "../lib/prisma";
import fetch from "node-fetch";

type LeaderboardRow = {
    timeframe: string;
    rank: number;
    displayName: string;
    wallet: string;
    totalPnl: number;
    totalVolume: number;
};

type LeaderboardApiRow = {
    rank: number | string;
    proxyWallet: string;
    userName?: string | null;
    pnl?: number | string | null;
    vol?: number | string | null;
};

type PositionResponse = {
    proxyWallet: string;
    asset: string;
    conditionId: string;
    size: number;
    avgPrice: number;
    initialValue: number;
    currentValue: number;
    cashPnl: number;
    percentPnl: number;
    totalBought: number;
    realizedPnl: number;
    percentRealizedPnl: number;
    curPrice: number;
    redeemable: boolean;
    mergeable: boolean;
    title: string;
    slug: string;
    icon: string;
    eventId: string;
    eventSlug: string;
    outcome: string;
    outcomeIndex: number;
    oppositeOutcome: string;
    oppositeAsset: string;
    endDate: string;
    negativeRisk: boolean;
};

const LEADERBOARD_API_CONFIG = [
    { timeframe: "Daily", timePeriod: "day" },
    { timeframe: "Weekly", timePeriod: "week" },
    { timeframe: "Monthly", timePeriod: "month" },
    { timeframe: "All Time", timePeriod: "all" },
];

const LEADERBOARD_LIMIT = 50;
const LEADERBOARD_OFFSETS = [0, 50, 100, 150];
const LEADERBOARD_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function toNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

function buildLeaderboardUrl(timePeriod: string, offset: number): string {
    const url = new URL("https://data-api.polymarket.com/v1/leaderboard");
    url.searchParams.set("timePeriod", timePeriod);
    url.searchParams.set("orderBy", "PNL");
    url.searchParams.set("limit", String(LEADERBOARD_LIMIT));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("category", "overall");
    return url.toString();
}

async function fetchLeaderboardBatch(
    timeframe: LeaderboardRow["timeframe"],
    timePeriod: string
): Promise<LeaderboardRow[]> {
    const results: LeaderboardRow[] = [];

    for (const offset of LEADERBOARD_OFFSETS) {
        const url = buildLeaderboardUrl(timePeriod, offset);
        console.log(`Fetching ${timeframe} offset ${offset}...`);

        try {
            const response = await fetch(url, {
                headers: { "User-Agent": LEADERBOARD_USER_AGENT },
            });

            if (!response.ok) {
                console.warn(`Leaderboard API returned ${response.status} for ${timeframe} offset ${offset}`);
                continue;
            }

            const data = (await response.json()) as unknown;
            if (!Array.isArray(data)) {
                console.warn(`Leaderboard API response not array for ${timeframe} offset ${offset}`);
                continue;
            }

            data.forEach((entry: LeaderboardApiRow, idx: number) => {
                const wallet = (entry.proxyWallet || "").toLowerCase();
                if (!wallet) return;

                const rank = toNumber(entry.rank, offset + idx + 1);
                const displayName = entry.userName?.trim() || wallet;

                results.push({
                    timeframe,
                    rank,
                    displayName,
                    wallet,
                    totalPnl: toNumber(entry.pnl),
                    totalVolume: toNumber(entry.vol),
                });
            });
        } catch (error) {
            console.warn(`Failed to fetch leaderboard for ${timeframe} offset ${offset}:`, error);
        }
    }

    return results;
}

async function fetchWhalePositions(walletAddress: string): Promise<PositionResponse[]> {
    try {
        const url = `https://data-api.polymarket.com/positions?sizeThreshold=1&limit=10&sortBy=CURRENT&sortDirection=DESC&user=${walletAddress}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch positions for ${walletAddress}: ${response.statusText}`);
            return [];
        }
        const data = await response.json() as PositionResponse[];
        return data;
    } catch (error) {
        console.error(`Error fetching positions for ${walletAddress}:`, error);
        return [];
    }
}

async function testScrape() {
    console.log("Starting leaderboard API scrape test...");
    const allRows: LeaderboardRow[] = [];

    try {
        for (const { timeframe, timePeriod } of LEADERBOARD_API_CONFIG) {
            const rows = await fetchLeaderboardBatch(timeframe, timePeriod);
            console.log(`Fetched ${rows.length} rows for ${timeframe}`);
            allRows.push(...rows);
        }

        if (allRows.length > 0) {
            console.log(`Fetched ${allRows.length} rows total. Inserting into DB...`);
            const snapshotAt = new Date();

            const rowsToInsert = allRows.map((row) => ({
                walletAddress: row.wallet,
                period: row.timeframe,
                rank: row.rank,
                totalPnl: row.totalPnl,
                totalVolume: row.totalVolume,
                winRate: 0,
                snapshotAt,
                accountName: row.displayName,
            }));

            await prisma.walletLeaderboardSnapshot.createMany({ data: rowsToInsert });
            console.log("Inserted leaderboard snapshots.");

            // Optional: fetch a small sample of positions to validate downstream flow
            const sampleForPositions = allRows.slice(0, 2);
            for (const row of sampleForPositions) {
                console.log(`Fetching positions for ${row.wallet}...`);
                const positions = await fetchWhalePositions(row.wallet);
                console.log(`Found ${positions.length} positions.`);

                let positionRank = 1;
                for (const pos of positions) {
                    await prisma.whalePositionSnapshot.create({
                        data: {
                            snapshotAt,
                            timeframe: row.timeframe,
                            walletRank: row.rank,
                            positionRank: positionRank++,
                            proxyWallet: pos.proxyWallet,
                            conditionId: pos.conditionId,
                            assetId: pos.asset,
                            eventId: pos.eventId,
                            eventSlug: pos.eventSlug,
                            marketTitle: pos.title,
                            marketSlug: pos.slug,
                            iconUrl: pos.icon,
                            outcome: pos.outcome,
                            outcomeIndex: pos.outcomeIndex,
                            oppositeOutcome: pos.oppositeOutcome,
                            oppositeAssetId: pos.oppositeAsset,
                            endDate: pos.endDate ? new Date(pos.endDate) : null,
                            negativeRisk: pos.negativeRisk,
                            redeemable: pos.redeemable,
                            size: pos.size,
                            avgPrice: pos.avgPrice,
                            curPrice: pos.curPrice,
                            initialValue: pos.initialValue,
                            currentValue: pos.currentValue,
                            totalBought: pos.totalBought,
                            cashPnl: pos.cashPnl,
                            percentPnl: pos.percentPnl,
                            realizedPnl: pos.realizedPnl,
                            percentRealizedPnl: pos.percentRealizedPnl,
                        }
                    });
                }
            }

            console.log("Successfully inserted snapshots (and sample positions).");
        } else {
            console.log("No rows found!");
        }

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testScrape();
