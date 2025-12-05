export type AnomalyType = 'GOD_WHALE' | 'SUPER_WHALE' | 'MEGA_WHALE' | 'WHALE' | 'STANDARD';

export interface PolymarketTrade {
    asset_id: string;
    price: number | string;
    size: number | string;
    side?: string;
    type?: string;
    user?: string;
    maker?: string;
    taker?: string;
    wallet?: string;
    market?: string;
    timestamp?: number | string | Date;
    transaction_hash?: string;
}

export interface UserPreferences {
    showStandard: boolean;
    showWhale: boolean;
    showMegaWhale: boolean;
    showSuperWhale: boolean;
    showGodWhale: boolean;
    showSports: boolean;
    minValueThreshold: number;
}

export interface Anomaly {
    id: string;
    type: AnomalyType;
    event: string; // Market Question/Title
    outcome: string;
    odds: number;
    value: number;
    timestamp: number;
    side: 'BUY' | 'SELL';
    image?: string | null; // Event image URL
    // Optional fields for enriched display
    wallet_context?: {
        address?: string;
        label: string;
        pnl_all_time: string;
        win_rate: string;
        is_fresh_wallet: boolean;
    };
    trader_context?: {
        tx_count: number;
        max_trade_value: number;
        activity_level: string | null;
    };
    market_impact?: {
        swept_levels: number;
        slippage_induced: string;
    };
    analysis?: {
        tags: string[];
    };
}

export interface MarketMeta {
    conditionId: string;
    eventId: string;
    eventTitle: string;
    question: string;
    marketType: string;
    outcomes: string[];
    clobTokenIds: string[];
    image?: string | null;
    outcomePrices?: string[];
    closed?: boolean;
}

export interface AssetOutcome {
    outcomeLabel: string;
    conditionId: string;
}

export interface PolymarketMarket {
    conditionId: string;
    question: string;
    marketType: string;
    outcomes: string | string[];
    clobTokenIds: string | string[];
    image?: string;
    icon?: string;
    twitterCardImage?: string;
    outcomePrices?: string | string[];
    closed?: boolean;
    events: {
        id: string;
        title: string;
        image?: string;
        icon?: string;
    }[];
}

export interface EnrichedTrade {
    type: string;
    market: {
        question: string;
        outcome: string;
        conditionId: string;
        odds: number;
        image?: string | null;
    };
    trade: {
        assetId: string;
        size: number;
        side: string;
        price: number;
        tradeValue: number;
        timestamp: Date;
    };
    analysis: {
        tags: string[];
        wallet_context: {
            address: string;
            label: string;
            pnl_all_time: string;
            win_rate: string;
            is_fresh_wallet: boolean;
        };
        market_impact: {
            swept_levels: number;
            slippage_induced: string;
        };
        trader_context: {
            tx_count: number;
            max_trade_value: number;
            activity_level: string | null;
        };
    };
}

// Data-API trade response from Polymarket
export interface DataAPITrade {
    id: string;
    taker_order_id: string;
    market: string;
    asset_id: string;
    side: 'BUY' | 'SELL';
    size: string;
    fee_rate_bps: string;
    price: string;
    status: string;
    match_time: string;
    last_update: string;
    outcome: string;
    bucket_index: number;
    owner: string;           // Wallet address (taker)
    maker_address: string;   // Maker wallet address
    transaction_hash: string;
    type: string;
}

// Data-API activity response from Polymarket /activity endpoint
export interface DataAPIActivity {
    id: string;
    proxyWallet: string;
    timestamp: number; // Unix timestamp
    type: 'TRADE' | 'SPLIT' | 'MERGE' | 'REDEEM' | 'REWARD' | 'CONVERSION';
    conditionId: string;
    size: string;
    usdcSize: string;
    transactionHash: string;
    price: string;
    side: 'BUY' | 'SELL';
    outcome: string;
    market: string;
    asset_id: string;
}

// RTDS (Real-Time Data Stream) trade payload from Polymarket
export interface RTDSTradePayload {
    asset: string; // asset_id
    bio?: string;
    conditionId: string;
    eventSlug?: string;
    icon?: string;
    name?: string;
    outcome: string;
    outcomeIndex?: number;
    price: number;
    profileImage?: string;
    proxyWallet: string;
    pseudonym?: string;
    side: 'BUY' | 'SELL';
    size: number;
    slug?: string;
    timestamp: number; // Unix timestamp in seconds
    title: string;
    transactionHash: string;
}

// RTDS WebSocket message structure
export interface RTDSMessage {
    connection_id?: string;
    payload: RTDSTradePayload;
    timestamp: number; // Unix timestamp in milliseconds
    topic: string;
    type: string;
}

// Enrichment status for trade wallet identity
export type EnrichmentStatus = 'pending' | 'enriched' | 'failed';

export interface WalletEnrichmentResult {
    walletAddress: string;
    maker: string;
    taker: string;
    source: 'websocket' | 'data-api' | 'tx-logs';
}

// Gamma Portfolio Types
export interface GammaPosition {
    asset_id: string;
    condition_id: string;
    question: string;
    outcome: string;
    outcomeLabel: string; // "Yes" or "No" usually
    market: string; // Market question
    size: number;
    price: number; // Current price
    value: number; // Current value
    avgPrice: number; // Average entry price
    pnl: number;
    pnlPercent: number;
    image?: string;
}

export interface GammaPortfolio {
    address: string;
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    positions: GammaPosition[];
}
