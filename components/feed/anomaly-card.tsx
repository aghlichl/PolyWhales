import { Anomaly } from "@/lib/market-stream";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface AnomalyCardProps {
    title: string;
    amount: string;
    bet: string;
    type: string;
    multiplier: string;
    isContra?: boolean;
}

export function convertAnomalyToCardProps(anomaly: Anomaly): AnomalyCardProps {
    return {
        title: anomaly.event,
        amount: `$${Math.round(anomaly.value).toLocaleString()}`,
        bet: `${anomaly.outcome} | ${anomaly.odds}¢`,
        type: anomaly.type,
        multiplier: anomaly.multiplier,
        isContra: anomaly.isContra
    };
}

export function AnomalyCard({ title, amount, bet, type, multiplier, isContra }: AnomalyCardProps) {
    const isMega = type === 'MEGA_WHALE';
    const isWhale = type === 'WHALE';
    
    return (
        <Card className={cn(
            "p-4 border-2 transition-all duration-300",
            isMega ? "border-purple-500 bg-purple-950/10 shadow-lg shadow-purple-500/30 animate-shake" :
            isWhale ? "border-blue-500 bg-blue-950/10 shadow-lg shadow-blue-500/25 animate-pulse-glow" :
            "border-zinc-500 bg-zinc-950/50"
        )}>
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
                    <div className="text-xs text-zinc-500 font-mono uppercase mb-1">Bet</div>
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
                        isMega ? "bg-purple-500/20 text-purple-400" :
                        isWhale ? "bg-blue-500/20 text-blue-400" :
                        "bg-zinc-500/20 text-zinc-400"
                    )}>
                        {isMega && <Flame size={12} />}
                        <span>{type.replace('_', ' ')}</span>
                        <span className="opacity-50">|</span>
                        <span>{multiplier}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

