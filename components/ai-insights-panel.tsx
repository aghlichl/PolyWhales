"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAiInsights } from "@/lib/useAiInsights";
import { AiInsightPick } from "@/lib/types";
import { cn, formatShortNumber, isMarketExpired } from "@/lib/utils";
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight, Activity, Zap } from "lucide-react";
import { useScoreStore, getLiveScoreLogo } from '@/lib/useScoreStore';
import svgPathsPrimary from "@/imports/svg-1ltd1kb2kd";
import svgPathsSecondary from "@/imports/svg-7cdl22zaum";
import { AiInsightsTradesModal } from "@/components/ai-insights-trades-modal";
import { motion, AnimatePresence } from "framer-motion";

type SortKey = "confidence" | "topTraders" | "volume";

const formatUsdCompact = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `$${formatShortNumber(value)}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeAdjustedConfidence = (pick: Partial<AiInsightPick> & { confidence: number }) => {
  const base = pick.confidencePercentile ?? pick.confidence ?? 0;

  const buyVol = pick.topTraderBuyVolume ?? pick.buyVolume ?? 0;
  const sellVol = pick.topTraderSellVolume ?? pick.sellVolume ?? 0;
  const inferredTopVolume = (pick.topTraderBuyVolume ?? 0) + (pick.topTraderSellVolume ?? 0);
  const whaleVolume =
    pick.topTraderVolume ??
    (inferredTopVolume > 0 ? inferredTopVolume : (pick.buyVolume ?? 0) + (pick.sellVolume ?? 0));
  const totalVolume = pick.totalVolume ?? 0;

  const whaleShare = clamp(totalVolume > 0 ? whaleVolume / totalVolume : 0, 0, 1);
  const volumeForDelta = buyVol + sellVol;
  const volumeDominance = volumeForDelta > 0 ? Math.abs((buyVol - sellVol) / (volumeForDelta + 1e-6)) : 0;

  const buyCount = pick.topTraderBuyCount ?? 0;
  const sellCount = pick.topTraderSellCount ?? 0;
  const countedTotal = buyCount + sellCount;
  const totalCount = (pick.topTraderCount ?? 0) || countedTotal;
  const countDominance = countedTotal > 0 ? Math.abs((buyCount - sellCount) / (countedTotal + 1e-6)) : volumeDominance;

  const consensus = 0.6 * countDominance + 0.4 * volumeDominance;

  let crowdFactor = 0.9;
  if (totalCount <= 1 && totalCount > 0) {
    crowdFactor = 0.78;
  } else if (totalCount === 2) {
    crowdFactor = 0.9;
  } else if (totalCount === 3) {
    crowdFactor = 1.02;
  } else if (totalCount === 4) {
    crowdFactor = 1.08;
  } else if (totalCount >= 5) {
    crowdFactor = 1.15;
  }

  const dominanceFactor = 0.65 + 0.35 * consensus;
  const shareFactor = 0.65 + 0.35 * whaleShare;

  const factorRaw = dominanceFactor * shareFactor * crowdFactor;
  const factor = clamp(factorRaw, 0.45, 1.05);

  return clamp(Math.round(base * factor), 1, 99);
};

const confidenceToGrade = (score: number) => {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 76) return "C+";
  if (score >= 72) return "C";
  if (score >= 68) return "C-";
  if (score >= 60) return "D";
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

interface GroupedEvent {
  eventTitle: string;
  eventSlug: string | null;
  conditionId: string | null;
  outcomes: AiInsightPick[];
  totalVolume: number;
  bestConfidence: number;
  bestRank: number | null;
  totalTopTraderCount: number;
}

function groupPicksByEvent(picks: AiInsightPick[]): GroupedEvent[] {
  const eventMap = new Map<string, GroupedEvent>();

  for (const pick of picks) {
    const key = pick.eventTitle || pick.conditionId || "Unknown";

    if (!eventMap.has(key)) {
      eventMap.set(key, {
        eventTitle: pick.eventTitle || "Unknown Market",
        eventSlug: pick.eventSlug,
        conditionId: pick.conditionId,
        outcomes: [],
        totalVolume: 0,
        bestConfidence: 0,
        bestRank: null,
        totalTopTraderCount: 0,
      });
    }

    const group = eventMap.get(key)!;
    group.outcomes.push(pick);
    group.totalVolume += pick.totalVolume;
    group.totalTopTraderCount += pick.topTraderCount ?? 0;

    const pickConfidence = getDisplayConfidence(pick);
    if (pickConfidence > group.bestConfidence) {
      group.bestConfidence = pickConfidence;
    }

    if (pick.bestRank !== null) {
      if (group.bestRank === null || pick.bestRank < group.bestRank) {
        group.bestRank = pick.bestRank;
      }
    }
  }

  // Sort outcomes within each group
  for (const group of eventMap.values()) {
    group.outcomes.sort((a, b) => getDisplayConfidence(b) - getDisplayConfidence(a));
  }

  return Array.from(eventMap.values());
}

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

  const groupedEvents = useMemo(() => {
    if (!activePicks.length) return [];
    const groups = groupPicksByEvent(activePicks);
    groups.sort((a, b) => {
      if (sortKey === "volume") return b.totalVolume - a.totalVolume;
      if (sortKey === "topTraders") return b.totalTopTraderCount - a.totalTopTraderCount;
      return b.bestConfidence - a.bestConfidence;
    });
    return groups.slice(0, 20);
  }, [activePicks, sortKey]);

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
            <div className="flex p-0.5 bg-zinc-900 border border-white/5 rounded-none">
              {(["confidence", "volume"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition-all border border-transparent",
                    sortKey === key
                      ? "bg-white/10 text-white border-white/10"
                      : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="group p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {!isLoading && groupedEvents.length === 0 && (
          <div className="py-20 text-center border border-dashed border-white/5 text-zinc-600 font-mono text-sm uppercase">
            Waiting for incoming signals...
          </div>
        )}

        <div className="grid gap-2">
          {groupedEvents.map((event) => (
            <SignalRow
              key={event.eventTitle}
              event={event}
              onSelectOutcome={setSelectedPick}
            />
          ))}
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

function SignalRow({ event, onSelectOutcome }: { event: GroupedEvent; onSelectOutcome: (pick: AiInsightPick) => void }) {
  const bestGrade = confidenceToGrade(event.bestConfidence);
  const liveGame = useScoreStore(state => state.getGameForTeam(event.eventTitle));

  return (
    <div className="group relative bg-[#09090b] hover:bg-[#0F0F12] border-b border-white/5 transition-colors p-4 grid gap-4 md:grid-cols-[2fr_auto] md:grid-rows-[auto_auto] items-start">
      {/* Left: Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {event.bestRank && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-sm font-mono">
              #{event.bestRank}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            {formatUsdCompact(event.totalVolume)} Vol // {event.totalTopTraderCount} Whales
          </span>
        </div>
        <h4 className="text-sm text-zinc-300 font-medium truncate pr-4">
          {event.eventTitle}
        </h4>
        {liveGame && (
          <div className="mt-1 inline-flex items-center gap-2 text-[10px] font-bold font-mono text-zinc-400 bg-white/5 border border-white/5 px-2 py-1 rounded-md">
            <div className="flex items-center gap-1">
              {getLiveScoreLogo(liveGame.league, liveGame.awayTeamAbbr, liveGame.awayTeamName) ? (
                <img
                  src={getLiveScoreLogo(liveGame.league, liveGame.awayTeamAbbr, liveGame.awayTeamName)!}
                  alt={liveGame.awayTeamShort}
                  className="w-4 h-4 object-contain"
                />
              ) : (
                <span className="uppercase text-zinc-500 text-[9px]">{liveGame.awayTeamShort}</span>
              )}
              <div className="flex items-center gap-0.5 min-w-[16px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={liveGame.awayScore}
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -5, opacity: 0 }}
                  >
                    {liveGame.awayScore}
                  </motion.span>
                </AnimatePresence>
                {liveGame.awayScoreTrend === 'UP' && <TrendingUp className="w-2 h-2 text-emerald-400" />}
              </div>
            </div>
            <span className="text-zinc-600 pb-0.5">:</span>
            <div className="flex items-center gap-1">
              {getLiveScoreLogo(liveGame.league, liveGame.homeTeamAbbr, liveGame.homeTeamName) ? (
                <img
                  src={getLiveScoreLogo(liveGame.league, liveGame.homeTeamAbbr, liveGame.homeTeamName)!}
                  alt={liveGame.homeTeamShort}
                  className="w-4 h-4 object-contain"
                />
              ) : (
                <span className="uppercase text-zinc-500 text-[9px]">{liveGame.homeTeamShort}</span>
              )}
              <div className="flex items-center gap-0.5 min-w-[16px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={liveGame.homeScore}
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -5, opacity: 0 }}
                  >
                    {liveGame.homeScore}
                  </motion.span>
                </AnimatePresence>
                {liveGame.homeScoreTrend === 'UP' && <TrendingUp className="w-2 h-2 text-emerald-400" />}
              </div>
            </div>

            <div className="w-px h-3 bg-white/10 mx-1" />
            <div className="flex items-center gap-1">
              <span className={liveGame.status === 'in_progress' ? "text-red-400 animate-pulse" : ""}>{liveGame.clock}</span>
              <span className="text-[9px] text-zinc-600">
                {liveGame.league === 'MLB'
                  ? (liveGame.period >= 10 ? `Ex` : `${liveGame.period}${['st', 'nd', 'rd'][liveGame.period - 1] || 'th'}`)
                  : `Q${liveGame.period}`
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Middle: Outcomes (full width) */}
      <div className="md:col-span-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar mask-gradient-right pt-1">
        {event.outcomes.map(pick => (
          <button
            key={pick.id}
            onClick={() => onSelectOutcome(pick)}
            className="flex items-center gap-3 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all min-w-max"
          >
            {(() => {
              const confidence = getDisplayConfidence(pick);
              const grade = getConfidenceGrade(pick);
              const whaleVolumeDisplay = getWhaleVolumeDisplay(pick);
              return (
                <>
                  <span className={cn(
                    "text-xs font-bold",
                    pick.stance === "bullish" ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {pick.stance === "bullish" ? "BUY" : "SELL"}
                  </span>
                  <span className="text-xs text-zinc-300 font-mono">
                    {extractMarketContext(pick.marketQuestion, pick.outcome)}
                  </span>
                  <div className="h-3 w-px bg-white/10" />
                  <span className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-xs font-mono",
                      confidence > 65 ? "text-white font-bold" : "text-zinc-500"
                    )}>
                      {grade}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{confidence}%</span>
                  </span>
                  {pick.topTraderCount ? (
                    <>
                      <div className="h-3 w-px bg-white/10" />
                      <span className="text-[11px] font-mono text-zinc-300 flex items-center gap-1">
                        {pick.topTraderCount}x <span aria-label="whales"> 🐋</span>
                      </span>
                      {whaleVolumeDisplay ? (
                        <>
                          <div className="h-3 w-px bg-white/10" />
                          <span className="text-[11px] font-mono text-zinc-300">
                            {whaleVolumeDisplay}
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </>
              );
            })()}
          </button>
        ))}
      </div>

      {/* Right: Best Signal */}
      <div className="text-right pl-4 md:row-start-1 md:col-start-2 md:self-center">
        <div className="space-y-1">
          <div className={cn(
            "text-2xl font-black tracking-tight leading-none",
            event.bestConfidence >= 70 ? "text-primary" : "text-zinc-500"
          )}>
            {bestGrade}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono tracking-tight leading-none">
            {event.bestConfidence}%
          </div>
        </div>
      </div>
    </div>
  )
}
