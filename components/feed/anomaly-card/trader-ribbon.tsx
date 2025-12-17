import { cn } from "@/lib/utils";

type WalletRank = {
    period: string;
    rank?: number | null;
    rankChange?: number | null;
    totalPnl?: number | null;
};

interface TraderRibbonProps {
    displayAccountName: string | null;
    walletRanks: WalletRank[];
    isGod: boolean;
    isSuper: boolean;
    isMega: boolean;
    isWhale: boolean;
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

export function TraderRibbon({
    displayAccountName,
    walletRanks,
    isGod,
    isSuper,
    isMega,
    isWhale,
}: TraderRibbonProps) {
    if (!displayAccountName || walletRanks.length === 0) return null;

    return (
        <div className={cn(
            "relative -mt-2 mx-1 pt-5 pb-3 px-3 rounded-b-xl",
            "bg-surface-1 border border-t-0 border-zinc-800/60",
            isGod && "border-b-yellow-500/20",
            isSuper && "border-b-red-500/20",
            isMega && "border-b-purple-500/20",
            isWhale && "border-b-blue-500/20"
        )}>
            <div className="flex items-center gap-1.5">
                {(['Daily', 'Weekly', 'Monthly', 'All Time'] as const).map((period) => {
                    const rankData = walletRanks.find(r => r.period === period);
                    const hasRank = rankData && typeof rankData.rank === 'number' && rankData.rank > 0;
                    const formattedPnl = hasRank ? formatBadgePnl(rankData.totalPnl) : null;

                    return (
                        <div
                            key={period}
                            className={cn(
                                "flex-1 flex flex-col items-center py-1 px-1.5 rounded-md",
                                "bg-surface-1 border",
                                hasRank ? (
                                    isGod ? "border-yellow-500/40" :
                                        isSuper ? "border-red-500/40" :
                                            isMega ? "border-purple-500/40" :
                                                isWhale ? "border-blue-500/40" :
                                                    "border-zinc-700/50"
                                ) : "border-zinc-800/40"
                            )}
                        >
                            <div className="flex items-center gap-1">
                                <span className={cn(
                                    "uppercase font-semibold text-[9px] lg:text-[10px]",
                                    hasRank ? (
                                        isGod ? "text-yellow-400/80" :
                                            isSuper ? "text-red-400/80" :
                                                isMega ? "text-purple-400/80" :
                                                    isWhale ? "text-blue-400/80" :
                                                        "text-zinc-500"
                                    ) : "text-zinc-600"
                                )}>
                                    {{
                                        'Daily': 'DAY',
                                        'Weekly': 'WEEK',
                                        'Monthly': 'MONTH',
                                        'All Time': 'ALL'
                                    }[period]}
                                </span>
                                <span className={cn(
                                    "text-[10px] lg:text-xs font-black",
                                    hasRank ? (
                                        isGod ? "text-yellow-300" :
                                            isSuper ? "text-red-300" :
                                                isMega ? "text-purple-300" :
                                                    isWhale ? "text-blue-300" :
                                                        "text-zinc-300"
                                    ) : "text-zinc-600"
                                )}>
                                    {hasRank ? `#${rankData.rank}` : '—'}
                                </span>
                                {hasRank && rankData.rankChange !== undefined && (
                                    rankData.rankChange === null ? (
                                        <span className="text-[7px] font-black text-cyan-400 uppercase" title="New entry">
                                            NEW
                                        </span>
                                    ) : rankData.rankChange > 0 ? (
                                        <span className="text-[8px] font-bold text-emerald-400" title={`Up ${rankData.rankChange}`}>
                                            ↑{rankData.rankChange}
                                        </span>
                                    ) : rankData.rankChange < 0 ? (
                                        <span className="text-[8px] font-bold text-red-400" title={`Down ${Math.abs(rankData.rankChange)}`}>
                                            ↓{Math.abs(rankData.rankChange)}
                                        </span>
                                    ) : null
                                )}
                            </div>
                            {formattedPnl && rankData && (
                                <span className={cn(
                                    "text-[9px] lg:text-[10px] font-semibold",
                                    rankData.totalPnl !== null && rankData.totalPnl !== undefined && rankData.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {formattedPnl}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="relative flex items-center justify-center gap-2 lg:gap-3 mt-2 lg:mt-3 pt-1.5 lg:pt-2">
                <div className={cn(
                    "flex-1 h-px opacity-50",
                    "bg-gradient-to-r from-transparent",
                    isGod ? "via-yellow-500/40 to-yellow-400/60" :
                        isSuper ? "via-red-500/40 to-red-400/60" :
                            isMega ? "via-purple-500/40 to-purple-400/60" :
                                isWhale ? "via-blue-500/40 to-blue-400/60" :
                                    "via-zinc-600/40 to-zinc-500/60"
                )} />

                <div className="relative flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 py-0.5">
                    <div className={cn(
                        "absolute inset-0 rounded-full blur-sm opacity-15",
                        isGod ? "bg-yellow-500" :
                            isSuper ? "bg-red-500" :
                                isMega ? "bg-purple-500" :
                                    isWhale ? "bg-blue-500" :
                                        "bg-zinc-500"
                    )} />

                    <div className="relative shrink-0 w-3.5 h-3.5 lg:w-4 lg:h-4 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logos/logoOnly.png"
                            alt="Polymarket logo"
                            className={cn(
                                "w-full h-full object-contain",
                                isGod ? "drop-shadow-[0_0_4px_rgba(250,204,21,0.4)]" :
                                    isSuper ? "drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]" :
                                        isMega ? "drop-shadow-[0_0_4px_rgba(168,85,247,0.4)]" :
                                            isWhale ? "drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]" :
                                                "drop-shadow-[0_0_4px_rgba(161,161,170,0.4)]"
                            )}
                        />
                    </div>

                    <span className={cn(
                        "relative text-[11px] lg:text-xs font-bold truncate tracking-wide uppercase max-w-[120px] lg:max-w-[160px]",
                        isGod ? "text-yellow-100" :
                            isSuper ? "text-red-100" :
                                isMega ? "text-purple-100" :
                                    isWhale ? "text-blue-100" :
                                        "text-zinc-100"
                    )}>
                        {displayAccountName}
                    </span>

                    <div className={cn(
                        "relative shrink-0 w-3 h-3 lg:w-3.5 lg:h-3.5 flex items-center justify-center",
                        isGod ? "text-yellow-400" :
                            isSuper ? "text-red-400" :
                                isMega ? "text-purple-400" :
                                    isWhale ? "text-blue-400" :
                                        "text-zinc-400"
                    )}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                            <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.46 1.89-3.2 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z" />
                        </svg>
                    </div>
                </div>

                <div className={cn(
                    "flex-1 h-px opacity-50",
                    "bg-gradient-to-l from-transparent",
                    isGod ? "via-yellow-500/40 to-yellow-400/60" :
                        isSuper ? "via-red-500/40 to-red-400/60" :
                            isMega ? "via-purple-500/40 to-purple-400/60" :
                                isWhale ? "via-blue-500/40 to-blue-400/60" :
                                    "via-zinc-600/40 to-zinc-500/60"
                )} />
            </div>
        </div>
    );
}
