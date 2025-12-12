"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMarketStore } from "@/lib/store";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { cn } from "@/lib/utils";
import { NumericDisplay } from "@/components/ui/numeric-display";
import { TopTradesPeriod } from "@/lib/client/api";
import { motion } from "framer-motion";
import { ExpandableSearch } from "@/components/expandable-search";
import type { FilterState } from "@/components/search-button";
import { useDebounce, applyWhaleFilters, applyWhaleSearch } from "@/lib/filtering";
import type { AnomalyType } from "@/lib/types";

const PERIODS: TopTradesPeriod[] = ["today", "weekly", "monthly", "max"];

const PERIOD_LABELS: Record<TopTradesPeriod, string> = {
  today: "1D",
  weekly: "1W",
  monthly: "1M",
  yearly: "1Y",
  max: "ALL"
};

const PAGE_SIZE = 20;

const RANK_COLORS = [
  "#F59E0B", // Gold
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#8B5CF6", // Purple
  "#10B981"  // Emerald
];

const TIER_OPTIONS: { label: string; value: AnomalyType; color: string }[] = [
  { label: "Standard", value: "STANDARD", color: "bg-zinc-600" },
  { label: "Whale", value: "WHALE", color: "bg-sky-500" },
  { label: "Mega", value: "MEGA_WHALE", color: "bg-purple-500" },
  { label: "Super", value: "SUPER_WHALE", color: "bg-[#8e2a2a]" },
  { label: "God", value: "GOD_WHALE", color: "bg-yellow-500" },
];

const LEAGUE_OPTIONS = ["NBA", "NFL", "NHL", "MLB", "UFC", "TENNIS", "SOCCER", "POLITICS", "CRYPTO"];

