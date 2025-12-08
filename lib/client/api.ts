import { Anomaly } from "../types";

export type TopTradesPeriod = "today" | "weekly" | "monthly" | "yearly" | "max";

export interface TopTradesResponse {
  period: TopTradesPeriod;
  count: number;
  trades: Anomaly[];
  nextCursor?: string;
}

export interface HistoryResponse {
  trades: Anomaly[];
  nextCursor?: string;
}

export interface LeaderboardRank {
  period: string;
  rank: number;
  totalPnl: number;
  accountName?: string | null;
  rankChange?: number | null;
}

export type LeaderboardResponse = Record<string, LeaderboardRank[]>;

const ensureOrigin = (origin?: string) => {
  if (origin) return origin;
  if (typeof window !== "undefined") return window.location.origin;
  throw new Error("Origin is required when window is undefined");
};

export async function fetchHistory({
  cursor,
  limit = 100,
  origin,
}: {
  cursor?: string;
  limit?: number;
  origin?: string;
}): Promise<HistoryResponse> {
  const base = ensureOrigin(origin);
  const url = new URL("/api/history", base);
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }

  return response.json() as Promise<HistoryResponse>;
}

export async function fetchTopTrades({
  period,
  cursor,
  limit = 100,
  origin,
}: {
  period: TopTradesPeriod;
  cursor?: string;
  limit?: number;
  origin?: string;
}): Promise<TopTradesResponse> {
  const base = ensureOrigin(origin);
  const url = new URL("/api/top-trades", base);
  url.searchParams.set("period", period);
  url.searchParams.set("limit", String(limit));
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch top trades: ${response.statusText}`);
  }

  return response.json() as Promise<TopTradesResponse>;
}

export async function fetchLeaderboardRanks(origin?: string): Promise<LeaderboardResponse> {
  const base = ensureOrigin(origin);
  const url = new URL("/api/leaderboard", base);
  url.searchParams.set("format", "snapshots");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard ranks: ${response.statusText}`);
  }

  return response.json() as Promise<LeaderboardResponse>;
}
