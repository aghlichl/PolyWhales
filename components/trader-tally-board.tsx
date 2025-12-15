"use client";

import React, { useState, useMemo } from "react";
import { AiInsightRank } from "@/lib/types";
import { cn, formatShortNumber } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Users, Shield, Trophy, Medal, Star } from "lucide-react";

// --- Types & Constants ---

type Tier = "APEX" | "ELITE" | "STRONG" | "UNPROVEN" | "TOURIST";

interface TierConfig {
    label: string;
    minRank: number;
    maxRank: number;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ElementType;
}

const TIERS: Record<Tier, TierConfig> = {
    APEX: {
        label: "Apex",
        minRank: 1,
        maxRank: 10,
        color: "text-rose-400",
        bgColor: "bg-rose-500/10",
        borderColor: "border-rose-500/30",
        icon: Trophy,
    },
    ELITE: {
        label: "Elite",
        minRank: 11,
        maxRank: 40,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        icon: Star,
    },
    STRONG: {
        label: "Strong",
        minRank: 41,
        maxRank: 90,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
        icon: Shield,
    },
    UNPROVEN: {
        label: "Unproven",
        minRank: 91,
        maxRank: 140,
        color: "text-zinc-400",
        bgColor: "bg-zinc-500/10",
        borderColor: "border-zinc-500/30",
        icon: Medal,
    },
    TOURIST: {
        label: "Tourist",
        minRank: 141,
        maxRank: 999999, // Catch-all
        color: "text-zinc-600",
        bgColor: "bg-zinc-800/20",
        borderColor: "border-zinc-800/30",
        icon: Users,
    },
};

const getTierFromRank = (rank?: number): TierConfig => {
    const r = rank ?? 999;
    if (r <= 10) return TIERS.APEX;
    if (r <= 40) return TIERS.ELITE;
    if (r <= 90) return TIERS.STRONG;
    if (r <= 140) return TIERS.UNPROVEN;
    return TIERS.TOURIST;
};

// --- Sub-components ---

function TierBadge({ rank }: { rank?: number }) {
    const tier = getTierFromRank(rank);
    const Icon = tier.icon;

    const isApex = tier.label === "Apex";

    return (
        <div
            className={cn(
                "flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider",
                isApex ? "shadow-[0_0_15px_rgba(244,63,94,0.4)] border-rose-500/50" : "shadow-[0_0_10px_rgba(0,0,0,0.2)]",
                tier.bgColor,
                tier.borderColor,
                tier.color
            )}
        >
            <Icon className={cn("w-3 h-3", isApex && "animate-pulse")} />
            <span className="hidden sm:inline">{tier.label}</span>
        </div>
    );
}

function TraderRow({
    trader,
    sideTotalVolume,
    hasVolumeData,
    onClick,
}: {
    trader: AiInsightRank;
    sideTotalVolume: number;
    hasVolumeData: boolean;
    onClick?: () => void;
}) {
    const tier = getTierFromRank(trader.rank);
    const identity =
        trader.accountName ||
        (trader.address
            ? `${trader.address.slice(0, 4)}...${trader.address.slice(-4)}`
            : "Unknown");

    const volumeShare =
        hasVolumeData && sideTotalVolume > 0 && trader.outcomeVolumeUsd
            ? (trader.outcomeVolumeUsd / sideTotalVolume) * 100
            : 0;

    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "w-full group relative flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 text-left",
                onClick && "cursor-pointer"
            )}
        >
            {/* Left: Rank & Identity */}
            <div className="flex items-center gap-3 min-w-0">
                {/* Rank # */}
                <div className="w-8 text-right font-mono text-[10px] text-zinc-500">
                    #{trader.rank > 0 && trader.rank < 9999 ? trader.rank : "-"}
                </div>

                {/* Badge */}
                <TierBadge rank={trader.rank} />

                {/* Identity & Volume */}
                <div className="flex items-baseline gap-2 min-w-0">
                    <div className="truncate text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                        {identity}
                    </div>
                    {/* Volume Next to Name */}
                    {trader.outcomeVolumeUsd && (
                        <div className="text-[10px] font-mono text-zinc-500">
                            ${formatShortNumber(trader.outcomeVolumeUsd)}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Volume Bar (Visual only now, text moved) */}
            {hasVolumeData && (
                <div className="flex flex-col items-end gap-1 ml-4 min-w-[60px]">
                    {/* Volume Bar */}
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden flex justify-end">
                        <div
                            className={cn("h-full rounded-full opacity-80", tier.color.replace('text-', 'bg-'))}
                            style={{ width: `${Math.max(volumeShare, 0)}%` }}
                        />
                    </div>
                </div>
            )}
        </button>
    );
}

