"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ExpandableSearch } from "@/components/expandable-search";
import { useDebounce, applyWinnerSearch } from "@/lib/filtering";
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

// Colors for top ranks
const MEDAL_COLORS = {
    1: "from-yellow-300 via-amber-200 to-yellow-500", // Gold
    2: "from-slate-300 via-zinc-200 to-slate-400",   // Silver
    3: "from-orange-300 via-amber-300 to-orange-400"  // Bronze
};

const RANK_BADGE_COLORS = [
    "bg-amber-500", // 1
    "bg-zinc-400",  // 2
    "bg-orange-500", // 3
    "bg-purple-500", // 4
    "bg-blue-500", // 5
    "bg-emerald-500" // 6+
];

export function BiggestWinnersPanel() {
    const [winners, setWinners] = useState<BiggestWinner[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("day");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const lastPeriodRef = useRef<TimePeriod>(selectedPeriod);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedQuery = useDebounce(searchQuery, 200);

    // Apply search filter
    const filteredWinners = useMemo(() => {
        return applyWinnerSearch(winners, debouncedQuery);
    }, [winners, debouncedQuery]);

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
        // Reset search when period changes
        setSearchQuery("");
    }, [selectedPeriod]);

    // Reset or clamp visible count when period changes or data size shrinks
    useEffect(() => {
        if (lastPeriodRef.current !== selectedPeriod) {
            lastPeriodRef.current = selectedPeriod;
            setVisibleCount(Math.min(PAGE_SIZE, filteredWinners.length));
            return;
        }

        setVisibleCount((prev) => {
            if (filteredWinners.length <= PAGE_SIZE) return filteredWinners.length;
            return Math.min(Math.max(prev, PAGE_SIZE), filteredWinners.length);
        });
    }, [selectedPeriod, filteredWinners.length]);

    const visibleWinners = useMemo(
        () => filteredWinners.slice(0, visibleCount),
        [filteredWinners, visibleCount]
    );

    const canShowMore = visibleCount < filteredWinners.length;

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) return;
            if (canShowMore) {
                setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredWinners.length));
            }
        });

        if (node) observerRef.current.observe(node);
    }, [canShowMore, loading, filteredWinners.length]);

    useEffect(() => {
        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, []);

    // Calculate ROI
    const getRoi = (winner: BiggestWinner) => {
        if (winner.initialValue === 0) return 0;
        return ((winner.finalValue - winner.initialValue) / winner.initialValue) * 100;
    };

    return (
        <div className="w-full relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-0 right-0 h-96 bg-green-500/5 blur-[100px] pointer-events-none rounded-full -translate-y-1/2 opacity-30" />

            {/* Header Controls */}
            <div className="relative sticky top-0 z-30 bg-black/50 backdrop-blur-xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                    {/* Period selector */}
                    <div className="relative flex-1 p-1 rounded-xl bg-black/40 border border-white/5 flex gap-1 shadow-inner shadow-black/50">
                        {PERIODS.map((period) => {
                            const isActive = selectedPeriod === period;
                            return (
                                <button
                                    key={period}
                                    onClick={() => setSelectedPeriod(period)}
                                    className={cn(
                                        "relative flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg z-10 overflow-hidden",
                                        isActive
                                            ? "text-white"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="bw-period-active"
                                            className="absolute inset-0 bg-white/10 rounded-lg border border-white/10 shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)]"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        >
                                            <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent opacity-50" />
                                        </motion.div>
                                    )}
                                    <span className="relative z-10">{PERIOD_LABELS[period]}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Expandable Search */}
                    <ExpandableSearch
                        query={searchQuery}
                        onQueryChange={setSearchQuery}
                        onClear={() => setSearchQuery("")}
                        placeholder="SEARCH..."
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="relative p-4 space-y-3 min-h-[500px]">
                {loading && winners.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 gap-3">
                        <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
                        <div className="text-[10px] text-green-500/50 uppercase tracking-widest animate-pulse">Scanning Chain Data...</div>
                    </div>
                ) : winners.length === 0 ? (
                    <div className="text-center text-zinc-600 mt-20 text-xs uppercase tracking-widest">
                        No winners found
                    </div>
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {visibleWinners.map((winner, index) => {
                                const roi = getRoi(winner);
                                const isTop3 = index < 3;
                                return (
                                    <motion.div
                                        key={winner.id}
                                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                        className="group relative"
                                    >
                                        {/* Card Container */}
                                        <div className={cn(
                                            "relative overflow-hidden rounded-xl border transition-all duration-300",
                                            isTop3
                                                ? "bg-zinc-900/40 backdrop-blur-md border-white/10 hover:border-white/20 hover:bg-zinc-800/40 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]"
                                                : "bg-zinc-950/40 backdrop-blur-sm border-white/5 hover:border-white/10 hover:bg-zinc-900/60"
                                        )}>

                                            {/* Top 3 Glow Effect */}
                                            {isTop3 && (
                                                <div className="absolute -inset-[100%] bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03),transparent_60%)] group-hover:opacity-100 opacity-50 transition-opacity duration-500 pointer-events-none" />
                                            )}

                                            <div className="relative flex items-center p-3 sm:p-4 gap-4">

                                                {/* Rank Badge */}
                                                <div className="flex flex-col items-center justify-center shrink-0 w-10">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-lg ring-1 ring-white/10 relative",
                                                        isTop3
                                                            ? `bg-linear-to-br ${MEDAL_COLORS[index + 1 as 1 | 2 | 3]} text-black`
                                                            : "bg-zinc-800 text-zinc-400 border border-white/5"
                                                    )}>
                                                        <span className="relative z-10">#{index + 1}</span>
                                                        {isTop3 && <div className="absolute inset-0 bg-white/40 blur-sm rounded-lg animate-pulse" />}
                                                    </div>
                                                </div>

                                                {/* User Avatar & Info */}
                                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                                    <div className="relative h-10 w-10 shrink-0">
                                                        <div className={cn(
                                                            "absolute inset-0 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                                                            "bg-green-500/20"
                                                        )} />
                                                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10 ring-2 ring-transparent group-hover:ring-green-500/20 transition-all bg-zinc-900">
                                                            {winner.profileImage ? (
                                                                <img src={winner.profileImage} alt={winner.userName || "User"} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                                                                    <span className="text-[10px] font-bold text-zinc-500">
                                                                        {(winner.userName || "WH").slice(0, 2).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-zinc-100 truncate group-hover:text-green-300 transition-colors">
                                                                {winner.userName || "Anonymous Whale"}
                                                            </span>
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-500 font-mono border border-white/5">
                                                                {winner.proxyWallet.slice(0, 4)}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-zinc-500 truncate mt-0.5 group-hover:text-zinc-400 transition-colors">
                                                            {winner.eventTitle || "Unknown Event"}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Metrics */}
                                                <div className="flex flex-col items-end shrink-0 gap-1 text-right">
                                                    <div className="flex items-center gap-2">
                                                        {/* ROI Badge */}
                                                        <div className="hidden sm:flex items-center px-1.5 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 tracking-wider">
                                                            +{roi.toFixed(0)}%
                                                        </div>
                                                        <div className="font-mono font-black text-lg text-green-400 tracking-tight tabular-nums drop-shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                                                            +<NumericDisplay value={`$${winner.pnl.toLocaleString()}`} />
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-600 font-mono flex items-center gap-1.5">
                                                        <span className="text-zinc-500">${(winner.initialValue / 1000).toFixed(1)}k</span>
                                                        <span className="text-zinc-700">➜</span>
                                                        <span className="text-zinc-300">${(winner.finalValue / 1000).toFixed(1)}k</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Scannnig laser effect */}
                                            <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-linear-to-b from-transparent via-green-500/50 to-transparent -translate-x-full group-hover:animate-[scan_2s_ease-in-out_infinite] opacity-0 group-hover:opacity-100" />

                                            {/* Bottom Highlight */}
                                            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-linear-to-r from-transparent via-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {canShowMore && (
                            <div
                                ref={lastElementRef}
                                className="h-12 w-full rounded-xl border border-white/5 bg-white/5 text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center justify-center hover:bg-white/10 transition-colors cursor-wait"
                            >
                                <span className="animate-pulse">Loading Chain Data...</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Add these keyframes to your global CSS or tailwind config if not present
// @keyframes scan {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(500px); } // Approximate width
// }
