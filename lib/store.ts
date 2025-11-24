import { create } from 'zustand';
import { Anomaly, startFirehose, UserPreferences } from './market-stream';

interface Preferences {
  showStandard: boolean;
  showWhale: boolean;
  showMegaWhale: boolean;
  showSuperWhale: boolean;
  showGodWhale: boolean;
  minValueThreshold: number;
}

const DEFAULT_PREFERENCES: Preferences = {
  showStandard: true,
  showWhale: true,
  showMegaWhale: true,
  showSuperWhale: true,
  showGodWhale: true,
  minValueThreshold: 0,
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

type TopTradesPeriod = 'today' | 'weekly' | 'monthly' | 'yearly' | 'max';

interface TopTradesResponse {
  period: TopTradesPeriod;
  count: number;
  trades: Anomaly[];
  nextCursor?: string;
}

interface HistoryResponse {
  trades: Anomaly[];
  nextCursor?: string;
}

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
  selectedPeriod: 'weekly',
  nextCursor: undefined,
  hasMore: true,

  addAnomaly: (anomaly) => set((state) => ({
    // Append new anomaly to the front. Limit strictly to 2000 to allow for history but prevent memory leak
    anomalies: [anomaly, ...state.anomalies].slice(0, 2000), 
    volume: state.volume + anomaly.value,
    tickerItems: [`${anomaly.event} ${anomaly.type === 'GOD_WHALE' || anomaly.type === 'SUPER_WHALE' || anomaly.type === 'MEGA_WHALE' ? 'WHALE' : 'TRADE'} $${(anomaly.value / 1000).toFixed(1)}k`, ...state.tickerItems].slice(0, 20)
  })),
  loadHistory: async (cursor) => {
    if (!cursor) {
        set({ isLoading: true, anomalies: [], historyCursor: undefined, hasMoreHistory: true });
    } else {
        set({ isLoading: true });
    }

    try {
      const url = new URL('/api/history', window.location.origin);
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }
      url.searchParams.set('limit', '100');

      const response = await fetch(url.toString());
      if (response.ok) {
        const data: HistoryResponse = await response.json();
        
        set((state) => ({
          // If cursor exists, we are appending to the end (older data). 
          // If no cursor (initial load), we replace.
          // Wait, previous implementation prepended history? 
          // "anomalies: [...historicalAnomalies, ...state.anomalies]"
          // Usually history API returns descending by time (newest first).
          // So if we fetch initial history, it should be the *base* content.
          // If we fetch *more* history (older), we append to the end.
          anomalies: cursor ? [...state.anomalies, ...data.trades] : data.trades,
          isLoading: false,
          historyCursor: data.nextCursor,
          hasMoreHistory: !!data.nextCursor
        }));
      } else {
        set({ isLoading: false });
      }
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

    // Start the WebSocket Firehose with preferences getter
    const cleanup = startFirehose((anomaly) => {
      get().addAnomaly(anomaly);
    }, getPreferences);
    return cleanup;
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
      const url = new URL('/api/top-trades', window.location.origin);
      url.searchParams.set('period', period);
      url.searchParams.set('limit', '100');
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        const data: TopTradesResponse = await response.json();

        set((state) => ({
          topTrades: cursor ? [...state.topTrades, ...data.trades] : data.trades,
          selectedPeriod: period,
          topTradesLoading: false,
          nextCursor: data.nextCursor,
          hasMore: !!data.nextCursor
        }));
      } else {
        console.error('Failed to fetch top trades');
        set({ topTradesLoading: false });
      }
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
  }
}));
