"use client";

import React, { useEffect, useState, useMemo } from "react";
import { cn, formatShortNumber } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
} from "recharts";
import { Card } from "@/components/ui/card";
import { useMarketStore } from "@/lib/store";
import type { LeaderboardRank } from "@/lib/client/api";
import { TraderRibbon } from "./feed/anomaly-card/trader-ribbon";
import { AiInsightsTradesModal } from "@/components/ai-insights-trades-modal";

const selectLeaderboardRanks = (state: ReturnType<typeof useMarketStore.getState>) => state.leaderboardRanks;
const selectFetchLeaderboardRanks = (state: ReturnType<typeof useMarketStore.getState>) => state.fetchLeaderboardRanks;

type PnlHistoryPoint = {
    date: string;
    pnl: number;
};

type TraderData = {
    walletAddress: string;
    accountName: string | null;
    rank: number;
    totalPnl: number;
    rankChange: number | null;
    pnlHistory: PnlHistoryPoint[];
};

type TopTradersResponse = {
    traders: TraderData[];
    period: string;
    snapshotAt: string | null;
};

type Period = "Daily" | "Weekly" | "Monthly" | "All Time";

const PERIODS: Period[] = ["Daily", "Weekly", "Monthly", "All Time"];
const PERIOD_LABELS: Record<Period, string> = {
    "Daily": "1D",
    "Weekly": "1W",
    "Monthly": "1M",
    "All Time": "ALL"
};

const TRADER_COLORS = [
    "#F59E0B", // Gold
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#8B5CF6", // Purple
    "#10B981", // Emerald
];

