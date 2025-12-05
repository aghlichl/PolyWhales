import { create } from 'zustand';
import { Anomaly, AnomalyType, UserPreferences } from './types';
import { io } from 'socket.io-client';

// Helper function to check if anomaly passes user preferences
function passesPreferences(anomaly: Anomaly, preferences?: UserPreferences): boolean {
  if (!preferences) return true; // No preferences means show all

  // Check minimum value threshold
  if (anomaly.value < preferences.minValueThreshold) return false;

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
}

const DEFAULT_PREFERENCES: Preferences = {
  showStandard: true,
  showWhale: true,
  showMegaWhale: true,
  showSuperWhale: true,
  showGodWhale: true,
  showSports: true,
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
  selectedPeriod: 'today',
  nextCursor: undefined,
  hasMore: true,

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
      newAnomalies = [anomaly, ...state.anomalies].slice(0, 2000);
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

    // Connect to worker's Socket.io server instead of direct WebSocket
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
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
    socket.on('trade', (enrichedTrade) => {
      // Convert worker's enriched trade format to anomaly format
      console.log('[STORE] Enriched trade:', JSON.stringify(enrichedTrade, null, 2));
      
      // Ensure wallet_context is always present and valid
      const walletContext = enrichedTrade.analysis?.wallet_context;
      if (!walletContext || !walletContext.address) {
        console.warn('[STORE] Trade missing wallet_context.address, skipping');
        return;
      }
      
      const anomaly: Anomaly = {
        id: enrichedTrade.trade.assetId + '_' + enrichedTrade.trade.timestamp.getTime(),
        type: enrichedTrade.analysis.tags.includes('GOD_WHALE') ? 'GOD_WHALE' :
          enrichedTrade.analysis.tags.includes('SUPER_WHALE') ? 'SUPER_WHALE' :
            enrichedTrade.analysis.tags.includes('MEGA_WHALE') ? 'MEGA_WHALE' :
              enrichedTrade.analysis.tags.includes('WHALE') ? 'WHALE' :
                'STANDARD' as AnomalyType,
        event: enrichedTrade.market.question,
        outcome: enrichedTrade.market.outcome,
        odds: enrichedTrade.market.odds,
        value: enrichedTrade.trade.tradeValue,
        timestamp: enrichedTrade.trade.timestamp.getTime(),
        side: enrichedTrade.trade.side as 'BUY' | 'SELL',
        image: enrichedTrade.market.image,
        wallet_context: {
          address: walletContext.address,
          label: walletContext.label || walletContext.address.slice(0, 6) + '...' + walletContext.address.slice(-4),
          pnl_all_time: walletContext.pnl_all_time || '...',
          win_rate: walletContext.win_rate || '...',
          is_fresh_wallet: walletContext.is_fresh_wallet || false,
        },
        trader_context: enrichedTrade.analysis.trader_context,
        market_impact: enrichedTrade.analysis.market_impact,
        analysis: {
          tags: enrichedTrade.analysis.tags,
        }
      };

      if (anomaly.wallet_context) {
        console.log('[STORE] Created anomaly with wallet:', anomaly.wallet_context.address, 'label:', anomaly.wallet_context.label);
      } else {
        console.warn('[STORE] Anomaly missing wallet_context');
      }

      // Only add if it passes user preferences
      const currentPreferences = getPreferences?.();
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
