import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketMetadata, tradeToAnomaly } from "@/lib/polymarket";

const PREFERRED_PERIODS = ["Daily", "Weekly", "Monthly", "All Time"] as const;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conditionId = searchParams.get("conditionId");
    const outcome = searchParams.get("outcome");
    const limitParam = Number.parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    if (!conditionId && !outcome) {
      return NextResponse.json(
        { error: "conditionId or outcome is required" },
        { status: 400 }
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch latest leaderboard snapshots for each period and dedupe top-20 wallets
    const snapshots = await Promise.all(
      PREFERRED_PERIODS.map(async (period) => {
        const latest = await prisma.walletLeaderboardSnapshot.findFirst({
          where: { period },
          orderBy: { snapshotAt: "desc" },
          select: { snapshotAt: true },
        });

        if (!latest?.snapshotAt) return null;

        const wallets = await prisma.walletLeaderboardSnapshot.findMany({
          where: { snapshotAt: latest.snapshotAt, period, rank: { lte: 20 } },
          orderBy: { rank: "asc" },
          select: { walletAddress: true, rank: true, accountName: true, totalPnl: true },
        });

        return { period, snapshotAt: latest.snapshotAt, wallets };
      })
    );

    const validSnapshots = snapshots.filter(
      (s): s is NonNullable<typeof s> => s !== null
    );

    const snapshotAt = validSnapshots.length
      ? new Date(Math.max(...validSnapshots.map((s) => s.snapshotAt.getTime())))
      : null;
    const snapshotPeriod = validSnapshots.length ? "Daily/Weekly/Monthly/All Time" : null;

    const walletBestRank = new Map<string, number>();
    const walletAddresses = new Set<string>();

    for (const snap of validSnapshots) {
      for (const w of snap.wallets) {
        const addr = w.walletAddress;
        walletAddresses.add(addr);

        const existing = walletBestRank.get(addr);
        if (existing === undefined || w.rank < existing) {
          walletBestRank.set(addr, w.rank);
        }
      }
    }

    const topWalletAddresses = Array.from(walletAddresses);

    // If we have no leaderboard data, still respond gracefully
    if (topWalletAddresses.length === 0) {
      return NextResponse.json({
        period: snapshotPeriod,
        snapshotAt,
        since: since.toISOString(),
        conditionId,
        outcome,
        top20Wallets: 0,
        count: 0,
        trades: [],
        note: "No leaderboard snapshot found; skipping top-20 filter",
      });
    }

    const whereClause = {
      timestamp: { gte: since },
      walletAddress: { in: topWalletAddresses },
      ...(conditionId ? { conditionId } : {}),
      ...(outcome ? { outcome } : {}),
    };

    const [trades, { marketsByCondition }] = await Promise.all([
      prisma.trade.findMany({
        where: whereClause,
        orderBy: { timestamp: "desc" },
        take: limit,
        include: { walletProfile: true },
      }),
      getMarketMetadata(),
    ]);

    const anomalies = trades.map((trade) =>
      tradeToAnomaly(trade, { marketsByCondition })
    );

    return NextResponse.json({
      period: snapshotPeriod,
      snapshotAt,
      since: since.toISOString(),
      conditionId,
      outcome,
      top20Wallets: topWalletAddresses.length,
      count: anomalies.length,
      trades: anomalies,
    });
  } catch (error) {
    console.error("[API] ai-insights/trades error:", error);
    return NextResponse.json(
      { error: "Failed to load trades for insight pick" },
      { status: 500 }
    );
  }
}


