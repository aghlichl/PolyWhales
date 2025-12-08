"use client";

import { useEffect, useMemo } from "react";
import { useMarketStore } from "@/lib/store";
import { NumericDisplay } from "@/components/ui/numeric-display";

export function Ticker() {
  const {
    topTrades,
    topTradesLoading,
    fetchTopTrades,
    volume,
  } = useMarketStore();

  useEffect(() => {
    if (!topTrades.length && !topTradesLoading) {
      fetchTopTrades('today');
    }
  }, [fetchTopTrades, topTrades.length, topTradesLoading]);

  const tickerEntries = useMemo(() => {
    if (!topTrades?.length) return [];

    return topTrades.slice(0, 100).map((trade) => {
      const outcome = trade.outcome || "";
      const side = trade.side === "SELL" ? "SELL" : "BUY";
      const valueLabel = `$${(trade.value / 1000).toFixed(1)}K`;

      return {
        id: trade.id,
        event: trade.event,
        side,
        outcome,
        valueLabel,
      };
    });
  }, [topTrades]);

  const marqueeItems = tickerEntries
    
  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] left-0 right-0 flex z-50 select-none">
      <div className="bg-primary/30 px-3 h-8 flex items-center border-r border-primary/40 z-50 backdrop-blur-sm shadow-[0_0_12px_rgba(0,255,148,0.25)]">
        <span className="text-primary text-xs font-bold tracking-[0.18em]">
          VOL{" "}
          <NumericDisplay
            value={`$${(volume / 1000000).toFixed(2)}M`}
            size="xs"
            variant="bold"
          />
        </span>
      </div>

      <div className="flex-1 h-8 bg-zinc-950/90 border-b border-zinc-800 overflow-hidden relative z-50 backdrop-blur-sm">
        <div className="absolute inset-0 flex items-center">
          <div className="ticker-marquee" aria-label="Top daily whales ticker">
            <div className="ticker-track">
              {marqueeItems.map((item) => (
                <span
                  key={`primary-${item.id}`}
                  className="ticker-chip"
                >
                  <span className="ticker-text">{item.event}</span>
                  {item.side && (
                    <span
                      className={`ticker-side ${item.side === "SELL" ? "text-rose-400" : "text-emerald-400"}`}
                    >
                      · {item.side}
                    </span>
                  )}
                  {item.outcome && (
                    <span className="ticker-outcome">· {item.outcome}</span>
                  )}
                  <span className="ticker-value">· {item.valueLabel}</span>
                </span>
              ))}
            </div>
            <div className="ticker-track">
              {marqueeItems.map((item) => (
                <span
                  key={`duplicate-${item.id}`}
                  className="ticker-chip"
                >
                  <span className="ticker-text">{item.event}</span>
                  {item.side && (
                    <span
                      className={`ticker-side ${item.side === "SELL" ? "text-rose-400" : "text-emerald-400"}`}
                    >
                      · {item.side}
                    </span>
                  )}
                  {item.outcome && (
                    <span className="ticker-outcome">· {item.outcome}</span>
                  )}
                  <span className="ticker-value">· {item.valueLabel}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
