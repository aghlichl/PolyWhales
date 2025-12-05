export const CONFIG = {
    THRESHOLDS: {
        MIN_VALUE: 1000,
        WHALE: 8001,
        MEGA_WHALE: 15000,
        SUPER_WHALE: 50000,
        GOD_WHALE: 100000,
    },
    URLS: {
        GAMMA_API: 'https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false&order=volume24hr&ascending=false',
        GAMMA_API_PORTFOLIO: 'https://gamma-api.polymarket.com/portfolio',
        WS_CLOB: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
        WS_RTDS: 'wss://ws-live-data.polymarket.com',
        DATA_API_TRADES: 'https://data-api.polymarket.com/trades',
    },
    CONSTANTS: {
        ODDS_THRESHOLD: 0.97,
        MAX_ODDS_FOR_CONTRA: 40,
        Z_SCORE_CONTRA_THRESHOLD: 2.0,
        METADATA_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
        HEARTBEAT_INTERVAL: 30000,
    },
    ENRICHMENT: {
        // Data-API rate limit: 75 requests per 10 seconds
        RATE_LIMIT_DELAY_MS: 200,        // ~5 req/s to stay under limit
        BATCH_SIZE: 50,                   // Trades per batch enrichment run
        BATCH_INTERVAL_MS: 60 * 1000,     // Run batch every minute
        TIME_WINDOW_MS: 5000,             // Match window for timestamp +/- 5s
        PRICE_TOLERANCE: 0.001,           // 0.1% price tolerance for matching
        SIZE_TOLERANCE: 0.01,             // 1% size tolerance for matching
        MAX_AGE_HOURS: 24,                // Only enrich trades from last 24h
    }
};

