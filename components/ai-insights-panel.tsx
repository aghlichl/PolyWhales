"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAiInsights } from "@/lib/useAiInsights";
import { AiInsightPick } from "@/lib/types";
import { cn, formatShortNumber } from "@/lib/utils";
import { RefreshCw, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AiInsightsTradesModal } from "@/components/ai-insights-trades-modal";

type SortKey = "confidence" | "support" | "volume";

const formatPct = (value: number) => `${Math.round(value * 100)}%`;

const formatUsdCompact = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `$${formatShortNumber(value)}`;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const computeUiConfidence = (pick: Partial<AiInsightPick> & { confidence: number }) => {
  const { totalVolume, top20Volume, top20Support, bestRank } = pick;
  if (totalVolume === null || totalVolume === undefined) return null;
  if (top20Volume === null || top20Volume === undefined) return null;
  if (top20Support === null || top20Support === undefined) return null;

  const safeTotalVolume = Math.max(totalVolume, 0);
  const whaleShare = safeTotalVolume > 0 ? clamp01(top20Volume / safeTotalVolume) : 0;
  const whaleAbs = clamp01(Math.log10(Math.max(top20Volume, 0) + 1) / 5);
  const volumeScore = clamp01(Math.log10(safeTotalVolume + 1) / 6);
  const rankScore = bestRank ? clamp01((21 - bestRank) / 20) : 0;
  const supportScore = clamp01(top20Support);

  const weighted =
    whaleShare * 0.32 +
    whaleAbs * 0.24 +
    rankScore * 0.20 +
    volumeScore * 0.14 +
    supportScore * 0.10;

  return Math.round(weighted * 100);
};

const getDisplayConfidence = (pick: Partial<AiInsightPick> & { confidence: number }) =>
  computeUiConfidence(pick) ?? pick.confidence;

// Format price as cents
const formatCents = (value: number) => {
  const cents = Math.round(value * 100);
  return `${cents}¢`;
};

// Grouped event type containing all outcomes for a single event
interface GroupedEvent {
  eventTitle: string;
  eventSlug: string | null;
  conditionId: string | null;
  outcomes: AiInsightPick[];
  totalVolume: number;
  bestConfidence: number;
  bestRank: number | null;
  totalTop20Volume: number;
  avgTop20Support: number;
}

// Group picks by eventTitle to dedupe
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
        totalTop20Volume: 0,
        avgTop20Support: 0,
      });
    }

    const group = eventMap.get(key)!;
    group.outcomes.push(pick);
    group.totalVolume += pick.totalVolume;
    group.totalTop20Volume += pick.top20Volume;

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

  // Calculate avg support and sort outcomes within each group
  for (const group of eventMap.values()) {
    group.avgTop20Support = group.outcomes.length > 0
      ? group.outcomes.reduce((sum, p) => sum + p.top20Support, 0) / group.outcomes.length
      : 0;
    group.outcomes.sort((a, b) => getDisplayConfidence(b) - getDisplayConfidence(a));
  }

  return Array.from(eventMap.values());
}

// Extract market type context from the full question
function extractMarketContext(question: string | null | undefined, outcome: string | null | undefined): string {
  if (!question) return outcome || "Unknown";

  const q = question.toLowerCase();
  const out = (outcome || "").toLowerCase();

  const spreadMatch = question.match(/([+-]\d+\.?\d*)/i);
  if (spreadMatch && (q.includes('cover') || q.includes('spread'))) {
    return `${outcome} ${spreadMatch[1]}`;
  }

  const totalMatch = question.match(/(\d+\.?\d*)/);
  if (out === 'over' || out === 'under') {
    if (totalMatch) {
      return `${outcome} ${totalMatch[1]}`;
    }
    return outcome || "Unknown";
  }

  if (q.includes('over') || q.includes('under') || q.includes('total')) {
    if (totalMatch) {
      const lineMatch = question.match(/(?:over|under|total)\s*(\d+\.?\d*)/i);
      if (lineMatch) {
        return `${outcome} (${lineMatch[1]})`;
      }
    }
  }

  if (q.includes('win') || q.includes('winner') || q.includes('moneyline')) {
    return `${outcome} ML`;
  }

  if ((out === 'yes' || out === 'no') && question.length > 0) {
    const cleanQ = question.replace(/^will\s+/i, '').replace(/\?$/i, '');
    const truncated = cleanQ.length > 40 ? cleanQ.slice(0, 37) + '...' : cleanQ;
    return `${outcome}: ${truncated}`;
  }

  return outcome || "Unknown";
}

