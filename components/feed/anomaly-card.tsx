import { Anomaly } from "@/lib/types";
import { MarketMeta } from "@/lib/types";
import { cn, formatShortNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Gauge } from "./gauge";
import { useState, memo, useMemo } from "react";
import { TradeDetailsModal } from "./trade-details-modal";
import { resolveTeamFromMarket, getLogoPathForTeam, inferLeagueFromMarket } from "@/lib/teamResolver";
import { useAutoFitText } from "@/lib/useAutoFitText";
import { useMarketStore } from "@/lib/store";
import { motion } from "framer-motion";
import { TierAura, TierOverlays } from "./anomaly-card/tier-effects";
import { TraderRibbon } from "./anomaly-card/trader-ribbon";

// Import distinctive fonts following Spotify/DoorDash/Robinhood patterns
import { Inter } from 'next/font/google';



const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'], // Include semibold for currency amounts
    display: 'swap',
});

interface AnomalyCardProps {
    anomaly: Anomaly;
}

export function convertAnomalyToCardProps(anomaly: Anomaly) {
    return {
        title: anomaly.event,
        amount: `$${Math.round(anomaly.value).toLocaleString()}`,
        bet: `${anomaly.outcome} | ${anomaly.odds}¢`,
        type: anomaly.type
    };
}

