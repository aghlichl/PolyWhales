"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAiInsights } from "@/lib/useAiInsights";
import { AiInsightPick, AiInsightRank } from "@/lib/types";
import { cn, formatShortNumber, isMarketExpired } from "@/lib/utils";
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight, Activity, Zap, ArrowUp, ArrowDown } from "lucide-react";
import { useScoreStore } from '@/lib/useScoreStore';
import { LiveScoreboard } from "@/components/live-scoreboard";
import svgPathsPrimary from "@/imports/svg-1ltd1kb2kd";
import svgPathsSecondary from "@/imports/svg-7cdl22zaum";
import { AiInsightsTradesModal } from "@/components/ai-insights-trades-modal";
import { motion, AnimatePresence } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { TraderTallyBoard } from "@/components/trader-tally-board";

type SortKey = "confidence" | "topTraders" | "volume";

const PAGE_SIZE = 20;

// Grouped event for stacked card deck
interface GroupedEvent {
  eventTitle: string;
  picks: AiInsightPick[];
  topPick: AiInsightPick;
}

const formatUsdCompact = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `$${formatShortNumber(value)}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Tier weights for trader quality differentiation
const TIER_WEIGHTS = {
  ELITE: 1.0,    // Rank 1-10
  GOLD: 0.6,     // Rank 11-30
  SILVER: 0.3,   // Rank 31-100
  BRONZE: 0.1,   // Rank 101-200
};

const getTierWeight = (rank: number): number => {
  if (rank <= 0 || rank > 200) return 0;
  if (rank <= 10) return TIER_WEIGHTS.ELITE;
  if (rank <= 30) return TIER_WEIGHTS.GOLD;
  if (rank <= 100) return TIER_WEIGHTS.SILVER;
  return TIER_WEIGHTS.BRONZE;
};

const countTiers = (topRanks: Array<{ rank: number }>) => {
  let elite = 0, gold = 0, silver = 0, bronze = 0;
  for (const { rank } of topRanks) {
    if (rank <= 10) elite++;
    else if (rank <= 30) gold++;
    else if (rank <= 100) silver++;
    else if (rank <= 200) bronze++;
  }
  return { elite, gold, silver, bronze };
};

const computeAdjustedConfidence = (pick: Partial<AiInsightPick> & { confidence: number }) => {
  // Use backend percentile as the primary signal - it already has sophisticated weighting
  const base = pick.confidencePercentile ?? pick.confidence ?? 0;

  // Calculate tier-weighted trader count from topRanks
  const topRanks = pick.topRanks ?? [];
  let weightedCount = 0;
  for (const { rank } of topRanks) {
    weightedCount += getTierWeight(rank);
  }

  // Volume dominance (how one-sided is the volume?)
  const buyVol = pick.topTraderBuyVolume ?? 0;
  const sellVol = pick.topTraderSellVolume ?? 0;
  const volumeForDelta = buyVol + sellVol;
  const volumeDominance = volumeForDelta > 0
    ? Math.abs((buyVol - sellVol) / (volumeForDelta + 1e-6))
    : 0;

  // Count dominance (how aligned are traders on one side?)
  const buyCount = pick.topTraderBuyCount ?? 0;
  const sellCount = pick.topTraderSellCount ?? 0;
  const countedTotal = buyCount + sellCount;
  const countDominance = countedTotal > 0
    ? Math.abs((buyCount - sellCount) / (countedTotal + 1e-6))
    : volumeDominance;

  // Consensus combines count and volume dominance
  const consensus = 0.5 * countDominance + 0.5 * volumeDominance;

  // LOGARITHMIC crowd factor with tier weighting
  // Uses log scaling so going from 1->2 elite traders matters more than 10->11 bronze
  // log2(weightedCount + 1) / log2(8) gives: 0->0, 1->0.33, 2->0.53, 4->0.77, 8->1.0
  // Scaled to 0.88-1.02 range (much more conservative than old 0.78-1.15)
  const logFactor = Math.log2(weightedCount + 1) / Math.log2(8);
  const crowdFactor = 0.88 + 0.14 * clamp(logFactor, 0, 1);

  // Consensus boost: slight increase for clear conviction (max +3%)
  const consensusBoost = 1 + 0.03 * consensus;

  // Combined adjustment factor (much more conservative)
  const factorRaw = crowdFactor * consensusBoost;
  const factor = clamp(factorRaw, 0.85, 1.05);

  return clamp(Math.round(base * factor), 1, 99);
};

const confidenceToGrade = (score: number) => {
  // Tightened thresholds to spread distribution across full range
  // A+ is now reserved for truly exceptional signals (top ~1-2%)
  if (score >= 99) return "A+";  // was 97 - elite signals only
  if (score >= 95) return "A";   // was 93
  if (score >= 91) return "A-";  // was 90
  if (score >= 87) return "B+";  // unchanged
  if (score >= 83) return "B";   // unchanged
  if (score >= 78) return "B-";  // was 80
  if (score >= 72) return "C+";  // was 76
  if (score >= 65) return "C";   // was 72
  if (score >= 58) return "C-";  // was 68
  if (score >= 50) return "D";   // was 60
  return "F";
};

const getDisplayConfidence = (pick: Partial<AiInsightPick> & { confidence: number }) => {
  return computeAdjustedConfidence(pick);
};

const getConfidenceGrade = (pick: Partial<AiInsightPick> & { confidence: number }) => {
  return confidenceToGrade(getDisplayConfidence(pick));
};

const formatCents = (value: number) => {
  const cents = Math.round(value * 100);
  return `${cents}¢`;
};

const getWhaleVolumeDisplay = (pick: Partial<AiInsightPick>) => {
  const explicitTopVolume = pick.topTraderVolume;
  const derivedTopVolume = (pick.topTraderBuyVolume ?? 0) + (pick.topTraderSellVolume ?? 0);
  const volume = explicitTopVolume ?? derivedTopVolume;
  if (!volume || Number.isNaN(volume) || volume <= 0) return null;
  return formatUsdCompact(volume);
};

type AccentStop = {
  offset?: number;
  color: string;
  opacity?: number;
};

type AccentGradient = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  stops: AccentStop[];
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
};

type AccentShape = {
  source: "primary" | "secondary";
  pathKey: string;
  viewBox: string;
  className: string;
  gradient: AccentGradient;
  fillOpacity?: number;
  style?: React.CSSProperties;
};

type AccentVariant = {
  shapes: AccentShape[];
};

const mintToPinkStops: AccentStop[] = [
  { color: "#ACFF42" },
  { offset: 0.281306, color: "#6ADBFF" },
  { offset: 0.412956, color: "#56D1FF" },
  { offset: 0.947917, color: "#F7C7FF" },
];

const dualWaveStops: AccentStop[] = [
  { color: "#FFFFFF" },
  { offset: 0.0001, color: "#003F53" },
  { offset: 1, color: "#FFFFFF" },
];

const limeGlowStops: AccentStop[] = [
  { color: "#65B145" },
  { offset: 0.0572917, color: "#C5DCFF", opacity: 0.15 },
  { offset: 0.81053, color: "#90FF61" },
];

const accentVariants: AccentVariant[] = [
  {
    shapes: [
      {
        source: "primary",
        pathKey: "p191bd700",
        viewBox: "0 0 1083 2174",
        className: "pointer-events-none absolute -right-16 top-1/4 w-36 h-56 opacity-75",
        fillOpacity: 0.8,
        gradient: {
          x1: 805.503,
          x2: 811.003,
          y1: 284.5,
          y2: 1910.5,
          stops: mintToPinkStops,
          gradientUnits: "userSpaceOnUse",
        },
      },
      {
        source: "primary",
        pathKey: "p103b2f80",
        viewBox: "0 0 1589 1040",
        className: "pointer-events-none absolute -left-20 -bottom-16 w-80 h-48 rotate-180 scale-y-[-100%] opacity-75",
        fillOpacity: 0.9,
        gradient: {
          x1: 1201,
          x2: 1196.5,
          y1: 258,
          y2: 867.5,
          stops: dualWaveStops,
          gradientUnits: "userSpaceOnUse",
        },
      },
      {
        source: "primary",
        pathKey: "p16d23600",
        viewBox: "0 0 1291 3433",
        className: "pointer-events-none absolute right-1/4 -top-32 w-20 h-72",
        style: { opacity: 0.55 },
        gradient: {
          x1: 308.661,
          x2: 1258.16,
          y1: 1952.5,
          y2: 3170,
          stops: limeGlowStops,
          gradientUnits: "userSpaceOnUse",
        },
      },
    ],
  },
  {
    shapes: [
      {
        source: "secondary",
        pathKey: "p191bd700",
        viewBox: "0 0 1083 2174",
        className: "pointer-events-none absolute -left-10 top-10 w-28 h-60 rotate-6 opacity-70",
        fillOpacity: 0.85,
        gradient: {
          x1: 805.503,
          x2: 811.003,
          y1: 284.5,
          y2: 1910.5,
          stops: mintToPinkStops,
        },
      },
      {
        source: "secondary",
        pathKey: "p11044800",
        viewBox: "0 0 1806 1806",
        className: "pointer-events-none absolute right-[-72px] top-1/3 w-60 h-60 opacity-50 blur-[1px]",
        gradient: {
          x1: 900,
          x2: 900,
          y1: 0,
          y2: 1806,
          stops: dualWaveStops,
        },
      },
      {
        source: "secondary",
        pathKey: "p1f460800",
        viewBox: "0 0 1164 1895",
        className: "pointer-events-none absolute -right-6 -bottom-12 w-48 h-40 opacity-60",
        fillOpacity: 0.8,
        gradient: {
          x1: 600,
          x2: 620,
          y1: 0,
          y2: 1895,
          stops: limeGlowStops,
        },
      },
    ],
  },
  {
    shapes: [
      {
        source: "primary",
        pathKey: "p223b69a0",
        viewBox: "0 0 1806 1806",
        className: "pointer-events-none absolute right-1/4 -top-12 w-44 h-44 opacity-65",
        gradient: {
          x1: 200,
          x2: 1600,
          y1: 120,
          y2: 1680,
          stops: mintToPinkStops,
        },
      },
      {
        source: "primary",
        pathKey: "p103b2f80",
        viewBox: "0 0 1589 1040",
        className: "pointer-events-none absolute left-[-220px] top-2/3 w-72 h-44 rotate-12 opacity-45 blur-[1px]",
        fillOpacity: 0.9,
        gradient: {
          x1: 1201,
          x2: 1196.5,
          y1: 258,
          y2: 867.5,
          stops: dualWaveStops,
          gradientUnits: "userSpaceOnUse",
        },
      },
      {
        source: "primary",
        pathKey: "p16b83200",
        viewBox: "0 0 1802 4152",
        className: "pointer-events-none absolute -right-28 bottom-[-160px] w-16 h-64 opacity-55 rotate-3 blur-[1px]",
        gradient: {
          x1: 308.661,
          x2: 1258.16,
          y1: 1952.5,
          y2: 3170,
          stops: limeGlowStops,
        },
      },
    ],
  },
  {
    shapes: [
      {
        source: "secondary",
        pathKey: "p11e82280",
        viewBox: "0 0 1469 2174",
        className: "pointer-events-none absolute left-[38%] -top-28 w-16 h-64 opacity-55 blur-[1px]",
        fillOpacity: 0.85,
        gradient: {
          x1: 308.661,
          x2: 1258.16,
          y1: 1952.5,
          y2: 3170,
          stops: limeGlowStops,
        },
      },
      {
        source: "secondary",
        pathKey: "p103b2f80",
        viewBox: "0 0 1589 1040",
        className: "pointer-events-none absolute -left-40 -bottom-24 w-64 h-40 rotate-180 scale-y-[-100%] opacity-45 blur-[1px]",
        fillOpacity: 0.9,
        gradient: {
          x1: 1201,
          x2: 1196.5,
          y1: 258,
          y2: 867.5,
          stops: dualWaveStops,
        },
      },
      {
        source: "secondary",
        pathKey: "p237c5580",
        viewBox: "0 0 2066 2236",
        className: "pointer-events-none absolute right-[-160px] bottom-12 w-60 h-24 opacity-30 blur-[1px]",
        gradient: {
          x1: 308.661,
          x2: 1258.16,
          y1: 1952.5,
          y2: 3170,
          stops: mintToPinkStops,
        },
      },
    ],
  },
  {
    shapes: [
      {
        source: "primary",
        pathKey: "p89b5a80",
        viewBox: "0 0 1589 1040",
        className: "pointer-events-none absolute left-[-160px] top-16 w-64 h-40 opacity-55 blur-[1px]",
        gradient: {
          x1: 1201,
          x2: 1196.5,
          y1: 258,
          y2: 867.5,
          stops: dualWaveStops,
        },
      },
      {
        source: "secondary",
        pathKey: "p36bbd40",
        viewBox: "0 0 1470 2174",
        className: "pointer-events-none absolute right-[-12px] top-[-120px] w-20 h-72 opacity-50 rotate-3 blur-[1px]",
        fillOpacity: 0.85,
        gradient: {
          x1: 308.661,
          x2: 1258.16,
          y1: 1952.5,
          y2: 3170,
          stops: limeGlowStops,
        },
      },
    ],
  },
];

// --- Types & Data Helpers ---



function extractMarketContext(question: string | null | undefined, outcome: string | null | undefined): string {
  if (!question) return outcome || "Unknown";
  const q = question.toLowerCase();
  const out = (outcome || "").toLowerCase();

  // Try to be smart about sports lines
  const spreadMatch = question.match(/([+-]\d+\.?\d*)/i);
  if (spreadMatch && (q.includes('cover') || q.includes('spread'))) {
    return `${outcome} ${spreadMatch[1]}`;
  }

  const totalMatch = question.match(/(\d+\.?\d*)/);
  if (out === 'over' || out === 'under') {
    if (totalMatch) return `${outcome} ${totalMatch[1]}`;
    return outcome || "Unknown";
  }

  if (q.includes('win') || q.includes('winner') || q.includes('moneyline')) {
    return `${outcome} ML`;
  }

  if ((out === 'yes' || out === 'no') && question.length > 0) {
    const cleanQ = question.replace(/^will\s+/i, '').replace(/\?$/i, '');
    const truncated = cleanQ.length > 35 ? cleanQ.slice(0, 32) + '...' : cleanQ;
    return `${outcome}: ${truncated}`;
  }

  return outcome || "Unknown";
}

// --- Main Component ---

export function AIInsightsPanel() {
  const { data, isLoading, refresh } = useAiInsights(90_000);
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [selectedPick, setSelectedPick] = useState<AiInsightPick | null>(null);
  const [selectedTrader, setSelectedTrader] = useState<AiInsightRank | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Poll for live scores
  useEffect(() => useScoreStore.getState().startPolling(), []);

  const activePicks = useMemo(() => {
    const graceMs = 12 * 60 * 60 * 1000; // keep markets visible for 4h after start/close
    return (
      data?.picks?.filter(
        (pick) => !pick.isResolved && !isMarketExpired(pick.closeTime, pick.resolutionTime, graceMs)
      ) ?? []
    );
  }, [data?.picks]);

  // Featured: Top 5 by confidence then volume
  const featuredTrades = useMemo(() => {
    if (!activePicks.length) return [];
    return [...activePicks]
      .map((pick) => ({ pick, displayConfidence: getDisplayConfidence(pick) }))
      .sort((a, b) => {
        if (b.displayConfidence !== a.displayConfidence) return b.displayConfidence - a.displayConfidence;
        return b.pick.totalVolume - a.pick.totalVolume;
      })
      .slice(0, 5)
      .map((entry) => entry.pick);
  }, [activePicks]);

  // Auto-rotate
  useEffect(() => {
    if (!featuredTrades.length || isHovering) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredTrades.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [featuredTrades.length, isHovering]);

  const sortedPicks = useMemo(() => {
    if (!activePicks.length) return [];
    const picks = [...activePicks];
    picks.sort((a, b) => {
      if (sortKey === "volume") return b.totalVolume - a.totalVolume;
      if (sortKey === "topTraders") return (b.topTraderCount || 0) - (a.topTraderCount || 0);
      return getDisplayConfidence(b) - getDisplayConfidence(a);
    });
    return picks.slice(0, 50);
  }, [activePicks, sortKey]);

  // Group picks by eventTitle for stacked card deck
  const groupedEvents = useMemo<GroupedEvent[]>(() => {
    if (!sortedPicks.length) return [];

    const eventMap = new Map<string, AiInsightPick[]>();

    for (const pick of sortedPicks) {
      const key = pick.eventTitle || "Unknown Event";
      const existing = eventMap.get(key);
      if (existing) {
        existing.push(pick);
      } else {
        eventMap.set(key, [pick]);
      }
    }

    // Convert to grouped events, sorting picks within group by confidence
    const groups: GroupedEvent[] = [];
    for (const [eventTitle, picks] of eventMap) {
      // Sort picks within group by confidence (highest first)
      const sortedGroupPicks = [...picks].sort(
        (a, b) => getDisplayConfidence(b) - getDisplayConfidence(a)
      );
      groups.push({
        eventTitle,
        picks: sortedGroupPicks,
        topPick: sortedGroupPicks[0],
      });
    }

    // Sort groups by the top pick's sort key
    groups.sort((a, b) => {
      if (sortKey === "volume") return b.topPick.totalVolume - a.topPick.totalVolume;
      if (sortKey === "topTraders") return (b.topPick.topTraderCount || 0) - (a.topPick.topTraderCount || 0);
      return getDisplayConfidence(b.topPick) - getDisplayConfidence(a.topPick);
    });

    return groups;
  }, [sortedPicks, sortKey]);

  const visibleGroups = useMemo(
    () => groupedEvents.slice(0, visibleCount),
    [groupedEvents, visibleCount]
  );

  const hasMore = visibleCount < groupedEvents.length;

  useEffect(() => {
    setVisibleCount(Math.min(PAGE_SIZE, groupedEvents.length));
  }, [groupedEvents.length, sortKey]);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, groupedEvents.length));
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [hasMore, isLoading, groupedEvents.length]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const hasFeatured = featuredTrades.length > 0;

  return (
    <div className="relative space-y-12 pb-12">
      {/* Featured Carousel */}
      {hasFeatured && (
        <div
          className="relative w-full"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >


          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 h-[340px]">
            {/* Main Featured Card */}
            <div className="relative h-full perspective-[2000px] group">
              <AnimatePresence mode="wait">
                <motion.div
                  key={featuredTrades[activeIndex].id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.4, ease: "circOut" }}
                  className="absolute inset-0 z-10"
                >
                  <FeaturedCard
                    pick={featuredTrades[activeIndex]}
                    onClick={() => setSelectedPick(featuredTrades[activeIndex])}
                    variantIndex={activeIndex}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Side List Navigation (hide on md and below) */}
            <div className="hidden md:flex flex-col gap-2 h-full overflow-y-auto no-scrollbar pr-1">
              {featuredTrades.map((pick, idx) => (
                <button
                  key={pick.id}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "flex-1 flex flex-col justify-center px-4 py-3 text-left transition-all border-l-2",
                    activeIndex === idx
                      ? "bg-white/5 border-primary"
                      : "bg-transparent border-white/5 hover:bg-white/5 hover:border-white/20"
                  )}
                >
                  {(() => {
                    const confidence = getDisplayConfidence(pick);
                    const grade = getConfidenceGrade(pick);
                    return (
                      <>
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className={cn(
                            "text-[10px] uppercase font-bold tracking-wider",
                            pick.stance === "bullish" ? "text-emerald-400" : "text-rose-400"
                          )}>
                            {pick.stance === "bullish" ? "▲ Buy" : "▼ Sell"}
                          </span>
                          <span className={cn(
                            "font-mono text-sm font-bold flex items-baseline gap-2",
                            activeIndex === idx ? "text-white" : "text-zinc-500"
                          )}>
                            <span>{grade}</span>
                            <span className="text-[10px] text-zinc-500">{confidence}%</span>
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 line-clamp-1">
                          {extractMarketContext(pick.marketQuestion, pick.outcome)}
                        </div>
                      </>
                    );
                  })()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Signal Feed (Table List) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              Recent Signals Feed
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex p-0.5 backdrop-blur-sm bg-black/60 border border-white/10 rounded-2xl shadow-2xl">
              {(["confidence", "volume"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition-all border border-transparent rounded-xl",
                    sortKey === key
                      ? "bg-white/10 text-white border-white/10"
                      : "text-zinc-400 hover:text-zinc-300"
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="group p-2 backdrop-blur-sm bg-black/60 border border-white/10 rounded-2xl shadow-2xl text-zinc-400 hover:text-white hover:bg-black/70 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {visibleGroups.map((group) => {
            const isVersus = group.eventTitle?.toLowerCase().includes(" vs.");
            if (isVersus) {
              return (
                <VersusMatchupCard
                  key={group.eventTitle}
                  group={group}
                  onSelectOutcome={setSelectedPick}
                  onSelectTrader={setSelectedTrader}
                />
              );
            }
            return (
              <GroupedSignalCard
                key={group.eventTitle}
                group={group}
                onSelectOutcome={setSelectedPick}
              />
            );
          })}
          {hasMore && (
            <div
              ref={lastElementRef}
              className="h-10 w-full backdrop-blur-sm bg-black/60 border border-white/10 rounded-2xl shadow-2xl text-[10px] uppercase tracking-[0.2em] text-zinc-400 flex items-center justify-center"
            >
              {isLoading ? "Loading..." : "Loading more signals..."}
            </div>
          )}
        </div>
      </div>

      <AiInsightsTradesModal
        pick={selectedPick}
        trader={selectedTrader ? {
          walletAddress: selectedTrader.address,
          displayName: selectedTrader.accountName,
          rank: selectedTrader.rank,
          totalPnl: selectedTrader.totalPnl,
          outcomeVolumeUsd: selectedTrader.outcomeVolumeUsd,
        } : null}
        onClose={() => { setSelectedPick(null); setSelectedTrader(null); }}
      />
    </div>
  );
}

// --- Sub-Components ---

function GlassAccents({ variantIndex }: { variantIndex: number }) {
  const variant = accentVariants[variantIndex % accentVariants.length];
  const maskStyle: React.CSSProperties = {
    maskImage: "radial-gradient(140% 140% at 50% 50%, #000 55%, transparent 95%)",
    WebkitMaskImage: "radial-gradient(140% 140% at 50% 50%, #000 55%, transparent 95%)",
  };

  return (
    <>
      {variant.shapes.map((shape, idx) => {
        const gradientId = `glass_card_grad_${variantIndex}_${idx}`;
        const source = shape.source === "primary" ? svgPathsPrimary : svgPathsSecondary;
        const path = (source as Record<string, string>)[shape.pathKey];
        if (!path) return null;

        return (
          <div
            key={gradientId}
            className={shape.className}
            style={{ ...maskStyle, ...shape.style }}
            aria-hidden
          >
            <svg
              className="block size-full"
              fill="none"
              preserveAspectRatio="none"
              viewBox={shape.viewBox}
            >
              <path d={path} fill={`url(#${gradientId})`} fillOpacity={shape.fillOpacity ?? 1} />
              <defs>
                <linearGradient
                  id={gradientId}
                  x1={shape.gradient.x1}
                  x2={shape.gradient.x2}
                  y1={shape.gradient.y1}
                  y2={shape.gradient.y2}
                  gradientUnits={shape.gradient.gradientUnits ?? "userSpaceOnUse"}
                >
                  {shape.gradient.stops.map((stop, stopIdx) => (
                    <stop
                      key={stopIdx}
                      offset={stop.offset ?? 0}
                      stopColor={stop.color}
                      stopOpacity={stop.opacity}
                    />
                  ))}
                </linearGradient>
              </defs>
            </svg>
          </div>
        );
      })}
    </>
  );
}

