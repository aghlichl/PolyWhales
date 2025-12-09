"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAiInsights } from "@/lib/useAiInsights";
import { AiInsightPick } from "@/lib/types";
import { cn, formatShortNumber } from "@/lib/utils";
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight, Activity, Zap } from "lucide-react";
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

  const activePicks = useMemo(() => {
    return data?.picks?.filter((pick) => !pick.isResolved) ?? [];
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

function FeaturedCard({ pick, onClick }: { pick: AiInsightPick; onClick: () => void }) {
  const confidence = getDisplayConfidence(pick);
  const grade = getConfidenceGrade(pick);
  const isBullish = pick.stance === "bullish";

  return (
    <div
      onClick={onClick}
      className="h-full w-full cursor-pointer relative overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(135deg,rgba(12,12,15,0.75),rgba(7,7,9,0.6))] backdrop-blur-2xl border border-white/5 hover:border-white/10 transition-colors group"
    >
      {/* Decorative Status Bar */}
      <div className={cn(
        "absolute top-0 left-0 w-1.5 h-full z-20",
        isBullish ? "bg-emerald-500" : "bg-rose-500"
      )} />

      {/* Background Noise/Texture */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 h-full p-8 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1 border text-xs font-mono uppercase tracking-wider",
              isBullish
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5 run-border-animation"
                : "border-rose-500/30 text-rose-400 bg-rose-500/5"
            )}>
              {isBullish ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isBullish ? "Bullish Outlook" : "Bearish Outlook"}
            </div>

            <div className="flex items-center gap-3">
              {pick.isUnusualActivity && (
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-amber-400 animate-pulse">
                  <Zap className="w-3 h-3 fill-amber-400" /> High Activity
                </span>
              )}
              <div className="text-zinc-500 font-mono text-xs">
                Vol: {formatUsdCompact(pick.totalVolume)}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-medium text-white leading-tight max-w-[90%] font-sans">
              {pick.eventTitle}
            </h3>
            <p className="mt-2 text-lg text-zinc-400 font-light flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-zinc-600" />
              {extractMarketContext(pick.marketQuestion, pick.outcome)}
            </p>
          </div>
        </div>

        {/* Footer Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/5">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Confidence</div>
            <div className="space-y-1">
              <div className={cn(
                "text-4xl font-black tracking-tight leading-none",
                isBullish ? "text-emerald-400" : "text-rose-400"
              )}>
                {grade}
              </div>
              <div className="text-xs text-zinc-500 font-mono tracking-tight leading-none">
                {confidence}%
              </div>
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

          <div className="flex items-end justify-end">
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
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
