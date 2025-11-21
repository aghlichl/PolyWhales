import { RunningStats } from './stats';

export type AnomalyType = 'MEGA_WHALE' | 'WHALE' | 'STANDARD';

export interface Anomaly {
    id: string;
    type: AnomalyType;
    event: string; // This will be the Market Question/Title
    outcome: string;
    odds: number;
    value: number;
    multiplier: string;
    zScore: number;
    timestamp: number;
    isContra?: boolean;
    side: 'BUY' | 'SELL';
}

// Global State
interface MarketMeta {
    conditionId: string;
    eventId: string;
    eventTitle: string;
    question: string;
    marketType: string;
    outcomes: string[];
    clobTokenIds: string[];
}

// Maps
const marketsByCondition = new Map<string, MarketMeta>();
const assetIdToOutcome = new Map<string, { outcomeLabel: string; conditionId: string }>();

const marketStats = new Map<string, RunningStats>();
const globalStats = new RunningStats();

interface PolymarketMarket {
    conditionId: string;
    question: string;
    marketType: string;
    outcomes: string | string[]; // API can return stringified JSON or array
    clobTokenIds: string | string[]; // API can return stringified JSON or array
    events: {
        id: string;
        title: string;
    }[];
}

async function fetchMarketMetadata() {
    try {
        const response = await fetch('/api/proxy/polymarket/markets');
        if (!response.ok) throw new Error('Failed to fetch metadata');

        const markets: PolymarketMarket[] = await response.json();
        const allAssetIds: string[] = [];

        markets.forEach(market => {
            if (!market.conditionId || !market.clobTokenIds || !market.outcomes) return;

            let tokenIds: string[] = [];
            let outcomes: string[] = [];

            try {
                // Parse clobTokenIds
                if (Array.isArray(market.clobTokenIds)) {
                    tokenIds = market.clobTokenIds;
                } else if (typeof market.clobTokenIds === 'string') {
                    tokenIds = JSON.parse(market.clobTokenIds);
                }

                // Parse outcomes
                if (Array.isArray(market.outcomes)) {
                    outcomes = market.outcomes;
                } else if (typeof market.outcomes === 'string') {
                    outcomes = JSON.parse(market.outcomes);
                }

                // Store Market Metadata
                const eventTitle = market.events && market.events.length > 0 ? market.events[0].title : 'Unknown Event';
                
                const meta: MarketMeta = {
                    conditionId: market.conditionId,
                    eventId: market.events && market.events.length > 0 ? market.events[0].id : '',
                    eventTitle,
                    question: market.question,
                    marketType: market.marketType,
                    outcomes,
                    clobTokenIds: tokenIds
                };

                marketsByCondition.set(market.conditionId, meta);

                // Map Tokens to Outcome Labels
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

            } catch {
                // Silent fail for individual market parsing errors
            }
        });

        console.log(`[Metadata] Mapped ${marketsByCondition.size} markets and ${assetIdToOutcome.size} assets`);
        return allAssetIds;
    } catch (error) {
        console.error('[Metadata] Error:', error);
        return [];
    }
}

