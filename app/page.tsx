"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useMarketStore, usePreferencesStore } from "@/lib/store";
import { Anomaly, UserPreferences as UserPreferencesType } from "@/lib/market-stream";
import { Ticker } from "@/components/feed/ticker";
import { SlotReel } from "@/components/feed/slot-reel";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { BottomCarousel } from "@/components/bottom-carousel";
import { UserPreferences } from "@/components/user-preferences";
import { TopWhales } from "@/components/top-whales";
import { SearchButton } from "@/components/search-button";
import { motion } from "framer-motion";


import { Header } from "@/components/header";
import { QuickSearchFilters } from "@/components/quick-search-filters";

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
    case 'SUPER_WHALE':
      return preferences.showSuperWhale;
    case 'GOD_WHALE':
      return preferences.showGodWhale;
    default:
      return true;
  }
}

export default function Home() {
  const { anomalies, startStream, isLoading, loadMoreHistory, hasMoreHistory } = useMarketStore();
  const { preferences, loadPreferences } = usePreferencesStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>();

  // Intersection Observer for Infinite Scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreHistory) {
        loadMoreHistory();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMoreHistory, loadMoreHistory]);


  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when switching tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterSelect = (query: string) => {
    setActiveFilter(query);
    setSearchQuery(query);
    setCurrentPage(1); // Switch to main feed if not already there
  };

  // Intelligent search function
  const intelligentSearch = (anomaly: Anomaly, query: string): boolean => {
    if (!query.trim()) return true;

    const searchTerm = query.toLowerCase().trim();
    const eventName = anomaly.event.toLowerCase();
    const outcome = anomaly.outcome.toLowerCase();

    // Exact match gets highest priority
    if (eventName.includes(searchTerm) || outcome.includes(searchTerm)) {
      return true;
    }

    // Fuzzy matching - check for partial words
    const words = searchTerm.split(/\s+/);
    return words.some(word =>
      eventName.includes(word) || outcome.includes(word)
    );
  };

  // Filter anomalies based on preferences AND search query
  const filteredAnomalies = anomalies
    .filter(anomaly => passesPreferences(anomaly, preferences))
    .filter(anomaly => intelligentSearch(anomaly, searchQuery));

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
    <main className="h-screen bg-background overflow-hidden relative">
      <Header />
      <Ticker />

      {/* Centered Quick Search Filters - Only on Live Feed page */}
      {currentPage === 1 && (
        <div className="fixed top-11 left-1/2 transform -translate-x-1/2 z-50 hidden md:block">
          <div className="relative max-w-[40vw] w-full">
            {/* Right fade only */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-background/95 via-background/70 to-transparent backdrop-blur-md z-10 pointer-events-none" />

            <QuickSearchFilters
              onFilterSelect={handleFilterSelect}
              activeFilter={activeFilter}
              anomalies={anomalies}
            />
          </div>
        </div>
      )}

      <div className="h-full overflow-y-auto p-4 scrollbar-hide pt-24 pb-20">
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
              
              {/* Sentinel for Infinite Scroll */}
              {hasMoreHistory && !searchQuery && (
                 <div ref={lastElementRef} className="h-4 w-full" />
              )}

              {filteredAnomalies.length === 0 && !isLoading && (
                <div className="text-center text-zinc-600 mt-20 font-mono">
                  {searchQuery ? `NO RESULTS FOR "${searchQuery.toUpperCase()}"` : "WAITING FOR SIGNAL..."}
                </div>
              )}

              {isLoading && (
                <div className="text-center text-zinc-600 mt-8 font-mono animate-pulse">
                  LOADING MORE DATA...
                </div>
              )}
            </>
          )}

          {currentPage === 0 && (
            <UserPreferences />
          )}

          {currentPage === 2 && (
            <TopWhales />
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
            onPageChange={handlePageChange}
          />
        </div>

        {/* Right side - Minimal version */}
        <div className="text-[8px] font-mono text-zinc-700">v1.0</div>
      </div>

      {/* Floating Search Button */}
      {currentPage === 1 && <SearchButton onSearch={setSearchQuery} />}
    </main>
  );
}
