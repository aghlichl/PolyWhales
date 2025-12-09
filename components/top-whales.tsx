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
  }, []); // Empty dependency array - only runs once on mount

  return (
    <div className="w-full">
      {/* Period selector */}
      <div className="px-4 pb-3">
        <div className="flex gap-1">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all rounded border",
                selectedPeriod === period
                  ? "bg-zinc-800 text-zinc-100 border-zinc-600 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-transparent"
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
            <div key={anomaly.id} className="relative">
              {/* Rank indicator */}
              <div className="absolute -left-8 top-4 z-10">
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                  index === 0 ? "border-yellow-500 bg-yellow-950/20 text-yellow-300" :
                    index === 1 ? "border-gray-400 bg-gray-950/20 text-gray-300" :
                      index === 2 ? "border-orange-600 bg-orange-950/20 text-orange-300" :
                        "border-zinc-600 bg-zinc-800 text-zinc-400"
                )}>
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
