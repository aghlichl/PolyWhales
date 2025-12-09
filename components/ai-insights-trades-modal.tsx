"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { AiInsightPick, Anomaly } from "@/lib/types";
import { cn } from "@/lib/utils";

type TradesResponse = {
  trades: Anomaly[];
  count: number;
  top20Wallets?: number;
  period?: string | null;
  snapshotAt?: string | null;
  since?: string;
  note?: string;
};

interface AiInsightsTradesModalProps {
  pick: AiInsightPick | null;
  onClose: () => void;
}

export function AiInsightsTradesModal({ pick, onClose }: AiInsightsTradesModalProps) {
  const isOpen = Boolean(pick);
  const [trades, setTrades] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<TradesResponse | null>(null);

  useEffect(() => {
    if (!isOpen || !pick) return;

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (pick.conditionId) params.set("conditionId", pick.conditionId);
    if (pick.outcome) params.set("outcome", pick.outcome);

    setIsLoading(true);
    setError(null);

    fetch(`/api/ai-insights/trades?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || `Request failed (${res.status})`);
        }
        return res.json() as Promise<TradesResponse>;
      })
      .then((json) => {
        setTrades(json.trades || []);
        setMeta(json);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load trades");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isOpen, pick?.conditionId, pick?.outcome]);

  const headerTitle = pick?.eventTitle || "Unknown market";
  const headerOutcome = pick?.outcome || "Outcome";

  const note = useMemo(() => {
    if (error) return null;
    if (meta?.note) return meta.note;
    if (meta?.top20Wallets === 0) return "No leaderboard snapshot available.";
    return null;
  }, [error, meta]);

  const sortedTrades = useMemo(
    () => trades.slice().sort((a, b) => b.value - a.value),
    [trades]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-5xl w-full border-emerald-500/30">
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
              Top-20 wallet trades · Last 24h
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-emerald-50 leading-tight line-clamp-2">
              {headerTitle}
            </h2>
            <p className="text-sm text-zinc-400 line-clamp-1">{headerOutcome}</p>
          </div>
          <div className="text-right text-sm text-zinc-400">
            {isLoading ? (
              <span className="animate-pulse text-emerald-200">Loading…</span>
            ) : (
              <div className="space-y-1">
                <div className="text-emerald-200 font-semibold">
                  {trades.length} trade{trades.length === 1 ? "" : "s"}
                </div>
                {meta?.top20Wallets !== undefined && (
                  <div className="text-[11px] text-zinc-500">
                    {meta.top20Wallets} wallets considered{meta.period ? ` · ${meta.period}` : ""}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-100 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {note && !error && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-100 text-sm px-3 py-2">
            {note}
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[140px] rounded-xl border border-emerald-500/20 bg-emerald-500/5 animate-pulse"
                />
              ))}
            </div>
          )}

          {!isLoading && !error && trades.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-10 text-center text-sm text-zinc-400">
              No recent top-20 trades for this outcome in the last 24h.
            </div>
          )}

          {!isLoading && trades.length > 0 && (
            <div className="space-y-3">
              {sortedTrades.map((trade) => (
                <AnomalyCard key={trade.id} anomaly={trade} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
