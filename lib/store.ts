import { create } from 'zustand';
import { Anomaly, startFirehose, UserPreferences } from './market-stream';

interface Preferences {
  showStandard: boolean;
  showWhale: boolean;
  showMegaWhale: boolean;
  minValueThreshold: number;
}

const DEFAULT_PREFERENCES: Preferences = {
  showStandard: true,
  showWhale: true,
  showMegaWhale: true,
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
}

interface MarketStore {
    anomalies: Anomaly[];
    volume: number;
    tickerItems: string[];
    isLoading: boolean;
    addAnomaly: (anomaly: Anomaly) => void;
    loadHistory: () => Promise<void>;
    startStream: (getPreferences?: () => UserPreferences) => () => void;

    // Top trades functionality
    topTrades: Anomaly[];
    topTradesLoading: boolean;
    selectedPeriod: TopTradesPeriod;
    fetchTopTrades: (period: TopTradesPeriod) => Promise<void>;
    setSelectedPeriod: (period: TopTradesPeriod) => void;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
    anomalies: [],
    volume: 0,
    tickerItems: [],
    isLoading: false,

    // Top trades state
    topTrades: [],
    topTradesLoading: false,
    selectedPeriod: 'weekly',
    addAnomaly: (anomaly) => set((state) => ({
        anomalies: [anomaly, ...state.anomalies].slice(0, 100), // Increased limit for historical + real-time
        volume: state.volume + anomaly.value,
        tickerItems: [`${anomaly.event} ${anomaly.type === 'MEGA_WHALE' ? 'WHALE' : 'TRADE'} $${(anomaly.value / 1000).toFixed(1)}k`, ...state.tickerItems].slice(0, 20)
    })),
    loadHistory: async () => {
        set({ isLoading: true });
        try {
            const response = await fetch('/api/history');
            if (response.ok) {
                const historicalAnomalies: Anomaly[] = await response.json();
                set((state) => ({
                    anomalies: [...historicalAnomalies, ...state.anomalies],
                    isLoading: false,
                }));
            }
        } catch (error) {
            console.error('Failed to load historical data:', error);
            set({ isLoading: false });
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
    fetchTopTrades: async (period) => {
        set({ topTradesLoading: true });
        try {
            const response = await fetch(`/api/top-trades?period=${period}`);
            if (response.ok) {
                const data: TopTradesResponse = await response.json();
                set({
                    topTrades: data.trades,
                    selectedPeriod: period,
                    topTradesLoading: false
                });
            } else {
                console.error('Failed to fetch top trades');
                set({ topTradesLoading: false });
            }
        } catch (error) {
            console.error('Error fetching top trades:', error);
            set({ topTradesLoading: false });
        }
    },
    setSelectedPeriod: (period) => {
        set({ selectedPeriod: period });
        get().fetchTopTrades(period);
    }
}));