function formatPnl(value: number): string {
    const absValue = Math.abs(value);
    if (absValue >= 1_000_000) {
        return `${value >= 0 ? "+" : ""}$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (absValue >= 1_000) {
        return `${value >= 0 ? "+" : ""}$${(value / 1_000).toFixed(0)}K`;
    }
    return `${value >= 0 ? "+" : ""}$${value.toFixed(0)}`;
}

function getPnlChange(history: PnlHistoryPoint[]): number | null {
    if (history.length < 2) return null;
    const latest = history[history.length - 1]?.pnl ?? 0;
    const first = history[0]?.pnl ?? 0;
    if (first === 0) return null;
    return ((latest - first) / Math.abs(first)) * 100;
}

// Neobrutalist sparkline
function Sparkline({ data, color }: { data: PnlHistoryPoint[]; color: string }) {
    if (data.length < 2) return <div className="h-8 w-full bg-white/5 rounded-md backdrop-blur-sm" />;

    return (
        <ResponsiveContainer width="100%" height={32}>
            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <defs>
                    <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#spark-${color.replace("#", "")})`}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// Minimal Trader Card
function TraderCard({
    trader,
    index,
    leaderboardRanks,
    onSelect,
}: {
    trader: TraderData;
    index: number;
    leaderboardRanks: Record<string, LeaderboardRank[]>;
    onSelect: () => void;
}) {
    const color = TRADER_COLORS[index % TRADER_COLORS.length];
    const pnlChange = getPnlChange(trader.pnlHistory);
    const isPositive = trader.totalPnl >= 0;
    const polymarketUrl = `https://polymarket.com/profile/${trader.walletAddress}`;

    const walletKey = trader.walletAddress?.toLowerCase?.() || "";
    const walletRanks = useMemo(() => {
        if (!walletKey) return [];
        return leaderboardRanks[walletKey] || [];
    }, [leaderboardRanks, walletKey]);

    const accountName = useMemo(() => {
        const named = walletRanks.find((r) => r.accountName && r.accountName.trim());
        if (named?.accountName) return named.accountName.trim();
        if (trader.accountName) return trader.accountName;
        if (trader.walletAddress) return `${trader.walletAddress.slice(0, 6)}...${trader.walletAddress.slice(-4)}`;
        return null;
    }, [walletRanks, trader.accountName, trader.walletAddress]);

    const isTop20Account = useMemo(() => {
        return walletRanks.some((r) => typeof r.rank === "number" && r.rank > 0 && r.rank <= 20);
    }, [walletRanks]);

    const displayAccountName = isTop20Account ? accountName : null;

    return (
        <div
            className={cn(
                "relative group cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-black/40 backdrop-blur-md transition-all duration-300",
                "hover:border-white/10 hover:bg-black/60 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.03)]"
            )}
            onClick={onSelect}
        >
            {/* Glass shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative p-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    {/* Rank + Name */}
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Rank badge */}
                        <div className={cn(
                            "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm shadow-inner",
                            "font-black text-sm border border-white/5",
                            "bg-gradient-to-b from-white/10 to-white/5"
                        )} style={{ color: color }}>
                            {trader.rank}
                        </div>

                        <div className="min-w-0 flex flex-col">
                            <a
                                href={polymarketUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-sm font-bold text-zinc-100 truncate hover:text-white transition-colors"
                                title="Open Polymarket profile"
                            >
                                <span className="truncate tracking-tight">
                                    {displayAccountName || accountName || "Anonymous"}
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                            <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase">
                                {trader.walletAddress.slice(0, 4)}...{trader.walletAddress.slice(-4)}
                            </span>
                        </div>
                    </div>

                    {/* P&L */}
                    <div className="text-right shrink-0 flex flex-col items-end">
                        <div className={cn(
                            "text-lg font-black tracking-tighter drop-shadow-sm",
                            isPositive ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {formatPnl(trader.totalPnl)}
                        </div>
                        {pnlChange !== null && (
                            <div className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm border border-white/5",
                                pnlChange >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            )}>
                                {pnlChange >= 0 ? "↑" : "↓"} {Math.abs(pnlChange).toFixed(1)}%
                            </div>
                        )}
                    </div>
                </div>

                {/* Sparkline */}
                <div className="mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Sparkline data={trader.pnlHistory} color={color} />
                </div>

                <div className="-mx-1 px-1">
                    <TraderRibbon
                        displayAccountName={displayAccountName}
                        walletRanks={walletRanks}
                        isGod={false}
                        isSuper={false}
                        isMega={false}
                        isWhale={false}
                    />
                </div>
            </div>
        </div>
    );
}

// Comparison chart with minimalist styling
function ComparisonChart({ traders }: { traders: TraderData[] }) {
    const chartData = useMemo(() => {
        const dateMap = new Map<string, Record<string, number | string>>();

        traders.slice(0, 5).forEach((trader, idx) => {
            for (const point of trader.pnlHistory) {
                if (!dateMap.has(point.date)) {
                    dateMap.set(point.date, { date: point.date });
                }
                const entry = dateMap.get(point.date)!;
                entry[`t${idx}`] = point.pnl;
            }
        });

        return Array.from(dateMap.values()).sort(
            (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
        );
    }, [traders]);

    if (chartData.length < 2) {
        return (
            <div className="h-48 flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest font-medium">
                Insufficient data
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#52525b" }}
                    tickFormatter={(val) =>
                        new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                />
                <YAxis
                    tick={{ fontSize: 9, fill: "#52525b" }}
                    tickFormatter={(val) => formatShortNumber(val)}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    dx={-5}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "rgba(9, 9, 11, 0.8)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        borderRadius: "12px",
                        fontSize: "10px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                        padding: "8px 12px",
                    }}
                    itemStyle={{
                        padding: "2px 0",
                    }}
                    labelStyle={{
                        color: "#a1a1aa",
                        marginBottom: "4px",
                        fontWeight: 600,
                    }}
                    labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                        })
                    }
                    formatter={(value: number, name: string) => {
                        const idx = parseInt(name.replace("t", ""), 10);
                        const trader = traders[idx];
                        return [
                            <span key="val" className="font-mono text-zinc-100">{formatPnl(value)}</span>,
                            trader?.accountName || `#${idx + 1}`
                        ];
                    }}
                />
                {traders.slice(0, 5).map((trader, idx) => (
                    <Line
                        key={trader.walletAddress}
                        type="monotone"
                        dataKey={`t${idx}`}
                        stroke={TRADER_COLORS[idx]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: TRADER_COLORS[idx], strokeWidth: 0 }}
                        name={`t${idx}`}
                        strokeOpacity={0.8}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}

// Main panel
export function TopTradersPanel() {
    const [traders, setTraders] = useState<TraderData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<Period>("Daily");
    const [selectedTrader, setSelectedTrader] = useState<TraderData | null>(null);
    const leaderboardRanks = useMarketStore(selectLeaderboardRanks);
    const fetchLeaderboardRanks = useMarketStore(selectFetchLeaderboardRanks);

    const fetchTraders = async (selectedPeriod: Period) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/top-traders?period=${encodeURIComponent(selectedPeriod)}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data: TopTradersResponse = await res.json();
            setTraders(data.traders);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTraders(period);
    }, [period]);

    useEffect(() => {
        fetchLeaderboardRanks();
    }, [fetchLeaderboardRanks]);

    return (
        <div className="space-y-6 px-4 pb-6">
            {/* Period selector - Glassmorphic pills */}
            <div className="p-1 rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 flex gap-1">
                {PERIODS.map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                            "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg",
                            period === p
                                ? "bg-white/10 text-white shadow-sm border border-white/5 backdrop-blur-md"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        {PERIOD_LABELS[p]}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="text-[10px] text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 backdrop-blur-sm">
                    {error}
                </div>
            )}

            {/* Loading skeletons */}
            {isLoading && (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-32 rounded-xl bg-gradient-to-r from-zinc-900/50 to-zinc-900/30 animate-pulse border border-white/5"
                        />
                    ))}
                </div>
            )}

            {/* Chart */}
            {!isLoading && traders.length > 0 && (
                <div className="relative rounded-xl border border-white/5 bg-black/20 backdrop-blur-md p-4 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Top 5
                        </span>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {traders.slice(0, 5).map((t, i) => (
                                <div key={t.walletAddress} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TRADER_COLORS[i] }} />
                                    <span className="text-[9px] text-zinc-300 font-medium truncate max-w-[60px]">
                                        {t.accountName || `#${t.rank}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <ComparisonChart traders={traders} />
                </div>
            )}

            {/* Trader cards */}
            {!isLoading && traders.length > 0 && (
                <div className="space-y-3">
                    {traders.map((trader, idx) => (
                        <TraderCard
                            key={trader.walletAddress}
                            trader={trader}
                            index={idx}
                            leaderboardRanks={leaderboardRanks}
                            onSelect={() => setSelectedTrader(trader)}
                        />
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && traders.length === 0 && (
                <div className="text-center py-12 rounded-xl border border-white/5 bg-black/20 backdrop-blur-sm">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
                        No data available for {period}
                    </span>
                </div>
            )}

            <AiInsightsTradesModal
                pick={null}
                trader={selectedTrader ? {
                    walletAddress: selectedTrader.walletAddress,
                    displayName: selectedTrader.accountName,
                    rank: selectedTrader.rank,
                    totalPnl: selectedTrader.totalPnl,
                } : null}
                onClose={() => setSelectedTrader(null)}
            />
        </div>
    );
}
