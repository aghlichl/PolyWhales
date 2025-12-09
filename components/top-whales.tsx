"use client";

import { useEffect } from "react";
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

  // Load initial data on mount only
  useEffect(() => {
    fetchTopTrades(selectedPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only runs once on mount

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
          {topTrades.map((anomaly, index) => (
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
        </div>
      ) : (
        <div className="text-center text-zinc-600 mt-20">
          NO TRADES FOUND FOR {PERIOD_LABELS[selectedPeriod].toUpperCase()}
        </div>
      )}

      {/* Load More Button */}
      {topTrades.length > 0 && hasMore && (
        <div className="flex justify-center py-8">
          <button
            onClick={() => loadMoreTopTrades()}
            disabled={topTradesLoading}
            className={cn(
              "px-4 py-2 border-2 border-zinc-700 bg-zinc-900 text-zinc-400 text-sm uppercase tracking-wider transition-all hover:border-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg",
              topTradesLoading && "opacity-50 cursor-wait"
            )}
          >
            {topTradesLoading ? "LOADING..." : "LOAD MORE"}
          </button>
        </div>
      )}
    </div>
  );
}
