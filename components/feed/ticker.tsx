"use client";

import { useMarketStore } from "@/lib/store";
import { NumericDisplay } from "@/components/ui/numeric-display";

export function Ticker() {
  const { tickerItems, volume } = useMarketStore();

  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] left-0 right-0 flex z-50">
      <div className="bg-primary/30 px-3 h-8 flex items-center border-r border-primary/40 z-50 backdrop-blur-sm">
        <span className="text-primary text-xs font-bold">
          VOL <NumericDisplay
            value={`$${(volume / 1000000).toFixed(2)}M`}
            size="xs"
            variant="bold"
          />
        </span>
      </div>
      <div className="flex-1 h-8 bg-zinc-950/90 border-b border-zinc-800 flex items-center overflow-hidden whitespace-nowrap relative z-50 backdrop-blur-sm">
        <div className="flex animate-marquee">
          {tickerItems.map((item, i) => (
            <span key={i} className="mx-4 text-xs text-zinc-500">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
