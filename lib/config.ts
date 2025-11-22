export const CONFIG = {
    THRESHOLDS: {
        MIN_VALUE: 1000,
        WHALE: 8000,
        MEGA_WHALE: 15000,
        SUPER_WHALE: 50000,
        GOD_WHALE: 100000,
    },
    URLS: {
        GAMMA_API: 'https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false&order=volume24hr&ascending=false',
        WS_CLOB: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
    },
    CONSTANTS: {
        ODDS_THRESHOLD: 0.97,
        MAX_ODDS_FOR_CONTRA: 40,
        Z_SCORE_CONTRA_THRESHOLD: 2.0,
        METADATA_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
        HEARTBEAT_INTERVAL: 30000,
    }
};

