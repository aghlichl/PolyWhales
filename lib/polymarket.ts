import { MarketMeta, AssetOutcome, PolymarketMarket } from './types';
import { CONFIG } from './config';

export function normalizeMarketResponse(data: any): PolymarketMarket[] {
    if (Array.isArray(data)) {
        return data;
    } else if (data && Array.isArray(data.data)) {
        return data.data;
    } else {
        console.error('Unexpected markets payload shape:', JSON.stringify(data, null, 2));
        return [];
    }
}

export async function fetchMarketsFromGamma(init?: RequestInit): Promise<PolymarketMarket[]> {
    const response = await fetch(CONFIG.URLS.GAMMA_API, {
        ...init,
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'OddsGods/1.0',
            ...init?.headers
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeMarketResponse(data);
}

export function parseMarketData(markets: PolymarketMarket[]): {
    marketsByCondition: Map<string, MarketMeta>;
    assetIdToOutcome: Map<string, AssetOutcome>;
    allAssetIds: string[];
} {
    const marketsByCondition = new Map<string, MarketMeta>();
    const assetIdToOutcome = new Map<string, AssetOutcome>();
    const allAssetIds: string[] = [];

    markets.forEach(market => {
        if (!market.conditionId || !market.clobTokenIds || !market.outcomes) return;

        let tokenIds: string[] = [];
        let outcomes: string[] = [];

        try {
            if (Array.isArray(market.clobTokenIds)) {
                tokenIds = market.clobTokenIds;
            } else if (typeof market.clobTokenIds === 'string') {
                tokenIds = JSON.parse(market.clobTokenIds);
            }

            if (Array.isArray(market.outcomes)) {
                outcomes = market.outcomes;
            } else if (typeof market.outcomes === 'string') {
                outcomes = JSON.parse(market.outcomes);
            }

            const eventTitle = market.events && market.events.length > 0 ? market.events[0].title : 'Unknown Event';

            // Extract image URL (prioritize twitterCardImage > image > icon)
            // Check market level first, then event level
            let imageUrl = market.twitterCardImage || market.image || market.icon;

            if (!imageUrl && market.events && market.events.length > 0) {
                const event = market.events[0];
                imageUrl = event.image || event.icon;
            }

            const meta: MarketMeta = {
                conditionId: market.conditionId,
                eventId: market.events && market.events.length > 0 ? market.events[0].id : '',
                eventTitle,
                question: market.question,
                marketType: market.marketType,
                outcomes,
                clobTokenIds: tokenIds,
                image: imageUrl
            };

            marketsByCondition.set(market.conditionId, meta);

            if (tokenIds && Array.isArray(tokenIds) && outcomes && Array.isArray(outcomes)) {
                tokenIds.forEach((assetId, index) => {
                    const outcomeLabel = outcomes[index] || 'Unknown';
                    assetIdToOutcome.set(assetId, {
                        outcomeLabel,
                        conditionId: market.conditionId
                    });
                    allAssetIds.push(assetId);
                });
            }
        } catch (error) {
            // console.warn(`Error parsing market ${market.conditionId}:`, error);
        }
    });

    return { marketsByCondition, assetIdToOutcome, allAssetIds };
}
