import "dotenv/config";
import { prisma } from "../lib/prisma";
import { load } from "cheerio";
import fetch from "node-fetch";

type LeaderboardRow = {
    timeframe: string;
    rank: number;
    displayName: string;
    wallet: string;
    profitLabel: string;
    volumeLabel: string;
};

const LEADERBOARD_URLS = [
    { url: "https://polymarket.com/leaderboard/overall/today/profit", timeframe: "Daily" },
];

function parseCurrency(label: string): number | null {
    const trimmed = label.trim();
    if (!trimmed || trimmed === "—") return null;

    const normalized = trimmed
        .replace(/[$,]/g, "")
        .replace(/^\+/, "");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

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
    console.log("Starting test scrape...");
    const allRows: LeaderboardRow[] = [];

    try {
        for (const { url, timeframe } of LEADERBOARD_URLS) {
            console.log(`Scraping ${timeframe} leaderboard...`);
            const html = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            }).then((r) => r.text());

            const $ = load(html);

            $(".flex.flex-col.gap-2.py-5.border-b").each((i, row) => {
                if (i >= 2) return; // Limit to 2 for testing positions

                const $row = $(row);
                const usernameAnchor = $row.find('a[href^="/profile/"]').last();
                const displayName = usernameAnchor.text().trim();
                const wallet = usernameAnchor.attr("href")!.replace("/profile/", "");
                const profitLabel = $row.find("p.text-text-primary").text().trim();
                const volumeLabel = $row.find("p.text-text-secondary").text().trim();

                console.log(`Found: ${displayName} (${wallet}) - PnL: ${profitLabel}`);

                allRows.push({
                    timeframe,
                    rank: i + 1,
                    displayName,
                    wallet,
                    profitLabel,
                    volumeLabel,
                });
            });
        }

        if (allRows.length > 0) {
            console.log(`Scraped ${allRows.length} rows. Inserting into DB...`);
            const snapshotAt = new Date();

            await prisma.$transaction(async (tx) => {
                for (const row of allRows) {
                    const totalPnl = parseCurrency(row.profitLabel) ?? 0;
                    const totalVolume = parseCurrency(row.volumeLabel) ?? 0;

                    await tx.walletLeaderboardSnapshot.create({
                        data: {
                            walletAddress: row.wallet,
                            period: row.timeframe,
                            rank: row.rank,
                            totalPnl,
                            totalVolume,
                            winRate: 0,
                            snapshotAt,
                            accountName: row.displayName,
                        }
                    });

                    console.log(`Fetching positions for ${row.wallet}...`);
                    const positions = await fetchWhalePositions(row.wallet);
                    console.log(`Found ${positions.length} positions.`);

                    let positionRank = 1;
                    for (const pos of positions) {
                        await tx.whalePositionSnapshot.create({
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
            });
            console.log("Successfully inserted snapshots and positions into DB.");
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
