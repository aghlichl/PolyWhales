import { cn } from "@/lib/utils";
import { getLiveScoreLogo, type LiveScore } from "@/lib/useScoreStore";
import { TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LiveScoreboardProps {
    game: LiveScore;
    className?: string;
    isStandard?: boolean;
}

export function LiveScoreboard({ game, className }: LiveScoreboardProps) {
    return (
        <div className={cn(
            "flex items-center gap-2 md:gap-3.5 text-xs md:text-sm font-semibold px-2 md:px-4 py-1.5 md:py-2 rounded-lg min-w-0 max-w-full text-zinc-300 h-full",
            className
        )}>
            {/* Away Team */}
            <div className="flex flex-col items-center gap-1 md:gap-1.5 min-w-[24px] md:min-w-[28px]">
                {getLiveScoreLogo(game.league, game.awayTeamAbbr, game.awayTeamName) ? (
                    <img
                        src={getLiveScoreLogo(game.league, game.awayTeamAbbr, game.awayTeamName)!}
                        alt={game.awayTeamShort}
                        className="w-5 h-5 md:w-8 md:h-8 object-contain drop-shadow-md rounded-md"
                    />
                ) : (
                    <span className="text-[9px] md:text-xs text-zinc-500 uppercase">{game.awayTeamShort.substring(0, 3)}</span>
                )}
                <div className="flex items-center gap-0.5 md:gap-1">
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                            key={game.awayScore}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="text-xs md:text-base font-semibold"
                        >
                            {game.awayScore}
                        </motion.span>
                    </AnimatePresence>
                    {game.awayScoreTrend === 'UP' && <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-400" />}
                </div>
            </div>

            <span className="text-zinc-600 pb-2 md:pb-4 text-xs md:text-base">:</span>

            {/* Home Team */}
            <div className="flex flex-col items-center gap-1 md:gap-1.5 min-w-[24px] md:min-w-[28px]">
                {getLiveScoreLogo(game.league, game.homeTeamAbbr, game.homeTeamName) ? (
                    <img
                        src={getLiveScoreLogo(game.league, game.homeTeamAbbr, game.homeTeamName)!}
                        alt={game.homeTeamShort}
                        className="w-5 h-5 md:w-8 md:h-8 object-contain drop-shadow-md rounded-md"
                    />
                ) : (
                    <span className="text-[9px] md:text-xs text-zinc-500 uppercase">{game.homeTeamShort.substring(0, 3)}</span>
                )}
                <div className="flex items-center gap-0.5 md:gap-1">
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                            key={game.homeScore}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="text-xs md:text-base font-semibold"
                        >
                            {game.homeScore}
                        </motion.span>
                    </AnimatePresence>
                    {game.homeScoreTrend === 'UP' && <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-400" />}
                </div>
            </div>

            {/* Clock separator */}
            <div className="w-px h-6 md:h-10 bg-white/10 mx-0.5 md:mx-1" />

            {/* Clock & Period */}
            <div className="flex items-center gap-1.5 md:gap-3 min-w-0 md:min-w-[80px]">
                <span className="text-xs md:text-base font-semibold text-zinc-100 whitespace-nowrap">
                    {game.clock}
                </span>
                <span className="text-xs md:text-base text-zinc-400 font-medium whitespace-nowrap">
                    {game.league === 'MLB'
                        ? (game.period >= 10 ? `Ex` : `${game.period}${['st', 'nd', 'rd'][game.period - 1] || 'th'}`)
                        : `Q${game.period}`
                    }
                </span>
            </div>
        </div>
    );
}
