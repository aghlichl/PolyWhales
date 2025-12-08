"use client";

import React, { useMemo, useState } from "react";
import { useAiInsights } from "@/lib/useAiInsights";
import { AiInsightPick } from "@/lib/types";
import { cn, formatShortNumber } from "@/lib/utils";
import { NumericDisplay } from "@/components/ui/numeric-display";
import { RefreshCw, Zap } from "lucide-react";

type SortKey = "confidence" | "support" | "volume";

const formatPct = (value: number) => `${Math.round(value * 100)}%`;

const formatUsdCompact = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `$${formatShortNumber(value)}`;
};

const formatCountCompact = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return formatShortNumber(value);
};

const heatClass = (score: number) => {
  if (score >= 85) return "from-emerald-400/80 via-cyan-400/70 to-blue-500/60";
  if (score >= 65) return "from-amber-400/80 via-orange-400/70 to-pink-500/60";
  return "from-rose-500/80 via-orange-500/70 to-amber-400/60";
};

const stanceBadge = (pick: AiInsightPick) =>
  pick.stance === "bullish"
    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-100"
    : "bg-rose-500/15 border-rose-500/40 text-rose-100";

export function AIInsightsPanel() {
  const { data, isLoading, error, refresh } = useAiInsights(90_000);
  const [sortKey, setSortKey] = useState<SortKey>("confidence");

  const sortedPicks = useMemo(() => {
    if (!data?.picks) return [];
    const picks = [...data.picks];
    picks.sort((a, b) => {
      if (sortKey === "volume") return b.totalVolume - a.totalVolume;
      if (sortKey === "support") return b.top20Support - a.top20Support;
      return b.confidence - a.confidence;
    });
    return picks.slice(0, 30); // keep panel tight
  }, [data?.picks, sortKey]);

  const topStrip = data?.topPicks ?? [];

  return (
    <div className="relative space-y-4">
      <div className="absolute inset-x-0 -top-6 h-20 bg-emerald-500/10 blur-3xl" />
      <div className="relative rounded-2xl border border-emerald-500/10 bg-linear-to-b from-zinc-950/80 via-zinc-950/50 to-zinc-950/80 shadow-[0_10px_50px_-25px_rgba(16,185,129,0.45)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/20 bg-linear-to-r from-emerald-500/5 via-transparent to-emerald-500/5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/80 flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-300 animate-pulse" />
              AI Insights
            </p>
            <p className="text-xs text-zinc-500">
              Last 24h | {formatCountCompact(data?.summary.uniqueMarkets)} markets scanned
            </p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/70 hover:bg-emerald-500/15 transition-all"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Sync
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryChip
              label="Total Volume"
              value={<NumericDisplay value={formatUsdCompact(data?.summary.totalVolume)} size="lg" variant="bold" />}
              hint="24h tracked"
            />
            <SummaryChip
              label="Top 20 Share"
              value={<span className="text-emerald-200 font-semibold">{formatPct(data?.summary.top20VolumeShare ?? 0)}</span>}
              hint="Volume owned by ranked wallets"
            />
            <SummaryChip
              label="Signals"
              value={<span className="text-emerald-200 font-semibold">{formatCountCompact(data?.picks?.length ?? 0)} picks</span>}
              hint="Ranked by confidence"
            />
          </div>

          {/* Top strip cards */}
          {topStrip.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                <span>Plays to watch</span>
                <span className="text-emerald-300/80">Top consensus</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {topStrip.map((pick, index) => (
                  <div
                    key={pick.id}
                    className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-zinc-900/60 p-3 shadow-[0_10px_30px_-20px_rgba(16,185,129,0.6)]"
                  >
                    <div className="absolute inset-0 bg-linear-to-r from-emerald-500/10 via-cyan-500/5 to-transparent opacity-70 pointer-events-none" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg border border-emerald-400/40 bg-emerald-500/10 flex items-center justify-center text-emerald-200 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-emerald-100 line-clamp-1">{pick.eventTitle || "Unknown market"}</p>
                        <p className="text-[11px] text-zinc-500 line-clamp-1">{pick.outcome || "Outcome"}</p>
                        <div className="mt-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={cn("h-full bg-linear-to-r", heatClass(pick.confidence))}
                            style={{ width: `${pick.confidence}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-200">{pick.confidence}%</div>
                        <div className="text-[11px] text-zinc-500">
                          {pick.stance.toUpperCase()} · {formatPct(pick.top20Support)} top20
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sorting toggles */}
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-zinc-500 px-1">
            <span>Quant table</span>
            <div className="flex gap-2">
              {(["confidence", "support", "volume"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-[11px] transition-all",
                    sortKey === key
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                      : "border-zinc-700 bg-zinc-900/70 text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-100"
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="space-y-2">
            {isLoading && <SkeletonRows />}
            {!isLoading && error && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                {error}
              </div>
            )}
            {!isLoading && !error && sortedPicks.length === 0 && (
              <div className="text-center text-zinc-600 py-10 border border-dashed border-zinc-800 rounded-xl">
                No signals yet. Waiting for smart money...
              </div>
            )}

            {!isLoading &&
              sortedPicks.map((pick) => (
                <div
                  key={pick.id}
                  className="relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/50 hover:border-emerald-400/50 transition-all group"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-linear-to-r from-emerald-500/8 via-cyan-500/6 to-transparent blur-xl transition-opacity" />
                  <div className="relative grid grid-cols-[1.2fr_0.9fr_0.8fr_0.6fr_0.5fr] gap-3 items-center px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-emerald-100 line-clamp-1">{pick.eventTitle || "Unknown market"}</p>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">{pick.outcome || "Outcome"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn("text-[10px] px-2 py-1 rounded-full border", stanceBadge(pick))}>
                          {pick.stance.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {formatCountCompact(pick.top20WalletCount)} top20 wallets · rank {pick.bestRank ?? "—"}
                        </span>
                      </div>
                    </div>

                    <ConfidenceCell value={pick.confidence} />

                    <SupportCell support={pick.top20Support} skew={pick.buySellSkew} />

                    <div className="text-right">
                      <div className="text-sm text-zinc-200">
                        <NumericDisplay value={formatUsdCompact(pick.totalVolume)} size="md" />
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {formatCountCompact(pick.tradeCount)} trades · {formatPct(pick.top20Volume / Math.max(pick.totalVolume, 1e-9))}
                      </div>
                    </div>

                    <div className="text-right text-sm text-emerald-200 font-semibold">
                      {pick.bestRank ? `#${pick.bestRank}` : "—"}
                      <div className="text-[10px] text-zinc-500">best rank</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-zinc-900/60 px-3 py-2 shadow-[0_6px_20px_-12px_rgba(16,185,129,0.5)]">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <div className="text-lg leading-tight">{value}</div>
      <p className="text-[10px] text-zinc-600">{hint}</p>
    </div>
  );
}

function ConfidenceCell({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>Confidence</span>
        <span className="text-emerald-200 font-semibold">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden shadow-inner">
        <div className={cn("h-full bg-linear-to-r", heatClass(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SupportCell({ support, skew }: { support: number; skew: number }) {
  const bullish = skew >= 0.5;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>Top20 Weight</span>
        <span className="text-emerald-200 font-semibold">{formatPct(support)}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex">
        <div
          className={cn("h-full bg-emerald-400/80", bullish ? "" : "bg-rose-400/80")}
          style={{ width: `${Math.max(12, support * 100)}%` }}
        />
        <div className="flex-1 bg-transparent" />
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{bullish ? "BUY skew" : "SELL skew"}</span>
        <span>{Math.round(skew * 100)}% buy</span>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="h-[86px] rounded-xl border border-zinc-800/60 bg-zinc-900/60 animate-pulse"
        />
      ))}
    </div>
  );
}
