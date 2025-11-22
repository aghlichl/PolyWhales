import { RunningStats } from './stats';
import { Anomaly, UserPreferences, MarketMeta, AssetOutcome, AnomalyType, PolymarketMarket } from './types';
import { CONFIG } from './config';
import { parseMarketData } from './polymarket';

// Re-export types for consumers
export type { Anomaly, UserPreferences, AnomalyType };

// Maps
let marketsByCondition = new Map<string, MarketMeta>();
let assetIdToOutcome = new Map<string, AssetOutcome>();

const marketStats = new Map<string, RunningStats>();
const globalStats = new RunningStats();

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

async function fetchMarketMetadata() {
    try {
        const response = await fetch('/api/proxy/polymarket/markets');
        if (!response.ok) throw new Error('Failed to fetch metadata');

        const markets: PolymarketMarket[] = await response.json();
        
        const result = parseMarketData(markets);
        
        marketsByCondition = result.marketsByCondition;
        assetIdToOutcome = result.assetIdToOutcome;

        console.log(`[Metadata] Mapped ${marketsByCondition.size} markets and ${assetIdToOutcome.size} assets`);
        return result.allAssetIds;
    } catch (error) {
        console.error('[Metadata] Error:', error);
        return [];
    }
}

export function startFirehose(onAnomaly: (a: Anomaly) => void, getPreferences?: () => UserPreferences) {
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

        ws = new WebSocket(CONFIG.URLS.WS_CLOB);

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
            }, 5000); // This seems faster than server worker (30s), maybe align? Keeping as is to avoid func change.

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
            }, CONFIG.CONSTANTS.METADATA_REFRESH_INTERVAL);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data as string);

                // console.log(`[WebSocket] Received event: ${data.event_type}`);

                if (data.event_type === "last_trade_price" || data.event_type === "trade") {
                    const trades = Array.isArray(data) ? data : [data];

                    // console.log(`[WebSocket] Processing ${trades.length} trades`);

                    trades.forEach(trade => {
                        if (!trade.price || !trade.size || !trade.asset_id) return;

                        const price = Number(trade.price);
                        const size = Number(trade.size);
                        const value = price * size;

                        // 1. Ignore Noise (< $1,000)
                        if (value < CONFIG.THRESHOLDS.MIN_VALUE) return;

                        // 2. Lookup Metadata
                        let conditionId = trade.market;
                        let outcomeLabel = '';
                        let marketMeta: MarketMeta | undefined;
                        const side: 'BUY' | 'SELL' = trade.side || (trade.type === 'buy' ? 'BUY' : 'SELL') || 'BUY';

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

                        // 5. Basic Classification
                        let type: AnomalyType = 'STANDARD';

                        if (value > CONFIG.THRESHOLDS.GOD_WHALE) type = 'GOD_WHALE';
                        else if (value > CONFIG.THRESHOLDS.SUPER_WHALE) type = 'SUPER_WHALE';
                        else if (value > CONFIG.THRESHOLDS.MEGA_WHALE) type = 'MEGA_WHALE';
                        else if (value > CONFIG.THRESHOLDS.WHALE) type = 'WHALE';

                        // 6. Create Anomaly
                        const odds = Math.round(price * 100);

                        // Filter out very likely outcomes
                        if (price > CONFIG.CONSTANTS.ODDS_THRESHOLD) return;

                        // Filter out 99c and 100c bets (already covered by odds threshold mostly, but explicit check exists)
                        if (odds === 99 || odds === 100) return;

                        const isContra = odds < CONFIG.CONSTANTS.MAX_ODDS_FOR_CONTRA && marketZScore > CONFIG.CONSTANTS.Z_SCORE_CONTRA_THRESHOLD;
                        const multiplier = `x${marketZScore.toFixed(1)}`;

                        const anomaly: Anomaly = {
                            id: Math.random().toString(36).substring(7),
                            type,
                            event: marketMeta.question,
                            outcome: outcomeLabel,
                            odds,
                            value,
                            multiplier,
                            zScore: marketZScore,
                            timestamp: Date.now(),
                            isContra,
                            side
                        };

                        // console.log('[Firehose] Enriched Trade:', anomaly);

                        // Apply user preferences filtering
                        const currentPreferences = getPreferences?.();
                        if (!currentPreferences || passesPreferences(anomaly, currentPreferences)) {
                            onAnomaly(anomaly);
                        } else {
                            // console.log('[Firehose] Filtered out anomaly due to user preferences:', anomaly.type, anomaly.value);
                        }
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
