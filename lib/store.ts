import { create } from 'zustand';
import { Anomaly, startFirehose } from './market-stream';

interface MarketStore {
    anomalies: Anomaly[];
    volume: number;
    tickerItems: string[];
    isLoading: boolean;
    addAnomaly: (anomaly: Anomaly) => void;
    loadHistory: () => Promise<void>;
    startStream: () => () => void;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
    anomalies: [],
    volume: 0,
    tickerItems: [],
    isLoading: false,
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
    startStream: () => {
        // Load historical data first
        get().loadHistory();

        // Start the WebSocket Firehose
        const cleanup = startFirehose((anomaly) => {
            get().addAnomaly(anomaly);
        });
        return cleanup;
    }
}));
