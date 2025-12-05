import { Anomaly } from "@/lib/types";
import { MarketMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Gauge } from "./gauge";
import { useState, memo, useMemo } from "react";
import { TradeDetailsModal } from "./trade-details-modal";
import { resolveTeamFromMarket, getLogoPathForTeam, inferLeagueFromMarket } from "@/lib/teamResolver";
import { useAutoFitText } from "@/lib/useAutoFitText";
import { useMarketStore } from "@/lib/store";

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

export const AnomalyCard = memo(function AnomalyCard({ anomaly }: AnomalyCardProps) {
    const { event: title, value, outcome, odds, type, timestamp, side, image } = anomaly;
    const { leaderboardRanks } = useMarketStore();

    // Get leaderboard ranks for this wallet
    const walletRanks = useMemo(() => {
        if (!anomaly.wallet_context?.address) return [];
        const walletKey = anomaly.wallet_context.address.toLowerCase();
        return leaderboardRanks[walletKey] || [];
    }, [anomaly.wallet_context?.address, leaderboardRanks]);

    // Prefer named leaderboard entry, else wallet label, else short address
    const accountName = useMemo(() => {
        const named = walletRanks.find((r) => r.accountName && r.accountName.trim());
        if (named?.accountName) return named.accountName.trim();
        if (anomaly.wallet_context?.label) return anomaly.wallet_context.label;
        if (anomaly.wallet_context?.address) {
            const addr = anomaly.wallet_context.address;
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        }
        return null;
    }, [walletRanks, anomaly.wallet_context?.label, anomaly.wallet_context?.address]);

    const isTop20Account = useMemo(() => {
        return walletRanks.some((r) => typeof r.rank === 'number' && r.rank > 0 && r.rank <= 20);
    }, [walletRanks]);

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
    }, [title, outcome, image, timestamp, side, type]);

    const amount = `$${Math.round(value).toLocaleString()}`;
    const isGod = type === 'GOD_WHALE';
    const isSuper = type === 'SUPER_WHALE';
    const isMega = type === 'MEGA_WHALE';
    const isWhale = type === 'WHALE';

    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <div
                className="group relative h-full select-none hover:z-30 cursor-pointer"
                onClick={() => setIsModalOpen(true)}
            >
                {/* Dragon Ball Z/Demon Slayer Aura - Only for God Whale */}
                {isGod && (
                    <div className="absolute inset-0 pointer-events-none isolate">
                        {/* Demonic Flame Rings - Around Card Border */}
                        <div className="absolute -inset-1 z-0 overflow-hidden rounded-inherit">
                            {/* Outer Ring - Slow Pulsing */}
                            <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(251,191,36,0.8)_45deg,rgba(239,68,68,0.9)_90deg,rgba(251,191,36,0.7)_135deg,transparent_180deg,rgba(168,85,247,0.6)_225deg,rgba(239,68,68,0.8)_270deg,rgba(251,191,36,0.7)_315deg,transparent_360deg)] animate-[spin_8s_linear_infinite] opacity-70 blur-sm rounded-xl" />

                            {/* Inner Ring - Faster Rotation */}
                            <div className="absolute inset-1 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(239,68,68,1.0)_30deg,rgba(251,191,36,1.0)_60deg,rgba(239,68,68,0.9)_90deg,transparent_120deg,rgba(251,191,36,0.8)_150deg,rgba(239,68,68,1.0)_180deg,rgba(251,191,36,0.9)_210deg,transparent_240deg,rgba(168,85,247,0.7)_270deg,rgba(239,68,68,0.8)_300deg,rgba(251,191,36,1.0)_330deg,transparent_360deg)] animate-spin-reverse opacity-60 blur-sm rounded-xl" />
                        </div>

                        Energy Wisps - Floating Demonic Particles Around Border
                        <div className="absolute -inset-0.5 z-0">
                            {/* Top wisps */}
                            <div className="absolute -top-0.5 left-1/4 w-0.5 h-3 bg-linear-to-t from-transparent via-yellow-400 to-transparent animate-energy-wisp" style={{ animationDelay: '0s' }} />
                            <div className="absolute -top-0.5 right-1/3 w-0.5 h-2 bg-linear-to-t from-transparent via-red-400 to-transparent animate-energy-wisp" style={{ animationDelay: '1s' }} />

                            {/* Side wisps */}
                            <div className="absolute top-1/2 -left-0.5 w-2 h-0.5 bg-linear-to-r from-transparent via-orange-400 to-transparent animate-energy-wisp" style={{ animationDelay: '0.5s' }} />
                            <div className="absolute top-1/3 -right-0.5 w-1.5 h-0.5 bg-linear-to-l from-transparent via-yellow-300 to-transparent animate-energy-wisp" style={{ animationDelay: '1.5s' }} />

                            {/* Bottom wisps */}
                            <div className="absolute -bottom-0.5 left-1/3 w-0.5 h-2.5 bg-linear-to-t from-yellow-500 via-orange-400 to-transparent animate-energy-wisp" style={{ animationDelay: '2s' }} />
                            <div className="absolute -bottom-0.5 right-1/4 w-0.5 h-1.5 bg-linear-to-t from-red-500 via-yellow-400 to-transparent animate-energy-wisp" style={{ animationDelay: '0.8s' }} />
                        </div>
                    </div>
                )}

                <Card className={cn(
                    "relative z-10 h-full p-4 transition-all duration-300 ease-out rounded-xl overflow-hidden border",
                    // Standard Tier (Default)
                    !isGod && !isSuper && !isMega && !isWhale &&
                    "bg-zinc-950 border-zinc-700 shadow-[5px_5px_0px_0px_#27272a] group-hover:shadow-[6px_6px_0px_0px_#27272a] group-hover:-translate-y-1",

                    // Whale Tier - Subtle Blue
                    isWhale && "bg-zinc-950 border-blue-500/20 shadow-[5px_5px_0px_0px_#3b82f6] group-hover:shadow-[6px_6px_0px_0px_#3b82f6] group-hover:-translate-y-1",

                    // Mega Whale - Pulsing Purple
                    isMega && "bg-zinc-950 border-purple-500/20 shadow-[5px_5px_0px_0px_#a855f7] group-hover:shadow-[6px_6px_0px_0px_#a855f7] group-hover:-translate-y-1",

                    // Super Whale - Aggressive Red
                    isSuper && "bg-zinc-950 border-red-500/20 shadow-[5px_5px_0px_0px_#ef4444] group-hover:shadow-[6px_6px_0px_0px_#ef4444] group-hover:-translate-y-1",

                    // God Whale - Mythic Gold
                    isGod && "bg-zinc-950 border-yellow-500/20 shadow-[5px_5px_0px_0px_#fbbf24] group-hover:shadow-[6px_6px_0px_0px_#fbbf24] group-hover:-translate-y-1"
                )}>
                    {/* God Tier: Cosmic Limit Break (Anime Style) */}
                    {isGod && (
                        <>
                            {/* Manga Speed Lines (Rapid Rotation) */}
                            <div className="absolute inset-[-150%] z-0 pointer-events-none bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(251,191,36,0.4)_10deg,transparent_20deg,rgba(251,191,36,0.1)_50deg,transparent_60deg,rgba(251,191,36,0.4)_90deg,transparent_100deg)] animate-super-spin mix-blend-plus-lighter opacity-70 rounded-xl" />

                            {/* Core Energy Flash (Blinding Light) */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,rgba(251,191,36,0.5)_20%,transparent_60%)] animate-flash mix-blend-screen" />

                            {/* Expanding Shockwaves */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(251,191,36,0.6)_40%,transparent_50%)] animate-shockwave mix-blend-plus-lighter" />

                            {/* Rising Aura (Flame Effect) */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(0deg,rgba(251,191,36,0.2)_0%,transparent_100%)] animate-pulse" />

                            {/* Deep Cosmic Shadow Overlay */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
                        </>
                    )}

                    {/* Super Tier: Critical Overload */}
                    {isSuper && (
                        <>
                            {/* Warning Throb (Siren) */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-red-500/10 animate-[pulse_0.5s_ease-in-out_infinite]" />

                            {/* Jagged Scanline */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(180deg,transparent_40%,rgba(239,68,68,0.8)_50%,transparent_60%)] bg-[length:100%_200%] animate-scanline mix-blend-plus-lighter opacity-80" />

                            {/* Heat Distortion Waves */}
                            <div className="absolute inset-0 z-0 pointer-events-none opacity-15">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent animate-heat-distortion" />
                                <div className="absolute inset-0 bg-gradient-to-l from-transparent via-red-600/8 to-transparent animate-heat-distortion" style={{ animationDelay: '0.5s' }} />
                                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-red-400/12 to-transparent animate-heat-distortion" style={{ animationDelay: '1s' }} />
                            </div>

                            {/* RGB Glitch Cycling Border */}
                            <div className="absolute inset-0 z-0 pointer-events-none border-2 border-red-500/60 animate-rgb-glitch-cycle" />

                            {/* Glitch Border Overlay */}
                            <div className="absolute inset-0 z-0 pointer-events-none border-2 border-red-500/30 animate-glitch-border" />

                            {/* Digital Noise (Static) */}
                            <div className="absolute inset-0 z-0 pointer-events-none opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
                        </>
                    )}

                    {/* Mega Tier: The Arcane Rune */}
                    {isMega && (
                        <>
                            {/* Spinning Rune Circle */}
                            <div className="absolute inset-[-50%] z-0 pointer-events-none bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(168,85,247,0.1)_60deg,transparent_120deg)] animate-[spin_10s_linear_infinite]" />

                            {/* Mana Surge (Breathing Core) */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.3)_0%,transparent_70%)] animate-heartbeat mix-blend-screen" />

                            {/* Arcane Nebula - Contained Swirling Motion */}
                            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
                                {/* Primary Nebula Swirl - Large central vortex */}
                                <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(168,85,247,0.1)_30deg,rgba(168,85,247,0.3)_60deg,rgba(168,85,247,0.1)_90deg,rgba(147,51,234,0.2)_120deg,rgba(147,51,234,0.4)_150deg,rgba(147,51,234,0.2)_180deg,transparent_210deg)] animate-[nebula-swirl_12s_linear_infinite] mix-blend-screen opacity-70" />

                                {/* Secondary Energy Streams - Flowing tendrils */}
                                <div className="absolute inset-[-20%] bg-[radial-gradient(circle_at_30%_70%,rgba(168,85,247,0.4)_0%,rgba(168,85,247,0.1)_30%,transparent_60%),radial-gradient(circle_at_70%_30%,rgba(147,51,234,0.3)_0%,rgba(147,51,234,0.1)_40%,transparent_70%)] animate-[energy-flow_8s_ease-in-out_infinite_alternate] mix-blend-plus-lighter opacity-60" />

                                {/* Cosmic Dust Particles - Stars across entire card */}
                                <div className="absolute inset-0 opacity-50">
                                    {/* Upper region stars */}
                                    <div className="absolute top-[15%] left-[25%] w-0.5 h-0.5 bg-purple-300 rounded-full animate-[dust-twinkle_3s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
                                    <div className="absolute top-[20%] right-[15%] w-1 h-1 bg-purple-400 rounded-full animate-[dust-twinkle_4s_ease-in-out_infinite]" style={{ animationDelay: '1s' }} />
                                    <div className="absolute top-[10%] left-[60%] w-0.5 h-0.5 bg-purple-200 rounded-full animate-[dust-twinkle_3.5s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
                                    <div className="absolute top-[25%] right-[70%] w-0.5 h-0.5 bg-white rounded-full animate-[dust-twinkle_5s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }} />

                                    {/* Central region stars */}
                                    <div className="absolute top-[45%] left-[15%] w-0.5 h-0.5 bg-purple-500 rounded-full animate-[dust-twinkle_4.5s_ease-in-out_infinite]" style={{ animationDelay: '1.5s' }} />
                                    <div className="absolute top-[55%] right-[25%] w-1 h-1 bg-purple-100 rounded-full animate-[dust-twinkle_3.2s_ease-in-out_infinite]" style={{ animationDelay: '2.5s' }} />
                                    <div className="absolute top-[35%] left-[75%] w-0.5 h-0.5 bg-purple-300 rounded-full animate-[dust-twinkle_4.8s_ease-in-out_infinite]" style={{ animationDelay: '0.8s' }} />

                                    {/* Lower region stars */}
                                    <div className="absolute bottom-[20%] left-[30%] w-0.5 h-0.5 bg-purple-400 rounded-full animate-[dust-twinkle_3.8s_ease-in-out_infinite]" style={{ animationDelay: '1.2s' }} />
                                    <div className="absolute bottom-[15%] right-[45%] w-0.5 h-0.5 bg-purple-200 rounded-full animate-[dust-twinkle_4.2s_ease-in-out_infinite]" style={{ animationDelay: '2.8s' }} />
                                    <div className="absolute bottom-[25%] left-[70%] w-1 h-1 bg-white rounded-full animate-[dust-twinkle_3.6s_ease-in-out_infinite]" style={{ animationDelay: '0.3s' }} />
                                    <div className="absolute bottom-[10%] right-[20%] w-0.5 h-0.5 bg-purple-500 rounded-full animate-[dust-twinkle_5.2s_ease-in-out_infinite]" style={{ animationDelay: '1.8s' }} />
                                </div>

                                {/* Inner Glow Core - Pulsing center */}
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[radial-gradient(circle,rgba(168,85,247,0.6)_0%,rgba(168,85,247,0.2)_50%,transparent_100%)] animate-[core-pulse_4s_ease-in-out_infinite] rounded-full blur-sm" />
                            </div>

                            {/* Static Border Glow */}
                            <div className="absolute inset-0 z-0 pointer-events-none border border-purple-500/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.2)]" />
                        </>
                    )}

                    {/* Whale Tier: The Bioluminescent Deep */}
                    {isWhale && (
                        <>
                            {/* Deep Ocean Base */}
                            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.4)_0%,rgba(59,130,246,0.1)_40%,transparent_70%)] animate-breathe" />

                            {/* Floating Plankton (Noise Texture) */}
                            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay animate-drift" />

                        </>
                    )}

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
                                            isSuper ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" :
                                                isMega ? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" :
                                                    isWhale ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" :
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
                                                    isSuper ? "text-red-100" :
                                                        isMega ? "text-purple-100" :
                                                            isWhale ? "text-blue-100" :
                                                                "text-zinc-100"
                                            )}
                                            title={title}
                                        >
                                            {/* Inner wrapper for line-clamp to work correctly within flex parent */}
                                            <span className="line-clamp-3 w-full">
                                                {title}
                                            </span>
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Right: Amount - REDESIGNED (Minimalist Neobrutalism) */}
                        <div className="flex items-start justify-end">
                            <div className={cn(
                                "relative group",
                                "bg-zinc-950", // Deep solid background
                                "border border-zinc-800", // Structural border
                                "rounded-lg", // Consistent shape
                                "px-4 py-2"
                            )}>
                                {/* Tier Indicator - Minimal Corner Accent */}
                                <div className={cn(
                                    "absolute top-0 right-0 w-2 h-2",
                                    "border-t border-r rounded-tr-lg", // Corner bracket style
                                    isGod ? "border-yellow-500" :
                                        isSuper ? "border-red-500" :
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
                                        isSuper ? "border-red-500" :
                                            isMega ? "border-purple-500" :
                                                isWhale ? "border-blue-500" :
                                                    "border-zinc-600"
                                )} />

                                <div className="relative flex items-baseline gap-1">
                                    <span className={cn(
                                        // jetbrains.className removed
                                        "text-sm font-bold",
                                        isGod ? "text-yellow-500/90" :
                                            isSuper ? "text-red-500/90" :
                                                isMega ? "text-purple-500/90" :
                                                    isWhale ? "text-blue-500/90" :
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
                                        "bg-zinc-950 border border-zinc-800"
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

                {/* Top 20 Trader Section - Layered underneath the card */}
                {displayAccountName && walletRanks.length > 0 && (
                    <div className={cn(
                        "relative -mt-2 mx-1 pt-5 pb-3 px-3 rounded-b-xl",
                        "bg-black border border-t-0 border-zinc-800/60",
                        // Tier-specific subtle accent on the bottom edge
                        isGod && "border-b-yellow-500/20",
                        isSuper && "border-b-red-500/20",
                        isMega && "border-b-purple-500/20",
                        isWhale && "border-b-blue-500/20"
                    )}>
                        {/* Rankings Row */}
                        <div className="flex items-center gap-1.5">
                            {(['Daily', 'Weekly', 'Monthly', 'All Time'] as const).map((period) => {
                                // Period display names match the database period values directly
                                const rankData = walletRanks.find(r => r.period === period);
                                const hasRank = rankData && typeof rankData.rank === 'number' && rankData.rank > 0;
                                const formattedPnl = hasRank ? formatBadgePnl(rankData.totalPnl) : null;

                                return (
                                    <div
                                        key={period}
                                        className={cn(
                                            "flex-1 flex flex-col items-center py-1.5 px-2 rounded-md text-xs lg:text-sm",
                                            "border",
                                            hasRank ? (
                                                isGod ? "bg-yellow-500/10 border-yellow-500/30" :
                                                    isSuper ? "bg-red-500/10 border-red-500/30" :
                                                        isMega ? "bg-purple-500/10 border-purple-500/30" :
                                                            isWhale ? "bg-blue-500/10 border-blue-500/30" :
                                                                "bg-zinc-800/50 border-zinc-700/50"
                                            ) : "bg-zinc-900/30 border-zinc-800/30"
                                        )}
                                    >
                                        {/* Period Label */}
                                        <span className={cn(
                                            "uppercase font-medium text-[10px] lg:text-xs",
                                            hasRank ? (
                                                isGod ? "text-yellow-400/70" :
                                                    isSuper ? "text-red-400/70" :
                                                        isMega ? "text-purple-400/70" :
                                                            isWhale ? "text-blue-400/70" :
                                                                "text-zinc-500"
                                            ) : "text-zinc-600"
                                        )}>
                                            {period}
                                        </span>
                                        {/* Rank */}
                                        <span className={cn(
                                            "text-xs lg:text-sm font-black leading-tight",
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
                                        {/* PnL (only if has rank) */}
                                        {formattedPnl && rankData && (
                                            <span className={cn(
                                                "text-[10px] lg:text-xs font-semibold leading-tight",
                                                rankData.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                                            )}>
                                                {formattedPnl}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Account Name Row - Centered */}
                        <div className="flex items-center justify-center gap-2 mt-2">
                            {/* Star Icon */}
                            <div className={cn(
                                "shrink-0 w-4 h-4 flex items-center justify-center",
                                isGod ? "text-yellow-400" :
                                    isSuper ? "text-red-400" :
                                        isMega ? "text-purple-400" :
                                            isWhale ? "text-blue-400" :
                                                "text-zinc-400"
                            )}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                </svg>
                            </div>
                            {/* Account Name */}
                            <span className={cn(
                                "text-sm font-bold truncate tracking-tight",
                                isGod ? "text-yellow-200" :
                                    isSuper ? "text-red-200" :
                                        isMega ? "text-purple-200" :
                                            isWhale ? "text-blue-200" :
                                                "text-zinc-100"
                            )}>
                                {displayAccountName}
                            </span>
                        </div>
                    </div>
                )}

                {/* Card Docked Plate - Timestamp Footer */}
                <div className={cn(
                    // jetbrains.className removed
                    "mx-auto mt-1 w-[92%] px-4 py-1.5 text-[10px] rounded-md",
                    "backdrop-blur-sm border-t",
                    // Base styling - more subtle
                    "bg-black/20 text-zinc-500 border-[rgba(255,255,255,0.03)] shadow-inner shadow-black/20",
                    // Tier-specific styling - premium tiers more subtle
                    isGod && "bg-black/10 border-t-yellow-400/20 text-yellow-400/80",
                    isSuper && "bg-black/10 border-t-red-400/20 text-red-400/80",
                    isMega && "bg-black/15 border-t-purple-400/25 text-purple-300/85 shadow-purple-900/15",
                    isWhale && "bg-black/15 border-t-blue-400/25 text-blue-300/85 shadow-blue-900/15"
                )}>
                    {(() => {
                        const date = new Date(timestamp);
                        const now = new Date();
                        const isToday = date.toDateString() === now.toDateString();

                        const timeString = date.toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        });

                        if (isToday) {
                            return `Today • ${timeString}`;
                        } else {
                            const month = date.toLocaleDateString([], { month: 'short' });
                            const day = date.getDate();
                            return `${month} ${day} • ${timeString}`;
                        }
                    })()}
                </div>
            </div>


            <TradeDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                anomaly={anomaly}
            />
        </>
    );
});

