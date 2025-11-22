import { Anomaly } from "@/lib/market-stream";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Gauge } from "./gauge";

interface AnomalyCardProps {
    anomaly: Anomaly;
}

export function convertAnomalyToCardProps(anomaly: Anomaly) {
    return {
        title: anomaly.event,
        amount: `$${Math.round(anomaly.value).toLocaleString()}`,
        bet: `${anomaly.outcome} | ${anomaly.odds}¢`,
        type: anomaly.type,
        multiplier: anomaly.multiplier,
        zScore: anomaly.zScore,
        isContra: anomaly.isContra
    };
}

export function AnomalyCard({ anomaly }: AnomalyCardProps) {
    const { event: title, value, outcome, odds, type, timestamp, side } = anomaly;
    const amount = `$${Math.round(value).toLocaleString()}`;
    const isGod = type === 'GOD_WHALE';
    const isSuper = type === 'SUPER_WHALE';
    const isMega = type === 'MEGA_WHALE';
    const isWhale = type === 'WHALE';

    return (
        <div className="group relative h-full select-none hover:z-50">
            <Card className={cn(
                "relative z-10 h-full p-4 border-2 transition-all duration-300 ease-out rounded-none overflow-hidden",
                // Standard Tier (Default)
                !isGod && !isSuper && !isMega && !isWhale &&
                "border-zinc-700 bg-zinc-950 shadow-[4px_4px_0px_0px_#27272a] group-hover:shadow-[6px_6px_0px_0px_#27272a] group-hover:-translate-y-1",

                // Whale Tier - Subtle Blue
                isWhale && "border-zinc-700 bg-zinc-950 shadow-[4px_4px_0px_0px_#3b82f6] group-hover:shadow-[6px_6px_0px_0px_#3b82f6] group-hover:-translate-y-1",

                // Mega Whale - Pulsing Purple
                isMega && "border-zinc-700 bg-zinc-950 shadow-[4px_4px_0px_0px_#a855f7] group-hover:shadow-[6px_6px_0px_0px_#a855f7] group-hover:-translate-y-1",

                // Super Whale - Aggressive Red
                isSuper && "border-zinc-700 bg-zinc-950 shadow-[4px_4px_0px_0px_#ef4444] group-hover:shadow-[6px_6px_0px_0px_#ef4444] group-hover:-translate-y-1",

                // God Whale - Mythic Gold
                isGod && "border-zinc-700 bg-zinc-950 shadow-[4px_4px_0px_0px_#fbbf24] group-hover:shadow-[6px_6px_0px_0px_#fbbf24] group-hover:-translate-y-1"
            )}>
                {/* God Tier: Cosmic Limit Break (Anime Style) */}
                {isGod && (
                    <>
                        {/* Manga Speed Lines (Rapid Rotation) */}
                        <div className="absolute inset-[-150%] z-0 pointer-events-none bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(251,191,36,0.4)_10deg,transparent_20deg,rgba(251,191,36,0.1)_50deg,transparent_60deg,rgba(251,191,36,0.4)_90deg,transparent_100deg)] animate-super-spin mix-blend-plus-lighter opacity-70" />

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

                        {/* Glitch Border Overlay */}
                        <div className="absolute inset-0 z-0 pointer-events-none border-2 border-red-500/50 animate-glitch-border" />

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

                        {/* Arcane Sparkles - Galaxy Motion */}
                        <div className="absolute inset-0 z-0 pointer-events-none">
                            {/* Primary sparkle cluster */}
                            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-300 rounded-full animate-sparkle opacity-60 blur-sm" style={{ animationDelay: '0s' }} />
                            <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-purple-200 rounded-full animate-sparkle opacity-50 blur-sm" style={{ animationDelay: '1s' }} />
                            <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-purple-400 rounded-full animate-sparkle opacity-70 blur-sm" style={{ animationDelay: '2s' }} />
                            <div className="absolute top-1/2 right-1/4 w-2.5 h-2.5 bg-purple-100 rounded-full animate-sparkle opacity-40 blur-sm" style={{ animationDelay: '3s' }} />
                            <div className="absolute bottom-1/3 right-1/2 w-1 h-1 bg-white rounded-full animate-sparkle opacity-80 blur-sm" style={{ animationDelay: '4s' }} />
                            {/* Secondary floating specks */}
                            <div className="absolute top-1/6 left-1/2 w-0.5 h-0.5 bg-purple-300 rounded-full animate-sparkle opacity-30" style={{ animationDelay: '0.5s' }} />
                            <div className="absolute bottom-1/6 right-1/6 w-0.5 h-0.5 bg-purple-200 rounded-full animate-sparkle opacity-40" style={{ animationDelay: '1.5s' }} />
                            <div className="absolute top-2/3 left-1/6 w-0.5 h-0.5 bg-white rounded-full animate-sparkle opacity-50" style={{ animationDelay: '2.5s' }} />
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

                <div className="relative z-10 grid grid-cols-[1fr_auto] gap-4">
                    {/* Top Left: Title */}
                    <div className="flex items-start">
                        <h3 className="text-sm font-bold uppercase tracking-tight text-zinc-100 line-clamp-2" title={title}>
                            {title}
                        </h3>
                    </div>

                    {/* Top Right: Amount */}
                    <div className="flex items-start justify-end">
                        <div className={cn(
                            "text-lg font-bold font-mono border-b",
                            isGod ? "text-yellow-300 border-yellow-300/60" :
                                isSuper ? "text-red-300 border-red-300/60" :
                                    isMega ? "text-purple-300 border-purple-300/60" :
                                        isWhale ? "text-blue-300 border-blue-300/60" :
                                            "text-zinc-300 border-zinc-300/60"
                        )}>
                            {amount}
                        </div>
                    </div>

                    {/* Bottom Left: Outcome */}
                    <div className="flex items-end">
                        <div className="flex flex-col justify-end">
                            <div className={cn(
                                "px-2 py-0.5 border-2 font-black text-sm uppercase bg-zinc-900",
                                side === 'SELL'
                                    ? "border-[#ff3b3b] text-[#ff3b3b] shadow-[3px_3px_0px_0px_#ff3b3b]"
                                    : "border-[#21ff99] text-[#21ff99] shadow-[3px_3px_0px_0px_#21ff99]"
                            )}>
                                {outcome}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Right: Gauge */}
                    <div className="flex items-end justify-end">
                        <Gauge value={odds} label={side} size={64} strokeWidth={2} />
                    </div>
                </div>
            </Card>

            {/* Timestamp Reveal - Appears behind the lifting card */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end z-0 opacity-0 group-hover:opacity-100 group-hover:translate-y-6 transition-all duration-300 delay-75">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider bg-black/50 px-2 py-0.5 rounded">
                    {new Date(timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    })}
                </span>
            </div>
        </div>
    );
}

