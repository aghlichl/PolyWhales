"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useMarketStore, usePreferencesStore, getTop20Wallets } from "@/lib/store";
import { Anomaly, UserPreferences as UserPreferencesType } from "@/lib/types";
// import { Ticker } from "@/components/feed/ticker";
import { SlotReel } from "@/components/feed/slot-reel";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { BottomCarousel } from "@/components/bottom-carousel";
import { SearchButton, FilterState } from "@/components/search-button";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { motion } from "framer-motion";
import { isSportsAnomaly } from "@/lib/utils";
import { useCategoryFilter, Category, CategoryProvider } from "@/lib/useCategoryFilter";


import { HybridHeader } from "@/components/hybrid-header";
import { DesktopLayout } from "@/components/desktop-layout";
import { AIInsightsPanel } from "@/components/ai-insights-panel";
import { TopTradersPanel } from "@/components/top-traders-panel";
import { TopWhales } from "@/components/top-whales";
import { BiggestWinnersPanel } from "@/components/leaderboard/biggest-winners-panel";

const PAGE_SIZE = 20;

// Helper function to check if anomaly passes user preferences
function passesPreferences(anomaly: Anomaly, preferences: UserPreferencesType, top20Wallets?: Set<string>): boolean {
  // Check minimum value threshold
  if (anomaly.value < preferences.minValueThreshold) return false;

  // Check odds range
  if (anomaly.odds < preferences.minOdds || anomaly.odds > preferences.maxOdds) return false;

  // Check top players filter
  if (preferences.filterTopPlayersOnly) {
    if (!top20Wallets || top20Wallets.size === 0) {
      // If leaderboard data not loaded yet, don't filter (show all)
      // This prevents hiding everything while data loads
      return true;
    }
    const walletAddress = anomaly.wallet_context?.address?.toLowerCase();
    if (!walletAddress || !top20Wallets.has(walletAddress)) {
      return false;
    }
  }

  // NOTE: Sports filtering is now handled by category selection in sidebar
  // The showSports preference is still respected for backwards compatibility
  if (!preferences.showSports && isSportsAnomaly(anomaly)) {
    return false;
  }

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

// Logic to check advanced filters
const passesAdvancedFilters = (anomaly: Anomaly, filters: FilterState): boolean => {
  // 1. Tiers
  if (filters.tiers.length > 0 && !filters.tiers.includes(anomaly.type)) {
    return false;
  }

  // 2. Sides
  if (filters.sides.length > 0 && !filters.sides.includes(anomaly.side)) {
    return false;
  }

  // 3. Leagues
  if (filters.leagues.length > 0) {
    const rawLeague = (
      anomaly.league ||
      anomaly.analysis?.market_context?.league ||
      anomaly.sport ||
      anomaly.analysis?.market_context?.sport ||
      anomaly.category ||
      ''
    ).toUpperCase();

    const matchesLeague = filters.leagues.some(filterLeague => {
      // Direct match
      if (rawLeague.includes(filterLeague)) return true;

      // Mappings
      if (filterLeague === 'SOCCER') {
        return ['UEFA', 'MLS', 'EPL', 'SOCCER', 'LIGA', 'BUNDESLIGA'].some(s => rawLeague.includes(s));
      }
      if (filterLeague === 'POLITICS') {
        return ['POLITICS', 'ELECTION', 'PRESIDENT', 'SENATE'].some(s => rawLeague.includes(s));
      }
      if (filterLeague === 'CRYPTO') {
        return ['CRYPTO', 'BITCOIN', 'ETHEREUM', 'SOLANA', 'TOKEN'].some(s => rawLeague.includes(s));
      }

      return false;
    });

    if (!matchesLeague) return false;
  }

  return true;
};

// Filter by category (sports vs markets)
const passesCategoryFilter = (anomaly: Anomaly, category: Category): boolean => {
  const isSports = isSportsAnomaly(anomaly);

  if (category === "sports") {
    return isSports;
  } else {
    // Markets = everything that is NOT sports
    return !isSports;
  }
};

function TerminalContent() {
  const { anomalies, startStream, isLoading, loadMoreHistory, hasMoreHistory, fetchLeaderboardRanks, leaderboardRanks } = useMarketStore();
  const { preferences, loadPreferences } = usePreferencesStore();
  const { activeCategory } = useCategoryFilter();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({ tiers: [], sides: [], leagues: [] });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Compute top 20 wallets from leaderboard ranks
  const top20Wallets = useMemo(() => {
    if (!leaderboardRanks || Object.keys(leaderboardRanks).length === 0) {
      return undefined;
    }
    return getTop20Wallets(leaderboardRanks);
  }, [leaderboardRanks]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when switching tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Filter anomalies based on category, preferences, search query, and advanced filters
  const filteredAnomalies = anomalies
    .filter(anomaly => passesCategoryFilter(anomaly, activeCategory))
    .filter(anomaly => passesPreferences(anomaly, preferences, top20Wallets))
    .filter(anomaly => passesAdvancedFilters(anomaly, filters))
    .filter(anomaly => intelligentSearch(anomaly, searchQuery));

  const visibleAnomalies = useMemo(
    () => filteredAnomalies.slice(0, visibleCount),
    [filteredAnomalies, visibleCount]
  );

  const canShowMoreLocal = visibleCount < filteredAnomalies.length;

  // Intersection Observer for Infinite Scroll (load more history or reveal more locally)
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;

      if (canShowMoreLocal) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredAnomalies.length));
        return;
      }

      if (!searchQuery && hasMoreHistory && !isLoading) {
        loadMoreHistory();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMoreHistory, loadMoreHistory, canShowMoreLocal, filteredAnomalies.length, searchQuery]);

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  useEffect(() => {
    setVisibleCount((prev) => {
      if (filteredAnomalies.length <= PAGE_SIZE) return filteredAnomalies.length;
      const normalizedPrev = Math.max(prev, PAGE_SIZE);
      return Math.min(normalizedPrev, filteredAnomalies.length);
    });
  }, [filteredAnomalies.length]);

  useEffect(() => {
    // Load user preferences on mount
    loadPreferences();
    // Fetch leaderboard ranks on mount
    fetchLeaderboardRanks();
  }, [loadPreferences, fetchLeaderboardRanks]);

  useEffect(() => {
    const cleanup = startStream(() => preferences);
    return cleanup;
  }, [startStream]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only depend on startStream, not preferences since we use a getter function
  // that dynamically gets current preferences without needing to restart the stream

  // Determine center panel title based on current page and category
  const getCenterTitle = () => {
    switch (currentPage) {
      case 0:
        return <><span className="text-fuchsia-400 animate-pulse">AI</span> INSIGHTS</>;
      case 1:
        return activeCategory === "sports"
          ? <><span className="text-green-400 animate-pulse">LIVE</span> SPORTS FEED</>
          : <><span className="text-green-400 animate-pulse">LIVE</span> MARKET INTELLIGENCE</>;
      case 2:
        return <>TOP <span className="text-orange-400 animate-pulse">TRADERS</span></>;
      case 3:
        return <>TOP <span className="text-blue-400 animate-pulse">WHALES</span></>;
      case 4:
        return <>BIGGEST <span className="text-green-400 animate-pulse">WINS</span></>;
      default:
        return activeCategory === "sports"
          ? <><span className="text-green-400 animate-pulse">LIVE</span> SPORTS FEED</>
          : <><span className="text-green-400 animate-pulse">LIVE</span> MARKET INTELLIGENCE</>;
    }
  };

  return (
    <DesktopLayout
      leftPanel={<AIInsightsPanel />}
      rightPanel={<TopTradersPanel />}
      fourthPanel={<TopWhales />}
      biggestWinnersPanel={<BiggestWinnersPanel />}
      winnersTitle={<>BIGGEST <span className="text-green-400 animate-pulse">WINS</span></>}
      centerTitle={getCenterTitle()}
      header={<HybridHeader />}
      ticker={null}
      leftTitle={<><span className="text-fuchsia-400 animate-pulse">AI</span> INSIGHTS</>}
      rightTitle={<>TOP <span className="text-orange-400 animate-pulse">TRADERS</span></>}
      fourthTitle={<>TOP <span className="text-blue-400 animate-pulse">WHALES</span></>}

    >
      <main className="bg-background relative">

        <div className="p-4 pt-4 pb-20">
          <motion.div
            className="w-full"
            key={currentPage}
            initial={{ opacity: 0, x: currentPage === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {currentPage === 0 && (
              <div className="lg:hidden">
                <AIInsightsPanel />
              </div>
            )}

            {currentPage === 1 && (
              <>
                <SearchButton
                  onSearch={setSearchQuery}
                  filters={filters}
                  onFilterChange={setFilters}
                />
                <SlotReel>
                  {visibleAnomalies.map((anomaly) => (
                    <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                  ))}
                </SlotReel>


                {/* Sentinel for Infinite Scroll */}
                {(canShowMoreLocal || (hasMoreHistory && !searchQuery)) && (
                  <div ref={lastElementRef} className="h-4 w-full" />
                )}

                {filteredAnomalies.length === 0 && !isLoading && (
                  <div className="text-center text-zinc-600 mt-20">
                    {searchQuery ? `NO RESULTS FOR "${searchQuery.toUpperCase()}"` :
                      activeCategory === "sports" ? "NO SPORTS SIGNALS YET..." : "WAITING FOR SIGNAL..."}
                  </div>
                )}

                {isLoading && (
                  <div className="text-center text-zinc-600 mt-8 animate-pulse">
                    LOADING MORE DATA...
                  </div>
                )}
              </>
            )}

            {currentPage === 2 && (
              <div className="lg:hidden">
                <TopTradersPanel />
              </div>
            )}

            {currentPage === 3 && (
              <div className="lg:hidden">
                <TopWhales />
              </div>
            )}

            {currentPage === 4 && (
              <div className="lg:hidden">
                <BiggestWinnersPanel />
              </div>
            )}
          </motion.div>
        </div>

        {/* Bottom Navigation - Hidden on Desktop */}
        <div className="fixed bottom-0 left-0 right-0 h-12 border-t border-zinc-800 bg-surface-1/90 backdrop-blur flex items-center justify-center px-3 z-50 lg:hidden">
          <div className="flex-1 flex items-center justify-center">
            <BottomCarousel
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          </div>
        </div>



        {/* Floating Scroll to Top Button */}
        {currentPage === 1 && (
          <ScrollToTopButton
            className="lg:absolute lg:bottom-8"
          />
        )}
      </main>
    </DesktopLayout>
  );
}

export default function Home() {
  return (
    <CategoryProvider>
      <TerminalContent />
    </CategoryProvider>
  );
}
