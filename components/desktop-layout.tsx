"use client";

import React from "react";
import { SidebarNavigation, DesktopPage, Category, SubPage } from "./sidebar-navigation";
import { cn, SPORTS_KEYWORDS } from "@/lib/utils";
import { useCategoryFilter } from "@/lib/useCategoryFilter";

interface DesktopLayoutProps {
    children: React.ReactNode;
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    fourthPanel?: React.ReactNode;
    centerTitle?: React.ReactNode;
    header?: React.ReactNode;
    ticker?: React.ReactNode;
    leftTitle?: React.ReactNode;
    rightTitle?: React.ReactNode;
    fourthTitle?: React.ReactNode;
    biggestWinnersPanel?: React.ReactNode;
    winnersTitle?: React.ReactNode;
}

// Export helper to check if an event is sports-related
export function isSportsEvent(eventText: string): boolean {
    return SPORTS_KEYWORDS.some(keyword =>
        eventText.toLowerCase().includes(keyword.toLowerCase())
    );
}

function DesktopLayoutInner({
    children,
    leftPanel,
    rightPanel,
    fourthPanel,
    centerTitle,
    header,
    ticker,
    leftTitle,
    rightTitle,
    fourthTitle,
    biggestWinnersPanel,
    winnersTitle
}: DesktopLayoutProps) {
    const { activePage, setActivePage, activeCategory } = useCategoryFilter();

    // Determine if we're in charts view (either sports-charts or markets-charts)
    const activeSubPage = activePage.split("-")[1] as SubPage;
    const isChartsView = activeSubPage === "charts";

    // Get category-specific titles
    const getLiveTitle = () => {
        if (activeCategory === "sports") {
            return (
                <>
                    <span className="text-green-400 animate-pulse">LIVE</span> SPORTS FEED
                </>
            );
        }
        return (
            <>
                <span className="text-green-400 animate-pulse">LIVE</span> MARKET INTELLIGENCE
            </>
        );
    };

    return (
        <div className="h-screen bg-background overflow-hidden min-h-0 flex flex-col">
            {/* Header and Ticker rendered outside scroll containers for iOS compatibility */}
            <div className="shrink-0 z-50 relative bg-background/80 backdrop-blur-md">
                {ticker}
                {header}
            </div>

            <div className="relative flex-1 min-h-0">
                {/* Floating Sidebar */}
                <SidebarNavigation activePage={activePage} onPageChange={setActivePage} />

                <div className="h-full pt-[calc(3rem+env(safe-area-inset-top,0px))] lg:pt-[calc(3.5rem+env(safe-area-inset-top,0px))] overflow-hidden min-h-0">
                    <div className={cn(
                        "grid grid-cols-1 h-full",
                        isChartsView ? "lg:grid-cols-3" : "lg:grid-cols-2"
                    )}>
                        {isChartsView ? (
                            <>
                                {/* Charts: Top Traders */}
                                <div className="flex flex-col h-full bg-background min-h-0 overflow-x-hidden relative">
                                    <div className="shrink-0 px-6 py-3 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {rightTitle || <>TOP <span className="text-orange-400 animate-pulse">TRADERS</span></>}
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
                                        {rightPanel}
                                    </div>
                                </div>

                                {/* Charts: Top Whales */}
                                <div className="flex flex-col h-full bg-background min-h-0 overflow-x-hidden relative">
                                    <div className="shrink-0 px-6 py-3 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {fourthTitle || <>TOP <span className="text-blue-400 animate-pulse">WHALES</span></>}
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
                                        {fourthPanel}
                                    </div>
                                </div>

                                {/* Charts: Biggest Winners */}
                                <div className="flex flex-col h-full bg-background min-h-0 overflow-x-hidden relative">
                                    <div className="shrink-0 px-6 py-3 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {winnersTitle || <>BIGGEST <span className="text-green-400 animate-pulse">WINS</span></>}
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
                                        {biggestWinnersPanel}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* LEFT COLUMN - AI Insights */}
                                <div className="hidden lg:flex lg:flex-col h-full bg-background min-h-0 overflow-x-hidden relative">
                                    <div className="shrink-0 px-6 py-3 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {leftTitle || <><span className="text-fuchsia-400 animate-pulse">AI</span> INSIGHTS</>}
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
                                        {leftPanel}
                                    </div>
                                </div>

                                {/* RIGHT COLUMN - Live Feed (filtered by category) */}
                                <div className="h-full relative bg-background flex flex-col min-h-0">
                                    <div className="shrink-0 px-6 py-3 relative z-5 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {centerTitle || getLiveTitle()}
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-container">
                                        {children}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// DesktopLayout - category context is now provided at page level
export function DesktopLayout(props: DesktopLayoutProps) {
    return <DesktopLayoutInner {...props} />;
}

// Export the types for use in child components 
export { type Category, type SubPage, type DesktopPage };
