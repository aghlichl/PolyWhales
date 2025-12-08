import { create } from 'zustand';
import { io } from 'socket.io-client';
import { enrichedTradeToAnomaly } from './domain/trades';
import {
  fetchHistory as fetchHistoryApi,
  fetchTopTrades as fetchTopTradesApi,
  fetchLeaderboardRanks as fetchLeaderboardRanksApi,
  TopTradesPeriod,
  HistoryResponse,
  TopTradesResponse,
  LeaderboardRank
} from './client/api';
import { Anomaly, UserPreferences, EnrichedTrade } from './types';
import { clientEnv } from './env';

// Helper function to get top 20 wallet addresses from leaderboard ranks
export function getTop20Wallets(leaderboardRanks: Record<string, LeaderboardRank[]>): Set<string> {
  const wallets: Array<{ address: string; bestRank: number }> = [];

  // For each wallet, find their best (lowest) rank across all periods
  for (const [address, ranks] of Object.entries(leaderboardRanks)) {
    if (!ranks || ranks.length === 0) continue;

    const bestRank = Math.min(...ranks.map(r => r.rank));
    wallets.push({ address: address.toLowerCase(), bestRank });
  }

  // Sort by best rank (ascending) and take top 20
  wallets.sort((a, b) => a.bestRank - b.bestRank);
  const top20 = wallets.slice(0, 20);

  return new Set(top20.map(w => w.address));
}

// Helper function to check if anomaly passes user preferences
function passesPreferences(
  anomaly: Anomaly,
  preferences?: UserPreferences,
  top20Wallets?: Set<string>
): boolean {
  if (!preferences) return true; // No preferences means show all

  // Check minimum value threshold
  if (anomaly.value < preferences.minValueThreshold) return false;

  // Check odds range
  if (anomaly.odds < preferences.minOdds || anomaly.odds > preferences.maxOdds) return false;

  // Check top players filter
  if (preferences.filterTopPlayersOnly) {
    if (!top20Wallets || top20Wallets.size === 0) {
      // If leaderboard data not loaded yet, don't filter (show all)
      // This prevents hiding everything while data loads
      return true;
    }
    const walletAddress = anomaly.wallet_context?.address?.toLowerCase();
    if (!walletAddress || !top20Wallets.has(walletAddress)) {
      return false;
    }
  }

  // Check anomaly type filters
  switch (anomaly.type) {
    case 'STANDARD':
      return preferences.showStandard;
    case 'WHALE':
      return preferences.showWhale;
    case 'MEGA_WHALE':
      return preferences.showMegaWhale;
    case 'SUPER_WHALE':
      return preferences.showSuperWhale;
    case 'GOD_WHALE':
      return preferences.showGodWhale;
    default:
      return true;
  }
}

interface Preferences {
  showStandard: boolean;
  showWhale: boolean;
  showMegaWhale: boolean;
  showSuperWhale: boolean;
  showGodWhale: boolean;
  showSports: boolean;
  minValueThreshold: number;
  minOdds: number;
  maxOdds: number;
  filterTopPlayersOnly: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  showStandard: true,
  showWhale: true,
  showMegaWhale: true,
  showSuperWhale: true,
  showGodWhale: true,
  showSports: true,
  minValueThreshold: 0,
  minOdds: 1,
  maxOdds: 99,
  filterTopPlayersOnly: false,
};

interface PreferencesStore {
  preferences: Preferences;
  isLoaded: boolean;
  setPreferences: (preferences: Partial<Preferences>) => void;
  loadPreferences: () => void;
  savePreferences: () => void;
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  isLoaded: false,
  setPreferences: (newPreferences) => {
    set((state) => ({
      preferences: { ...state.preferences, ...newPreferences }
    }));
    // Auto-save when preferences change (after initial load)
    if (get().isLoaded) {
      get().savePreferences();
    }
  },
  loadPreferences: () => {
    if (typeof window === 'undefined') return; // SSR safety

    const saved = localStorage.getItem('oddsGods-preferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        set({ preferences: { ...DEFAULT_PREFERENCES, ...parsed }, isLoaded: true });
      } catch (error) {
        console.warn('Failed to load preferences:', error);
        set({ preferences: DEFAULT_PREFERENCES, isLoaded: true });
      }
    } else {
      set({ preferences: DEFAULT_PREFERENCES, isLoaded: true });
    }
  },
  savePreferences: () => {
    if (typeof window === 'undefined') return; // SSR safety

    localStorage.setItem('oddsGods-preferences', JSON.stringify(get().preferences));
  }
}));

