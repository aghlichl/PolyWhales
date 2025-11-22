export type AnomalyType = 'GOD_WHALE' | 'SUPER_WHALE' | 'MEGA_WHALE' | 'WHALE' | 'STANDARD';

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
    multiplier: string;
    zScore: number;
    timestamp: number;
    isContra?: boolean;
    side: 'BUY' | 'SELL';
    // Optional fields for enriched display
    wallet_context?: {
        label: string;
        pnl_all_time: string;
        win_rate: string;
        is_fresh_wallet: boolean;
    };
    market_impact?: {
        swept_levels: number;
        slippage_induced: string;
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
    events: {
        id: string;
        title: string;
    }[];
}

export interface EnrichedTrade {
    type: string;
    market: {
        question: string;
        outcome: string;
        conditionId: string;
        odds: number;
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

