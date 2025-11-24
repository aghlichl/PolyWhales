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
    image?: string; // Event image URL
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
    image?: string;
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
        image?: string;
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
            label: string;
            pnl_all_time: string;
            win_rate: string;
            is_fresh_wallet: boolean;
        };
        market_impact: {
            swept_levels: number;
            slippage_induced: string;
        };
    };
}

