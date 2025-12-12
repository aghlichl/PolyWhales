import { useEffect, useState } from "react";
import type { Anomaly } from "./types";
import type { FilterState } from "@/components/search-button";

/**
 * Normalize text for case-insensitive searching
 */
export function normalizeText(text: string | null | undefined): string {
    return (text || "").toLowerCase().trim();
}

/**
 * Tokenize a search query into individual searchable terms
 */
export function tokenize(query: string): string[] {
    return normalizeText(query)
        .split(/\s+/)
        .filter(token => token.length > 0);
}

/**
 * Check if searchable text matches all tokens in the query
 * Returns true if ALL tokens are found in the searchable text
 */
export function matchesQuery(searchableText: string, query: string): boolean {
    if (!query.trim()) return true;

    const normalized = normalizeText(searchableText);
    const tokens = tokenize(query);

    return tokens.every(token => normalized.includes(token));
}

/**
 * Apply whale filters (Tier/Side/League) to anomalies
 */
export function applyWhaleFilters(
    anomalies: Anomaly[],
    filters: FilterState
): Anomaly[] {
    let filtered = anomalies;

    // Filter by tiers
    if (filters.tiers.length > 0) {
        filtered = filtered.filter(anomaly => filters.tiers.includes(anomaly.type));
    }

    // Filter by sides
    if (filters.sides.length > 0) {
        filtered = filtered.filter(anomaly => filters.sides.includes(anomaly.side));
    }

    // Filter by leagues
    if (filters.leagues.length > 0) {
        filtered = filtered.filter(anomaly => {
            const league = anomaly.league || anomaly.analysis?.market_context?.league;
            return league && filters.leagues.includes(league);
        });
    }

    return filtered;
}

/**
 * Apply search query to anomalies (TopWhales)
 * Searches across event name, outcome, league, and event title
 */
export function applyWhaleSearch(anomalies: Anomaly[], query: string): Anomaly[] {
    if (!query.trim()) return anomalies;

    return anomalies.filter(anomaly => {
        const searchableFields = [
            anomaly.event,
            anomaly.outcome,
            anomaly.league,
            anomaly.analysis?.market_context?.league,
            anomaly.eventTitle,
            anomaly.analysis?.event?.title,
            anomaly.sport,
            anomaly.analysis?.market_context?.sport,
        ].filter(Boolean).join(" ");

        return matchesQuery(searchableFields, query);
    });
}

/**
 * Apply search query to traders (TopTraders)
 * Searches across account name and wallet address
 */
export function applyTraderSearch<T extends { accountName: string | null; walletAddress: string }>(
    traders: T[],
    query: string
): T[] {
    if (!query.trim()) return traders;

    return traders.filter(trader => {
        const searchableFields = [
            trader.accountName,
            trader.walletAddress,
        ].filter(Boolean).join(" ");

        return matchesQuery(searchableFields, query);
    });
}

/**
 * Apply search query to winners (BiggestWinners)
 * Searches across username, proxy wallet, and event title
 */
export function applyWinnerSearch<T extends {
    userName?: string | null;
    proxyWallet: string;
    eventTitle?: string | null;
}>(
    winners: T[],
    query: string
): T[] {
    if (!query.trim()) return winners;

    return winners.filter(winner => {
        const searchableFields = [
            winner.userName,
            winner.proxyWallet,
            winner.eventTitle,
        ].filter(Boolean).join(" ");

        return matchesQuery(searchableFields, query);
    });
}

/**
 * React hook for debouncing a value
 * @param value The value to debounce
 * @param delay Delay in milliseconds (default: 200ms)
 */
export function useDebounce<T>(value: T, delay: number = 200): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
