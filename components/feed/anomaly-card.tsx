import { Anomaly } from "@/lib/market-stream";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";

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
    const { event: title, value, outcome, odds, type, multiplier, zScore, timestamp, isContra } = anomaly;
    const amount = `$${Math.round(value).toLocaleString()}`;
    const bet = `${outcome} | ${odds}¢`;
    const isMega = type === 'MEGA_WHALE';
    const isWhale = type === 'WHALE';
    const isBadgeMega = zScore > 10;
    const isBadgeWhale = zScore > 2;
    
    return (
        <Card className={cn(
            "relative p-4 border-2 transition-all duration-300 group",
            isMega ? "border-purple-500 bg-purple-950/10 shadow-xl shadow-purple-500/40 animate-pulse-glow-purple" :
            isWhale ? "border-blue-500 bg-blue-950/10 shadow-lg shadow-blue-500/25 animate-pulse-glow" :
            "border-zinc-500 bg-zinc-950/50"
        )}>
            {/* Timestamp overlay - appears on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 backdrop-blur-sm rounded-lg z-10">
                <div className="text-sm font-mono text-zinc-200 font-bold">
                    {new Date(timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    })}
                </div>
            </div>

            <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-medium text-zinc-200 line-clamp-2 flex-1 mr-4" title={title}>
                    {title}
                </h3>
                <div className="text-lg font-bold text-emerald-400 font-mono whitespace-nowrap">
                    {amount}
                </div>
            </div>

            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <div className="text-sm font-mono text-zinc-300 bg-zinc-800/50 px-2 py-1 rounded">
                        {bet}
                    </div>
                </div>

                <div className="flex flex-col items-end">
                    {isContra && (
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">
                            CONTRA
                        </span>
                    )}
                    <div className={cn(
                        "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                        isBadgeMega ? "bg-purple-500/20 text-purple-400" :
                        isBadgeWhale ? "bg-blue-500/20 text-blue-400" :
                        "bg-zinc-500/20 text-zinc-400"
                    )}>
                        {isBadgeMega && <Flame size={12} />}
                        <span>{multiplier}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