interface MarketStore {
  anomalies: Anomaly[];
  volume: number;
  tickerItems: string[];
  isLoading: boolean;
  addAnomaly: (anomaly: Anomaly) => void;
  loadHistory: (cursor?: string) => Promise<void>;
  loadMoreHistory: () => void;
  startStream: (getPreferences?: () => UserPreferences) => () => void;

  // History pagination state
  historyCursor?: string;
  hasMoreHistory: boolean;

  // Top trades functionality
  topTrades: Anomaly[];
  topTradesLoading: boolean;
  selectedPeriod: TopTradesPeriod;
  nextCursor?: string;
  hasMore: boolean;
  fetchTopTrades: (period: TopTradesPeriod, cursor?: string) => Promise<void>;
  loadMoreTopTrades: () => void;
  setSelectedPeriod: (period: TopTradesPeriod) => void;

  // Leaderboard ranks functionality
  leaderboardRanks: Record<string, LeaderboardRank[]>; // wallet (lowercase) -> ranks
  leaderboardRanksLoading: boolean;
  fetchLeaderboardRanks: () => Promise<void>;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  anomalies: [],
  volume: 0,
  tickerItems: [],
  isLoading: false,
  historyCursor: undefined,
  hasMoreHistory: true,

  // Top trades state
  topTrades: [],
  topTradesLoading: false,
  selectedPeriod: 'today',
  nextCursor: undefined,
  hasMore: true,

  // Leaderboard ranks state
  leaderboardRanks: {},
  leaderboardRanksLoading: false,

  addAnomaly: (anomaly) => set((state) => {
    // Check if anomaly already exists
    const existingIndex = state.anomalies.findIndex(a => a.id === anomaly.id);

    let newAnomalies;
    let newVolume = state.volume;
    let newTickerItems = state.tickerItems;

    if (existingIndex >= 0) {
      // Update existing anomaly - preserve wallet_context if new one is missing/empty
      const existing = state.anomalies[existingIndex];
      const updatedAnomaly = {
        ...anomaly,
        // Ensure wallet_context is always preserved
        wallet_context: (anomaly.wallet_context && anomaly.wallet_context.address)
          ? anomaly.wallet_context
          : (existing.wallet_context || anomaly.wallet_context || undefined),
      };
      newAnomalies = [...state.anomalies];
      newAnomalies[existingIndex] = updatedAnomaly;
      // Don't update volume/ticker for updates to avoid double counting
    } else {
      // Add new anomaly
      const newAnomaly = { ...anomaly, isNew: true };
      newAnomalies = [newAnomaly, ...state.anomalies].slice(0, 2000);
      newVolume += anomaly.value;
      newTickerItems = [`${anomaly.event} ${anomaly.type === 'GOD_WHALE' || anomaly.type === 'SUPER_WHALE' || anomaly.type === 'MEGA_WHALE' ? 'WHALE' : 'TRADE'} $${(anomaly.value / 1000).toFixed(1)}k`, ...state.tickerItems].slice(0, 20);
    }

    return {
      anomalies: newAnomalies,
      volume: newVolume,
      tickerItems: newTickerItems
    };
  }),
  loadHistory: async (cursor) => {
    if (!cursor) {
      // Keep current anomalies so the list doesn't disappear while fetching
      set({ isLoading: true, historyCursor: undefined, hasMoreHistory: true });
    } else {
      set({ isLoading: true });
    }

    try {
      const data: HistoryResponse = await fetchHistoryApi({ cursor, limit: 100 });

      set((state) => ({
        // Merge without clearing so live-streamed anomalies stay visible
        anomalies: (() => {
          const seen = new Set<string>();
          const combined = [...state.anomalies, ...data.trades];
          const merged: Anomaly[] = [];
          for (const item of combined) {
            if (seen.has(item.id)) continue;
            merged.push(item);
            seen.add(item.id);
          }
          return merged;
        })(),
        isLoading: false,
        historyCursor: data.nextCursor,
        hasMoreHistory: !!data.nextCursor
      }));
    } catch (error) {
      console.error('Failed to load historical data:', error);
      set({ isLoading: false });
    }
  },
  loadMoreHistory: () => {
    const { historyCursor, isLoading, hasMoreHistory } = get();
    if (!isLoading && hasMoreHistory && historyCursor) {
      get().loadHistory(historyCursor);
    }
  },
  startStream: (getPreferences) => {
    // Load historical data first
    get().loadHistory();

    // Connect to worker's Socket.io server instead of direct WebSocket
    const socket = io(clientEnv.socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[Store] Connected to worker Socket.io');
    });

