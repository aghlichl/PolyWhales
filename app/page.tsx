"use client";

import { useEffect, useState } from "react";
import { useMarketStore, usePreferencesStore } from "@/lib/store";
import { Anomaly, UserPreferences as UserPreferencesType } from "@/lib/market-stream";
import { Ticker } from "@/components/feed/ticker";
import { SlotReel } from "@/components/feed/slot-reel";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { BottomCarousel } from "@/components/bottom-carousel";
import { UserPreferences } from "@/components/user-preferences";
import { motion } from "framer-motion";

const PAGES = [
  { name: "Feed", component: "feed" },
  { name: "Preferences", component: "preferences" },
  { name: "Top Whales", component: "whales" }
];

// Helper function to check if anomaly passes user preferences
function passesPreferences(anomaly: Anomaly, preferences: UserPreferencesType): boolean {
  // Check minimum value threshold
  if (anomaly.value < preferences.minValueThreshold) return false;

  // Check anomaly type filters
  switch (anomaly.type) {
    case 'STANDARD':
      return preferences.showStandard;
    case 'WHALE':
      return preferences.showWhale;
    case 'MEGA_WHALE':
      return preferences.showMegaWhale;
    default:
      return true;
  }
}

export default function Home() {
  const { anomalies, startStream, isLoading } = useMarketStore();
  const { preferences, loadPreferences } = usePreferencesStore();
  const [currentPage, setCurrentPage] = useState(1);

  // Filter anomalies based on current preferences
  const filteredAnomalies = anomalies.filter(anomaly => passesPreferences(anomaly, preferences));

  useEffect(() => {
    // Load user preferences on mount
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    const cleanup = startStream(() => preferences);
    return cleanup;
  }, [startStream]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only depend on startStream, not preferences since we use a getter function
  // that dynamically gets current preferences without needing to restart the stream

  return (
    <main className="min-h-screen bg-background">
      <Ticker />

      <div className="pt-8 pb-14 overflow-y-auto p-4 scrollbar-hide min-h-screen">
        <motion.div
          className="max-w-md mx-auto w-full"
          key={currentPage}
          initial={{ opacity: 0, x: currentPage === 0 ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {currentPage === 1 && (
            <>
              <SlotReel>
                {filteredAnomalies.map((anomaly) => (
                  <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                ))}
              </SlotReel>

              {filteredAnomalies.length === 0 && !isLoading && (
                <div className="text-center text-zinc-600 mt-20 font-mono">
                  WAITING FOR SIGNAL...
                </div>
              )}

              {isLoading && anomalies.length === 0 && (
                <div className="text-center text-zinc-600 mt-20 font-mono">
                  LOADING RECENT WHALES...
                </div>
              )}
            </>
          )}

          {currentPage === 0 && (
            <UserPreferences />
          )}

          {currentPage === 2 && (
            <div className="text-center mt-20">
              <h2 className="text-xl font-mono text-zinc-300 mb-4">TOP WHALES</h2>
              <p className="text-zinc-600 font-mono">Coming soon...</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Navigation / Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur flex items-center justify-between px-3 z-50">
        {/* Left side - Minimal LIVE indicator */}
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
          <span className="text-[8px] font-mono text-zinc-600 tracking-wider">LIVE</span>
        </div>

        {/* Center - Carousel Navigation */}
        <div className="flex-1 flex items-center justify-center">
          <BottomCarousel
            currentPage={currentPage}
            totalPages={PAGES.length}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right side - Minimal version */}
        <div className="text-[8px] font-mono text-zinc-700">v1.0</div>
      </div>
    </main>
  );
}
