import { cn } from "@/lib/utils";
import { getLiveScoreLogo, type LiveScore } from "@/lib/useScoreStore";
import { normalizeEspnEvent, type NormalizedGame } from "@/lib/espn-normalizer";
import { TrendingUp, MonitorPlay, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LiveScoreboardProps {
    game: LiveScore | NormalizedGame | any;
    className?: string;
    isStandard?: boolean;
}

export function LiveScoreboard({ game, className }: LiveScoreboardProps) {
    // 1. Attempt Normalization
    // If it's already normalized (has ids structure), use it.
    // If it has rawEspnEvent (from updated implementation), normalize that.
    // Otherwise try normalizing game itself (if raw passed directly).
    let norm: NormalizedGame | null = null;
    if (game && typeof game === 'object') {
        if ('ids' in game && 'meta' in game) {
            norm = game as NormalizedGame;
        } else {
            const raw = (game as any).rawEspnEvent ?? game;
            norm = normalizeEspnEvent(raw);
        }
    }

    // 2. Fallback to Legacy Render if normalization fails
    if (!norm) {
        // Assume legacy LiveScore shape
        const legacy = game as LiveScore;
        return (
            <div className={cn(
                "flex items-center gap-2 md:gap-3.5 text-xs md:text-sm font-semibold px-2 md:px-4 py-1.5 md:py-2 rounded-lg min-w-0 max-w-full text-zinc-300 h-full",
                className
            )}>
                {/* Away Team */}
                <div className="flex flex-col items-center gap-1 md:gap-1.5 min-w-[24px] md:min-w-[28px]">
                    {legacy.awayTeamAbbr ? (
                        <TeamLogo league={legacy.league} abbr={legacy.awayTeamAbbr} name={legacy.awayTeamName} alt={legacy.awayTeamShort} />
                    ) : (
                        <span className="text-[9px] md:text-xs text-zinc-500 uppercase">{legacy.awayTeamShort?.substring(0, 3)}</span>
                    )}
                    <div className="flex items-center gap-0.5 md:gap-1">
                        <ScoreDisplay score={legacy.awayScore} />
                        {legacy.awayScoreTrend === 'UP' && <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-400" />}
                    </div>
                </div>

                <span className="text-zinc-600 pb-2 md:pb-4 text-xs md:text-base">:</span>

                {/* Home Team */}
                <div className="flex flex-col items-center gap-1 md:gap-1.5 min-w-[24px] md:min-w-[28px]">
                    {legacy.homeTeamAbbr ? (
                        <TeamLogo league={legacy.league} abbr={legacy.homeTeamAbbr} name={legacy.homeTeamName} alt={legacy.homeTeamShort} />
                    ) : (
                        <span className="text-[9px] md:text-xs text-zinc-500 uppercase">{legacy.homeTeamShort?.substring(0, 3)}</span>
                    )}
                    <div className="flex items-center gap-0.5 md:gap-1">
                        <ScoreDisplay score={legacy.homeScore} />
                        {legacy.homeScoreTrend === 'UP' && <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-400" />}
                    </div>
                </div>

                <div className="w-px h-6 md:h-10 bg-white/10 mx-0.5 md:mx-1" />

                {(legacy.clock !== "0.0" || legacy.period !== 0) && (
                    <div className="flex items-center gap-1.5 md:gap-3 min-w-0 md:min-w-[80px]">
                        <span className="text-xs md:text-base font-semibold text-zinc-100 whitespace-nowrap">
                            {legacy.clock}
                        </span>
                        <span className="text-xs md:text-base text-zinc-400 font-medium whitespace-nowrap">
                            {/* Best effort period label for legacy */}
                            {legacy.league === 'MLB'
                                ? (legacy.period >= 10 ? `Ex` : `${legacy.period}${['st', 'nd', 'rd'][legacy.period - 1] || 'th'}`)
                                : `Q${legacy.period}`
                            }
                        </span>
                    </div>
                )}
            </div>
        );
    }

    // 3. Rich Render (Normalized)
    const { teams, score, timing, derived, meta, broadcast } = norm;
    // Infer league for logo lookups
    const league = meta.seasonSlug?.toUpperCase()?.replace("MEN", "")?.replace("WOMEN", "")?.trim()
        || (game as LiveScore).league
        || 'NBA';

    const home = teams.home;
    const away = teams.away;
    const isPost = timing.state === 'post' || timing.completed;
    const isLive = timing.state === 'in';

    return (
        <div className={cn(
            "flex items-center gap-3 md:gap-4 text-xs md:text-sm font-semibold px-3 py-2 rounded-lg min-w-0 max-w-full text-zinc-300 h-full relative group overflow-hidden",
            className
        )}>
            {/* Momentum Background Hint (subtle gradient if significant momentum) */}
            {derived?.lastSegmentWinner && isLive && (
                <div className={cn(
                    "absolute inset-0 opacity-5 pointer-events-none transition-colors duration-1000",
                    derived.lastSegmentWinner === 'home' ? "bg-emerald-500" :
                        derived.lastSegmentWinner === 'away' ? "bg-blue-500" : ""
                )} />
            )}

            {/* Away Team */}
            <div className="flex flex-col items-center gap-1 min-w-[32px]">
                <TeamLogo
                    league={league}
                    abbr={away?.abbreviation}
                    name={away?.name}
                    alt={away?.shortDisplayName}
                    logo={away?.logo}
                    className={cn(isPost && away?.winner && "ring-2 ring-emerald-500/50 rounded-md")}
                />
                <div className="flex flex-col items-center">
                    <ScoreDisplay score={score?.away ?? 0} />
                    {/* Record context */}
                    {away?.record?.overall && (
                        <span className="text-[9px] text-zinc-500 font-normal leading-none -mt-0.5">{away.record.overall}</span>
                    )}
                </div>
            </div>

            {/* Center Status / Clock / Network */}
            <div className="flex flex-col items-center justify-center min-w-[70px] gap-1">
                {/* Status or Clock */}
                {isLive ? (
                    <>
                        <span className="text-xs md:text-sm font-bold text-white tabular-nums tracking-tight">
                            {timing.displayClock}
                        </span>
                        <span className="text-[10px] md:text-xs uppercase tracking-wider text-zinc-400 font-medium">
                            Q{timing.period}
                        </span>
                    </>
                ) : (
                    <span className="text-[9px] md:text-xs uppercase font-medium text-zinc-400">
                        {isPost ? "FINAL" : (
                            timing.startTimeISO ? (() => {
                                const gameDate = new Date(timing.startTimeISO);
                                const today = new Date();
                                const isToday = gameDate.toDateString() === today.toDateString();

                                const timeString = gameDate.toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                }).toLowerCase();

                                if (isToday) {
                                    return `${timeString}`;
                                } else {
                                    const month = gameDate.getMonth() + 1;
                                    const day = gameDate.getDate();
                                    return `${month}/${day} · ${timeString}`;
                                }
                            })() : "PRE"
                        )}
                    </span>
                )}

                {/* Broadcast or Momentum Pill */}
                {isLive && derived?.momentumText ? (
                    <div className="flex items-center gap-1 text-[9px] text-amber-400 font-medium animate-pulse">
                        <Zap className="w-2.5 h-2.5" />
                        <span>{derived.momentumText}</span>
                    </div>
                ) : broadcast?.primary ? (
                    <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                        <MonitorPlay className="w-2.5 h-2.5 opacity-70" />
                        <span className="truncate max-w-[60px]">{broadcast.primary}</span>
                    </div>
                ) : null}
            </div>

            {/* Home Team */}
            <div className="flex flex-col items-center gap-1 min-w-[32px]">
                <TeamLogo
                    league={league}
                    abbr={home?.abbreviation}
                    name={home?.name}
                    alt={home?.shortDisplayName}
                    logo={home?.logo}
                    className={cn(isPost && home?.winner && "ring-2 ring-emerald-500/50 rounded-md")}
                />
                <div className="flex flex-col items-center">
                    <ScoreDisplay score={score?.home ?? 0} />
                    {/* Record context */}
                    {home?.record?.overall && (
                        <span className="text-[9px] text-zinc-500 font-normal leading-none -mt-0.5">{home.record.overall}</span>
                    )}
                </div>
            </div>

            {/* Optional: Comeback badge if final */}
            {isPost && derived?.comeback?.occurred && (
                <div className="absolute top-1 right-1">
                    <span className="px-1 py-px bg-orange-500/20 text-orange-400 text-[8px] font-bold rounded uppercase border border-orange-500/30">
                        Comeback
                    </span>
                </div>
            )}
        </div>
    );
}

// Subcomponents to keep it clean

function TeamLogo({ league, abbr, name, alt, logo, className }: { league?: string, abbr?: string, name?: string, alt?: string, logo?: string, className?: string }) {
    // Priority: ESPN logo URL > Local logo lookup > Abbreviation fallback
    const espnSrc = logo;
    const localSrc = (league && abbr && name) ? getLiveScoreLogo(league, abbr, name) : null;
    const src = espnSrc || localSrc;

    return (
        <div className="flex flex-col items-center gap-0.5">
            {src ? (
                <img src={src} alt={alt || abbr} className={cn("w-6 h-6 md:w-8 md:h-8 object-contain drop-shadow-md rounded-md p-0.5", className)} />
            ) : (
                <div className={cn("w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[9px] text-zinc-500 uppercase", className)}>
                    {abbr?.substring(0, 3) || alt?.substring(0, 2) || "??"}
                </div>
            )}
            <span className="text-[8px] md:text-[9px] text-zinc-500 font-medium uppercase leading-none">
                {abbr}
            </span>
        </div>
    );
}

function ScoreDisplay({ score }: { score: number | string }) {
    return (
        <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
                key={score}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="text-sm md:text-base font-bold tabular-nums"
            >
                {score}
            </motion.span>
        </AnimatePresence>
    );
}
