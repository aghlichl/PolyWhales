"use client";

import React, { useState } from "react";
import { SidebarNavigation, DesktopPage } from "./sidebar-navigation";
import { cn } from "@/lib/utils";

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

export function DesktopLayout({
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
    const [activePage, setActivePage] = useState<DesktopPage>("live");

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
                        "grid grid-cols-1 h-full divide-x divide-zinc-800/50 min-h-0",
                        activePage === "charts" ? "lg:grid-cols-3" : "lg:grid-cols-2"
                    )}>
                        {activePage === "charts" ? (
                            <>
                                {/* Charts: Top Traders */}
                                <div className="flex flex-col h-full bg-zinc-950/30 min-h-0 overflow-x-hidden relative">
                                    <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {rightTitle || <>TOP <span className="text-orange-400 animate-pulse">TRADERS</span></>}
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 scrollbar-hide">
                                        {rightPanel}
                                    </div>
                                </div>

                                {/* Charts: Top Whales */}
                                <div className="flex flex-col h-full bg-background min-h-0 overflow-x-hidden relative">
                                    <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30 flex items-center justify-center">
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
                                    <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30 flex items-center justify-center">
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
                                {/* LEFT COLUMN */}
                                <div className="hidden lg:flex lg:flex-col h-full bg-zinc-950/30 min-h-0 overflow-x-hidden relative">
                                    <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {activePage === "live"
                                                ? (leftTitle || <><span className="text-fuchsia-400 animate-pulse">AI</span> INSIGHTS</>)
                                                : (rightTitle || <>TOP <span className="text-orange-400 animate-pulse">TRADERS</span></>)
                                            }
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 scrollbar-hide">
                                        {activePage === "live" ? leftPanel : rightPanel}
                                    </div>
                                </div>

                                {/* RIGHT COLUMN */}
                                <div className="h-full relative bg-background flex flex-col min-h-0">
                                    <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30 relative z-5 flex items-center justify-center">
                                        <h2 className="text-center text-sm tracking-wider uppercase">
                                            {centerTitle || <><span className="text-green-400 animate-pulse">LIVE</span> MARKET INTELLIGENCE</>}
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

