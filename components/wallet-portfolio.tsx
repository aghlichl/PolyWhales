"use client";

import { useEffect, useState } from "react";
import { GammaPortfolio, GammaPosition } from "@/lib/types";
import { cn, formatCurrency, formatShortNumber } from "@/lib/utils";

interface WalletPortfolioProps {
    walletAddress: string;
    className?: string;
}

export function WalletPortfolio({ walletAddress, className }: WalletPortfolioProps) {
    const [portfolio, setPortfolio] = useState<GammaPortfolio | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!walletAddress) return;

        setIsLoading(true);
        setError(null);

        fetch(`/api/portfolio?address=${walletAddress}`)
            .then(async (res) => {
                if (!res.ok) {
                    // If 404, just means no portfolio data found
                    if (res.status === 404) return null;
                    throw new Error("Failed to fetch portfolio");
                }
                return res.json();
            })
            .then((data) => {
                setPortfolio(data);
            })
            .catch((err) => {
                console.error("Error fetching portfolio:", err);
                setError("Failed to load portfolio");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [walletAddress]);

    if (isLoading) {
        return (
            <div className={cn("p-4 animate-pulse", className)}>
                <div className="h-4 w-32 bg-zinc-800 rounded mb-4"></div>
                <div className="space-y-2">
                    <div className="h-10 w-full bg-zinc-900 rounded"></div>
                    <div className="h-10 w-full bg-zinc-900 rounded"></div>
                    <div className="h-10 w-full bg-zinc-900 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !portfolio || portfolio.positions.length === 0) {
        return null; // Don't show anything if no data
    }

    // Sort positions by value (descending)
    const sortedPositions = [...portfolio.positions].sort((a, b) => b.value - a.value).slice(0, 5);

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div className="flex items-center justify-between">
                <h3 className="text-sm md:text-base font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-indigo-500 rounded-full" />
                    Current Portfolio
                </h3>
                <div className="text-xs text-zinc-500 font-mono">
                    Total Value: <span className="text-zinc-300 font-bold">{formatCurrency(portfolio.totalValue)}</span>
                </div>
            </div>

            <div className="bg-zinc-900/50 rounded border border-zinc-800 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-2 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                    <div className="col-span-6">Market</div>
                    <div className="col-span-2 text-right">Size</div>
                    <div className="col-span-2 text-right">Value</div>
                    <div className="col-span-2 text-right">PnL</div>
                </div>

                <div className="divide-y divide-zinc-800/50">
                    {sortedPositions.map((pos, idx) => (
                        <div key={`${pos.asset_id}-${idx}`} className="grid grid-cols-12 gap-2 p-2 text-xs hover:bg-white/5 transition-colors items-center">
                            <div className="col-span-6 min-w-0">
                                <div className="truncate font-medium text-zinc-300" title={pos.question}>
                                    {pos.question}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                                        pos.outcomeLabel === 'Yes' ? "bg-emerald-500/10 text-emerald-400" :
                                            pos.outcomeLabel === 'No' ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-400"
                                    )}>
                                        {pos.outcomeLabel}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">
                                        @ {pos.price.toFixed(1)}¢
                                    </span>
                                </div>
                            </div>
                            <div className="col-span-2 text-right font-mono text-zinc-400">
                                {formatShortNumber(pos.size)}
                            </div>
                            <div className="col-span-2 text-right font-mono text-zinc-300 font-bold">
                                {formatShortNumber(pos.value)}
                            </div>
                            <div className="col-span-2 text-right font-mono">
                                <div className={cn(
                                    "font-bold",
                                    pos.pnl > 0 ? "text-emerald-400" : pos.pnl < 0 ? "text-red-400" : "text-zinc-400"
                                )}>
                                    {pos.pnl > 0 ? '+' : ''}{formatShortNumber(pos.pnl)}
                                </div>
                                <div className={cn(
                                    "text-[10px]",
                                    pos.pnlPercent > 0 ? "text-emerald-500/70" : pos.pnlPercent < 0 ? "text-red-500/70" : "text-zinc-600"
                                )}>
                                    {pos.pnlPercent > 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {portfolio.positions.length > 5 && (
                    <div className="p-2 text-center border-t border-zinc-800 bg-zinc-900/30">
                        <span className="text-[10px] text-zinc-500 italic">
                            + {portfolio.positions.length - 5} more positions
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
