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

                {/* Super Tier: Crimson Vortex - Magical Blood Nebula */}
                {isSuper && (
                    <>
                        {/* Primary Crimson Swirl - Blood vortex rotation */}
                        <div className="absolute inset-0 z-0 pointer-events-none bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(239,68,68,0.15)_45deg,rgba(220,38,38,0.25)_90deg,rgba(239,68,68,0.15)_135deg,transparent_180deg,rgba(185,28,28,0.2)_225deg,rgba(220,38,38,0.3)_270deg,rgba(185,28,28,0.2)_315deg,transparent_360deg)] animate-[crimson-swirl_10s_linear_infinite] mix-blend-screen opacity-80" />

                        {/* Secondary Energy Rivers - Flowing crimson streams */}
                        <div className="absolute inset-[-15%] z-0 pointer-events-none bg-[radial-gradient(circle_at_25%_75%,rgba(239,68,68,0.3)_0%,rgba(239,68,68,0.1)_25%,transparent_50%),radial-gradient(circle_at_75%_25%,rgba(220,38,38,0.25)_0%,rgba(220,38,38,0.1)_30%,transparent_60%)] animate-[blood-flow_7s_ease-in-out_infinite_alternate] mix-blend-plus-lighter opacity-70" />

                        {/* Crimson Star Dust - Blood-red twinkling stars */}
                        <div className="absolute inset-0 opacity-60">
                            {/* Upper region blood stars */}
                            <div className="absolute top-[18%] left-[20%] w-0.5 h-0.5 bg-red-400 rounded-full animate-[blood-twinkle_3.2s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
                            <div className="absolute top-[15%] right-[18%] w-1 h-1 bg-red-300 rounded-full animate-[blood-twinkle_4.1s_ease-in-out_infinite]" style={{ animationDelay: '1.2s' }} />
                            <div className="absolute top-[12%] left-[65%] w-0.5 h-0.5 bg-red-500 rounded-full animate-[blood-twinkle_3.8s_ease-in-out_infinite]" style={{ animationDelay: '2.1s' }} />
                            <div className="absolute top-[22%] right-[75%] w-0.5 h-0.5 bg-red-200 rounded-full animate-[blood-twinkle_4.9s_ease-in-out_infinite]" style={{ animationDelay: '0.7s' }} />

                            {/* Central region blood stars */}
                            <div className="absolute top-[42%] left-[18%] w-0.5 h-0.5 bg-red-600 rounded-full animate-[blood-twinkle_4.3s_ease-in-out_infinite]" style={{ animationDelay: '1.8s' }} />
                            <div className="absolute top-[58%] right-[22%] w-1 h-1 bg-red-100 rounded-full animate-[blood-twinkle_3.5s_ease-in-out_infinite]" style={{ animationDelay: '2.9s' }} />
                            <div className="absolute top-[38%] left-[78%] w-0.5 h-0.5 bg-red-400 rounded-full animate-[blood-twinkle_4.7s_ease-in-out_infinite]" style={{ animationDelay: '1.1s' }} />

                            {/* Lower region blood stars */}
                            <div className="absolute bottom-[18%] left-[25%] w-0.5 h-0.5 bg-red-500 rounded-full animate-[blood-twinkle_3.9s_ease-in-out_infinite]" style={{ animationDelay: '1.4s' }} />
                            <div className="absolute bottom-[15%] right-[40%] w-0.5 h-0.5 bg-red-300 rounded-full animate-[blood-twinkle_4.4s_ease-in-out_infinite]" style={{ animationDelay: '2.6s' }} />
                            <div className="absolute bottom-[22%] left-[72%] w-1 h-1 bg-red-200 rounded-full animate-[blood-twinkle_3.7s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }} />
                            <div className="absolute bottom-[12%] right-[15%] w-0.5 h-0.5 bg-red-600 rounded-full animate-[blood-twinkle_5.1s_ease-in-out_infinite]" style={{ animationDelay: '1.9s' }} />
                        </div>

                        {/* Inner Crimson Core - Pulsing blood heart */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[radial-gradient(circle,rgba(239,68,68,0.5)_0%,rgba(220,38,38,0.3)_40%,rgba(185,28,28,0.2)_70%,transparent_100%)] animate-[blood-core_3.5s_ease-in-out_infinite] rounded-full blur-sm" />
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
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-none">
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

