import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateCompositeSignal,
  calculateMarketBaseline,
  calculatePercentiles,
  timeDecayWeight,
  clamp,
  directionConviction,
  type MarketBaseline,
  type EnhancedSignalMetrics,
} from "@/lib/signal-calculator";
import { EXPIRY_GRACE_MS, isMarketExpired } from "@/lib/utils";
import type { SignalFactors } from "@/lib/types";

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
  marketQuestion: string | null;
  latestPrice: number;
  isResolved: boolean;
  closeTime: string | null;
  resolutionTime: string | null;
  totalVolume: number;
  tradeCount: number;
  buyVolume: number;
  sellVolume: number;
  buySellSkew: number;
  top20Volume: number;
  top20Trades: number;
  top20WalletCount: number;
  top20Support: number;
  topTraderCount: number;
  topTraderBuyCount: number;
  topTraderSellCount: number;
  topTraderBuyVolume: number;
  topTraderSellVolume: number;
  topTraderVolume: number;
  topTraderDominantSide: "buy" | "sell" | null;
  topTraderDominantShare: number;
  topRanks: Array<{ address: string; rank: number; accountName: string | null; totalPnl: number }>;
  bestRank: number | null;
  stance: "bullish" | "bearish";
  confidence: number;
  latestTradeAt: string | null;

  // Enhanced quant metrics
  volumeZScore: number;
  hhiConcentration: number;
  rankWeightedScore: number;
  timeDecayedVolume: number;
  directionConviction: number;
  confidencePercentile: number;
  signalFactors: SignalFactors;
  isUnusualActivity: boolean;
  isConcentrated: boolean;

  // Internal tracking (not returned)
  _walletVolumes: Map<string, number>;
  _timeDecayedTop20Volume: number;
  _topTraderBuyers: Set<string>;
  _topTraderSellers: Set<string>;
  _topTraderBuyVolume: number;
  _topTraderSellVolume: number;
};

// Legacy confidence calculation for backwards compatibility fallback
function computeLegacyConfidence(pick: Omit<InsightPick, 'volumeZScore' | 'hhiConcentration' | 'rankWeightedScore' | 'timeDecayedVolume' | 'directionConviction' | 'confidencePercentile' | 'signalFactors' | 'isUnusualActivity' | 'isConcentrated' | '_walletVolumes' | '_timeDecayedTop20Volume' | '_topTraderBuyers' | '_topTraderSellers' | '_topTraderBuyVolume' | '_topTraderSellVolume'>): number {
  const { totalVolume, top20Volume, buyVolume, sellVolume, bestRank, topTraderCount, topTraderBuyCount, topTraderSellCount, topTraderBuyVolume, topTraderSellVolume } = pick;

  const volumeScore = clamp(Math.log10(totalVolume + 1) / 5);
  const whaleVolumeScore = totalVolume > 0 ? clamp(top20Volume / totalVolume) : 0;

  // Unique top trader alignment boost: strong boost once 2-3+ align on a side
  const dominantCount = Math.max(topTraderBuyCount, topTraderSellCount);
  const alignmentShare = topTraderCount > 0 ? dominantCount / topTraderCount : 0;
  const clusterBoost = clamp(dominantCount / 3); // caps at 3+ aligned traders
  const topTraderTotalVol = topTraderBuyVolume + topTraderSellVolume;
  const dominantTopTraderVol = Math.max(topTraderBuyVolume, topTraderSellVolume);
  const traderVolumeShare = totalVolume > 0 ? dominantTopTraderVol / totalVolume : 0;
  const topTraderVolumeBalance = topTraderTotalVol > 0 ? dominantTopTraderVol / topTraderTotalVol : 0;
  const alignmentScore = clamp(
    0.45 * alignmentShare +
    0.35 * clusterBoost +
    0.20 * clamp(topTraderVolumeBalance * 0.8 + traderVolumeShare)
  );

  const uniqueTraderScore = clamp(topTraderCount / 5); // more top traders involved
  const skewScore = totalVolume > 0 ? clamp(Math.abs(buyVolume - sellVolume) / totalVolume) : 0;
  const rankBoost = bestRank ? clamp((21 - bestRank) / 20) : 0;

  const weighted =
    alignmentScore * 0.45 +
    rankBoost * 0.15 +
    whaleVolumeScore * 0.15 +
    uniqueTraderScore * 0.10 +
    skewScore * 0.08 +
    volumeScore * 0.07;

  return Math.round(clamp(weighted, 0, 1) * 100);
}

