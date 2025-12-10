"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMarketStore } from "@/lib/store";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { cn } from "@/lib/utils";
import { NumericDisplay } from "@/components/ui/numeric-display";
import { TopTradesPeriod } from "@/lib/client/api";

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

  const visibleTrades = useMemo(
    () => topTrades.slice(0, visibleCount),
    [topTrades, visibleCount]
  );

  const canShowMoreLocal = visibleCount < topTrades.length;

  // Load initial data on mount only
  useEffect(() => {
    fetchTopTrades(selectedPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only runs once on mount

  // Reset or clamp visible count when period changes or list shrinks
  useEffect(() => {
    if (lastPeriodRef.current !== selectedPeriod) {
      lastPeriodRef.current = selectedPeriod;
      setVisibleCount(Math.min(PAGE_SIZE, topTrades.length));
      return;
    }

    setVisibleCount((prev) => {
      if (topTrades.length <= PAGE_SIZE) return topTrades.length;
      return Math.min(Math.max(prev, PAGE_SIZE), topTrades.length);
    });
  }, [selectedPeriod, topTrades.length]);

  // Intersection Observer for infinite scroll
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (topTradesLoading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;

      if (canShowMoreLocal) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, topTrades.length));
        return;
      }

      if (hasMore && !topTradesLoading) {
        loadMoreTopTrades();
      }
    });

    if (node) observerRef.current.observe(node);
  }, [canShowMoreLocal, hasMore, loadMoreTopTrades, topTrades.length, topTradesLoading]);

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return (
    <div className="w-full">
      {/* Period selector - Glassmorphic pills */}
      <div className="px-4 pb-4">
        <div className="p-1 rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 flex gap-1">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg",
                selectedPeriod === period
                  ? "bg-white/10 text-white shadow-sm border border-white/5 backdrop-blur-md"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>
      </div>

      {topTradesLoading ? (
        <div className="text-center text-zinc-600 mt-20">
          LOADING TOP TRADES...
        </div>
      ) : topTrades.length > 0 ? (
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
          NO TRADES FOUND FOR {PERIOD_LABELS[selectedPeriod].toUpperCase()}
        </div>
      )}
    </div>
  );
}
