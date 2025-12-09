'use client';

import { useCallback, useEffect, useState } from "react";
import { AiInsightsResponse } from "./types";

type UseAiInsightsResult = {
  data?: AiInsightsResponse;
  isLoading: boolean;
  error?: string | null;
  refresh: () => Promise<void>;
};

export function useAiInsights(refreshMs = 60_000): UseAiInsightsResult {
  const [data, setData] = useState<AiInsightsResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(
    async (isActive?: () => boolean) => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/ai-insights", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load AI insights (${res.status})`);
        }
        const json: AiInsightsResponse = await res.json();
        if (isActive && !isActive()) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (isActive && !isActive()) return;
        const message = err instanceof Error ? err.message : "Failed to load AI insights";
        setError(message);
      } finally {
        if (!isActive || isActive()) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    const isActive = () => active;

    fetchInsights(isActive);

    let interval: ReturnType<typeof setInterval> | undefined;
    if (refreshMs) {
      interval = setInterval(() => fetchInsights(isActive), refreshMs);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [fetchInsights, refreshMs]);

  const refresh = useCallback(async () => {
    await fetchInsights(() => true);
  }, [fetchInsights]);

  return { data, isLoading, error, refresh };
}


