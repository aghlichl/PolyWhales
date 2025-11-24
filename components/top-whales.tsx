"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/lib/store";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { cn } from "@/lib/utils";

type Period = 'today' | 'weekly' | 'monthly' | 'yearly' | 'max';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'TODAY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
  max: 'ALL'
};

const PERIODS: Period[] = ['today', 'weekly', 'monthly', 'yearly', 'max'];

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

  // Load initial data on mount
  useEffect(() => {
    fetchTopTrades(selectedPeriod);
  }, [fetchTopTrades, selectedPeriod]);

  return (
    <div className="w-full">
      {/* Fixed Header and Controls */}
      <div className="space-y-6 pb-4">

        {/* Period Selector */}
        <div className="flex flex-wrap gap-2 justify-center pl-14 pr-2">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              disabled={topTradesLoading}
              className={cn(
                "px-2 py-1.5 border-2 font-mono text-xs font-bold uppercase transition-all duration-200 shrink-0",
                selectedPeriod === period
                  ? "border-[#b8a889] bg-[#b8a889]/10 text-[#e9e2d3] shadow-[3px_3px_0px_0px_rgba(184,168,137,0.7)]"
                  : "border-zinc-600 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300",
                topTradesLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto scrollbar-hide">
        {topTradesLoading ? (
          <div className="text-center text-zinc-600 mt-20 font-mono">
            LOADING TOP TRADES...
          </div>
        ) : topTrades.length > 0 ? (
          <div className="space-y-4 pl-10 pr-4 py-2">
            {topTrades.map((anomaly, index) => (
              <div key={anomaly.id} className="relative">
                {/* Rank indicator */}
                <div className="absolute -left-8 top-4 z-10">
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-mono font-bold",
                    index === 0 ? "border-yellow-500 bg-yellow-950/20 text-yellow-300" :
                      index === 1 ? "border-gray-400 bg-gray-950/20 text-gray-300" :
                        index === 2 ? "border-orange-600 bg-orange-950/20 text-orange-300" :
                          "border-zinc-600 bg-zinc-800 text-zinc-400"
                  )}>
                    {index + 1}
                  </div>
                </div>
                <AnomalyCard anomaly={anomaly} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-zinc-600 mt-20 font-mono">
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
                "px-4 py-2 border-2 border-zinc-700 bg-zinc-900 text-zinc-400 font-mono text-sm uppercase tracking-wider transition-all hover:border-zinc-500 hover:text-zinc-200 hover:bg-zinc-800",
                topTradesLoading && "opacity-50 cursor-wait"
              )}
            >
              {topTradesLoading ? "LOADING..." : "LOAD MORE"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
