"use client";

import { Anomaly, MarketMeta } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { cn, formatShortNumber, calculatePositionPL, formatCurrency } from "@/lib/utils";
import { NumericDisplay } from "@/components/ui/numeric-display";
import { useState, useEffect, useMemo } from "react";
import { resolveTeamFromMarket, getLogoPathForTeam, inferLeagueFromMarket } from "@/lib/teamResolver";
import { useMarketStore } from "@/lib/store";
import { CONFIG } from "@/lib/config";
import { WalletPortfolio } from "@/components/wallet-portfolio";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    ReferenceLine
} from "recharts";

interface TradeDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    anomaly: Anomaly;
}

const formatBadgePnl = (pnl?: number | null) => {
    if (pnl === undefined || pnl === null || Number.isNaN(pnl)) return null;
    const sign = pnl >= 0 ? '+' : '-';
    const abs = Math.abs(pnl);
    let value: string;
    if (abs >= 1_000_000) {
        value = (abs / 1_000_000).toFixed(1) + 'M';
    } else if (abs >= 1_000) {
        value = (abs / 1_000).toFixed(1) + 'K';
    } else {
        value = abs.toFixed(1);
    }
    return `${sign}$${value}`;
};

export function TradeDetailsModal({ isOpen, onClose, anomaly }: TradeDetailsModalProps) {
    const { event, outcome, odds, value, side, trader_context, wallet_context, analysis, image } = anomaly;
    const { leaderboardRanks } = useMarketStore();
    const marketContext = anomaly.analysis?.market_context;
    const leagueFromMeta = (() => {
        const raw = (anomaly.league || marketContext?.league || marketContext?.sport || anomaly.sport || anomaly.category || '').toUpperCase();
        if (raw === 'NBA' || raw === 'NFL' || raw === 'MLB' || raw === 'MLS' || raw === 'UEFA' || raw === 'NHL') return raw as any;
        return undefined;
    })();
    const eventContext = anomaly.analysis?.event || {
        id: anomaly.eventId,
        title: anomaly.eventTitle,
    };
    const liquidityValue = marketContext?.liquidity ?? anomaly.liquidity ?? null;
    const volumeValue = marketContext?.volume24h ?? anomaly.volume24h ?? null;
    const feeValue = marketContext?.feeBps ?? anomaly.feeBps ?? null;
    const denomination = (marketContext?.denominationToken || anomaly.denominationToken || '').toUpperCase() || null;
    const openTime = marketContext?.openTime || anomaly.openTime || null;
    const closeTime = marketContext?.closeTime || anomaly.closeTime || null;
    const resolutionTime = marketContext?.resolutionTime || anomaly.resolutionTime || null;
    const crowding = anomaly.crowding || analysis?.crowding;

    const formatUsdShort = (num: number | null) => {
        if (num === null || Number.isNaN(num)) return '—';
        return `$${formatShortNumber(num)}`;
    };

    const formatTimeRemaining = (iso: string | null) => {
        if (!iso) return '—';
        const target = new Date(iso).getTime();
        if (Number.isNaN(target)) return '—';
        const diff = target - Date.now();
        if (diff <= 0) return 'Closed';
        const mins = Math.ceil(diff / 60000);
        if (mins < 60) return `${mins}m left`;
        const hours = Math.ceil(diff / 3600000);
        if (hours < 48) return `${hours}h left`;
        const days = Math.ceil(diff / 86400000);
        return `${days}d left`;
    };

    const formatDateLabel = (iso: string | null) => {
        if (!iso) return '—';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    const formatShare = (value: number | null | undefined) => {
        if (value === null || value === undefined || Number.isNaN(value)) return null;
        const pct = value > 1 ? value : value * 100;
        return `${pct.toFixed(0)}%`;
    };
    const top5Share = formatShare(crowding?.top5_share);
    const top10Share = formatShare(crowding?.top10_share);

    // Resolve team logo
    const { resolvedTeam, logoPath, usePolymarketFallback } = useMemo(() => {
        const team = resolveTeamFromMarket({
            leagueHint: leagueFromMeta,
            marketTitle: event,
            outcomeLabel: outcome,
            question: event,
        });
        const league = team?.league || inferLeagueFromMarket({ question: event, league: leagueFromMeta } as MarketMeta);

        // If no team found in teamMeta.ts, use Polymarket image as primary fallback
        const noTeamMatch = !team;
        const hasPolymarketImage = image && image.length > 0;

        return {
            resolvedTeam: team,
            logoPath: noTeamMatch && hasPolymarketImage ? image : getLogoPathForTeam(team, league),
            usePolymarketFallback: noTeamMatch && hasPolymarketImage
        };
    }, [event, outcome, image, leagueFromMeta]);

    // Get leaderboard ranks for this wallet
    const walletRanks = useMemo(() => {
        if (!wallet_context?.address) return [];
        const walletKey = wallet_context.address.toLowerCase();
        return leaderboardRanks[walletKey] || [];
    }, [wallet_context?.address, leaderboardRanks]);

    // Prefer named leaderboard entry, else wallet label, else short address
    const accountName = useMemo(() => {
        const named = walletRanks.find((r) => r.accountName && r.accountName.trim());
        if (named?.accountName) return named.accountName.trim();
        if (wallet_context?.label) return wallet_context.label;
        if (wallet_context?.address) {
            const addr = wallet_context.address;
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        }
        return null;
    }, [walletRanks, wallet_context?.label, wallet_context?.address]);

    const isTopRankedAccount = useMemo(() => {
        return walletRanks.some((r) => typeof r.rank === 'number' && r.rank > 0 && r.rank <= CONFIG.LEADERBOARD.TOP_RANK_THRESHOLD);
    }, [walletRanks]);

    const displayAccountName = isTopRankedAccount ? accountName : null;

    // Fallback to analysis tags if trader_context is missing (for older trades)
    const isInsider = analysis?.tags?.includes('INSIDER');
    const activityLevel = trader_context?.activity_level || 'UNKNOWN';
    const txCount = trader_context?.tx_count ?? 0;
    const maxTrade = trader_context?.max_trade_value ?? 0;

    // Determine color theme based on type
    const isGod = anomaly.type === 'GOD_WHALE';
    const isSuper = anomaly.type === 'SUPER_WHALE';
    const isMega = anomaly.type === 'MEGA_WHALE';
    const isWhale = anomaly.type === 'WHALE';

    const themeColor = isGod ? "text-yellow-400 border-yellow-400/30" :
        isSuper ? "text-red-400 border-red-400/30" :
            isMega ? "text-purple-400 border-purple-400/30" :
                isWhale ? "text-blue-400 border-blue-400/30" :
                    "text-zinc-400 border-zinc-700";

    const bgGlow = isGod ? "bg-yellow-400/5" :
        isSuper ? "bg-red-400/5" :
            isMega ? "bg-purple-400/5" :
                isWhale ? "bg-blue-400/5" :
                    "bg-zinc-900/50";

    // Chart Data State
    const [historyData, setHistoryData] = useState<{
        priceHistory: any[];
        walletHistory: any[];
        stats?: {
            last5: { winRate: number; pnlPercent: number; totalPnL: number; tradeCount: number };
            last10: { winRate: number; pnlPercent: number; totalPnL: number; tradeCount: number };
            last50: { winRate: number; pnlPercent: number; totalPnL: number; tradeCount: number };
        };
    } | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        if (isOpen && anomaly) {
            setIsLoadingHistory(true);
            const params = new URLSearchParams({
                question: anomaly.event,
                outcome: anomaly.outcome,
                walletAddress: anomaly.wallet_context?.address || '',
                tradeTimestamp: anomaly.timestamp.toString()
            });

            fetch(`/api/market-history?${params.toString()}`)
                .then(res => res.json())
                .then(data => {
                    setHistoryData(data);
                })
                .catch(err => console.error("Failed to fetch history:", err))
                .finally(() => setIsLoadingHistory(false));
        }
    }, [isOpen, anomaly]);

    // Calculate P/L if we have price history
    const currentPrice = historyData?.priceHistory && historyData.priceHistory.length > 0
        ? historyData.priceHistory[historyData.priceHistory.length - 1].price
        : null;
    const unrealizedPL = currentPrice !== null
        ? calculatePositionPL(value, odds, currentPrice, side)
        : 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            className="max-w-lg md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
        >
            <div className="flex flex-col max-h-[75vh] md:max-h-[80vh] lg:max-h-[85vh] overflow-y-auto scrollbar-hide">
                {/* Header - HERO STYLE */}
                <div className={cn("relative border-b border-zinc-800", bgGlow)}>
                    {/* Background Image Overlay */}
                    {/* Background Image Overlay */}
                    {(image || logoPath) && (
                        <div className="absolute inset-0 opacity-10 overflow-hidden">
                            <img
                                src={image || logoPath}
                                alt={event}
                                className="w-full h-full object-cover blur-sm scale-105"
                            />
                            <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/60 to-transparent" />
                        </div>
                    )}

                    <div className="relative z-10 p-3 md:p-4 lg:p-6">
                        {/* Main Hero Content */}
                        <div className="flex items-start gap-3 md:gap-4 lg:gap-6">
                            {/* Large Hero Thumbnail */}
                            <div className="relative shrink-0">
                                <div className="relative w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 xl:w-28 xl:h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl group-hover:border-white/30 transition-all duration-300 backdrop-blur-sm bg-white/5">
                                    {/* Modern Glass Effect - Only for Polymarket images */}
                                    {usePolymarketFallback && (
                                        <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-black/20" />
                                    )}

                                    <img
                                        src={logoPath}
                                        alt={resolvedTeam?.name || event}
                                        className="w-full h-full object-cover relative z-10"
                                        onError={(e) => {
                                            if (image && (e.target as HTMLImageElement).src !== image) {
                                                (e.target as HTMLImageElement).src = image;
                                                (e.target as HTMLImageElement).className = "w-full h-full object-cover relative z-10";
                                            }
                                        }}
                                    />

                                    {/* Enhanced Scanline Overlay */}
                                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/10 to-transparent opacity-40 pointer-events-none" />

                                    {/* Subtle Glow Effect */}
                                    <div className="absolute inset-0 ring-1 ring-white/10 group-hover:ring-white/20 transition-all duration-300" />
                                </div>
                            </div>

                            {/* Title and Trade Info */}
                            <div className="flex-1 min-w-0">
                                {/* Type Badge Row */}
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={cn("text-xs md:text-sm font-bold px-3 py-1 border rounded-full bg-black/60 backdrop-blur-sm", themeColor)}>
                                        {anomaly.type.replace('_', ' ')}
                                    </span>
                                    {isInsider && (
                                        <span className="text-xs md:text-sm font-bold px-3 py-1 border border-red-500 text-red-500 bg-red-500/10 rounded-full animate-pulse backdrop-blur-sm">
                                            INSIDER DETECTED
                                        </span>
                                    )}
                                </div>

                                {/* Event Title */}
                                <h2 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-black text-zinc-100 leading-tight uppercase tracking-tight mb-2">
                                    {event}
                                </h2>

                                {/* Event Subtitle - Outcome, Side, Odds */}
                                <div className="flex items-center gap-3 text-sm md:text-base text-zinc-400">
                                    <span className="font-bold">{outcome}</span>
                                    <span className={cn("font-bold px-2 py-0.5 rounded text-xs uppercase", side === 'BUY' ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>
                                        {side}
                                    </span>
                                    <span className="text-zinc-600">•</span>
                                    <NumericDisplay value={`${odds}¢`} />
                                </div>
                                {(eventContext?.title && eventContext.title !== event) || marketContext?.category || marketContext?.sport || marketContext?.league || marketContext?.time_to_close_bucket || marketContext?.liquidity_bucket || marketContext?.feeBps !== undefined ? (
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                                        {eventContext?.title && eventContext.title !== event && (
                                            <span className="px-2 py-1 rounded-full bg-zinc-900/70 border border-zinc-800">{eventContext.title}</span>
                                        )}
                                        {marketContext?.category && (
                                            <span className="px-2 py-1 rounded-full bg-zinc-900/70 border border-zinc-800">{marketContext.category}</span>
                                        )}
                                        {(marketContext?.sport || marketContext?.league) && (
                                            <span className="px-2 py-1 rounded-full bg-zinc-900/70 border border-zinc-800">{marketContext.league || marketContext.sport}</span>
                                        )}
                                        {marketContext?.time_to_close_bucket && (
                                            <span className="px-2 py-1 rounded-full bg-zinc-900/70 border border-zinc-800">{marketContext.time_to_close_bucket}</span>
                                        )}
                                        {marketContext?.liquidity_bucket && (
                                            <span className="px-2 py-1 rounded-full bg-zinc-900/70 border border-zinc-800">Lq {marketContext.liquidity_bucket}</span>
                                        )}
                                        {marketContext?.feeBps !== undefined && marketContext.feeBps !== null && (
                                            <span className="px-2 py-1 rounded-full bg-zinc-900/70 border border-zinc-800">{marketContext.feeBps} bps fee</span>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Unified Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 md:p-4 lg:p-6 border-b border-zinc-800 bg-black/20">
                    {/* 1. Liquidity */}
                    <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 flex flex-col justify-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Liq</span>
                        <span className="text-sm font-medium text-zinc-200">{formatUsdShort(liquidityValue)}</span>
                    </div>

                    {/* 2. Volume */}
                    <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 flex flex-col justify-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Vol</span>
                        <span className="text-sm font-medium text-zinc-200">{formatUsdShort(volumeValue)}</span>
                    </div>

                    {/* 3. Closes */}
                    <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Closes</span>
                            {closeTime && (
                                <span className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                                    formatTimeRemaining(closeTime).includes('m') ? "bg-red-500/10 text-red-400" :
                                        formatTimeRemaining(closeTime).includes('h') && parseInt(formatTimeRemaining(closeTime)) < 12 ? "bg-orange-500/10 text-orange-400" :
                                            "bg-zinc-800 text-zinc-400"
                                )}>
                                    {formatTimeRemaining(closeTime)}
                                </span>
                            )}
                        </div>
                        <span className="text-sm font-medium text-zinc-200 truncate">
                            {formatDateLabel(closeTime).split(',')[0]}
                        </span>
                        <span className="text-[10px] text-zinc-500 truncate">
                            {formatDateLabel(closeTime).split(',')[1] || ''}
                        </span>
                    </div>

                    {/* 4. Trade Value */}
                    <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 flex flex-col justify-center relative overflow-hidden group">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Trade</span>
                        <span className={cn("text-lg font-black tracking-tight", themeColor.split(' ')[0])}>
                            <NumericDisplay
                                value={`$${Math.round(value).toLocaleString()}`}
                                size="lg"
                                variant="bold"
                            />
                        </span>
                    </div>

                    {/* 5. Price vs Odds */}
                    <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 flex flex-col justify-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                            Price
                            {historyData?.priceHistory && historyData.priceHistory.length > 0 && (
                                <span className={cn(
                                    "text-[9px]",
                                    historyData.priceHistory[historyData.priceHistory.length - 1].price > odds ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {historyData.priceHistory[historyData.priceHistory.length - 1].price > odds ? '↗' : '↘'}
                                </span>
                            )}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={cn(
                                "text-base font-bold",
                                historyData?.priceHistory && historyData.priceHistory.length > 0 ?
                                    (historyData.priceHistory[historyData.priceHistory.length - 1].price > odds ?
                                        "text-emerald-400" : "text-red-400") :
                                    "text-zinc-100"
                            )}>
                                {historyData?.priceHistory && historyData.priceHistory.length > 0 ?
                                    `${Math.abs(historyData.priceHistory[historyData.priceHistory.length - 1].price - odds).toFixed(1)}¢` :
                                    '0¢'
                                }
                            </span>
                            <span className="text-[10px] text-zinc-500">vs bet</span>
                        </div>
                    </div>

                    {/* 6. P/L */}
                    <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 flex flex-col justify-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">P/L</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={cn(
                                "text-base font-bold",
                                unrealizedPL > 0 ? "text-emerald-400" :
                                    unrealizedPL < 0 ? "text-red-400" : "text-zinc-100"
                            )}>
                                <NumericDisplay value={formatCurrency(unrealizedPL)} size="sm" variant="bold" />
                            </span>
                            <span className={cn(
                                "text-[10px] font-medium",
                                unrealizedPL > 0 ? "text-emerald-500/70" :
                                    unrealizedPL < 0 ? "text-red-500/70" : "text-zinc-500"
                            )}>
                                {unrealizedPL !== 0 ? `${unrealizedPL > 0 ? '+' : ''}${(unrealizedPL / value * 100).toFixed(1)}%` : '0%'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="p-3 md:p-4 lg:p-6 space-y-4 md:space-y-6 border-b border-zinc-800">
                    {/* Price History Chart */}
                    <div>
                        <h3 className="text-xs md:text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-1 h-3 bg-blue-500 rounded-full" />
                            Price History ({outcome})
                        </h3>
                        <div className="h-32 md:h-40 lg:h-48 xl:h-56 w-full bg-black/20 rounded-xl border border-zinc-800/50 p-1 md:p-2 [&_*]:outline-none [&_*]:focus:outline-none">
                            {isLoadingHistory ? (
                                <div className="h-full flex items-center justify-center text-zinc-600 text-xs md:text-sm animate-pulse">Loading chart data...</div>
                            ) : historyData?.priceHistory?.length ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={historyData.priceHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="timestamp"
                                            type="number"
                                            domain={['auto', 'auto']}
                                            tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            stroke="#52525b"
                                            fontSize={9}
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={40}
                                        />
                                        <YAxis
                                            domain={[0, 100]}
                                            stroke="#52525b"
                                            fontSize={9}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => `${val}¢`}
                                            width={30}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '11px' }}
                                            itemStyle={{ color: '#e4e4e7' }}
                                            labelFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                                            formatter={(value: number) => [`${value.toFixed(1)}¢`, 'Price']}
                                        />
                                        <ReferenceLine
                                            x={anomaly.timestamp}
                                            stroke="#ffffff"
                                            strokeDasharray="3 3"
                                            strokeWidth={2}
                                            strokeOpacity={0.8}
                                            label={{
                                                value: new Date(anomaly.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                position: 'insideTop',
                                                fill: '#a1a1aa',
                                                fontSize: 10,
                                                offset: 8,
                                                dx: 30
                                            }}
                                        />
                                        <ReferenceLine
                                            y={odds}
                                            stroke={unrealizedPL > 0 ? "#10b981" : unrealizedPL < 0 ? "#ef4444" : "#f4f4f5"}
                                            strokeDasharray="5 5"
                                            strokeWidth={1}
                                            strokeOpacity={0.7}
                                            label={{
                                                value: `${odds}¢`,
                                                position: "insideRight",
                                                fill: unrealizedPL > 0 ? "#10b981" : unrealizedPL < 0 ? "#ef4444" : "#f4f4f5",
                                                fontSize: 10,
                                                dy: -5
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="price"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorPrice)"
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-zinc-600 text-xs md:text-sm">No price history available</div>
                            )}
                        </div>
                    </div>

                    {/* Wallet Activity Chart */}
                    <div>
                        <h3 className="text-xs md:text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                            Recent Wallet Activity
                        </h3>
                        <div className="h-32 md:h-40 lg:h-48 xl:h-56 w-full bg-black/20 rounded-xl border border-zinc-800/50 p-1 md:p-2 [&_*]:outline-none [&_*]:focus:outline-none">
                            {isLoadingHistory ? (
                                <div className="h-full flex items-center justify-center text-zinc-600 text-xs md:text-sm animate-pulse">Loading wallet data...</div>
                            ) : historyData?.walletHistory?.length ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={historyData.walletHistory}>
                                        <XAxis
                                            dataKey="timestamp"
                                            tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            stroke="#52525b"
                                            fontSize={9}
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={40}
                                        />
                                        <YAxis
                                            stroke="#52525b"
                                            fontSize={9}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                            width={30}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#ffffff10' }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length && label) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-zinc-900 border border-zinc-800 p-2 rounded shadow-xl text-xs">
                                                            <div className="font-bold text-zinc-300 mb-1">{new Date(label).toLocaleTimeString()}</div>
                                                            <div className="text-zinc-400">{data.question}</div>
                                                            <div className={cn("font-bold mt-1", data.side === 'BUY' ? "text-emerald-400" : "text-red-400")}>
                                                                {data.side} {data.outcome}
                                                            </div>
                                                            <div className="text-zinc-300 mt-1">
                                                                <NumericDisplay
                                                                    value={`$${Math.round(data.tradeValue).toLocaleString()}`}
                                                                    size="sm"
                                                                /> @ <NumericDisplay
                                                                    value={`${data.price.toFixed(1)}¢`}
                                                                    size="sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="tradeValue" radius={[2, 2, 0, 0]}>
                                            {historyData.walletHistory.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.side === 'BUY' ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-zinc-600 text-xs md:text-sm">No recent wallet activity</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Performance Stats */}
                <div className="p-3 md:p-4 lg:p-6 border-b border-zinc-800">
                    <h3 className="text-sm md:text-base font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-purple-500 rounded-full" />
                        Recent Performance
                    </h3>
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                        {[
                            { label: 'Last 5', data: historyData?.stats?.last5 },
                            { label: 'Last 10', data: historyData?.stats?.last10 },
                            { label: 'Last 50', data: historyData?.stats?.last50 }
                        ].map((period) => (
                            <div key={period.label} className="bg-zinc-900/50 p-2 md:p-3 rounded-xl border border-zinc-800 flex flex-col items-center text-center">
                                <div className="text-[10px] text-zinc-500 uppercase mb-1">{period.label} Trades</div>

                                <div className="grid grid-cols-2 w-full gap-x-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-zinc-600">Win Rate</span>
                                        <span className={cn(
                                            "font-bold text-sm md:text-base",
                                            period.data ? (
                                                period.data.winRate >= 50 ? "text-emerald-400" : "text-red-400"
                                            ) : "text-zinc-600 animate-pulse"
                                        )}>
                                            <NumericDisplay
                                                value={period.data ? (
                                                    `${period.data.winRate.toFixed(0)}%`
                                                ) : (
                                                    '...'
                                                )}
                                                size="sm"
                                                variant="bold"
                                            />
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-zinc-600">PnL</span>
                                        <span className={cn(
                                            "font-bold text-sm md:text-base",
                                            period.data ? (
                                                period.data.pnlPercent > 0 ? "text-emerald-400" :
                                                    period.data.pnlPercent < 0 ? "text-red-400" : "text-zinc-400"
                                            ) : "text-zinc-600 animate-pulse"
                                        )}>
                                            <NumericDisplay
                                                value={period.data ? (
                                                    `${period.data.pnlPercent > 0 ? '+' : ''}${period.data.pnlPercent.toFixed(1)}%`
                                                ) : (
                                                    '...'
                                                )}
                                                size="sm"
                                                variant="bold"
                                            />
                                        </span>
                                    </div>
                                </div>

                                {period.data && period.data.tradeCount === 0 && (
                                    <div className="mt-1 text-[10px] text-zinc-600 italic">No data</div>
                                )}
                                {!period.data && (
                                    <div className="mt-1 text-[10px] text-zinc-600 italic animate-pulse">Loading stats...</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trader Intelligence */}
                <div className="p-3 md:p-4 lg:p-6 space-y-3 md:space-y-4">
                    <div>
                        <h3 className="text-sm md:text-base font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 bg-zinc-600 rounded-full" />
                            Trader Intelligence
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                            {/* Activity Level */}
                            <div className="bg-zinc-900/50 p-2 md:p-3 rounded-xl border border-zinc-800">
                                <div className="text-[10px] text-zinc-500 uppercase mb-1">Activity Level</div>
                                <div className={cn(
                                    "font-bold text-sm",
                                    activityLevel === 'LOW' ? "text-red-400" :
                                        activityLevel === 'HIGH' ? "text-emerald-400" : "text-yellow-400"
                                )}>
                                    {activityLevel}
                                    <span className="text-zinc-600 font-normal ml-1 text-xs">({txCount} txs)</span>
                                </div>
                                <div className="text-[10px] text-zinc-600 mt-1 leading-tight">
                                    {activityLevel === 'LOW' ? "Barely makes any bets" : "Regular trader"}
                                </div>
                            </div>

                            {/* Profitability */}
                            <div className="bg-zinc-900/50 p-2 md:p-3 rounded-xl border border-zinc-800">
                                <div className="text-[10px] text-zinc-500 uppercase mb-1">Total PnL</div>
                                <div className={cn(
                                    "font-bold text-sm",
                                    (wallet_context?.pnl_all_time?.includes('-') ?? false) ? "text-red-400" : "text-emerald-400"
                                )}>
                                    {wallet_context?.pnl_all_time || "$0"}
                                </div>
                                <div className="text-[10px] text-zinc-600 mt-1 leading-tight">
                                    Win Rate: {wallet_context?.win_rate || "0%"}
                                </div>
                            </div>

                            {/* Max Trade Context */}
                            <div className="bg-zinc-900/50 p-2 md:p-3 rounded-xl border border-zinc-800 md:col-span-2 lg:col-span-1">
                                <div className="text-[10px] text-zinc-500 uppercase mb-1">Max Trade Size</div>
                                <div className="font-bold text-sm text-zinc-300">
                                    <NumericDisplay
                                        value={`$${Math.round(maxTrade).toLocaleString()}`}
                                        size="sm"
                                        variant="bold"
                                    />
                                </div>
                                <div className="text-[10px] text-zinc-600 mt-1 leading-tight">
                                    {value >= maxTrade * 0.9 ? "New record trade!" : "Within normal range"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Insider Analysis */}
                    {isInsider && (
                        <div className="bg-red-500/5 border border-red-500/20 p-3 md:p-4 rounded-xl">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-red-500/10 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M2 12h20" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" /><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /></svg>
                                </div>
                                <div>
                                    <h4 className="text-red-400 font-bold text-sm mb-1">Suspicious Activity Detected</h4>
                                    <p className="text-xs text-red-300/70 leading-relaxed">
                                        This trader has <strong>low activity</strong> but a <strong>high win rate</strong> and is making a <strong>large bet</strong>. This pattern is often associated with insider information or selective trading.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top 20 Trader Section - Rankings & Account Name */}
                    {displayAccountName && (
                        <div className={cn(
                            "flex flex-col gap-3 p-3 md:p-4 rounded-xl border mt-4",
                            "bg-black/30",
                            isGod ? "border-yellow-500/20" :
                                isSuper ? "border-red-500/20" :
                                    isMega ? "border-purple-500/20" :
                                        isWhale ? "border-blue-500/20" :
                                            "border-zinc-800"
                        )}>
                            {/* Account Name Row */}
                            <div className="flex items-center gap-3">
                                {/* Star Icon */}
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                    isGod ? "bg-yellow-500/20 text-yellow-400" :
                                        isSuper ? "bg-red-500/20 text-red-400" :
                                            isMega ? "bg-purple-500/20 text-purple-400" :
                                                isWhale ? "bg-blue-500/20 text-blue-400" :
                                                    "bg-zinc-800 text-zinc-400"
                                )}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                    </svg>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Top Trader</span>
                                    <span className={cn(
                                        "text-base md:text-lg font-bold tracking-tight truncate",
                                        isGod ? "text-yellow-300" :
                                            isSuper ? "text-red-300" :
                                                isMega ? "text-purple-300" :
                                                    isWhale ? "text-blue-300" :
                                                        "text-zinc-100"
                                    )}>
                                        {displayAccountName}
                                    </span>
                                </div>
                            </div>
                            {/* Ranking Badges */}
                            {walletRanks.length > 0 && (
                                <div className="grid grid-cols-2 md:flex md:flex-row gap-2">
                                    {walletRanks.map((rank) => {
                                        const formattedPnl = formatBadgePnl(rank.totalPnl);
                                        return (
                                            <div
                                                key={rank.period}
                                                className={cn(
                                                    "flex flex-col md:flex-row items-center md:gap-1.5 px-2 py-1.5 md:px-2.5 rounded-lg text-xs font-semibold",
                                                    "border backdrop-blur-sm",
                                                    isGod ? "bg-yellow-500/10 border-yellow-500/30" :
                                                        isSuper ? "bg-red-500/10 border-red-500/30" :
                                                            isMega ? "bg-purple-500/10 border-purple-500/30" :
                                                                isWhale ? "bg-blue-500/10 border-blue-500/30" :
                                                                    "bg-zinc-800/50 border-zinc-700/50"
                                                )}
                                            >
                                                <span className={cn(
                                                    "text-[10px] uppercase tracking-wider opacity-70",
                                                    isGod ? "text-yellow-400" :
                                                        isSuper ? "text-red-400" :
                                                            isMega ? "text-purple-400" :
                                                                isWhale ? "text-blue-400" :
                                                                    "text-zinc-500"
                                                )}>{rank.period}</span>
                                                <span className={cn(
                                                    "font-black text-sm",
                                                    isGod ? "text-yellow-300" :
                                                        isSuper ? "text-red-300" :
                                                            isMega ? "text-purple-300" :
                                                                isWhale ? "text-blue-300" :
                                                                    "text-zinc-300"
                                                )}>#{rank.rank}</span>
                                                {formattedPnl && (
                                                    <span className={cn(
                                                        "text-xs font-medium",
                                                        rank.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                                                    )}>
                                                        {formattedPnl}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-2 pt-3 border-t border-zinc-800 mt-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span>WALLET:</span>
                            <span className="text-zinc-300">
                                {wallet_context?.label && wallet_context.label !== 'Unknown'
                                    ? wallet_context.label
                                    : wallet_context?.address
                                        ? `${wallet_context.address.slice(0, 6)}...${wallet_context.address.slice(-4)}`
                                        : 'UNKNOWN TRADER'}
                            </span>
                        </div>

                        {wallet_context?.address && (
                            <a
                                href={`https://polymarket.com/profile/${wallet_context.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full justify-center group mt-2 flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-[#1B58FD] transition-all duration-300"
                            >
                                <img
                                    src="/logos/polym.png"
                                    alt="Polymarket"
                                    className="h-10 w-auto opacity-70 object-contain group-hover:opacity-100 transition-opacity"
                                />
                            </a>
                        )}
                    </div>
                </div>

                {/* Wallet Portfolio */}
                {wallet_context?.address && (
                    <div className="p-3 md:p-4 lg:p-6 border-t border-zinc-800">
                        <WalletPortfolio walletAddress={wallet_context.address} />
                    </div>
                )}
            </div>
        </Modal>
    );
}