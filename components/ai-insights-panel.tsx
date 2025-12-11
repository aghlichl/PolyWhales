"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAiInsights } from "@/lib/useAiInsights";
import { AiInsightPick } from "@/lib/types";
import { cn, formatShortNumber, isMarketExpired } from "@/lib/utils";
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight, Activity, Zap } from "lucide-react";
import { useScoreStore, getLiveScoreLogo } from '@/lib/useScoreStore';
import svgPathsPrimary from "@/imports/svg-1ltd1kb2kd";
import svgPathsSecondary from "@/imports/svg-7cdl22zaum";
import { AiInsightsTradesModal } from "@/components/ai-insights-trades-modal";
import { motion, AnimatePresence } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

type SortKey = "confidence" | "topTraders" | "volume";

const PAGE_SIZE = 20;

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Poll for live scores
  useEffect(() => useScoreStore.getState().startPolling(), []);

  const activePicks = useMemo(() => {
    const graceMs = 4 * 60 * 60 * 1000; // keep markets visible for 4h after start/close
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

  const visiblePicks = useMemo(
    () => sortedPicks.slice(0, visibleCount),
    [sortedPicks, visibleCount]
  );

  const hasMore = visibleCount < sortedPicks.length;

  useEffect(() => {
    setVisibleCount(Math.min(PAGE_SIZE, sortedPicks.length));
  }, [sortedPicks.length, sortKey]);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedPicks.length));
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [hasMore, isLoading, sortedPicks.length]
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

        <div className="grid gap-2">
          {visiblePicks.map((pick) => (
            <SignalRow
              key={pick.id}
              pick={pick}
              onSelectOutcome={setSelectedPick}
            />
          ))}
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
        onClose={() => setSelectedPick(null)}
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
      className="relative h-full w-full cursor-pointer overflow-hidden rounded-3xl border border-white/5 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.04),transparent_26%),linear-gradient(135deg,rgba(7,11,16,0.85),rgba(10,10,12,0.72))] hover:border-white/10 transition-colors group"
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
        <h4 className="text-xs md:text-sm text-zinc-200 font-semibold line-clamp-1 leading-tight">
          {pick.eventTitle} | {extractMarketContext(pick.marketQuestion, pick.outcome)}
        </h4>

        {/* Live Score - Compact on mobile */}
        {liveGame && (
          <div className="inline-flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold font-mono text-zinc-400 bg-black/20 border border-white/5 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md w-fit">
            <div className="flex items-center gap-0.5 md:gap-1">
              {getLiveScoreLogo(liveGame.league, liveGame.awayTeamAbbr, liveGame.awayTeamName) ? (
                <img
                  src={getLiveScoreLogo(liveGame.league, liveGame.awayTeamAbbr, liveGame.awayTeamName)!}
                  alt={liveGame.awayTeamShort}
                  className="w-3 h-3 md:w-3.5 md:h-3.5 object-contain"
                />
              ) : (
                <span className="uppercase text-zinc-500 text-[8px] md:text-[9px]">{liveGame.awayTeamShort}</span>
              )}
              <span className={cn(liveGame.awayScoreTrend === 'UP' && "text-white")}>{liveGame.awayScore}</span>
            </div>
            <span className="text-zinc-600 pb-0.5">:</span>
            <div className="flex items-center gap-0.5 md:gap-1">
              {getLiveScoreLogo(liveGame.league, liveGame.homeTeamAbbr, liveGame.homeTeamName) ? (
                <img
                  src={getLiveScoreLogo(liveGame.league, liveGame.homeTeamAbbr, liveGame.homeTeamName)!}
                  alt={liveGame.homeTeamShort}
                  className="w-3 h-3 md:w-3.5 md:h-3.5 object-contain"
                />
              ) : (
                <span className="uppercase text-zinc-500 text-[8px] md:text-[9px]">{liveGame.homeTeamShort}</span>
              )}
              <span className={cn(liveGame.homeScoreTrend === 'UP' && "text-white")}>{liveGame.homeScore}</span>
            </div>
            <div className="w-px h-2.5 md:h-3 bg-white/10 mx-0.5 md:mx-1" />
            <span className={liveGame.status === 'in_progress' ? "text-red-400 animate-pulse" : ""}>{liveGame.clock}</span>
          </div>
        )}

        {/* Stats Block - Mobile Only (shown inline on mobile, hidden on desktop where it's in middle column) */}
        <div className="flex items-center gap-4 md:hidden">
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