function FeaturedCard({ pick, onClick, variantIndex }: { pick: AiInsightPick; onClick: () => void; variantIndex: number }) {
  const confidence = getDisplayConfidence(pick);
  const grade = getConfidenceGrade(pick);
  const isBullish = pick.stance === "bullish";

  return (
    <div
      onClick={onClick}
      className="relative h-full w-full cursor-pointer overflow-hidden rounded-3xl border border-white/5 bg-black hover:border-white/10 transition-colors group"
    >
      <GlassAccents variantIndex={variantIndex} />
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay" aria-hidden />
      {/* <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/5 via-transparent to-white/5" aria-hidden /> */}

      <div className="absolute inset-4 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md p-8 flex flex-col justify-between shadow-2xl z-10">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 border text-xs font-mono uppercase tracking-wider rounded-full",
                isBullish
                  ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                  : "border-rose-500/40 text-rose-300 bg-rose-500/10"
              )}
            >
              {isBullish ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isBullish ? "Bullish" : "Bearish"}
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-zinc-300">
              {pick.isUnusualActivity && (
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-amber-300">
                  <Zap className="w-3 h-3 fill-amber-300" /> High Activity
                </span>
              )}
              <span className="text-zinc-400">Vol {formatUsdCompact(pick.totalVolume)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-white leading-tight max-w-[92%]">
              {pick.eventTitle}
            </h3>
            <p className="text-sm text-zinc-300 font-light flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-zinc-500" />
              {extractMarketContext(pick.marketQuestion, pick.outcome)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] items-end gap-4 md:gap-6 pt-6 border-t border-white/10">
          <div className="space-y-1">
            <div
              className={cn(
                "text-4xl font-black tracking-tight leading-none",
                isBullish ? "text-emerald-300" : "text-rose-300"
              )}
            >
              {grade}
            </div>
            <div className="text-xs text-zinc-500 font-mono tracking-tight leading-none">
              {confidence}%
            </div>
          </div>

          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Price</div>
            <div className="text-2xl text-white font-mono tracking-tight">
              {formatCents(pick.latestPrice || 0)}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Whales</div>
            <div className="text-2xl text-white font-mono tracking-tight">
              {pick.topTraderCount || 0}
            </div>
          </div>

          <div className="flex items-center justify-start sm:justify-end">
            <div className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
              <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// Specialized card for Head-to-Head matchups (e.g. Sports)
// Specialized card for Head-to-Head matchups (e.g. Sports)
function VersusMatchupCard({
  group,
  onSelectOutcome,
  onSelectTrader,
}: {
  group: GroupedEvent;
  onSelectOutcome: (pick: AiInsightPick) => void;
  onSelectTrader?: (trader: AiInsightRank) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Strict assumption per user request: [Away] vs [Home]
  const titleParts = group.eventTitle.split(/\s+vs\.?\s+/i);
  const awayName = titleParts[0]?.trim();
  const homeName = titleParts[1]?.trim();

  // Try to match live game data using individual team names instead of full title
  const liveGame = useScoreStore(state =>
    state.getGameForTeam(awayName || homeName || group.topPick.eventTitle || "")
  );

  // Bucket picks into Away ML, Home ML, and Other (Spreads/Totals/Props)
  const { awayML, homeML, otherPicks } = useMemo(() => {
    let awayPick: AiInsightPick | undefined;
    let homePick: AiInsightPick | undefined;
    const others: AiInsightPick[] = [];

    // Heuristic: If outcome name matches team name, it's a Moneyline bet
    group.picks.forEach(pick => {
      const outcome = pick.outcome?.toLowerCase() || "";
      const q = pick.marketQuestion?.toLowerCase() || "";

      // Strict matching for ML: outcome must "include" team name but NOT be a spread/total
      // Actually standard Polymarket sports ML outcome IS the team name.
      const isSpread = q.includes("handicap") || q.includes("spread") || outcome.match(/[+-]\d+(\.\d+)?$/);
      const isTotal = q.includes("total") || q.includes("over/under") || outcome.startsWith("over") || outcome.startsWith("under");

      if (!isSpread && !isTotal) {
        if (outcome.includes(awayName?.toLowerCase() || "___")) {
          if (!awayPick || getDisplayConfidence(pick) > getDisplayConfidence(awayPick)) {
            if (awayPick) others.push(awayPick);
            awayPick = pick;
          } else {
            others.push(pick);
          }
          return;
        }
        if (outcome.includes(homeName?.toLowerCase() || "___")) {
          if (!homePick || getDisplayConfidence(pick) > getDisplayConfidence(homePick)) {
            if (homePick) others.push(homePick);
            homePick = pick;
          } else {
            others.push(pick);
          }
          return;
        }
      }
      others.push(pick);
    });

    return {
      awayML: awayPick,
      homeML: homePick,
      otherPicks: others.sort((a, b) => getDisplayConfidence(b) - getDisplayConfidence(a))
    };
  }, [group.picks, awayName, homeName]);

  // Use raw confidence scores
  const { awayConf, homeConf } = useMemo(() => {
    const rawAway = awayML ? getDisplayConfidence(awayML) : 0;
    const rawHome = homeML ? getDisplayConfidence(homeML) : 0;

    return {
      awayConf: rawAway,
      homeConf: rawHome
    };
  }, [awayML, homeML]);

  // Colors from API or default (with contrast adjustment)
  const adjustColor = (c?: string) => {
    if (!c) return "#ffffff";
    const hex = c.toLowerCase();
    if (hex === "#000000" || hex === "#000" || hex === "black") return "#ffffff";
    // Check brightness for very dark colors
    if (hex.startsWith("#")) {
      try {
        const h = hex.replace("#", "");
        const r = parseInt(h.length === 3 ? h[0] + h[0] : h.substring(0, 2), 16);
        const g = parseInt(h.length === 3 ? h[1] + h[1] : h.substring(2, 4), 16);
        const b = parseInt(h.length === 3 ? h[2] + h[2] : h.substring(4, 6), 16);
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma < 20) return "#ffffff";
      } catch (e) { }
    }
    return c;
  };

  const awayColor = adjustColor(liveGame?.awayTeamColor || liveGame?.awayTeamAltColor || "#3b82f6"); // Blue default
  const homeColor = adjustColor(liveGame?.homeTeamColor || liveGame?.homeTeamAltColor || "#ef4444"); // Red default

  // Combined Chart Data
  const chartData = useMemo(() => {
    if (!awayML && !homeML) return [];

    // Merge histories based on timestamp
    const map = new Map<number, { time: number; away?: number; home?: number }>();

    if (awayML?.confidenceHistory) {
      awayML.confidenceHistory.forEach(h => {
        const t = new Date(h.timestamp).getTime();
        const existing = map.get(t) || { time: t };
        existing.away = h.value;
        map.set(t, existing);
      });
    } else if (awayML) {
      // Single point
      const t = Date.now();
      map.set(t, { time: t, away: getDisplayConfidence(awayML) });
    }

    if (homeML?.confidenceHistory) {
      homeML.confidenceHistory.forEach(h => {
        const t = new Date(h.timestamp).getTime();
        const existing = map.get(t) || { time: t };
        existing.home = h.value;
        map.set(t, existing);
      });
    } else if (homeML) {
      const t = Date.now();
      const existing = map.get(t) || { time: t };
      existing.home = getDisplayConfidence(homeML);
      map.set(t, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.time - b.time).map(point => {
      if (point.away !== undefined && point.home !== undefined) {
        const delta = point.away - point.home;
        return {
          time: point.time,
          away: Math.max(1, Math.min(99, 50 + delta / 2)),
          home: Math.max(1, Math.min(99, 50 - delta / 2))
        };
      }
      return point;
    });
  }, [awayML, homeML]);

  // Helper to render stats for a ML side
  const renderMLStats = (pick: AiInsightPick | undefined, color: string, alignRight: boolean, overrideConfidence?: number) => {
    if (!pick) return <div className="flex-1 opacity-20 text-xs flex items-center justify-center">No Data</div>;

    const confidence = overrideConfidence ?? getDisplayConfidence(pick);
    // Aggregator logic (reused)
    let gold = 0;
    pick.topRanks.forEach(r => { if (r.rank <= 20) gold++; });

    return (
      <div
        onClick={() => onSelectOutcome(pick)}
        className={cn(
          "flex-1 flex flex-col justify-between py-1 cursor-pointer hover:bg-white/5 rounded-xl px-2 transition-colors",
          alignRight ? "items-end text-right" : "items-start text-left"
        )}
      >
        <div className="space-y-0.5">
          <div className={cn("text-xs font-bold truncate max-w-[120px]", alignRight && "ml-auto")}>
            {extractMarketContext(pick.marketQuestion, pick.outcome)}
          </div>
          {pick.latestPrice > 0 && (
            <div className={cn("text-lg font-mono leading-none tracking-tight", alignRight && "ml-auto")}>
              {formatCents(pick.latestPrice)}
              {(() => {
                const change = pick.snapshotPrice ? pick.latestPrice - pick.snapshotPrice : 0;
                if (Math.abs(change) >= 0.001) {
                  const isUp = change > 0;
                  return (
                    <span className={cn("text-[10px] ml-1.5 align-top", isUp ? "text-emerald-400" : "text-rose-400")}>
                      {isUp ? "↑" : "↓"}{Math.round(Math.abs(change) * 100)}¢
                    </span>
                  )
                }
                return null;
              })()}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className={cn("text-[10px] text-zinc-500 font-mono", alignRight ? "justify-end" : "justify-start")}>
            Vol {formatUsdCompact(pick.totalVolume)}
          </div>
          <div className={cn("flex flex-col", alignRight ? "items-end" : "items-start")}>
            <div className="text-xl font-black leading-none" style={{ color }}>
              {alignRight ? `${homeName} ${awayConf > homeConf ? '-' : '+'}${Math.abs(Math.round(awayConf - homeConf))}%` : `${awayName} ${awayConf > homeConf ? '+' : '-'}${Math.abs(Math.round(awayConf - homeConf))}%`}
            </div>
            <div className="text-[9px] text-zinc-600 font-mono">{confidence}% Conf</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative backdrop-blur-sm bg-black/60 border border-white/10 rounded-2xl shadow-2xl overflow-hidden group">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/20">
        <h4 className="text-sm text-zinc-200 font-bold tracking-tight px-1 flex gap-2">
          <span style={{ color: awayColor }}>{awayName}</span>
          <span className="text-zinc-600">vs</span>
          <span style={{ color: homeColor }}>{homeName}</span>
        </h4>
        {liveGame && (
          <LiveScoreboard game={liveGame} className="py-0.5 px-2 text-[10px] gap-2 mr-2 scale-90 origin-right" />
        )}
      </div>

      {/* Main Content: ML Stats + Combined Chart */}
      <div className="flex h-[140px] relative">
        {/* Away Stats */}
        <div className="w-[120px] sm:w-[160px] flex flex-col border-r border-white/5 p-2 bg-gradient-to-r from-white/[0.02] to-transparent">
          {renderMLStats(awayML, awayColor, false, awayConf)}
        </div>

        {/* Combined Chart */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 top-4 bottom-4 px-2 opacity-60 hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad_away" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={awayColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={awayColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad_home" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={homeColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={homeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                <Tooltip
                  content={({ payload, label }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div className="bg-black/90 border border-white/10 px-3 py-2 rounded-lg text-xs shadow-xl backdrop-blur-md">
                        <div className="mb-1 text-zinc-500 font-mono text-[10px]">
                          {label && typeof label === 'number' ? new Date(label).toLocaleTimeString() : 'N/A'}
                        </div>
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex items-center gap-2 mb-0.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: entry.color }} />
                            <span className="text-zinc-300">
                              {entry.name === 'away' ? awayName : homeName}:
                            </span>
                            <span className="font-bold text-white ml-auto">
                              {Math.round(entry.value)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="away"
                  name="away"
                  stroke={awayColor}
                  strokeWidth={2}
                  fill="url(#grad_away)"
                  connectNulls
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="home"
                  name="home"
                  stroke={homeColor}
                  strokeWidth={2}
                  fill="url(#grad_home)"
                  connectNulls
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>


        </div>

        {/* Home Stats */}
        <div className="w-[120px] sm:w-[160px] flex flex-col border-l border-white/5 p-2 bg-gradient-to-l from-white/[0.02] to-transparent">
          {renderMLStats(homeML, homeColor, true, homeConf)}
        </div>
      </div>

      {/* Top Traders Tally Board */}
      <TraderTallyBoard
        awayTraders={awayML?.topRanks || []}
        homeTraders={homeML?.topRanks || []}
        awayLabel={awayName}
        homeLabel={homeName}
        awayColor={awayColor}
        homeColor={homeColor}
        onTraderClick={(trader, side) => {
          if (!onSelectTrader) return;
          const pick = side === "away" ? awayML : homeML;
          if (pick) {
            // We also need to select the outcome so the modal has context
            onSelectOutcome(pick);
            onSelectTrader(trader);
          }
        }}
      />

      {/* Footer / Expandable Others */}
      {otherPicks.length > 0 && (
        <div className="border-t border-white/5 bg-white/[0.01]">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-all"
          >
            <span>{isExpanded ? "Hide" : "Show"} {otherPicks.length} other bets</span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ArrowDown className="w-3 h-3" />
            </motion.div>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                  {otherPicks.map(pick => (
                    <SecondaryPickRow key={pick.id} pick={pick} onSelectOutcome={onSelectOutcome} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Helpers needed for VersusMatchupCard
function normalizeTeam(name: string): string {
  return name.toLowerCase().trim();
}

const getOutcomeStyle = (stance: "bullish" | "bearish", confidence: number) => {
  const baseColor = stance === "bullish"
    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
    : "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]";

  return baseColor;
};

// Stacked card deck for grouped events
function GroupedSignalCard({
  group,
  onSelectOutcome
}: {
  group: GroupedEvent;
  onSelectOutcome: (pick: AiInsightPick) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMultiplePicks = group.picks.length > 1;
  const secondaryPicks = group.picks.slice(1);

  const topConfidence = getDisplayConfidence(group.topPick);
  const topGrade = getConfidenceGrade(group.topPick);
  const liveGame = useScoreStore(state => state.getGameForTeam(group.topPick.eventTitle || ""));

  const outcomeText = extractMarketContext(group.topPick.marketQuestion, group.topPick.outcome);
  const outcomeStyle = getOutcomeStyle(group.topPick.stance, topConfidence);

  // Aggregate stats for the top pick
  const aggregator = useMemo(() => {
    let gold = 0;
    let silver = 0;
    let bronze = 0;

    group.topPick.topRanks.forEach(r => {
      if (r.rank <= 20) gold++;
      else if (r.rank <= 100) silver++;
      else if (r.rank <= 200) bronze++;
    });

    return { gold, silver, bronze };
  }, [group.topPick.topRanks]);

  // Confidence history from API (fallback to current confidence)
  const historyData = useMemo(() => {
    if (!group.topPick.confidenceHistory || group.topPick.confidenceHistory.length === 0) {
      return [{ value: topConfidence }];
    }

    return group.topPick.confidenceHistory.map((h) => ({
      value: h.value,
      timestamp: new Date(h.timestamp).getTime(),
    }));
  }, [group.topPick.confidenceHistory, topConfidence]);

  return (
    <div className="relative">
      {/* Stacked cards visual behind the top card (only visible when collapsed) */}
      <AnimatePresence>
        {hasMultiplePicks && !isExpanded && (
          <>
            {/* Second card peeking */}
            {secondaryPicks[0] && (
              <motion.div
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 0 }}
                className={cn(
                  "absolute inset-x-0 top-0 h-full rounded-2xl border",
                  "backdrop-blur-sm bg-black/40 border-white/5",
                  "transform translate-y-2 scale-[0.97] origin-top"
                )}
                style={{ zIndex: -1 }}
              />
            )}
            {/* Third card peeking (if 3+ picks) */}
            {secondaryPicks[1] && (
              <motion.div
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 0.6, y: 0 }}
                exit={{ opacity: 0, y: 0 }}
                className={cn(
                  "absolute inset-x-0 top-0 h-full rounded-2xl border",
                  "backdrop-blur-sm bg-black/30 border-white/3",
                  "transform translate-y-4 scale-[0.94] origin-top"
                )}
                style={{ zIndex: -2 }}
              />
            )}
          </>
        )}
      </AnimatePresence>

      {/* Main card (top pick) */}
      <motion.div
        layout
        className={cn(
          "relative group cursor-pointer",
          "backdrop-blur-sm bg-black/60",
          "border border-white/10 rounded-2xl",
          "shadow-2xl",
          "hover:bg-black/70 hover:border-white/15",
          "transition-colors duration-200 ease-out"
        )}
      >
        {/* Top Pick Content */}
        <button
          type="button"
          onClick={() => onSelectOutcome(group.topPick)}
          className={cn(
            "w-full text-left p-3 md:p-4 grid gap-3 md:gap-4",
            "grid-cols-[1fr_auto] md:grid-cols-[280px_1fr_auto] items-center"
          )}
        >
          {/* LEFT: Market Info & Stats */}
          <div className="min-w-0 flex flex-col gap-2 md:gap-0 md:pr-4 md:border-r md:border-white/5 md:h-full md:justify-center">
            {/* Title - Compact on mobile */}
            <div className="flex flex-col gap-1.5 mb-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] uppercase font-black tracking-widest border backdrop-blur-md",
                  outcomeStyle
                )}>
                  {outcomeText}
                </span>
                {hasMultiplePicks && (
                  <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-zinc-400">
                    +{secondaryPicks.length} more
                  </span>
                )}
              </div>
              <h4 className="text-xs md:text-sm text-zinc-200 font-medium line-clamp-1 leading-tight group-hover:text-white transition-colors">
                {group.eventTitle}
              </h4>
            </div>

            {/* Live Score */}
            {liveGame && (
              <div className="bg-black/20 border border-white/5 rounded-md overflow-hidden w-fit mt-1">
                <LiveScoreboard
                  game={liveGame}
                  className="py-0.5 px-2 text-[10px] md:text-xs gap-2 md:gap-3"
                />
              </div>
            )}

            {/* Stats Block - Mobile Only */}
            <div className="flex items-center gap-4 md:hidden mt-1">
              {/* Price & Movement */}
              {(group.topPick.latestPrice > 0) && (
                <div>
                  <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">Price</div>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-200 font-medium">
                    <span>{formatCents(group.topPick.latestPrice)}</span>
                    {(() => {
                      const change = group.topPick.snapshotPrice ? group.topPick.latestPrice - group.topPick.snapshotPrice : 0;
                      if (Math.abs(change) < 0.001) return null;
                      const isUp = change > 0;
                      return (
                        <span className={cn(
                          "flex items-center text-[10px]",
                          isUp ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {isUp ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">Volume</div>
                <div className="font-mono text-xs text-zinc-300 font-medium">
                  {formatUsdCompact(group.topPick.totalVolume)}
                </div>
              </div>

              <div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1">Traders</div>
                <div className="flex items-center gap-1">
                  {aggregator.gold > 0 && (
                    <div title="Gold Tier (Top 20)" className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-[9px] font-mono text-amber-400">
                      <div className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_3px_rgba(251,191,36,0.5)]" />
                      {aggregator.gold}
                    </div>
                  )}
                  {aggregator.silver > 0 && (
                    <div title="Silver Tier (Top 100)" className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-zinc-400/10 border border-zinc-400/20 text-[9px] font-mono text-zinc-400">
                      <div className="w-1 h-1 rounded-full bg-zinc-400" />
                      {aggregator.silver}
                    </div>
                  )}
                  {aggregator.bronze > 0 && (
                    <div title="Bronze Tier (Top 200)" className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-700/10 border border-orange-700/20 text-[9px] font-mono text-orange-700">
                      <div className="w-1 h-1 rounded-full bg-orange-700" />
                      {aggregator.bronze}
                    </div>
                  )}
                  {aggregator.gold === 0 && aggregator.silver === 0 && aggregator.bronze === 0 && (
                    <span className="text-zinc-600 text-[9px]">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE: Stats, Segmentation & Graph (Desktop Only) */}
          <div className="hidden md:grid grid-cols-[auto_1fr] gap-6 items-center px-2">
            <div className="flex flex-col gap-2 min-w-[140px]">
              {/* Price & Movement */}
              {(group.topPick.latestPrice > 0) && (
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Price</div>
                  <div className="flex items-center gap-2 font-mono text-xl text-white font-medium tracking-tight">
                    <span>{formatCents(group.topPick.latestPrice)}</span>
                    {(() => {
                      const change = group.topPick.snapshotPrice ? group.topPick.latestPrice - group.topPick.snapshotPrice : 0;
                      if (Math.abs(change) < 0.001) return null;
                      const isUp = change > 0;
                      return (
                        <div className={cn(
                          "flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border backdrop-blur-sm",
                          isUp ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        )}>
                          {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          <span className="font-bold">{Math.round(Math.abs(change) * 100)}¢</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Volume</div>
                <div className="font-mono text-sm text-zinc-300 font-medium">
                  {formatUsdCompact(group.topPick.totalVolume)}
                </div>
              </div>

              <div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5">Top Traders</div>
                <div className="flex items-center gap-1.5">
                  {aggregator.gold > 0 && (
                    <div title="Gold Tier (Top 20)" className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-[10px] font-mono text-amber-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
                      {aggregator.gold}
                    </div>
                  )}
                  {aggregator.silver > 0 && (
                    <div title="Silver Tier (Top 100)" className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-400/10 border border-zinc-400/20 text-[10px] font-mono text-zinc-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      {aggregator.silver}
                    </div>
                  )}
                  {aggregator.bronze > 0 && (
                    <div title="Bronze Tier (Top 200)" className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-700/10 border border-orange-700/20 text-[10px] font-mono text-orange-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-700" />
                      {aggregator.bronze}
                    </div>
                  )}
                  {aggregator.gold === 0 && aggregator.silver === 0 && aggregator.bronze === 0 && (
                    <span className="text-zinc-600 text-[10px]">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-16 w-full opacity-50 group-hover:opacity-100 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id={`grad_group_${group.topPick.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const data = payload[0].payload as { value: number; timestamp?: number };
                      return (
                        <div className="bg-black/90 border border-white/10 px-2 py-1 rounded text-xs">
                          <div className="text-zinc-400">Confidence: {Math.round(data.value)}%</div>
                          {data.timestamp && (
                            <div className="text-zinc-600 text-[10px]">
                              {new Date(data.timestamp).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fill={`url(#grad_group_${group.topPick.id})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RIGHT: Grade & Confidence */}
          <div className="flex flex-col items-end gap-1.5 md:gap-2 md:pl-4 md:border-l md:border-white/5 md:h-full md:justify-center">
            {/* Chart - Mobile Only */}
            <div className="h-12 w-20 md:hidden opacity-50 group-hover:opacity-100 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id={`grad_group_mobile_${group.topPick.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fill={`url(#grad_group_mobile_${group.topPick.id})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col items-end gap-0.5 md:gap-2">
              <div className={cn("text-lg md:text-xl font-black leading-none tracking-tighter", topConfidence >= 80 ? "text-emerald-400" : "text-white")}>
                {topGrade}
              </div>
              <div className="text-[9px] md:text-[10px] text-zinc-500 font-mono">{topConfidence}% Conf</div>
            </div>
          </div>
        </button>

        {/* Expand/Collapse toggle for groups with multiple picks */}
        {hasMultiplePicks && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 px-4",
              "border-t border-white/5",
              "text-[10px] uppercase tracking-widest font-mono",
              "text-zinc-500 hover:text-zinc-300 transition-colors",
              "hover:bg-white/[0.02]"
            )}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            {isExpanded ? "Hide other outcomes" : `Show ${secondaryPicks.length} more outcome${secondaryPicks.length > 1 ? 's' : ''}`}
          </button>
        )}
      </motion.div>

      {/* Expanded secondary picks */}
      <AnimatePresence>
        {isExpanded && secondaryPicks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 pl-4 border-l-2 border-white/10">
              {secondaryPicks.map((pick, idx) => (
                <motion.div
                  key={pick.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <SecondaryPickRow pick={pick} onSelectOutcome={onSelectOutcome} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact row for secondary picks within an expanded group
function SecondaryPickRow({ pick, onSelectOutcome }: { pick: AiInsightPick; onSelectOutcome: (pick: AiInsightPick) => void }) {
  const confidence = getDisplayConfidence(pick);
  const grade = getConfidenceGrade(pick);
  const outcomeText = extractMarketContext(pick.marketQuestion, pick.outcome);
  const outcomeStyle = getOutcomeStyle(pick.stance, confidence);

  return (
    <button
      type="button"
      onClick={() => onSelectOutcome(pick)}
      className={cn(
        "group w-full text-left cursor-pointer",
        "backdrop-blur-sm bg-black/40",
        "border border-white/5 rounded-xl",
        "hover:bg-black/50 hover:border-white/10",
        "p-3 flex items-center justify-between gap-4",
        "transition-all duration-150"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border backdrop-blur-md shrink-0",
          outcomeStyle
        )}>
          {outcomeText}
        </span>
        <span className="text-xs text-zinc-400 font-mono truncate">
          Vol {formatUsdCompact(pick.totalVolume)}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className={cn(
          "text-sm font-bold tracking-tight",
          confidence >= 80 ? "text-emerald-400" : "text-zinc-300"
        )}>
          {grade}
        </div>
        <div className="text-[9px] text-zinc-500 font-mono">{confidence}%</div>
      </div>
    </button>
  );
}

function SignalRow({ pick, onSelectOutcome }: { pick: AiInsightPick; onSelectOutcome: (pick: AiInsightPick) => void }) {
  const confidence = getDisplayConfidence(pick);
  const grade = getConfidenceGrade(pick);
  const liveGame = useScoreStore(state => state.getGameForTeam(pick.eventTitle || ""));
  const whaleVolumeDisplay = getWhaleVolumeDisplay(pick);

  // Determine tiers for top traders
  // Gold: 1-20, Silver: 21-100, Bronze: 101-200
  const aggregator = useMemo(() => {
    let gold = 0;
    let silver = 0;
    let bronze = 0;

    pick.topRanks.forEach(r => {
      if (r.rank <= 20) gold++;
      else if (r.rank <= 100) silver++;
      else if (r.rank <= 200) bronze++;
    });

    return { gold, silver, bronze };
  }, [pick.topRanks]);

  // Confidence history from API (fallback to current confidence)
  const historyData = useMemo(() => {
    if (!pick.confidenceHistory || pick.confidenceHistory.length === 0) {
      return [{ value: confidence }];
    }

    return pick.confidenceHistory.map((h) => ({
      value: h.value,
      timestamp: new Date(h.timestamp).getTime(),
    }));
  }, [pick.confidenceHistory, confidence]);

  const outcomeText = extractMarketContext(pick.marketQuestion, pick.outcome);
  const outcomeStyle = getOutcomeStyle(pick.stance, confidence);

  return (
    <button
      type="button"
      onClick={() => onSelectOutcome(pick)}
      className={cn(
        "group relative w-full text-left cursor-pointer",
        // Glassmorphism base - matching featured card style
        "backdrop-blur-sm bg-black/60",
        // Border & shadow
        "border border-white/10 rounded-2xl",
        "shadow-2xl",
        // Hover state
        "hover:bg-black/70 hover:border-white/15",
        // Layout: Mobile two-column, Desktop three-column
        "p-3 md:p-4 grid gap-3 md:gap-4",
        "grid-cols-[1fr_auto] md:grid-cols-[280px_1fr_auto] items-center",
        // Transition
        "transition-all duration-200 ease-out"
      )}
    >
      {/* LEFT: Market Info & Stats (Mobile) / Market Info Only (Desktop) */}
      <div className="min-w-0 flex flex-col gap-2 md:gap-0 md:pr-4 md:border-r md:border-white/5 md:h-full md:justify-center">
        {/* Title - Compact on mobile */}
        <div className="flex flex-col gap-1.5 mb-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] uppercase font-black tracking-widest border backdrop-blur-md",
              outcomeStyle
            )}>
              {outcomeText}
            </span>
          </div>
          <h4 className="text-xs md:text-sm text-zinc-200 font-medium line-clamp-1 leading-tight group-hover:text-white transition-colors">
            {pick.eventTitle}
          </h4>
        </div>

        {/* Live Score - Compact on mobile */}
        {liveGame && (
          <div className="bg-black/20 border border-white/5 rounded-md overflow-hidden w-fit mt-1">
            <LiveScoreboard
              game={liveGame}
              className="py-0.5 px-2 text-[10px] md:text-xs gap-2 md:gap-3"
            />
          </div>
        )}

        {/* Stats Block - Mobile Only (shown inline on mobile, hidden on desktop where it's in middle column) */}
        <div className="flex items-center gap-4 md:hidden mt-1">
          {/* Volume */}
          <div>
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">Volume</div>
            <div className="font-mono text-xs text-zinc-300 font-medium">
              {formatUsdCompact(pick.totalVolume)}
            </div>
          </div>

          {/* Top Traders - Compact badges */}
          <div>
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1">Traders</div>
            <div className="flex items-center gap-1">
              {aggregator.gold > 0 && (
                <div title="Gold Tier (Top 20)" className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-[9px] font-mono text-amber-400">
                  <div className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_3px_rgba(251,191,36,0.5)]" />
                  {aggregator.gold}
                </div>
              )}
              {aggregator.silver > 0 && (
                <div title="Silver Tier (Top 100)" className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-zinc-400/10 border border-zinc-400/20 text-[9px] font-mono text-zinc-400">
                  <div className="w-1 h-1 rounded-full bg-zinc-400" />
                  {aggregator.silver}
                </div>
              )}
              {aggregator.bronze > 0 && (
                <div title="Bronze Tier (Top 200)" className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-700/10 border border-orange-700/20 text-[9px] font-mono text-orange-700">
                  <div className="w-1 h-1 rounded-full bg-orange-700" />
                  {aggregator.bronze}
                </div>
              )}
              {aggregator.gold === 0 && aggregator.silver === 0 && aggregator.bronze === 0 && (
                <span className="text-zinc-600 text-[9px]">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE: Stats, Segmentation & Graph (Desktop Only) */}
      <div className="hidden md:grid grid-cols-[auto_1fr] gap-6 items-center px-2">
        {/* Stats Block */}
        <div className="flex flex-col gap-2 min-w-[140px]">
          {/* Volume */}
          <div>
            <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Volume</div>
            <div className="font-mono text-sm text-zinc-300 font-medium">
              {formatUsdCompact(pick.totalVolume)}
            </div>
          </div>

          {/* Whales Segmentation */}
          <div>
            <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5">Top Traders</div>
            <div className="flex items-center gap-1.5">
              {aggregator.gold > 0 && (
                <div title="Gold Tier (Top 20)" className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-[10px] font-mono text-amber-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
                  {aggregator.gold}
                </div>
              )}
              {aggregator.silver > 0 && (
                <div title="Silver Tier (Top 100)" className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-400/10 border border-zinc-400/20 text-[10px] font-mono text-zinc-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  {aggregator.silver}
                </div>
              )}
              {aggregator.bronze > 0 && (
                <div title="Bronze Tier (Top 200)" className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-700/10 border border-orange-700/20 text-[10px] font-mono text-orange-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-700" />
                  {aggregator.bronze}
                </div>
              )}
              {aggregator.gold === 0 && aggregator.silver === 0 && aggregator.bronze === 0 && (
                <span className="text-zinc-600 text-[10px]">-</span>
              )}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-16 w-full opacity-50 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id={`grad_${pick.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const data = payload[0].payload as { value: number; timestamp?: number };
                  return (
                    <div className="bg-black/90 border border-white/10 px-2 py-1 rounded text-xs">
                      <div className="text-zinc-400">Confidence: {Math.round(data.value)}%</div>
                      {data.timestamp && (
                        <div className="text-zinc-600 text-[10px]">
                          {new Date(data.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={1.5}
                fill={`url(#grad_${pick.id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RIGHT: Chart + Grade & Confidence (Mobile) / Grade & Confidence Only (Desktop) */}
      <div className="flex flex-col items-end gap-1.5 md:gap-2 md:pl-4 md:border-l md:border-white/5 md:h-full md:justify-center">
        {/* Chart - Mobile Only (compact) */}
        <div className="h-12 w-20 md:hidden opacity-50 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id={`grad_mobile_${pick.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={1.5}
                fill={`url(#grad_mobile_${pick.id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Grade & Confidence */}
        <div className="flex flex-col items-end gap-0.5 md:gap-2">
          <div className={cn("text-lg md:text-xl font-black leading-none tracking-tighter", confidence >= 80 ? "text-emerald-400" : "text-white")}>
            {grade}
          </div>
          <div className="text-[9px] md:text-[10px] text-zinc-500 font-mono">{confidence}% Conf</div>
        </div>
      </div>

    </button>
  )
}