export const AnomalyCard = memo(function AnomalyCard({ anomaly }: AnomalyCardProps) {
    const { event: title, value, outcome, odds, type, timestamp, side, image } = anomaly;
    // Narrow store subscription so card only rerenders when leaderboard data changes
    const leaderboardRanks = useMarketStore((state) => state.leaderboardRanks);

    const walletRanks = anomaly.wallet_context?.address
        ? leaderboardRanks[anomaly.wallet_context.address.toLowerCase()] || []
        : [];

    const accountName = (() => {
        const named = walletRanks.find((r) => r.accountName && r.accountName.trim());
        if (named?.accountName) return named.accountName.trim();
        if (anomaly.wallet_context?.label) return anomaly.wallet_context.label;
        if (anomaly.wallet_context?.address) {
            const addr = anomaly.wallet_context.address;
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        }
        return null;
    })();

    const isTop20Account = walletRanks.some((r) => typeof r.rank === 'number' && r.rank > 0 && r.rank <= 20);

    const displayAccountName = isTop20Account ? accountName : null;

    // Auto-fit text hook for responsive title sizing
    const { textRef } = useAutoFitText({
        minFontSize: 0.75, // 12px at base 16px
        maxFontSize: 1.125, // 18px at base 16px
        maxLines: 3,
        lineHeight: 1.2,
    });

    // Resolve team logo
    const { resolvedTeam, logoPath, usePolymarketFallback } = useMemo(() => {

        const team = resolveTeamFromMarket({
            marketTitle: title,
            outcomeLabel: outcome,
            question: title, // Anomaly event is usually the question/title
        });

        // console.log('[TEAM_RESOLUTION_RESULT]', {
        //     input: { title, outcome },
        //     resolvedTeam: team ? {
        //         league: team.league,
        //         slug: team.slug,
        //         name: team.name,
        //         logoPath: team.logoPath
        //     } : null,
        //     finalLogoPath: !team && image && image.trim() !== '' ? image : team ? team.logoPath : '/logos/generic/default.svg'
        // });
        const league = team?.league || inferLeagueFromMarket({ question: title } as MarketMeta);

        // If no team found in teamMeta.ts, use Polymarket image as primary fallback
        const noTeamMatch = !team;
        const hasPolymarketImage = image && image.length > 0;
        // console.log('[IMAGE]', image);
        // console.log('[HAS_POLYMARKET_IMAGE]', hasPolymarketImage);
        // console.log('[NO_TEAM_MATCH]', noTeamMatch);
        // console.log('[GET_LOGO_PATH_FOR_TEAM]', getLogoPathForTeam(team, league));
        // console.log('[USE_POLYMARKET_FALLBACK]', noTeamMatch && hasPolymarketImage);
        return {
            resolvedTeam: team,
            logoPath: noTeamMatch && hasPolymarketImage ? image : getLogoPathForTeam(team, league),
            usePolymarketFallback: noTeamMatch && hasPolymarketImage
        };
    }, [title, outcome, image]);

    const amount = `$${Math.round(value).toLocaleString()}`;
    const isGod = type === 'GOD_WHALE';
    const isSuper = type === 'SUPER_WHALE';
    const isMega = type === 'MEGA_WHALE';
    const isWhale = type === 'WHALE';
    const isStandard = !isGod && !isSuper && !isMega && !isWhale;

    const [isModalOpen, setIsModalOpen] = useState(false);

    const marketContext = anomaly.analysis?.market_context;
    const liquidityValue = marketContext?.liquidity ?? anomaly.liquidity ?? null;
    const volumeValue = marketContext?.volume24h ?? anomaly.volume24h ?? null;
    const closeTime = marketContext?.closeTime || anomaly.closeTime || null;
    const resolutionTime = marketContext?.resolutionTime || anomaly.resolutionTime || null;
    const [now] = useState(() => Date.now());

    const formatUsdShort = (num: number | null) => {
        if (num === null || Number.isNaN(num)) return null;
        return `$${formatShortNumber(num)}`;
    };

    const formatTimeRemaining = (iso: string | null, currentNow: number) => {
        if (!iso) return null;
        const target = new Date(iso).getTime();
        if (Number.isNaN(target)) return null;
        const diff = target - currentNow;
        if (diff <= 0) return 'Closed';
        const mins = Math.ceil(diff / 60000);
        if (mins < 60) return `${mins}m left`;
        const hours = Math.ceil(diff / 3600000);
        if (hours < 48) return `${hours}h left`;
        const days = Math.ceil(diff / 86400000);
        return `${days}d left`;
    };

    const closeTimeLabel = useMemo(() => {
        const closeMs = closeTime ? new Date(closeTime).getTime() : 0;
        const resMs = resolutionTime ? new Date(resolutionTime).getTime() : 0;

        if (closeTime && closeMs > now) {
            return formatTimeRemaining(closeTime, now);
        }

        if (resolutionTime && resMs > now) {
            const dist = formatTimeRemaining(resolutionTime, now);
            return dist && dist !== 'Closed' ? `Resolves ${dist.replace(' left', '')}` : null;
        }

        return null;
    }, [closeTime, resolutionTime, now]);

    // Portal animation variants
    const portalVariants = {
        initial: {
            y: -20,
            opacity: 0,
            scale: 0.92,
            filter: "blur(12px)",
        },
        animate: {
            y: 0,
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            transition: {
                type: "spring" as const,
                stiffness: 400,
                damping: 30,
                mass: 1
            }
        }
    };

    return (
        <>
            <motion.div
                layout="position"
                initial={anomaly.isNew ? "initial" : false}
                animate={anomaly.isNew ? "animate" : false}
                variants={portalVariants}
                className="group relative h-full select-none hover:z-30 cursor-pointer will-change-transform"
                onClick={() => setIsModalOpen(true)}
            >
                <TierAura isGod={isGod} />

                <Card className={cn(
                    "relative z-10 h-full p-4 transition-all duration-300 ease-out rounded-xl overflow-hidden border backdrop-blur-md",
                    // Standard Tier (Default)
                    !isGod && !isSuper && !isMega && !isWhale &&
                    "bg-black/40 border-zinc-800/50 shadow-[5px_5px_0px_0px_rgba(39,39,42,0.5)] group-hover:shadow-[6px_6px_0px_0px_rgba(39,39,42,0.6)] group-hover:-translate-y-1",

                    // Whale Tier - Subtle Blue
                    isWhale && "bg-[radial-gradient(circle_at_22%_18%,rgba(99,179,237,0.45)_0%,rgba(14,30,54,0.78)_40%,rgba(8,14,34,0.95)_78%)] border-sky-400/50 shadow-[5px_5px_0px_0px_rgba(56,189,248,0.24)] group-hover:shadow-[6px_6px_0px_0px_rgba(56,189,248,0.32)] group-hover:border-sky-300/70 group-hover:-translate-y-1",

                    // Mega Whale - Pulsing Purple
                    isMega && "bg-purple-950/20 border-purple-500/20 shadow-[5px_5px_0px_0px_rgba(168,85,247,0.2)] group-hover:shadow-[6px_6px_0px_0px_rgba(168,85,247,0.3)] group-hover:-translate-y-1",

                    // Super Whale - Deep Crimson (darker neon)
                    isSuper && "bg-[radial-gradient(circle_at_24%_18%,rgba(130,34,34,0.55)_0%,rgba(71,10,10,0.9)_42%,rgba(12,4,4,0.95)_78%)] border-[rgba(130,34,34,0.6)] shadow-[5px_5px_0px_0px_rgba(130,34,34,0.22)] group-hover:shadow-[6px_6px_0px_0px_rgba(178,60,60,0.28)] group-hover:border-[rgba(178,60,60,0.75)] group-hover:-translate-y-1",

                    // God Whale - Mythic Gold (slightly more opaque for readability)
                    isGod && "bg-yellow-950/20 border-yellow-500/40 shadow-[5px_5px_0px_0px_rgba(251,191,36,0.24)] group-hover:shadow-[6px_6px_0px_0px_rgba(251,191,36,0.32)] group-hover:border-yellow-400/70 group-hover:-translate-y-1"
                )}>
                    <TierOverlays isGod={isGod} isSuper={isSuper} isMega={isMega} isWhale={isWhale} />

                    <div className={cn(
                        "relative z-10 grid grid-cols-[1fr_auto] gap-2",
                        isSuper && "animate-heat-distortion"
                    )}>
                        {/* Top Left: Title - REDESIGNED (Tactical HUD) */}
                        <div className="flex items-start min-w-0 pr-2">
                            <div className="relative group/title w-full flex gap-3">
                                {/* Team Logo / Event Image */}
                                <div className={cn(
                                    "relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/20 shadow-2xl backdrop-blur-sm",
                                    usePolymarketFallback ? "bg-white/5" : "bg-transparent"
                                )}>
                                    {/* Modern Glass Effect - Only for Polymarket images */}
                                    {usePolymarketFallback && (
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
                                    )}

                                    <img
                                        src={logoPath}
                                        alt={resolvedTeam?.name || title}
                                        className="w-full h-full object-cover relative z-10"
                                        onError={(e) => {
                                            // If logo fails, try falling back to original Polymarket image if available, or hide
                                            if (image && (e.target as HTMLImageElement).src !== image) {
                                                (e.target as HTMLImageElement).src = image;
                                                (e.target as HTMLImageElement).className = "w-full h-full object-cover relative z-10"; // Reset style for event image
                                            } else {
                                                // (e.target as HTMLImageElement).style.display = 'none';
                                                // Don't hide, show placeholder? logoPath should be valid generic at least.
                                            }
                                        }}
                                    />

                                    {/* Enhanced Scanline Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-40 pointer-events-none" />

                                    {/* Subtle Glow Effect */}
                                    <div className="absolute inset-0 ring-1 ring-white/10 group-hover/title:ring-white/20 transition-all duration-300" />

                                    {/* Hover Scale Animation */}
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/title:opacity-100 transition-opacity duration-300" />
                                </div>

                                <div className="relative flex-1 min-w-0">
                                    {/* Tier-Specific Accent Bar (Vertical) */}
                                    <div className={cn(
                                        "absolute -left-2 top-1 bottom-1 w-1 rounded-full",
                                        "opacity-40",
                                        isGod ? "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]" :
                                            isSuper ? "bg-[#8e2a2a] shadow-[0_0_10px_rgba(178,60,60,0.55)]" :
                                                isMega ? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" :
                                                    isWhale ? "bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.7)] opacity-70" :
                                                        "bg-zinc-600"
                                    )} />

                                    <div className="flex flex-col gap-1">
                                        {/* Main Title - Auto-fit with 3-line support */}
                                        <h3
                                            ref={textRef as React.RefObject<HTMLHeadingElement>}
                                            className={cn(
                                                "font-black uppercase tracking-tight",
                                                // Line height for consistent spacing
                                                "leading-[1.2]",
                                                // Layout: Flex column for vertical centering
                                                "min-h-10 flex flex-col justify-center",
                                                // Balanced text wrapping for better readability
                                                "text-balance",
                                                // Tier-specific text colors
                                                isGod ? "text-yellow-100" :
                                                    isSuper ? "text-[#f3d7d7]" :
                                                        isMega ? "text-purple-100" :
                                                            isWhale ? "text-sky-50" :
                                                                "text-zinc-100"
                                            )}
                                            title={title}
                                        >
                                            {/* Inner wrapper for line-clamp to work correctly within flex parent */}
                                            <span className="line-clamp-3 w-full">
                                                {title}
                                            </span>
                                        </h3>
                                        {(closeTimeLabel || volumeValue || liquidityValue) && (
                                            <div className="mt-1.5 flex items-center gap-2 text-[10px] font-medium text-zinc-500">
                                                {/* Time Left - High urgency signal */}
                                                {closeTimeLabel && (
                                                    <span className={cn(
                                                        closeTimeLabel.includes('m left') ? "text-red-400" :
                                                            closeTimeLabel.includes('h left') && parseInt(closeTimeLabel) < 12 ? "text-orange-400" :
                                                                "text-zinc-500"
                                                    )}>
                                                        {closeTimeLabel}
                                                    </span>
                                                )}

                                                {(closeTimeLabel && (volumeValue || liquidityValue)) && (
                                                    <span className="text-zinc-700 mx-px">•</span>
                                                )}

                                                {/* Volume - Primary Market Signal */}
                                                {volumeValue !== null && (
                                                    <span className="text-zinc-400">
                                                        Vol <span className="text-zinc-300">{formatUsdShort(volumeValue)}</span>
                                                    </span>
                                                )}

                                                {(volumeValue && liquidityValue) && (
                                                    <span className="text-zinc-700 mx-px">•</span>
                                                )}

                                                {/* Liquidity - Secondary Signal */}
                                                {liquidityValue !== null && (
                                                    <span className="text-zinc-500">
                                                        Liq <span className="text-zinc-400">{formatUsdShort(liquidityValue)}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Right: Amount - REDESIGNED (Minimalist Neobrutalism) */}
                        <div className="flex items-start justify-end">
                            <div className={cn(
                                "relative group rounded-lg px-4 py-2",
                                isStandard
                                    ? "bg-black border border-black"
                                    : "bg-white/5 backdrop-blur-md border border-white/10" // Glass background/border for non-standard tiers
                            )}>
                                {/* Tier Indicator - Minimal Corner Accent */}
                                <div className={cn(
                                    "absolute top-0 right-0 w-2 h-2",
                                    "border-t border-r rounded-tr-lg", // Corner bracket style
                                    isGod ? "border-yellow-500" :
                                        isSuper ? "border-[#b23c3c]" :
                                            isMega ? "border-purple-500" :
                                                isWhale ? "border-blue-500" :
                                                    "border-zinc-600"
                                )} />

                                {/* Bottom Left Accent - Balancing the composition */}
                                <div className={cn(
                                    "absolute bottom-0 left-0 w-2 h-2",
                                    "border-b border-l rounded-bl-lg", // Corner bracket style
                                    "opacity-50",
                                    isGod ? "border-yellow-500" :
                                        isSuper ? "border-[#b23c3c]" :
                                            isMega ? "border-purple-500" :
                                                isWhale ? "border-blue-500" :
                                                    "border-zinc-600"
                                )} />

                                <div className="relative flex items-baseline gap-1">
                                    <span className={cn(
                                        // jetbrains.className removed
                                        "text-sm font-bold",
                                        isGod ? "text-yellow-500/90" :
                                            isSuper ? "text-[#e3b6b6]" :
                                                isMega ? "text-purple-500/90" :
                                                    isWhale ? "text-sky-300" :
                                                        "text-zinc-500"
                                    )}>$</span>

                                    <span className={cn(
                                        inter.className,
                                        "text-3xl font-semibold tracking-tight text-zinc-100"
                                    )}>
                                        {amount.replace('$', '')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Left: Outcome - REDESIGNED */}
                        <div className="flex items-end z-20">
                            <div className="flex flex-col justify-end">
                                <div className="relative group/outcome cursor-default">
                                    {/* Main Container */}
                                    <div className={cn(
                                        "relative flex flex-col min-w-[100px] overflow-hidden rounded-lg",
                                        isStandard
                                            ? "bg-black border border-black"
                                            : "bg-white/5 backdrop-blur-md border border-white/10"
                                    )}>
                                        {/* Decorative Top Bar */}
                                        <div className={cn(
                                            "h-0.5 w-full",
                                            side === 'SELL'
                                                ? "bg-gradient-to-r from-red-500 via-orange-500 to-transparent"
                                                : "bg-gradient-to-r from-emerald-500 via-cyan-500 to-transparent"
                                        )} />

                                        <div className="px-2 py-1.5">
                                            {/* Label - Micro Typography */}
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className={cn(
                                                    // bricolage.className removed
                                                    "text-[0.65rem] uppercase tracking-[0.25em] font-black",
                                                    side === 'SELL' ? "text-red-400" : "text-emerald-400"
                                                )}>
                                                    {side === 'SELL' ? 'Short' : 'Long'}
                                                </span>
                                                {/* Animated Dot */}
                                                <div className={cn(
                                                    "w-1 h-1 rounded-full animate-pulse",
                                                    side === 'SELL' ? "bg-red-500" : "bg-emerald-500"
                                                )} />
                                            </div>

                                            {/* The Outcome Text - Hero */}
                                            <div className="relative">
                                                <span className={cn(
                                                    // bricolage.className removed
                                                    "block text-lg font-black italic tracking-tighter leading-none uppercase text-zinc-100"
                                                )}>
                                                    {outcome}
                                                </span>

                                            </div>
                                        </div>

                                        {/* Background Pattern - Subtle Grid */}
                                        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[size:4px_4px] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)]" />

                                        {/* Corner Accent */}
                                        <div className={cn(
                                            "absolute bottom-0 right-0 w-2 h-2 border-b-1.5 border-r-1.5",
                                            side === 'SELL' ? "border-red-500" : "border-emerald-500"
                                        )} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Right: Gauge */}
                        <div className="flex items-end justify-end">
                            <Gauge value={odds} label={side} size={64} strokeWidth={2} />
                        </div>
                    </div>
                </Card>

                <TraderRibbon
                    displayAccountName={displayAccountName}
                    walletRanks={walletRanks}
                    isGod={isGod}
                    isSuper={isSuper}
                    isMega={isMega}
                    isWhale={isWhale}
                />

                {/* Card Docked Plate - Timestamp Footer */}
                <div className={cn(
                    "mx-auto mt-1 w-[92%] px-4 py-1.5 text-[10px]",
                    isGod ? "text-white font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" :
                        isSuper ? "text-[rgba(227,182,182,0.8)]" :
                            isMega ? "text-purple-400/70" :
                                isWhale ? "text-sky-300/80" :
                                    "text-zinc-400"
                )}>
                    {(() => {
                        const date = new Date(timestamp);
                        const now = new Date();
                        const isToday = date.toDateString() === now.toDateString();

                        const timeString = date.toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });

                        // Calculate relative time
                        const diffMs = now.getTime() - date.getTime();
                        const diffSec = Math.floor(diffMs / 1000);
                        const diffMin = Math.floor(diffSec / 60);
                        const diffHr = Math.floor(diffMin / 60);
                        const diffDays = Math.floor(diffHr / 24);

                        let relativeTime: string;
                        if (diffSec < 30) {
                            relativeTime = 'just now';
                        } else if (diffSec < 60) {
                            relativeTime = `${diffSec}s ago`;
                        } else if (diffMin < 60) {
                            relativeTime = `${diffMin} min ago`;
                        } else if (diffHr < 24) {
                            relativeTime = `${diffHr}h ago`;
                        } else if (diffDays === 1) {
                            relativeTime = 'yesterday';
                        } else {
                            relativeTime = `${diffDays}d ago`;
                        }

                        if (isToday) {
                            return `Today • ${timeString} — ${relativeTime}`;
                        } else {
                            const month = date.toLocaleDateString([], { month: 'short' });
                            const day = date.getDate();
                            return `${month} ${day} • ${timeString} — ${relativeTime}`;
                        }
                    })()}
                </div>
            </motion.div>


            <TradeDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                anomaly={anomaly}
            />
        </>
    );
});
