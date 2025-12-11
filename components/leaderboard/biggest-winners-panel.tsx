"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { NumericDisplay } from "@/components/ui/numeric-display";

type TimePeriod = "day" | "week" | "month" | "all";

const PERIODS: TimePeriod[] = ["day", "week", "month", "all"];

const PERIOD_LABELS: Record<TimePeriod, string> = {
    day: "1D",
    week: "1W",
    month: "1M",
    all: "ALL"
};

const PAGE_SIZE = 20;

type BiggestWinner = {
    id: string;
    winRank: number;
    proxyWallet: string;
    userName?: string | null;
    eventSlug?: string | null;
    eventTitle?: string | null;
    initialValue: number;
    finalValue: number;
    pnl: number;
    profileImage?: string | null;
};

const RANK_COLORS = [
    "#F59E0B", // Gold
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#8B5CF6", // Purple
    "#10B981"  // Emerald
];

export function BiggestWinnersPanel() {
    const [winners, setWinners] = useState<BiggestWinner[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("day");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const lastPeriodRef = useRef<TimePeriod>(selectedPeriod);

    useEffect(() => {
        async function fetchWinners() {
            setLoading(true);
            try {
                const res = await fetch(`/api/biggest-winners?timePeriod=${selectedPeriod}`);
                if (res.ok) {
                    const data = await res.json();
                    setWinners(data);
                    setVisibleCount(Math.min(PAGE_SIZE, data.length));
                } else {
                    setWinners([]);
                    setVisibleCount(PAGE_SIZE);
                }
            } catch (error) {
                console.error("Failed to fetch biggest winners", error);
                setWinners([]);
                setVisibleCount(PAGE_SIZE);
            } finally {
                setLoading(false);
            }
        }
        fetchWinners();
    }, [selectedPeriod]);

    // Reset or clamp visible count when period changes or data size shrinks
    useEffect(() => {
        if (lastPeriodRef.current !== selectedPeriod) {
            lastPeriodRef.current = selectedPeriod;
            setVisibleCount(Math.min(PAGE_SIZE, winners.length));
            return;
        }

        setVisibleCount((prev) => {
            if (winners.length <= PAGE_SIZE) return winners.length;
            return Math.min(Math.max(prev, PAGE_SIZE), winners.length);
        });
    }, [selectedPeriod, winners.length]);

    const visibleWinners = useMemo(
        () => winners.slice(0, visibleCount),
        [winners, visibleCount]
    );

    const canShowMore = visibleCount < winners.length;

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) return;
            if (canShowMore) {
                setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, winners.length));
            }
        });

        if (node) observerRef.current.observe(node);
    }, [canShowMore, loading, winners.length]);

    useEffect(() => {
        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, []);

    if (loading) {
        return (
            <div className="text-center text-zinc-600 mt-20 animate-pulse">
                LOADING BIGGEST WINNERS...
            </div>
        );
    }

    if (winners.length === 0) {
        return (
            <div className="text-center text-zinc-600 mt-20">
                NO DATA AVAILABLE
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Period selector - Glassmorphic pills */}
            <div className="px-4 pb-4 pt-2">
                <div className="p-1 rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 flex gap-1">
                    {PERIODS.map((period) => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            className={cn(
                                "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg",
                                selectedPeriod === period
                                    ? "bg-white/10 text-white shadow-sm border border-white/5 backdrop-blur-md"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {PERIOD_LABELS[period]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4 px-4 pb-4">
                {visibleWinners.map((winner, index) => (
                    <div key={winner.id} className="relative group">
                        {/* Card Content */}
                        <div className="
            relative overflow-hidden rounded-xl border border-white/5 
            bg-zinc-900/40 backdrop-blur-md transition-all duration-300
            hover:bg-zinc-800/60 hover:border-white/10 hover:shadow-lg hover:shadow-green-500/5
            group
          ">
                            <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            <div className="relative flex items-start gap-3 sm:gap-4 p-3 sm:p-4">
                                <div className="flex flex-1 items-start gap-3 sm:gap-4 min-w-0">
                                    {/* Rank + Avatar */}
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <div className={cn(
                                            "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm shadow-inner",
                                            "font-black text-sm border border-white/5 bg-linear-to-b from-white/10 to-white/5",
                                            "transition-transform duration-200 group-hover:scale-105 ring-1 ring-white/5"
                                        )} style={{ color: RANK_COLORS[index % RANK_COLORS.length] }}>
                                            <NumericDisplay value={winner.winRank} size="xs" variant="bold" />
                                        </div>
                                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 ring-2 ring-transparent group-hover:ring-green-500/20 transition-all">
                                            {winner.profileImage ? (
                                                <img src={winner.profileImage} alt={winner.userName || winner.proxyWallet} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[10px] text-zinc-400">
                                                    {winner.userName?.slice(0, 2).toUpperCase() || "WH"}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Identity & Event */}
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-bold text-sm text-zinc-200 truncate">
                                                {winner.userName || `${winner.proxyWallet.slice(0, 6)}...${winner.proxyWallet.slice(-4)}`}
                                            </span>
                                            {winner.userName && (
                                                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline-block">
                                                    {winner.proxyWallet.slice(0, 4)}...
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-zinc-400 truncate pr-1 sm:pr-4">
                                            <span className="text-zinc-300 group-hover:text-green-400 transition-colors">
                                                {winner.eventTitle || "Unknown Event"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Metrics */}
                                <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                    <div className="font-mono font-bold text-green-400 text-base tabular-nums flex items-center gap-1">
                                        <span>+${winner.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono tracking-tighter flex items-center gap-1">
                                        <span>${winner.initialValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        <span className="text-zinc-600">➜</span>
                                        <span className="text-zinc-300">${winner.finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom sheen/highlight */}
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                ))}
                {canShowMore && (
                    <div
                        ref={lastElementRef}
                        className="h-10 w-full rounded-lg border border-white/5 bg-white/5 text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center justify-center"
                    >
                        {loading ? "Loading..." : "Loading more winners..."}
                    </div>
                )}
            </div>
        </div>
    );
}
