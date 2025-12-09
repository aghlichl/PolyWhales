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
    if (data.length < 2) return <div className="h-8 w-full bg-zinc-800/50" />;

    return (
        <ResponsiveContainer width="100%" height={32}>
            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <defs>
                    <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke={color}
                    strokeWidth={1.5}
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
}: {
    trader: TraderData;
    index: number;
    leaderboardRanks: Record<string, LeaderboardRank[]>;
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

    // Rank-based styling
    const rankColors: Record<number, { badgeBg: string; text: string }> = {
        1: { badgeBg: "bg-amber-500/20", text: "text-amber-200" },
        2: { badgeBg: "bg-zinc-300/20", text: "text-zinc-100" },
        3: { badgeBg: "bg-amber-600/20", text: "text-amber-300" },
    };
    const rankStyle = rankColors[trader.rank] || { badgeBg: "bg-zinc-800/60", text: "text-zinc-200" };

    return (
        <Card className={cn(
            "relative bg-zinc-950/70 rounded-lg overflow-hidden transition-all duration-200",
            "border-none shadow-none",
            "hover:-translate-y-0.5 cursor-pointer group"
        )}>
            {/* Top accent bar */}
            <div className="h-0.5 w-full" style={{ backgroundColor: color }} />

            <div className="p-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    {/* Rank + Name */}
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Rank badge */}
                        <div className={cn(
                            "shrink-0 w-7 h-7 rounded flex items-center justify-center",
                            "font-black text-sm",
                            rankStyle.badgeBg,
                            rankStyle.text
                        )}>
                            {trader.rank}
                        </div>

                        <div className="min-w-0">
                            <a
                                href={polymarketUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-sm font-bold text-zinc-100 truncate hover:text-zinc-200"
                                title="Open Polymarket profile"
                            >
                                <span className="truncate">
                                    {displayAccountName || accountName || "Anonymous"}
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                            </a>
                            <a
                                href={polymarketUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-zinc-600 font-mono hover:text-zinc-400"
                            >
                                {trader.walletAddress.slice(0, 6)}...{trader.walletAddress.slice(-4)}
                            </a>
                        </div>
                    </div>

                    {/* P&L */}
                    <div className="text-right shrink-0">
                        <div className={cn(
                            "text-lg font-black tracking-tight",
                            isPositive ? "text-emerald-400" : "text-red-400"
                        )}>
                            {formatPnl(trader.totalPnl)}
                        </div>
                        {pnlChange !== null && (
                            <div className={cn(
                                "text-[10px] font-semibold",
                                pnlChange >= 0 ? "text-emerald-400/70" : "text-red-400/70"
                            )}>
                                {pnlChange >= 0 ? "+" : ""}{pnlChange.toFixed(1)}%
                            </div>
                        )}
                    </div>
                </div>

                {/* Sparkline */}
                <div className="mb-2">
                    <Sparkline data={trader.pnlHistory} color={color} />
                </div>
                <div className="mt-2 -mx-1">
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
        </Card>
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
            <div className="h-48 flex items-center justify-center text-zinc-600 text-xs uppercase tracking-wider">
                Insufficient data
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#71717a" }}
                    tickFormatter={(val) =>
                        new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fontSize: 9, fill: "#71717a" }}
                    tickFormatter={(val) => formatShortNumber(val)}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "#18181b",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "10px",
                        boxShadow: "none",
                    }}
                    labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                        })
                    }
                    formatter={(value: number, name: string) => {
                        const idx = parseInt(name.replace("t", ""), 10);
                        const trader = traders[idx];
                        return [formatPnl(value), trader?.accountName || `#${idx + 1}`];
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
                        name={`t${idx}`}
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
        <div className="space-y-4 px-4 pb-6">
            {/* Period selector - Neobrutalist pills */}
            <div className="flex gap-1">
                {PERIODS.map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                            "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all rounded border",
                            period === p
                                ? "bg-zinc-800 text-zinc-100 border-zinc-600 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                                : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-transparent"
                        )}
                    >
                        {PERIOD_LABELS[p]}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded">
                    {error}
                </div>
            )}

            {/* Loading skeletons */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-24 rounded-lg bg-zinc-900/60 animate-pulse"
                        />
                    ))}
                </div>
            )}

            {/* Chart */}
            {!isLoading && traders.length > 0 && (
                <Card className="bg-zinc-950/70 rounded-lg p-3 border-none shadow-none">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 font-bold">
                            Top 5 Performance
                        </span>
                        <div className="flex items-center gap-2">
                            {traders.slice(0, 5).map((t, i) => (
                                <div key={t.walletAddress} className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: TRADER_COLORS[i] }} />
                                    <span className="text-[8px] text-zinc-600 truncate max-w-[40px]">
                                        {t.accountName || `#${t.rank}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <ComparisonChart traders={traders} />
                </Card>
            )}

            {/* Trader cards */}
            {!isLoading && traders.length > 0 && (
                <div className="space-y-2">
                    {traders.map((trader, idx) => (
                        <TraderCard
                            key={trader.walletAddress}
                            trader={trader}
                            index={idx}
                            leaderboardRanks={leaderboardRanks}
                        />
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && traders.length === 0 && (
                <div className="text-center py-8 rounded-lg bg-zinc-900/50">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                        No data for {period}
                    </span>
                </div>
            )}
        </div>
    );
}