export function TopWhales() {
  const {
    topTrades,
    topTradesLoading,
    selectedPeriod,
    fetchTopTrades,
    setSelectedPeriod,
    hasMore,
    loadMoreTopTrades
  } = useMarketStore();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastPeriodRef = useRef<TopTradesPeriod>(selectedPeriod);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    tiers: [],
    sides: [],
    leagues: []
  });
  const debouncedQuery = useDebounce(searchQuery, 200);

  // Apply filter pipeline: base data -> filters -> search -> slice
  const filteredTrades = useMemo(() => {
    let result = topTrades;

    // Apply advanced filters (Tier/Side/League)
    result = applyWhaleFilters(result, filters);

    // Apply search query
    result = applyWhaleSearch(result, debouncedQuery);

    return result;
  }, [topTrades, filters, debouncedQuery]);

  const visibleTrades = useMemo(
    () => filteredTrades.slice(0, visibleCount),
    [filteredTrades, visibleCount]
  );

  const canShowMoreLocal = visibleCount < filteredTrades.length;

  // Load initial data on mount only
  useEffect(() => {
    fetchTopTrades(selectedPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only runs once on mount

  // Reset or clamp visible count when period changes or list shrinks
  useEffect(() => {
    if (lastPeriodRef.current !== selectedPeriod) {
      lastPeriodRef.current = selectedPeriod;
      setVisibleCount(Math.min(PAGE_SIZE, filteredTrades.length));
      // Reset search and filters when period changes
      setSearchQuery("");
      setFilters({ tiers: [], sides: [], leagues: [] });
      return;
    }

    setVisibleCount((prev) => {
      if (filteredTrades.length <= PAGE_SIZE) return filteredTrades.length;
      return Math.min(Math.max(prev, PAGE_SIZE), filteredTrades.length);
    });
  }, [selectedPeriod, filteredTrades.length]);

  // Intersection Observer for infinite scroll
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (topTradesLoading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;

      if (canShowMoreLocal) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredTrades.length));
        return;
      }

      if (hasMore && !topTradesLoading) {
        loadMoreTopTrades();
      }
    });

    if (node) observerRef.current.observe(node);
  }, [canShowMoreLocal, hasMore, loadMoreTopTrades, filteredTrades.length, topTradesLoading]);

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // Filter helpers
  const toggleTier = (tier: AnomalyType) => {
    const newTiers = filters.tiers.includes(tier)
      ? filters.tiers.filter(t => t !== tier)
      : [...filters.tiers, tier];
    setFilters({ ...filters, tiers: newTiers });
  };

  const toggleSide = (side: 'BUY' | 'SELL') => {
    const newSides = filters.sides.includes(side)
      ? filters.sides.filter(s => s !== side)
      : [...filters.sides, side];
    setFilters({ ...filters, sides: newSides });
  };

  const toggleLeague = (league: string) => {
    const newLeagues = filters.leagues.includes(league)
      ? filters.leagues.filter(l => l !== league)
      : [...filters.leagues, league];
    setFilters({ ...filters, leagues: newLeagues });
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilters({ tiers: [], sides: [], leagues: [] });
  };

  const hasActiveFilters = filters.tiers.length > 0 || filters.sides.length > 0 || filters.leagues.length > 0;
  const activeFilterCount = filters.tiers.length + filters.sides.length + filters.leagues.length;

  return (
    <div className="w-full">
      {/* Period selector + Search */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          {/* Period selector - Glassmorphic pills */}
          <div className="relative flex-1 p-1 rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 flex gap-1">
            {PERIODS.map((period, index) => {
              const isActive = selectedPeriod === period;
              return (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={cn(
                    "relative flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg z-10",
                    isActive
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {/* Active Background Pill (Animated) */}
                  {isActive && (
                    <motion.div
                      layoutId="top-whales-period-active"
                      className="absolute inset-1 bg-white/10 rounded-lg border border-white/5 backdrop-blur-md shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                      }}
                    />
                  )}

                  {PERIOD_LABELS[period]}
                </button>
              );
            })}
          </div>

          {/* Expandable Search */}
          <ExpandableSearch
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onClear={clearAllFilters}
            placeholder="Search trades..."
            hasActiveFilters={hasActiveFilters}
            renderFilters={() => (
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Filters</span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors font-medium"
                    >
                      RESET ({activeFilterCount})
                    </button>
                  )}
                </div>

                {/* Tier Filter */}
                <div className="space-y-1.5">
                  <div className="text-[9px] text-zinc-500 font-medium ml-1">TIER</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TIER_OPTIONS.map((tier) => (
                      <button
                        key={tier.value}
                        onClick={() => toggleTier(tier.value)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-200 border",
                          filters.tiers.includes(tier.value)
                            ? `border-${tier.color.replace('bg-', '')}/50 ${tier.color} text-white shadow-[0_0_10px_-2px_rgba(255,255,255,0.3)]`
                            : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                        )}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Side Filter */}
                <div className="space-y-1.5">
                  <div className="text-[9px] text-zinc-500 font-medium ml-1">SIDE</div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => toggleSide('BUY')}
                      className={cn(
                        "flex-1 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-200 border",
                        filters.sides.includes('BUY')
                          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]"
                          : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                      )}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => toggleSide('SELL')}
                      className={cn(
                        "flex-1 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-200 border",
                        filters.sides.includes('SELL')
                          ? "border-red-500/50 bg-red-500/20 text-red-400 shadow-[0_0_10px_-2px_rgba(239,68,68,0.3)]"
                          : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                      )}
                    >
                      Sell
                    </button>
                  </div>
                </div>

                {/* League Filter */}
                <div className="space-y-1.5">
                  <div className="text-[9px] text-zinc-500 font-medium ml-1">LEAGUE</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {LEAGUE_OPTIONS.map((league) => (
                      <button
                        key={league}
                        onClick={() => toggleLeague(league)}
                        className={cn(
                          "px-1.5 py-1 rounded-lg text-[9px] font-semibold tracking-wide text-center uppercase transition-all duration-200 border truncate",
                          filters.leagues.includes(league)
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                            : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                        )}
                      >
                        {league}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      {topTradesLoading ? (
        <div className="text-center text-zinc-600 mt-20">
          LOADING TOP TRADES...
        </div>
      ) : filteredTrades.length > 0 ? (
        <div className="space-y-4 p-4 pl-10">
          {visibleTrades.map((anomaly, index) => (
            <div key={anomaly.id} className="relative group">
              {/* Rank indicator */}
              <div className="absolute -left-8 top-4 z-10">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm shadow-inner",
                  "font-black text-sm border border-white/5 bg-linear-to-b from-white/10 to-white/5",
                  "transition-transform duration-200 group-hover:scale-105"
                )} style={{ color: RANK_COLORS[index % RANK_COLORS.length] }}>
                  <NumericDisplay value={index + 1} size="xs" variant="bold" />
                </div>
              </div>
              <AnomalyCard anomaly={anomaly} />
            </div>
          ))}
          {(canShowMoreLocal || hasMore) && (
            <div
              ref={lastElementRef}
              className="h-10 w-full rounded-lg border border-white/5 bg-white/5 text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center justify-center"
            >
              {topTradesLoading ? "Loading..." : "Loading more whales..."}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-zinc-600 mt-20">
          {searchQuery || hasActiveFilters ? (
            <div className="space-y-2">
              <div>NO MATCHING TRADES</div>
              <button
                onClick={clearAllFilters}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            <div>NO TRADES FOUND FOR {PERIOD_LABELS[selectedPeriod].toUpperCase()}</div>
          )}
        </div>
      )}
    </div>
  );
}