export function AIInsightsPanel() {
  const { data, isLoading, error, refresh } = useAiInsights(90_000);
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [selectedPick, setSelectedPick] = useState<AiInsightPick | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Top 5 featured trades
  const featuredTrades = useMemo(() => {
    if (!data?.picks) return [];
    return [...data.picks]
      .map((pick) => ({ pick, displayConfidence: getDisplayConfidence(pick) }))
      .sort((a, b) => {
        if (b.displayConfidence !== a.displayConfidence) return b.displayConfidence - a.displayConfidence;
        return b.pick.totalVolume - a.pick.totalVolume;
      })
      .slice(0, 5)
      .map((entry) => entry.pick);
  }, [data?.picks]);

  useEffect(() => {
    setFeaturedIndex(0);
  }, [featuredTrades.length]);

  const hasFeatured = featuredTrades.length > 0;

  const handlePrev = () => {
    if (!hasFeatured) return;
    setFeaturedIndex((idx) => (idx - 1 + featuredTrades.length) % featuredTrades.length);
  };

  const handleNext = () => {
    if (!hasFeatured) return;
    setFeaturedIndex((idx) => (idx + 1) % featuredTrades.length);
  };

  // Group and sort events
  const groupedEvents = useMemo(() => {
    if (!data?.picks) return [];
    const groups = groupPicksByEvent(data.picks);

    groups.sort((a, b) => {
      if (sortKey === "volume") return b.totalVolume - a.totalVolume;
      if (sortKey === "support") return b.avgTop20Support - a.avgTop20Support;
      return b.bestConfidence - a.bestConfidence;
    });

    return groups.slice(0, 20);
  }, [data?.picks, sortKey]);

  return (
    <div className="relative space-y-6">
      {/* Floating Glassmorphism Cards */}
      {hasFeatured && (
        <div
          className="relative h-[200px] group overflow-hidden"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Navigation arrows - visible on hover */}
          <button
            onClick={handlePrev}
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300",
              "bg-white/10 backdrop-blur-md border border-white/20 text-white/80 hover:bg-white/20 hover:text-white",
              isHovering ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleNext}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300",
              "bg-white/10 backdrop-blur-md border border-white/20 text-white/80 hover:bg-white/20 hover:text-white",
              isHovering ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Card stack */}
          <div
            className="relative h-full flex items-center justify-center overflow-hidden"
            style={{ perspective: 1200 }}
          >
            {featuredTrades.map((pick, idx) => {
              const offset = idx - featuredIndex;
              const normalizedOffset = ((offset % featuredTrades.length) + featuredTrades.length) % featuredTrades.length;
              const displayOffset = normalizedOffset > featuredTrades.length / 2
                ? normalizedOffset - featuredTrades.length
                : normalizedOffset;

              // Only show 3 cards: current, left, right
              if (Math.abs(displayOffset) > 1) return null;

              const isCenter = displayOffset === 0;
              const distanceFromCenter = Math.abs(displayOffset);
              const translateX = displayOffset * 320;
              const scale = isCenter ? 1 : 0.88;
              const opacity = isCenter ? 1 : Math.max(0.55, 1 - distanceFromCenter * 0.4);
              const confidence = getDisplayConfidence(pick);
              const isBullish = pick.stance === "bullish";
              const tradePrice = pick.latestPrice ?? 0;

              return (
                <div
                  key={pick.id}
                  onClick={() => isCenter && setSelectedPick(pick)}
                  className={cn(
                    "absolute w-[340px] cursor-pointer",
                    isCenter ? "z-20" : "z-10"
                  )}
                  style={{
                    transform: `translate3d(${translateX}px, 0, 0) scale(${scale}) rotateY(${displayOffset * -6}deg)`,
                    opacity,
                    filter: isCenter ? "none" : "blur(1.5px)",
                    pointerEvents: isCenter ? "auto" : "none",
                    transition: "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease, filter 0.45s ease",
                    willChange: "transform, opacity, filter",
                  }}
                >
                  {/* Glassmorphism Card */}
                  <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                    {/* Gradient glow */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-transparent blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-gradient-to-tr from-blue-500/20 via-purple-500/10 to-transparent blur-2xl" />

                    {/* Content */}
                    <div className="relative p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center",
                              isBullish ? "bg-emerald-500/30 text-emerald-300" : "bg-rose-500/30 text-rose-300"
                            )}>
                              {isBullish ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-[10px] uppercase tracking-wider text-white/60">
                              {isBullish ? "Bullish" : "Bearish"} signal
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white/90 line-clamp-2">
                            {pick.eventTitle || "Unknown Market"}
                          </p>
                          <p className="text-xs text-white/50 line-clamp-1 mt-1">
                            {extractMarketContext(pick.marketQuestion, pick.outcome)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold text-white">{confidence}%</div>
                          <div className="text-[10px] text-white/40 uppercase">confidence</div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                          <p className="text-[10px] text-white/40 uppercase">Price</p>
                          <p className="text-sm font-semibold text-white/90">{formatCents(tradePrice)}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                          <p className="text-[10px] text-white/40 uppercase">Top20</p>
                          <p className="text-sm font-semibold text-white/90">{formatPct(pick.top20Support)}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                          <p className="text-[10px] text-white/40 uppercase">Volume</p>
                          <p className="text-sm font-semibold text-white/90">{formatUsdCompact(pick.totalVolume)}</p>
                        </div>
                      </div>

                      {/* Footer indicator */}
                      <div className="flex items-center justify-center gap-1.5 pt-1">
                        {featuredTrades.map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1.5 rounded-full transition-all duration-300",
                              i === featuredIndex ? "w-4 bg-white/60" : "w-1.5 bg-white/20"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading skeleton for cards */}
      {isLoading && !hasFeatured && (
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-[340px] h-[180px] rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 animate-pulse" />
        </div>
      )}

      {/* Smart Money Signals Section - Unnested */}
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">Smart Money Signals</span>
            <span className="text-[10px] text-zinc-600">
              {data?.summary.uniqueMarkets ?? 0} markets · 24h
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Sort toggles */}
            <div className="flex gap-1">
              {(["confidence", "support", "volume"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] transition-all",
                    sortKey === key
                      ? "bg-white/10 text-white/90"
                      : "text-zinc-500 hover:text-white/70"
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
            {/* Refresh button */}
            <button
              onClick={refresh}
              className="p-1.5 rounded-md text-zinc-500 hover:text-white/70 hover:bg-white/5 transition-all"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Event Cards */}
        {error && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
            {error}
          </div>
        )}
        {!isLoading && !error && groupedEvents.length === 0 && (
          <div className="text-center text-zinc-600 py-10 border border-dashed border-zinc-800 rounded-xl">
            No signals yet. Waiting for smart money...
          </div>
        )}

        {isLoading && <SkeletonRows />}

        {!isLoading && groupedEvents.map((event) => (
          <EventCard
            key={event.eventTitle}
            event={event}
            onSelectOutcome={setSelectedPick}
          />
        ))}
      </div>

      <AiInsightsTradesModal
        pick={selectedPick}
        onClose={() => setSelectedPick(null)}
      />
    </div>
  );
}

// Single event card with all outcomes
function EventCard({
  event,
  onSelectOutcome
}: {
  event: GroupedEvent;
  onSelectOutcome: (pick: AiInsightPick) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      {/* Event Header */}
      <div className="px-4 py-3 border-b border-zinc-800/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-100 line-clamp-2">{event.eventTitle}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
              <span>{formatUsdCompact(event.totalVolume)} vol</span>
              <span>·</span>
              <span>{event.outcomes.length} outcomes</span>
              {event.bestRank && (
                <>
                  <span>·</span>
                  <span className="text-emerald-400">#{event.bestRank}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-emerald-300">{event.bestConfidence}%</div>
            <div className="text-[10px] text-zinc-500">top signal</div>
          </div>
        </div>
      </div>

      {/* Outcomes */}
      <div className="divide-y divide-zinc-800/30">
        {event.outcomes.map((pick) => (
          <OutcomeRow
            key={pick.id}
            pick={pick}
            onClick={() => onSelectOutcome(pick)}
          />
        ))}
      </div>
    </div>
  );
}

// Individual outcome row
function OutcomeRow({ pick, onClick }: { pick: AiInsightPick; onClick: () => void }) {
  const confidence = getDisplayConfidence(pick);
  const isBullish = pick.stance === "bullish";
  const isResolved = pick.isResolved;
  const tradePrice = pick.latestPrice ?? 0;

  return (
    <div
      className={cn(
        "px-4 py-2.5 cursor-pointer transition-colors",
        isResolved
          ? "opacity-40 hover:opacity-60"
          : "hover:bg-white/2"
      )}
      onClick={onClick}
    >
      {/* Mobile layout */}
      <div className="flex flex-col gap-1 md:hidden">
        <div className="flex items-start gap-2 justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <div className={cn(
              "shrink-0 w-4 h-4 rounded flex items-center justify-center",
              isResolved
                ? "text-zinc-600"
                : isBullish
                  ? "text-emerald-400"
                  : "text-rose-400"
            )}>
              {isBullish ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            </div>
            <span className={cn(
              "text-sm leading-5 line-clamp-2",
              isResolved ? "text-zinc-600" : "text-zinc-300"
            )} title={pick.marketQuestion || undefined}>
              {extractMarketContext(pick.marketQuestion, pick.outcome)}
            </span>
            {isResolved && (
              <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-zinc-800 text-zinc-500">
                Resolved
              </span>
            )}
          </div>
          <div className={cn(
            "shrink-0 text-xs font-mono text-right min-w-[44px]",
            isResolved ? "text-zinc-600" : tradePrice >= 0.5 ? "text-emerald-300" : "text-amber-300"
          )}>
            {formatCents(tradePrice)}
          </div>
        </div>
        <div className="grid grid-cols-3 items-center gap-2 text-[11px] text-zinc-500">
          <div className="flex flex-col">
            <span className="uppercase text-[10px] tracking-[0.08em] text-zinc-600">Support</span>
            <span className={cn("text-xs", isResolved ? "text-zinc-600" : "text-zinc-300")}>
              {formatPct(pick.top20Support)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="uppercase text-[10px] tracking-[0.08em] text-zinc-600">Volume</span>
            <span className={cn("text-xs", isResolved ? "text-zinc-600" : "text-zinc-300")}>
              {formatUsdCompact(pick.totalVolume)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="uppercase text-[10px] tracking-[0.08em] text-zinc-600">Signal</span>
            <span className={cn(
              "text-[11px] px-1.5 py-0.5 rounded",
              isResolved
                ? "text-zinc-600"
                : confidence >= 70
                  ? "text-emerald-300 bg-emerald-500/10"
                  : confidence >= 50
                    ? "text-amber-300 bg-amber-500/10"
                    : "text-zinc-400"
            )}>
              {confidence}%
            </span>
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-[1fr_70px_70px_80px_60px] md:items-center md:gap-2">
        {/* Outcome */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "shrink-0 w-4 h-4 rounded flex items-center justify-center",
            isResolved
              ? "text-zinc-600"
              : isBullish
                ? "text-emerald-400"
                : "text-rose-400"
          )}>
            {isBullish ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          </div>
          <span className={cn(
            "text-sm leading-5 line-clamp-1 truncate",
            isResolved ? "text-zinc-600" : "text-zinc-300"
          )} title={pick.marketQuestion || undefined}>
            {extractMarketContext(pick.marketQuestion, pick.outcome)}
          </span>
          {isResolved && (
            <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-zinc-800 text-zinc-500">
              Resolved
            </span>
          )}
        </div>

        {/* Price */}
        <div className="text-right">
          <span className={cn(
            "text-sm font-mono",
            isResolved ? "text-zinc-600" : tradePrice >= 0.5 ? "text-emerald-300" : "text-amber-300"
          )}>
            {formatCents(tradePrice)}
          </span>
        </div>

        {/* Top20 */}
        <div className="text-right">
          <span className={cn("text-sm", isResolved ? "text-zinc-600" : "text-zinc-400")}>
            {formatPct(pick.top20Support)}
          </span>
        </div>

        {/* Volume */}
        <div className="text-right">
          <span className={cn("text-sm", isResolved ? "text-zinc-600" : "text-zinc-500")}>
            {formatUsdCompact(pick.totalVolume)}
          </span>
        </div>

        {/* Signal */}
        <div className="text-right">
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded",
            isResolved
              ? "text-zinc-600"
              : confidence >= 70
                ? "text-emerald-300 bg-emerald-500/10"
                : confidence >= 50
                  ? "text-amber-300 bg-amber-500/10"
                  : "text-zinc-400"
          )}>
            {confidence}%
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="h-[120px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
        />
      ))}
    </div>
  );
}
