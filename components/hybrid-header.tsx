"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarketStore } from "@/lib/store";
import { LoginButton } from "@/components/auth/login-button";
import { UserPreferencesModal } from "@/components/user-preferences-modal";

export function HybridHeader() {
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

    // Ticker Logic
    const {
        topTrades,
        topTradesLoading,
        fetchTopTrades,
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

    const marqueeItems = tickerEntries;
    const hasTickerEntries = marqueeItems.length > 0;

    return (
        <>
            <header className="fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] left-0 right-0 h-10 mx-auto w-[calc(100%-1rem)] bg-surface-1/80 backdrop-blur-md border border-white/10 rounded-full z-40 flex items-center px-1 shadow-lg overflow-hidden">

                {/* LOGO AREA */}
                <div className="flex items-center gap-2 pl-3 pr-3 shrink-0 h-full relative z-20">
                    <img
                        src="/polywhalelogo.png"
                        alt="PolyWhale Logo"
                        className="h-6 w-6 object-contain"
                    />
                    <h1 className="text-sm font-black tracking-tighter italic bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent hidden sm:block">
                        POLYWHALES
                    </h1>
                </div>

                {/* TICKER MARQUEE */}
                <div className="flex-1 h-full overflow-hidden relative z-10 flex items-center bg-surface-1/20">
                    {/* Gradient Masks */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 z-20 bg-gradient-to-r from-surface-1 to-transparent pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-8 z-20 bg-gradient-to-l from-surface-1 to-transparent pointer-events-none" />

                    <div
                        className={`ticker-marquee w-full ${hasTickerEntries ? "" : "opacity-0"}`}
                        aria-label="Top daily whales ticker"
                        style={{ animationPlayState: hasTickerEntries ? "running" : "paused" }}
                    >
                        <div className="ticker-track">
                            {marqueeItems.map((item) => (
                                <span
                                    key={`primary-${item.id}`}
                                    className="ticker-chip text-xs py-0.5"
                                >
                                    <span className="ticker-text text-zinc-300">{item.event}</span>
                                    {item.side && (
                                        <span
                                            className={`ticker-side font-bold ${item.side === "SELL" ? "text-rose-400" : "text-emerald-400"}`}
                                        >
                                            · {item.side}
                                        </span>
                                    )}
                                    {item.outcome && (
                                        <span className="ticker-outcome text-zinc-400">· {item.outcome}</span>
                                    )}
                                    <span className="ticker-value text-zinc-200 font-medium">· {item.valueLabel}</span>
                                </span>
                            ))}
                        </div>
                        <div className="ticker-track">
                            {marqueeItems.map((item) => (
                                <span
                                    key={`duplicate-${item.id}`}
                                    className="ticker-chip text-xs py-0.5"
                                >
                                    <span className="ticker-text text-zinc-300">{item.event}</span>
                                    {item.side && (
                                        <span
                                            className={`ticker-side font-bold ${item.side === "SELL" ? "text-rose-400" : "text-emerald-400"}`}
                                        >
                                            · {item.side}
                                        </span>
                                    )}
                                    {item.outcome && (
                                        <span className="ticker-outcome text-zinc-400">· {item.outcome}</span>
                                    )}
                                    <span className="ticker-value text-zinc-200 font-medium">· {item.valueLabel}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AUTH & SETTINGS */}
                <div className="flex items-center gap-2 pl-4 pr-1 border-l border-white/5 h-full shrink-0 z-20 bg-surface-1/50 backdrop-blur-sm">
                    <LoginButton
                        showPreferencesTrigger
                        onOpenPreferences={() => setIsPreferencesOpen(true)}
                        compact
                    />
                </div>

            </header>

            <UserPreferencesModal
                isOpen={isPreferencesOpen}
                onClose={() => setIsPreferencesOpen(false)}
            />
        </>
    );
}