export function startFirehose(onAnomaly: (a: Anomaly) => void) {
    let ws: WebSocket | null = null;
    let heartbeatInterval: NodeJS.Timeout;

    const connect = async () => {
        const assetIds = await fetchMarketMetadata();
        if (assetIds.length === 0) {
            console.warn('[Firehose] No assets found, retrying in 5s...');
            setTimeout(connect, 5000);
            return;
        }

        const subscribedAssets = new Set<string>(assetIds);

        ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

        ws.onopen = () => {
            console.log('[Firehose] Connected');

            // Subscribe to trades
            const msg = {
                type: "market",
                assets_ids: assetIds,
                channel: "trades"
            };
            ws?.send(JSON.stringify(msg));

            heartbeatInterval = setInterval(() => {
                console.log('[Firehose] Heartbeat - Connected');
            }, 5000);

            // Poll for new markets every 5 minutes
            setInterval(async () => {
                console.log('[Firehose] Refreshing metadata...');
                const latestAssetIds = await fetchMarketMetadata();
                const newAssets = latestAssetIds.filter(id => !subscribedAssets.has(id));
                
                if (newAssets.length > 0 && ws?.readyState === WebSocket.OPEN) {
                    console.log(`[Firehose] Subscribing to ${newAssets.length} new assets`);
                    ws.send(JSON.stringify({
                        type: "market",
                        assets_ids: newAssets,
                        channel: "trades"
                    }));
                    newAssets.forEach(id => subscribedAssets.add(id));
                }
            }, 5 * 60 * 1000);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data as string);

                console.log(`[WebSocket] Received event: ${data.event_type}`);

                if (data.event_type === "last_trade_price" || data.event_type === "trade") {
                    const trades = Array.isArray(data) ? data : [data];

                    console.log(`[WebSocket] Processing ${trades.length} trades`);

                    trades.forEach(trade => {
                        if (!trade.price || !trade.size || !trade.asset_id) return;

                        const price = Number(trade.price);
                        const size = Number(trade.size);
                        const value = price * size;

                        // 1. Ignore Noise (< $1,000) - Match worker threshold
                        if (value < 1000) return;

                        // 2. Lookup Metadata
                        // First try to find market by conditionId if provided in trade (usually "market" field)
                        let conditionId = trade.market;
                        let outcomeLabel = '';
                        let marketMeta: MarketMeta | undefined;
                        const side: 'BUY' | 'SELL' = trade.side || (trade.type === 'buy' ? 'BUY' : 'SELL') || 'BUY';

                        // If trade has asset_id, we can fallback to looking up via assetIdToOutcome
                        if (trade.asset_id) {
                            const assetInfo = assetIdToOutcome.get(trade.asset_id);
                            if (assetInfo) {
                                outcomeLabel = assetInfo.outcomeLabel;
                                if (!conditionId) conditionId = assetInfo.conditionId;
                            }
                        }

                        if (conditionId) {
                            marketMeta = marketsByCondition.get(conditionId);
                        }

                        if (!marketMeta) return;

                        // If we didn't get outcomeLabel from asset map, try to derive from market outcomes
                        if (!outcomeLabel && marketMeta.outcomes) {
                            // Sometimes trade has outcomeIndex? User mentioned it.
                            // If not, we rely on asset_id map which we built.
                            // If we are here, it means we didn't find it in assetIdToOutcome map?
                            // But we subscribed using assetIds we know...
                            // So this case is unlikely if we built the map correctly.
                            return;
                        }
                        
                        // 3. Get or Create Stats
                        let stats = marketStats.get(conditionId);
                        if (!stats) {
                            stats = new RunningStats();
                            marketStats.set(conditionId, stats);
                        }

                        // 4. Stats Calculation
                        const marketZScore = stats.getZScore(value);
                        globalStats.push(value);
                        stats.push(value);

                        // 5. Basic Classification (based on bet amount only)
                        let type: AnomalyType = 'STANDARD';

                        if (value > 15000) type = 'MEGA_WHALE';
                        else if (value > 8000) type = 'WHALE';
                        // else remains 'STANDARD'

                        // 6. Create Anomaly
                        const odds = Math.round(price * 100);

                        // Filter out very likely outcomes (price > 97% = odds > 97)
                        if (price > 0.97) return;

                        // Filter out 99c and 100c bets
                        if (odds === 99 || odds === 100) return;

                        const isContra = odds < 40 && marketZScore > 2.0;
                        const multiplier = `x${marketZScore.toFixed(1)}`;

                        const anomaly: Anomaly = {
                            id: Math.random().toString(36).substring(7),
                            type,
                            event: marketMeta.question, // The User wants the market question here
                            outcome: outcomeLabel,
                            odds,
                            value,
                            multiplier,
                            zScore: marketZScore,
                            timestamp: Date.now(),
                            isContra,
                            side
                        };

                        console.log('[Firehose] Enriched Trade:', anomaly);
                        onAnomaly(anomaly);
                    });
                }
            } catch (e) {
                console.warn('[Firehose] Parse Error', e);
            }
        };

        ws.onerror = (e) => console.error('[Firehose] Error', e);
        ws.onclose = () => {
            console.log('[Firehose] Closed, reconnecting...');
            clearInterval(heartbeatInterval);
            setTimeout(connect, 3000);
        };
    };

    connect();

    return () => {
        if (ws) ws.close();
        clearInterval(heartbeatInterval);
    };
}