function SideColumn({
    label,
    traders,
    color,
    hasVolumeData,
    onTraderClick,
    side,
}: {
    label?: string;
    traders: AiInsightRank[];
    color?: string;
    hasVolumeData: boolean;
    onTraderClick?: (trader: AiInsightRank, side: "away" | "home") => void;
    side: "away" | "home";
}) {
    // Sort by rank ascending (best first)
    const sorted = [...traders].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    const displayed = sorted.slice(0, 12); // Max 12
    const remaining = sorted.length - displayed.length;

    const sideTotalVolume = useMemo(() => {
        return displayed.reduce((acc, t) => acc + (t.outcomeVolumeUsd || 0), 0);
    }, [displayed]);

    if (traders.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                <h4 className="text-[10px] uppercase tracking-widest font-mono text-zinc-500 border-b border-white/5 pb-2 mb-2">
                    {label || "Team"}
                </h4>
                <div className="text-xs text-zinc-600 italic py-4 text-center">
                    No top trader data available.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <h4
                className="text-[10px] uppercase tracking-widest font-bold font-mono border-b border-white/5 pb-2 mb-2 flex justify-between items-center"
                style={{ color: color || "#a1a1aa" }}
            >
                <span>{label || "Team"}</span>
                <span className="text-zinc-600 text-[9px] font-normal">
                    {traders.length} Analyzed
                </span>
            </h4>

            <div className="space-y-0.5">
                {displayed.map((trader) => (
                    <TraderRow
                        key={trader.address + trader.rank}
                        trader={trader}
                        sideTotalVolume={sideTotalVolume}
                        hasVolumeData={hasVolumeData}
                        onClick={onTraderClick ? () => onTraderClick(trader, side) : undefined}
                    />
                ))}
            </div>

            {remaining > 0 && (
                <div className="text-center text-[10px] text-zinc-600 font-mono pt-2">
                    +{remaining} more traders
                </div>
            )}
        </div>
    );
}

// --- Main Component ---

interface TraderTallyBoardProps {
    awayTraders: AiInsightRank[];
    homeTraders: AiInsightRank[];
    awayLabel?: string;
    homeLabel?: string;
    awayColor?: string;
    homeColor?: string;
    defaultExpanded?: boolean;
    onTraderClick?: (trader: AiInsightRank, side: "away" | "home") => void;
}

export function TraderTallyBoard({
    awayTraders = [],
    homeTraders = [],
    awayLabel = "Away",
    homeLabel = "Home",
    awayColor,
    homeColor,
    defaultExpanded = false,
    onTraderClick,
}: TraderTallyBoardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Check if volume data is available for ANY trader
    const hasVolumeData = useMemo(() => {
        const allTraders = [...awayTraders, ...homeTraders];
        return allTraders.some((t) => typeof t.outcomeVolumeUsd === "number");
    }, [awayTraders, homeTraders]);

    // Counts
    const awayCount = awayTraders.length;
    const homeCount = homeTraders.length;
    const totalCount = awayCount + homeCount;

    if (totalCount === 0) return null;

    return (
        <div className="w-full border-t border-white/5 bg-black/20">
            {/* Toggle Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                        <Users className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wider font-bold">Top Traders</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                        <span style={{ color: awayColor }} className="font-bold">{awayCount}</span>
                        <span className="text-zinc-600">vs</span>
                        <span style={{ color: homeColor }} className="font-bold">{homeCount}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    <span>{isExpanded ? "Hide Tally" : "View Tally"}</span>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                        <ChevronDown className="w-3.5 h-3.5" />
                    </motion.div>
                </div>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-6 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-4 relative">
                                {/* Vertical Divider (Desktop) */}
                                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />

                                {/* Away Side */}
                                <SideColumn
                                    label={awayLabel}
                                    traders={awayTraders}
                                    color={awayColor}
                                    hasVolumeData={hasVolumeData}
                                    onTraderClick={onTraderClick}
                                    side="away"
                                />

                                {/* Home Side */}
                                <SideColumn
                                    label={homeLabel}
                                    traders={homeTraders}
                                    color={homeColor}
                                    hasVolumeData={hasVolumeData}
                                    onTraderClick={onTraderClick}
                                    side="home"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