    socket.on('disconnect', () => {
      console.log('[Store] Disconnected from worker Socket.io');
    });
    socket.on('trade', (enrichedTrade: EnrichedTrade) => {
      const anomaly = enrichedTradeToAnomaly(enrichedTrade);
      if (!anomaly) {
        console.warn('[STORE] Trade missing required fields, skipping');
        return;
      }

      if (anomaly.wallet_context) {
        console.log('[STORE] Created anomaly with wallet:', anomaly.wallet_context.address, 'label:', anomaly.wallet_context.label);
      } else {
        console.warn('[STORE] Anomaly missing wallet_context');
      }

      // Only add if it passes user preferences
      const currentPreferences = getPreferences?.();
      // Note: top20Wallets filtering is handled in app/page.tsx for display
      // We skip it here to avoid circular dependencies between stores
      if (!currentPreferences || passesPreferences(anomaly, currentPreferences)) {
        get().addAnomaly(anomaly);
      }
    });

    socket.on('error', (error) => {
      console.error('[Store] Socket.io error:', error);
    });

    return () => socket.disconnect();
  },

  // Top trades functions
  fetchTopTrades: async (period, cursor) => {
    // If no cursor (initial load), set loading state and reset list
    if (!cursor) {
      set({ topTradesLoading: true, topTrades: [], hasMore: true, nextCursor: undefined });
    } else {
      // If loading more, just set loading state
      set({ topTradesLoading: true });
    }

    try {
      const data: TopTradesResponse = await fetchTopTradesApi({ period, cursor, limit: 100 });

      set((state) => ({
        topTrades: cursor ? [...state.topTrades, ...data.trades] : data.trades,
        topTradesLoading: false,
        nextCursor: data.nextCursor,
        hasMore: !!data.nextCursor
      }));
    } catch (error) {
      console.error('Error fetching top trades:', error);
      set({ topTradesLoading: false });
    }
  },
  loadMoreTopTrades: () => {
    const { selectedPeriod, nextCursor, topTradesLoading, hasMore } = get();
    if (!topTradesLoading && hasMore && nextCursor) {
      get().fetchTopTrades(selectedPeriod, nextCursor);
    }
  },
  setSelectedPeriod: (period) => {
    set({ selectedPeriod: period });
    get().fetchTopTrades(period);
  },

  // Leaderboard ranks functions
  fetchLeaderboardRanks: async () => {
    // Don't refetch if already loading or if we have data
    const { leaderboardRanksLoading, leaderboardRanks } = get();
    if (leaderboardRanksLoading || Object.keys(leaderboardRanks).length > 0) {
      return;
    }

    set({ leaderboardRanksLoading: true });

    try {
      const data: Record<string, LeaderboardRank[]> = await fetchLeaderboardRanksApi();
      set({ leaderboardRanks: data, leaderboardRanksLoading: false });
    } catch (error) {
      console.error('Error fetching leaderboard ranks:', error);
      set({ leaderboardRanksLoading: false });
    }
  }
}));
