import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LeaderboardWallet = {
  walletAddress: string;
  rank: number;
  totalPnl: number;
  accountName: string | null;
};

type InsightPick = {
  id: string;
  conditionId: string | null;
  eventTitle: string | null;
  eventSlug: string | null;
  outcome: string | null;
  marketQuestion: string | null; // Full market question for context (spread, total, etc.)
  latestPrice: number; // Latest trade price (0-1 scale)
  isResolved: boolean; // Whether the market has been resolved
  totalVolume: number;
  tradeCount: number;
  buyVolume: number;
  sellVolume: number;
  buySellSkew: number; // 0-1 bullish vs bearish tilt
  top20Volume: number;
  top20Trades: number;
  top20WalletCount: number;
  top20Support: number; // trades share from top20
  topRanks: Array<{ address: string; rank: number; accountName: string | null; totalPnl: number }>;
  bestRank: number | null;
  stance: "bullish" | "bearish";
  confidence: number; // 0-100 composite score
  latestTradeAt: string | null;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function computeConfidence(pick: InsightPick): number {
  const { totalVolume, top20Support, top20Volume, buyVolume, sellVolume, bestRank } = pick;
  const volumeScore = clamp(Math.log10(totalVolume + 1) / 5); // ~100k+ caps the score
  const whaleVolumeScore = pick.totalVolume > 0 ? clamp(top20Volume / pick.totalVolume) : 0;
  const supportScore = clamp(top20Support); // already 0-1
  const skewScore = pick.totalVolume > 0 ? clamp(Math.abs(buyVolume - sellVolume) / pick.totalVolume) : 0;
  const rankBoost = bestRank ? clamp((21 - bestRank) / 20) : 0;

  const weighted =
    supportScore * 0.32 +
    whaleVolumeScore * 0.25 +
    volumeScore * 0.18 +
    rankBoost * 0.15 +
    skewScore * 0.10;

  return Math.round(clamp(weighted, 0, 1) * 100);
}

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find the freshest snapshot period we can use (prefer Daily)
    const preferredPeriods = ["Daily", "Weekly", "Monthly", "All Time"];
    let snapshotAt: Date | null = null;
    let snapshotPeriod: string | null = null;

    for (const period of preferredPeriods) {
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
        select: { walletAddress: true, rank: true, totalPnl: true, accountName: true },
      })
      : [];

    const top20Map = new Map<string, LeaderboardWallet>(
      top20.map((w) => [w.walletAddress.toLowerCase(), w])
    );

    // Limit to a sane window to keep response fast
    const trades = await prisma.trade.findMany({
      where: {
        timestamp: { gte: since },
        walletAddress: { not: "" },
      },
      orderBy: { timestamp: "desc" },
      take: 4000,
      select: {
        id: true,
        conditionId: true,
        outcome: true,
        question: true,
        eventTitle: true,
        eventSlug: true,
        tradeValue: true,
        price: true,
        side: true,
        walletAddress: true,
        timestamp: true,
        resolutionTime: true,
      },
    });

    const groups = new Map<string, InsightPick>();

    let totalVolume = 0;
    let top20VolumeTotal = 0;
    let top20TradeTotal = 0;

    for (const trade of trades) {
      const walletKey = trade.walletAddress.toLowerCase();
      const isTop20 = top20Map.has(walletKey);
      const key = `${trade.conditionId || trade.eventTitle || "unknown"}::${trade.outcome || "unknown"}`;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          conditionId: trade.conditionId ?? null,
          eventTitle: trade.eventTitle ?? trade.conditionId ?? "Unknown Market",
          eventSlug: trade.eventSlug ?? null,
          outcome: trade.outcome ?? null,
          marketQuestion: trade.question ?? null,
          latestPrice: trade.price, // Initialize with first (most recent) trade's price
          isResolved: trade.resolutionTime !== null && trade.resolutionTime <= new Date(),
          totalVolume: 0,
          tradeCount: 0,
          buyVolume: 0,
          sellVolume: 0,
          buySellSkew: 0,
          top20Volume: 0,
          top20Trades: 0,
          top20WalletCount: 0,
          top20Support: 0,
          topRanks: [],
          bestRank: null,
          stance: "bullish",
          confidence: 0,
          latestTradeAt: null,
        });
      }

      const pick = groups.get(key)!;
      pick.totalVolume += trade.tradeValue;
      pick.tradeCount += 1;

      // Track the latest trade's price (trades are ordered by timestamp desc, so first is latest)
      const tradeTime = trade.timestamp.getTime();
      const currentLatestTime = pick.latestTradeAt ? new Date(pick.latestTradeAt).getTime() : 0;
      if (tradeTime > currentLatestTime) {
        pick.latestPrice = trade.price;
      }

      pick.latestTradeAt = pick.latestTradeAt
        ? new Date(Math.max(new Date(pick.latestTradeAt).getTime(), tradeTime)).toISOString()
        : trade.timestamp.toISOString();

      if (trade.side === "BUY") {
        pick.buyVolume += trade.tradeValue;
      } else if (trade.side === "SELL") {
        pick.sellVolume += trade.tradeValue;
      }

      if (isTop20) {
        pick.top20Volume += trade.tradeValue;
        pick.top20Trades += 1;
        const lb = top20Map.get(walletKey)!;
        if (!pick.topRanks.find((r) => r.address === walletKey)) {
          pick.topRanks.push({
            address: walletKey,
            rank: lb.rank,
            accountName: lb.accountName ?? null,
            totalPnl: lb.totalPnl,
          });
        }
      }

      totalVolume += trade.tradeValue;
      if (isTop20) {
        top20VolumeTotal += trade.tradeValue;
        top20TradeTotal += 1;
      }
    }

    const picks: InsightPick[] = Array.from(groups.values())
      .map((pick) => {
        const buySellTotal = pick.buyVolume + pick.sellVolume;
        pick.buySellSkew = buySellTotal > 0 ? pick.buyVolume / buySellTotal : 0.5;
        pick.top20WalletCount = pick.topRanks.length;
        pick.top20Support = pick.tradeCount > 0 ? pick.top20Trades / pick.tradeCount : 0;
        pick.bestRank = pick.topRanks.length > 0 ? Math.min(...pick.topRanks.map((r) => r.rank)) : null;
        pick.stance = pick.buyVolume >= pick.sellVolume ? "bullish" : "bearish";
        pick.confidence = computeConfidence(pick);
        return pick;
      })
      .sort((a, b) => b.confidence - a.confidence);

    const response = {
      period: snapshotPeriod,
      snapshotAt,
      since: since.toISOString(),
      summary: {
        totalVolume,
        tradesCount: trades.length,
        uniqueMarkets: groups.size,
        top20VolumeShare: totalVolume > 0 ? top20VolumeTotal / totalVolume : 0,
        top20TradeShare: trades.length > 0 ? top20TradeTotal / trades.length : 0,
      },
      picks,
      topPicks: picks.slice(0, 3).map((p) => ({
        id: p.id,
        eventTitle: p.eventTitle,
        outcome: p.outcome,
        marketQuestion: p.marketQuestion,
        confidence: p.confidence,
        stance: p.stance,
        buySellSkew: p.buySellSkew,
        top20Support: p.top20Support,
        bestRank: p.bestRank,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] ai-insights error:", error);
    return NextResponse.json({ error: "Failed to compute AI insights" }, { status: 500 });
  }
}
