"use client";

import { useMarketStore } from "@/lib/store";

export function Ticker() {
  const { tickerItems, volume } = useMarketStore();

  return (
    <div className="flex">
      <div className="bg-primary/10 px-3 h-8 flex items-center border-r border-primary/20 z-10">
        <span className="text-primary font-mono text-xs font-bold">
          VOL ${(volume / 1000000).toFixed(2)}M
        </span>
      </div>
      <div className="flex-1 h-8 bg-zinc-950 border-b border-zinc-800 flex items-center overflow-hidden whitespace-nowrap relative z-50">
        <div className="flex animate-marquee">
          {tickerItems.map((item, i) => (
            <span key={i} className="mx-4 text-xs font-mono text-zinc-500">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
