"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { AnomalyCard } from "@/components/feed/anomaly-card";
import { AiInsightPick, Anomaly } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X, Box, Layers, Zap } from "lucide-react";

const PAGE_SIZE = 20;

type TradesResponse = {
  trades: Anomaly[];
  count: number;
  top20Wallets?: number;
  period?: string | null;
  snapshotAt?: string | null;
  since?: string;
  note?: string;
  wallet?: string;
  walletAddress?: string;
};

interface AiInsightsTradesModalProps {
  pick: AiInsightPick | null;
  trader?: {
    walletAddress: string;
    displayName?: string | null;
    rank?: number;
    totalPnl?: number;
    outcomeVolumeUsd?: number;
  } | null;
  onClose: () => void;
}

export function AiInsightsTradesModal({ pick, trader = null, onClose }: AiInsightsTradesModalProps) {
  const isOpen = Boolean(pick || trader);
  const isWalletMode = Boolean(trader);
  const [trades, setTrades] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<TradesResponse | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!isOpen || (!pick && !trader)) return;

    const controller = new AbortController();
    const params = new URLSearchParams();

    // If pick is available, always filter by it (even in wallet mode)
    if (pick) {
      if (pick.conditionId) params.set("conditionId", pick.conditionId);
      if (pick.outcome) params.set("outcome", pick.outcome);
    }

    if (isWalletMode && trader?.walletAddress) {
      params.set("wallet", trader.walletAddress);
    }

    setTrades([]);
    setMeta(null);
    setIsLoading(true);
    setError(null);
    setVisibleCount(PAGE_SIZE);

    const endpoint = pick ? "/api/ai-insights/trades" : (isWalletMode ? "/api/wallet-trades" : "/api/ai-insights/trades");

    fetch(`${endpoint}?${params.toString()}`, { signal: controller.signal })
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
        const fallback = isWalletMode ? "Failed to load wallet trades" : "Failed to load trades";
        setError(err.message || fallback);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isOpen, pick?.conditionId, pick?.outcome, trader?.walletAddress, isWalletMode, pick]);

  const headerTitle = isWalletMode
    ? (trader?.displayName || (trader?.walletAddress
      ? `${trader.walletAddress.slice(0, 6)}...${trader.walletAddress.slice(-4)}`
      : "Unknown wallet"))
    : pick?.eventTitle || "Unknown market";

  const headerOutcome = isWalletMode
    ? (pick?.outcome ? `Trading ${pick.outcome} · Rank #${trader?.rank ?? '-'}` : (trader?.rank ? `Rank #${trader.rank}` : "Last 24h trades"))
    : pick?.outcome || "Outcome";

  const kicker = isWalletMode ? "Wallet trades · Last 24h" : "Top-20 wallet trades · Last 24h";

  const emptyMessage = isWalletMode
    ? (pick ? `No trades found for this wallet on ${pick.outcome}.` : "No trades from this wallet in the last 24h.")
    : "No recent top-20 trades for this outcome in the last 24h.";

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

  const visibleTrades = useMemo(
    () => sortedTrades.slice(0, visibleCount),
    [sortedTrades, visibleCount]
  );

  const hasMore = visibleCount < sortedTrades.length;

  useEffect(() => {
    setVisibleCount((prev) => {
      if (sortedTrades.length === 0) return 0;
      return Math.min(Math.max(prev, PAGE_SIZE), sortedTrades.length);
    });
  }, [sortedTrades.length]);

  const lastTradeRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedTrades.length));
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [hasMore, isLoading, sortedTrades.length]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-5xl w-full !bg-zinc-950/80 !backdrop-blur-3xl !border-white/10 shadow-[0_0_100px_rgba(16,185,129,0.05)] p-0 overflow-hidden"
    >
      {/* Decorative gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none translate-y-1/2 -translate-x-1/2" />

      {/* Header Section */}
      <div className="relative z-10 p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
        <div className="flex flex-col gap-1 relative">
          {/* Top Line Meta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              </span>
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 font-bold font-mono">
                {kicker}
              </p>
            </div>

            {!isLoading && (
              <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                {meta?.top20Wallets !== undefined && !isWalletMode && (
                  <span>{meta.top20Wallets} Wallets Scanned</span>
                )}
                {meta?.since && isWalletMode && (
                  <span>Since {new Date(meta.since).toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-6 mt-2">
            <div className="space-y-1 min-w-0 flex-1">
              <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-500 uppercase tracking-tight leading-[0.9] line-clamp-2">
                {headerTitle}{isWalletMode && typeof trader?.outcomeVolumeUsd === 'number' && (
                  <span className="text-xl text-zinc-500 font-medium ml-2 align-middle">
                    · ${new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(trader.outcomeVolumeUsd)}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 text-zinc-400">
                <Layers className="w-3.5 h-3.5" />
                <p className="text-sm font-medium tracking-wide line-clamp-1">{headerOutcome}</p>
              </div>
            </div>

            {/* Right side stats */}
            <div className="shrink-0 text-right">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-500/50 h-10">
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span className="tracking-widest">SYNCING...</span>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white tracking-tighter">
                      {trades.length}
                    </span>
                    <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-1">TXs</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col h-[65vh]">
        {/* Alerts Area */}
        {error && (
          <div className="mx-6 mt-6 p-4 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-200 text-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 font-bold mb-1">
              <Zap className="w-4 h-4 text-rose-500" />
              ERROR
            </div>
            {error}
          </div>
        )}

        {note && !error && (
          <div className="mx-6 mt-6 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-200 text-sm backdrop-blur-sm flex items-start gap-2">
            <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0" />
            <span className="font-mono text-xs">{note}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[160px] rounded-xl border border-white/5 bg-white/5 animate-pulse relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && !error && trades.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 min-h-[300px]">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                <Box className="w-8 h-8 opacity-30" />
              </div>
              <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-70 max-w-[200px] text-center leading-relaxed">
                {emptyMessage}
              </p>
            </div>
          )}

          {!isLoading && trades.length > 0 && (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {visibleTrades.map((trade, i) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(i * 0.05, 0.5),
                      ease: "easeOut"
                    }}
                  >
                    <AnomalyCard anomaly={trade} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {hasMore && (
                <div
                  ref={lastTradeRef}
                  className="h-10 w-full rounded-lg border border-white/5 bg-white/5 text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center justify-center"
                >
                  {isLoading ? "Loading..." : "Loading more trades..."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 bg-black/40 backdrop-blur-xl flex justify-between items-center text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
            AI_INSIGHTS_V2.0
          </div>
          <div>RTDS_STREAM_ACTIVE</div>
        </div>
      </div>
    </Modal>
  );
}
