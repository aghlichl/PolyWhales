"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/lib/store";
import { Ticker } from "@/components/feed/ticker";
import { SlotReel } from "@/components/feed/slot-reel";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { motion } from "framer-motion";

export default function Home() {
  const { anomalies, startStream, isLoading } = useMarketStore();

  useEffect(() => {
    const cleanup = startStream();
    return cleanup;
  }, [startStream]);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <Ticker />

      <div className="flex-1 overflow-y-auto p-4 pb-20 scrollbar-hide">
        <motion.div
          className="max-w-md mx-auto w-full"
        >

          <SlotReel>
            {anomalies.map((anomaly) => (
              <AnomalyCard key={anomaly.id} anomaly={anomaly} />
            ))}
          </SlotReel>

          {anomalies.length === 0 && !isLoading && (
            <div className="text-center text-zinc-600 mt-20 font-mono">
              WAITING FOR SIGNAL...
            </div>
          )}

          {isLoading && anomalies.length === 0 && (
            <div className="text-center text-zinc-600 mt-20 font-mono">
              LOADING RECENT WHALES...
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Navigation / Status Bar */}
      <div className="h-16 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur flex items-center justify-around px-4 z-50">
        <div className="flex flex-col items-center text-primary">
          <div className="w-1 h-1 bg-primary rounded-full mb-1 animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest">LIVE</span>
        </div>
        <div className="text-zinc-600 text-xs font-mono">ODDSGOD v1.0</div>
      </div>
    </main >
  );
}
