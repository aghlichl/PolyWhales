"use client";

import React from "react";

interface DesktopLayoutProps {
    children: React.ReactNode;
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    centerTitle?: React.ReactNode;
    header?: React.ReactNode;
    ticker?: React.ReactNode;
    leftTitle?: React.ReactNode;
}

export function DesktopLayout({ children, leftPanel, rightPanel, centerTitle, header, ticker, leftTitle }: DesktopLayoutProps) {
    return (
        <div className="h-screen bg-background overflow-hidden min-h-0">
            {/* Header and Ticker rendered outside scroll containers for iOS compatibility */}
            {ticker}
            {header}
            
            <div className="h-full pt-[calc(5rem+env(safe-area-inset-top,0px))] lg:pt-20 overflow-hidden min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 h-full divide-x divide-zinc-800/50 min-h-0">
                    {/* Left Panel - Preferences */}
                    <div className="hidden lg:flex lg:flex-col h-full bg-zinc-950/30 min-h-0">
                        <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30">
                            <h2 className="text-center text-sm tracking-wider uppercase">
                                {leftTitle || <>AI <span className="text-emerald-400 animate-pulse">INSIGHTS</span></>}
                            </h2>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-hide">
                            {leftPanel}
                        </div>
                    </div>

                    {/* Center Panel - Main Feed */}
                    <div className="h-full relative bg-background flex flex-col min-h-0">
                        <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30 relative z-5">
                            <h2 className="text-center text-sm tracking-wider uppercase">
                                {centerTitle || <><span className="text-green-400 animate-pulse">LIVE</span> MARKET INTELLIGENCE</>}
                            </h2>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide scroll-container">
                            {children}
                        </div>
                    </div>

                    {/* Right Panel - Top Whales */}
                    <div className="hidden lg:flex lg:flex-col h-full bg-zinc-950/30 min-h-0">
                        <div className="shrink-0 px-6 py-3 border-b border-zinc-800/30">
                            <h2 className="text-center text-sm tracking-wider uppercase">
                                TOP <span className="text-blue-400 animate-pulse">WHALES</span>
                            </h2>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                            {rightPanel}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
