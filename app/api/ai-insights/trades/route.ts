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

    // Find the freshest leaderboard snapshot (prefer Daily)
    let snapshotAt: Date | null = null;
    let snapshotPeriod: (typeof PREFERRED_PERIODS)[number] | null = null;

    for (const period of PREFERRED_PERIODS) {
      const latest = await prisma.walletLeaderboardSnapshot.findFirst({
        where: { period },
        orderBy: { snapshotAt: "desc" },
        select: { snapshotAt: true },
      });
      if (latest?.snapshotAt) {
        snapshotAt = latest.snapshotAt;
        snapshotPeriod = period;
        break;
      }
    }

    const top20 = snapshotAt
      ? await prisma.walletLeaderboardSnapshot.findMany({
        where: { snapshotAt, period: snapshotPeriod!, rank: { lte: 20 } },
        orderBy: { rank: "asc" },
        select: { walletAddress: true, rank: true, accountName: true, totalPnl: true },
      })
      : [];

    const topWalletAddresses = top20.map((w) => w.walletAddress);

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