export async function GET() {
  try {
    const now = new Date();
    const nowMs = now.getTime();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch latest leaderboard snapshots for each period and build a unified top-20 set
    const leaderboardPeriods = ["Daily", "Weekly", "Monthly", "All Time"] as const;

    const snapshots = await Promise.all(
      leaderboardPeriods.map(async (period) => {
        const latest = await prisma.walletLeaderboardSnapshot.findFirst({
          where: { period },
          orderBy: { snapshotAt: "desc" },
          select: { snapshotAt: true },
        });

        if (!latest?.snapshotAt) return null;

        const wallets = await prisma.walletLeaderboardSnapshot.findMany({
          where: { snapshotAt: latest.snapshotAt, period, rank: { lte: 100 } },
          orderBy: { rank: "asc" },
          select: { walletAddress: true, rank: true, totalPnl: true, accountName: true },
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

    // Create lookup maps using best rank per wallet across all periods
    const walletToRank = new Map<string, number>();
    const walletToInfo = new Map<string, LeaderboardWallet>();
    const top20Set = new Set<string>();

    for (const snap of validSnapshots) {
      for (const w of snap.wallets) {
        const key = w.walletAddress.toLowerCase();
        const existingRank = walletToRank.get(key);

        if (existingRank === undefined || w.rank < existingRank) {
          walletToRank.set(key, w.rank);
          walletToInfo.set(key, w);
        }

        if (w.rank <= 20) {
          top20Set.add(key);
        }
      }
    }

    // Fetch trades
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
        closeTime: true,
        resolutionTime: true,
      },
    });

    const groups = new Map<string, InsightPick>();

    // Phase 1: Aggregate trade data
    for (const trade of trades) {
      const walletKey = trade.walletAddress.toLowerCase();
      const isTop20 = top20Set.has(walletKey);
      const walletRank = walletToRank.get(walletKey);
      const key = `${trade.conditionId || trade.eventTitle || "unknown"}::${trade.outcome || "unknown"}`;
      const resolvedForTrade = isMarketExpired(
        trade.closeTime,
        trade.resolutionTime,
        EXPIRY_GRACE_MS,
        nowMs
      );
      const closeIso = trade.closeTime ? trade.closeTime.toISOString() : null;
      const resolutionIso = trade.resolutionTime ? trade.resolutionTime.toISOString() : null;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          conditionId: trade.conditionId ?? null,
          eventTitle: trade.eventTitle ?? trade.conditionId ?? "Unknown Market",
          eventSlug: trade.eventSlug ?? null,
          outcome: trade.outcome ?? null,
          marketQuestion: trade.question ?? null,
          latestPrice: trade.price,
          isResolved: resolvedForTrade,
          closeTime: closeIso,
          resolutionTime: resolutionIso,
          totalVolume: 0,
          tradeCount: 0,
          buyVolume: 0,
          sellVolume: 0,
          buySellSkew: 0,
          top20Volume: 0,
          top20Trades: 0,
          top20WalletCount: 0,
          top20Support: 0,
          topTraderCount: 0,
          topTraderBuyCount: 0,
          topTraderSellCount: 0,
          topTraderBuyVolume: 0,
          topTraderSellVolume: 0,
          topTraderVolume: 0,
          topTraderDominantSide: null,
          topTraderDominantShare: 0,
          topRanks: [],
          bestRank: null,
          stance: "bullish",
          confidence: 0,
          latestTradeAt: null,

          // Enhanced metrics (initialized)
          volumeZScore: 0,
          hhiConcentration: 0,
          rankWeightedScore: 0,
          timeDecayedVolume: 0,
          directionConviction: 0.5,
          confidencePercentile: 0,
          signalFactors: {
            volumeContribution: 0,
            rankContribution: 0,
            concentrationContribution: 0,
            recencyContribution: 0,
            directionContribution: 0,
            alignmentContribution: 0,
          },
          isUnusualActivity: false,
          isConcentrated: false,

          // Internal tracking
          _walletVolumes: new Map<string, number>(),
          _timeDecayedTop20Volume: 0,
          _topTraderBuyers: new Set<string>(),
          _topTraderSellers: new Set<string>(),
          _topTraderBuyVolume: 0,
          _topTraderSellVolume: 0,
        });
      }

      const pick = groups.get(key)!;
      if (!pick.closeTime && closeIso) {
        pick.closeTime = closeIso;
      }
      if (!pick.resolutionTime && resolutionIso) {
        pick.resolutionTime = resolutionIso;
      }
      pick.isResolved = pick.isResolved || resolvedForTrade;
      pick.totalVolume += trade.tradeValue;
      pick.tradeCount += 1;

      // Track latest price
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

      // Track ranked wallet activity (for rank-weighted scoring)
      if (walletRank !== undefined) {
        const currentWalletVol = pick._walletVolumes.get(walletKey) || 0;
        pick._walletVolumes.set(walletKey, currentWalletVol + trade.tradeValue);

        // Time-decayed volume for ranked wallets
        const decayWeight = timeDecayWeight(trade.timestamp, now);
        pick._timeDecayedTop20Volume += trade.tradeValue * decayWeight;
      }

      // Track top 20 specifically (for legacy compatibility)
      if (isTop20) {
        pick.top20Volume += trade.tradeValue;
        pick.top20Trades += 1;
        const lb = walletToInfo.get(walletKey)!;
        if (trade.side === "BUY") {
          pick._topTraderBuyers.add(walletKey);
          pick._topTraderBuyVolume += trade.tradeValue;
        } else if (trade.side === "SELL") {
          pick._topTraderSellers.add(walletKey);
          pick._topTraderSellVolume += trade.tradeValue;
        }
        if (!pick.topRanks.find((r) => r.address === walletKey)) {
          pick.topRanks.push({
            address: walletKey,
            rank: lb.rank,
            accountName: lb.accountName ?? null,
            totalPnl: lb.totalPnl,
          });
        }
      }
    }

    // Phase 2: Calculate market baseline for Z-scores
    const picksArray = Array.from(groups.values());
    for (const pick of picksArray) {
      const expired = isMarketExpired(
        pick.closeTime,
        pick.resolutionTime,
        EXPIRY_GRACE_MS,
        nowMs
      );
      if (expired) {
        pick.isResolved = true;
      }
    }
    const activePicks = picksArray.filter((p) => !p.isResolved);

    const allTop20Volumes = activePicks.map(p => p.top20Volume);
    const allTotalVolumes = activePicks.map(p => p.totalVolume);

    const baseline: MarketBaseline = calculateMarketBaseline(allTotalVolumes, allTop20Volumes);

    // Phase 3: Calculate enhanced metrics for each pick
    for (const pick of activePicks) {
      // Legacy metrics
      const buySellTotal = pick.buyVolume + pick.sellVolume;
      pick.buySellSkew = buySellTotal > 0 ? pick.buyVolume / buySellTotal : 0.5;
      pick.top20WalletCount = pick.topRanks.length;
      pick.top20Support = pick.tradeCount > 0 ? pick.top20Trades / pick.tradeCount : 0;
      const topTraderUnion = new Set([...pick._topTraderBuyers, ...pick._topTraderSellers]);
      pick.topTraderBuyCount = pick._topTraderBuyers.size;
      pick.topTraderSellCount = pick._topTraderSellers.size;
      pick.topTraderCount = topTraderUnion.size;
      pick.topTraderBuyVolume = pick._topTraderBuyVolume;
      pick.topTraderSellVolume = pick._topTraderSellVolume;
      pick.topTraderVolume = pick.topTraderBuyVolume + pick.topTraderSellVolume;
      const dominantCount = Math.max(pick.topTraderBuyCount, pick.topTraderSellCount);
      pick.topTraderDominantSide =
        pick.topTraderBuyCount > pick.topTraderSellCount ? "buy"
          : pick.topTraderSellCount > pick.topTraderBuyCount ? "sell"
            : null;
      pick.topTraderDominantShare = pick.topTraderCount > 0 ? dominantCount / pick.topTraderCount : 0;
      pick.bestRank = pick.topRanks.length > 0 ? Math.min(...pick.topRanks.map((r) => r.rank)) : null;
      pick.stance = pick.buyVolume >= pick.sellVolume ? "bullish" : "bearish";

      // Calculate composite signal using new calculator
      const signalInput = {
        totalVolume: pick.totalVolume,
        top20Volume: pick.top20Volume,
        timeDecayedTop20Volume: pick._timeDecayedTop20Volume,
        baseline,
        walletRanks: walletToRank,
        walletVolumes: pick._walletVolumes,
        buyVolume: pick.buyVolume,
        sellVolume: pick.sellVolume,
        topTraderVolume: {
          buyVolume: pick.topTraderBuyVolume,
          sellVolume: pick.topTraderSellVolume,
          totalVolume: pick.topTraderBuyVolume + pick.topTraderSellVolume,
        },
        topTraderAlignment: {
          totalTopTraders: pick.topTraderCount,
          buyCount: pick.topTraderBuyCount,
          sellCount: pick.topTraderSellCount,
        },
      };

      const enhancedMetrics = calculateCompositeSignal(signalInput);

      // Assign enhanced metrics
      pick.volumeZScore = enhancedMetrics.volumeZScore;
      pick.hhiConcentration = enhancedMetrics.hhiConcentration;
      pick.rankWeightedScore = enhancedMetrics.rankWeightedScore;
      pick.timeDecayedVolume = enhancedMetrics.timeDecayedVolume;
      pick.directionConviction = enhancedMetrics.directionConviction;
      pick.signalFactors = enhancedMetrics.signalFactors;
      pick.isUnusualActivity = enhancedMetrics.isUnusualActivity;
      pick.isConcentrated = enhancedMetrics.isConcentrated;

      // Legacy confidence (for backwards compatibility)
      pick.confidence = computeLegacyConfidence(pick);
    }

    // Phase 4: Calculate percentile rankings
    const rawConfidences = activePicks.map(p =>
      p.signalFactors.volumeContribution +
      p.signalFactors.rankContribution +
      p.signalFactors.concentrationContribution +
      p.signalFactors.recencyContribution +
      p.signalFactors.directionContribution +
      (p.signalFactors.alignmentContribution ?? 0)
    );

    const percentiles = calculatePercentiles(rawConfidences);

    for (let i = 0; i < activePicks.length; i++) {
      activePicks[i].confidencePercentile = percentiles[i];
    }

    // Phase 5: Filter and sort by new percentile ranking
    const picks = activePicks
      .filter(pick => pick.top20Trades > 0) // Strict user requirement: ONLY top 20 activity
      .map(pick => {
        // Remove internal tracking fields before returning
        const { _walletVolumes, _timeDecayedTop20Volume, _topTraderBuyers, _topTraderSellers, _topTraderBuyVolume, _topTraderSellVolume, ...cleanPick } = pick;
        return cleanPick;
      })
      .sort((a, b) => b.confidencePercentile - a.confidencePercentile);

    // Summary metrics derived from active picks only
    const totalVolume = activePicks.reduce((sum, p) => sum + p.totalVolume, 0);
    const tradesCount = activePicks.reduce((sum, p) => sum + p.tradeCount, 0);
    const top20VolumeTotal = activePicks.reduce((sum, p) => sum + p.top20Volume, 0);
    const top20TradeTotal = activePicks.reduce((sum, p) => sum + p.top20Trades, 0);
    const uniqueMarkets = new Set(
      activePicks.map((p) => p.conditionId || p.eventTitle || p.id)
    ).size;

    const response = {
      period: snapshotPeriod,
      snapshotAt,
      since: since.toISOString(),
      summary: {
        totalVolume,
        tradesCount,
        uniqueMarkets,
        top20VolumeShare: totalVolume > 0 ? top20VolumeTotal / totalVolume : 0,
        top20TradeShare: tradesCount > 0 ? top20TradeTotal / tradesCount : 0,
        // New: market baseline stats for context
        baseline: {
          meanTop20Volume: baseline.meanTop20Volume,
          stdDevTop20Volume: baseline.stdDevTop20Volume,
        },
      },
      picks,
      topPicks: picks.slice(0, 3).map((p) => ({
        id: p.id,
        eventTitle: p.eventTitle,
        outcome: p.outcome,
        marketQuestion: p.marketQuestion,
        confidence: p.confidence,
        confidencePercentile: p.confidencePercentile,
        stance: p.stance,
        buySellSkew: p.buySellSkew,
        top20Support: p.top20Support,
        bestRank: p.bestRank,
        volumeZScore: p.volumeZScore,
        isUnusualActivity: p.isUnusualActivity,
        isConcentrated: p.isConcentrated,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] ai-insights error:", error);
    return NextResponse.json({ error: "Failed to compute AI insights" }, { status: 500 });
  }
}
