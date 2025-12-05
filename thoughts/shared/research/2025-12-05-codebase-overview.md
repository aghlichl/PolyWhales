## Analysis: OddsGods Trading Platform (2025-12-05)

### Overview
OddsGods ingests Polymarket RTDS trades via a worker, enriches them with market metadata and trader intelligence, stores to Postgres, and streams enriched trades to a Next.js client over Socket.io. The client filters and renders live anomalies with historical/top-trade views while API routes reshape DB data to frontend `Anomaly` format.

### Entry Points
- `app/page.tsx` – Client home page handling filters, streaming, and layout.
- `lib/store.ts` – Zustand stores for preferences, live anomalies, top trades, leaderboard ranks.
- `server/worker.ts` – RTDS ingestion, enrichment, DB writes, Socket.io broadcast, alerts.
- `app/api/history/route.ts` – 24h whale history API with cursor pagination.
- `app/api/top-trades/route.ts` – Period-based top-trade API.
- `app/api/leaderboard/route.ts` – Leaderboard snapshots or legacy aggregation.
- `app/api/portfolio/route.ts` – Wallet portfolio snapshots via Gamma.
- `lib/polymarket.ts` / `lib/intelligence.ts` – Market metadata, Data API helpers, trader intelligence.

### Core Implementation

#### Client Surface (`app/page.tsx`)
- Filters anomalies by value, odds, sports keywords, top-20 wallets (from leaderboard), and tier toggles before display. Top-20 set derived via `getTop20Wallets` against fetched ranks.
- Loads preferences and leaderboard ranks on mount; starts Socket.io stream once (preferences read via getter to avoid restarts). IntersectionObserver triggers `loadMoreHistory` for infinite scroll.
- Center panel shows filtered anomalies; other panels expose user preferences and top whales; bottom nav carousel switches panels on mobile.

```
22:68:app/page.tsx
function passesPreferences(anomaly: Anomaly, preferences: UserPreferencesType, top20Wallets?: Set<string>): boolean {
  if (anomaly.value < preferences.minValueThreshold) return false;
  if (anomaly.odds < preferences.minOdds || anomaly.odds > preferences.maxOdds) return false;
  if (preferences.filterTopPlayersOnly) {
    if (!top20Wallets || top20Wallets.size === 0) return true;
    const walletAddress = anomaly.wallet_context?.address?.toLowerCase();
    if (!walletAddress || !top20Wallets.has(walletAddress)) {
      return false;
    }
  }
  if (
    !preferences.showSports &&
    ['vs.', 'spread:', 'win on 202', 'counter-strike'].some(keyword =>
      anomaly.event.toLowerCase().includes(keyword)
    )
  ) {
    return false;
  }
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
```

```
70:146:app/page.tsx
const { anomalies, startStream, isLoading, loadMoreHistory, hasMoreHistory, fetchLeaderboardRanks, leaderboardRanks } = useMarketStore();
const { preferences, loadPreferences } = usePreferencesStore();
...
const top20Wallets = useMemo(() => {
  if (!leaderboardRanks || Object.keys(leaderboardRanks).length === 0) {
    return undefined;
  }
  return getTop20Wallets(leaderboardRanks);
}, [leaderboardRanks]);
...
useEffect(() => {
  loadPreferences();
  fetchLeaderboardRanks();
}, [loadPreferences, fetchLeaderboardRanks]);

useEffect(() => {
  const cleanup = startStream(() => preferences);
  return cleanup;
}, [startStream]);
```

#### State & Streaming (`lib/store.ts`)
- `usePreferencesStore` persists display preferences to localStorage after initial load; defaults show all whale tiers, odds 1–99, no threshold.
- `useMarketStore` tracks anomalies (cap 2,000), volume, ticker items (cap 20), pagination for history, top trades, and leaderboard ranks.
- `addAnomaly` deduplicates by id, preserves wallet_context on updates, appends new anomalies/tickers/volume.
- `loadHistory` fetches `/api/history` (limit=100), replaces on initial load and appends for pagination via cursor; `loadMoreHistory` guards by flags.
- `startStream` loads history first, opens Socket.io to `NEXT_PUBLIC_SOCKET_URL` (default localhost:3001), validates wallet_context/timestamp from worker payloads, maps tags to `AnomalyType`, and pushes anomalies if they pass provided preference getter.
- Top trades helpers fetch `/api/top-trades` with pagination; leaderboard ranks fetched once unless already populated.

```
102:135:lib/store.ts
export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  isLoaded: false,
  setPreferences: (newPreferences) => {
    set((state) => ({
      preferences: { ...state.preferences, ...newPreferences }
    }));
    if (get().isLoaded) {
      get().savePreferences();
    }
  },
  loadPreferences: () => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('oddsGods-preferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        set({ preferences: { ...DEFAULT_PREFERENCES, ...parsed }, isLoaded: true });
      } catch (error) {
        set({ preferences: DEFAULT_PREFERENCES, isLoaded: true });
      }
    } else {
      set({ preferences: DEFAULT_PREFERENCES, isLoaded: true });
    }
  },
  savePreferences: () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('oddsGods-preferences', JSON.stringify(get().preferences));
  }
}));
```

```
208:241:lib/store.ts
addAnomaly: (anomaly) => set((state) => {
  const existingIndex = state.anomalies.findIndex(a => a.id === anomaly.id);
  let newAnomalies;
  let newVolume = state.volume;
  let newTickerItems = state.tickerItems;

  if (existingIndex >= 0) {
    const existing = state.anomalies[existingIndex];
    const updatedAnomaly = {
      ...anomaly,
      wallet_context: (anomaly.wallet_context && anomaly.wallet_context.address)
        ? anomaly.wallet_context
        : (existing.wallet_context || anomaly.wallet_context || undefined),
    };
    newAnomalies = [...state.anomalies];
    newAnomalies[existingIndex] = updatedAnomaly;
  } else {
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
```

```
287:373:lib/store.ts
startStream: (getPreferences) => {
  get().loadHistory();
  const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
  ...
  socket.on('trade', (enrichedTrade) => {
    const walletContext = enrichedTrade.analysis?.wallet_context;
    if (!walletContext || !walletContext.address) {
      return;
    }
    const tsRaw = enrichedTrade.trade.timestamp;
    const ts = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);
    if (Number.isNaN(ts.getTime())) {
      return;
    }
    const anomaly: Anomaly = {
      id: enrichedTrade.trade.assetId + '_' + ts.getTime(),
      type: enrichedTrade.analysis.tags.includes('GOD_WHALE') ? 'GOD_WHALE' :
        enrichedTrade.analysis.tags.includes('SUPER_WHALE') ? 'SUPER_WHALE' :
          enrichedTrade.analysis.tags.includes('MEGA_WHALE') ? 'MEGA_WHALE' :
            enrichedTrade.analysis.tags.includes('WHALE') ? 'WHALE' :
              'STANDARD' as AnomalyType,
      event: enrichedTrade.market.question,
      outcome: enrichedTrade.market.outcome,
      odds: enrichedTrade.market.odds,
      value: enrichedTrade.trade.tradeValue,
      timestamp: ts.getTime(),
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
    const currentPreferences = getPreferences?.();
    if (!currentPreferences || passesPreferences(anomaly, currentPreferences)) {
      get().addAnomaly(anomaly);
    }
  });
  ...
  return () => socket.disconnect();
},
```

#### UI Components
- `AnomalyCard` renders each anomaly, derives leaderboard ranks from store, shows account name only if wallet is top-20 across periods, resolves team/league logos (fallback to Polymarket image), and opens `TradeDetailsModal` on click.
- `TradeDetailsModal` pulls leaderboard ranks, loads `/api/market-history` when opened, derives unrealized P/L using price history, and displays wallet stats/portfolio via `WalletPortfolio`.

```
55:83:components/feed/anomaly-card.tsx
const { event: title, value, outcome, odds, type, timestamp, side, image } = anomaly;
const { leaderboardRanks } = useMarketStore();
const walletRanks = useMemo(() => {
  if (!anomaly.wallet_context?.address) return [];
  const walletKey = anomaly.wallet_context.address.toLowerCase();
  return leaderboardRanks[walletKey] || [];
}, [anomaly.wallet_context?.address, leaderboardRanks]);

const accountName = useMemo(() => {
  const named = walletRanks.find((r) => r.accountName && r.accountName.trim());
  if (named?.accountName) return named.accountName.trim();
  if (anomaly.wallet_context?.label) return anomaly.wallet_context.label;
  if (anomaly.wallet_context?.address) {
    const addr = anomaly.wallet_context.address;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return null;
}, [walletRanks, anomaly.wallet_context?.label, anomaly.wallet_context?.address]);

const isTop20Account = useMemo(() => {
  return walletRanks.some((r) => typeof r.rank === 'number' && r.rank > 0 && r.rank <= 20);
}, [walletRanks]);
```

```
45:148:components/feed/trade-details-modal.tsx
export function TradeDetailsModal({ isOpen, onClose, anomaly }: TradeDetailsModalProps) {
  const { event, outcome, odds, value, side, trader_context, wallet_context, analysis, image } = anomaly;
  const { leaderboardRanks } = useMarketStore();
  ...
  const walletRanks = useMemo(() => {
    if (!wallet_context?.address) return [];
    const walletKey = wallet_context.address.toLowerCase();
    return leaderboardRanks[walletKey] || [];
  }, [wallet_context?.address, leaderboardRanks]);
  ...
  useEffect(() => {
    if (isOpen && anomaly) {
      setIsLoadingHistory(true);
      const params = new URLSearchParams({
        question: anomaly.event,
        outcome: anomaly.outcome,
        walletAddress: anomaly.wallet_context?.address || '',
        tradeTimestamp: anomaly.timestamp.toString()
      });

      fetch(`/api/market-history?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
          setHistoryData(data);
        })
        .catch(err => console.error("Failed to fetch history:", err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [isOpen, anomaly]);
}
```

#### API Routes
- `app/api/history/route.ts` filters trades in last 24h with `tradeValue > 5000` and non-empty wallet addresses, orders by `timestamp desc`, paginates with cursor, includes `walletProfile`, maps to `Anomaly` shape with type classification and fresh images from current market metadata.
- `app/api/top-trades/route.ts` applies period-based date filter (today/weekly/monthly/yearly/max), requires `tradeValue > 1000`, orders by value desc, paginates limit+1, maps to anomalies including trader tags reconstructed from flags and INSIDER heuristic.
- `app/api/leaderboard/route.ts` supports `format=legacy` (7-day volume aggregation with walletProfile enrichment) or default snapshot mode; default returns top 20 per period with rank changes computed from last two snapshots.
- `app/api/portfolio/route.ts` looks for snapshot newer than 5 minutes, otherwise fetches portfolio from Gamma, upserts wallet profile, stores snapshot, computes totalPnlPercent, returns stale snapshot when Gamma fails.

```
18:110:app/api/history/route.ts
const trades = await prisma.trade.findMany({
  where: {
    tradeValue: { gt: 5000 },
    timestamp: { gte: twentyFourHoursAgo },
    walletAddress: { not: "" },
  },
  orderBy: { timestamp: 'desc' },
  take: limit + 1,
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
  include: { walletProfile: true },
});
...
const anomalies = trades.map(trade => {
  const value = trade.tradeValue;
  const price = trade.price;
  let type: 'GOD_WHALE' | 'SUPER_WHALE' | 'MEGA_WHALE' | 'WHALE' | 'STANDARD' = 'STANDARD';
  if (value > 100000) type = 'GOD_WHALE';
  else if (value > 50000) type = 'SUPER_WHALE';
  else if (value > 15000) type = 'MEGA_WHALE';
  else if (value > 8000) type = 'WHALE';
  const marketMeta = trade.conditionId ? marketsByCondition.get(trade.conditionId) : undefined;
  const image = marketMeta?.image || trade.image || undefined;
  return {
    id: trade.id,
    type,
    event: trade.question || 'Unknown Market',
    outcome: trade.outcome || 'Unknown',
    odds: Math.round(price * 100),
    value,
    timestamp: trade.timestamp.getTime(),
    side: trade.side as 'BUY' | 'SELL',
    image,
    wallet_context: {
      address: trade.walletProfile?.id || trade.walletAddress,
      label: trade.walletProfile?.label || 'Unknown',
      pnl_all_time: `$${(trade.walletProfile?.totalPnl || 0).toLocaleString()}`,
      win_rate: `${((trade.walletProfile?.winRate || 0) * 100).toFixed(0)}%`,
      is_fresh_wallet: trade.walletProfile?.isFresh || false,
    },
    trader_context: {
      tx_count: trade.walletProfile?.txCount || 0,
      max_trade_value: trade.walletProfile?.maxTradeValue || 0,
      activity_level: trade.walletProfile?.activityLevel || null,
    },
    analysis: {
      tags: [
        trade.isWhale && 'WHALE',
        trade.isSmartMoney && 'SMART_MONEY',
        trade.isFresh && 'FRESH_WALLET',
        trade.isSweeper && 'SWEEPER',
        (trade.walletProfile?.activityLevel === 'LOW' && (trade.walletProfile?.winRate || 0) > 0.7 && (trade.walletProfile?.totalPnl || 0) > 10000) && 'INSIDER',
      ].filter(Boolean) as string[],
    },
  };
});
```

```
31:159:app/api/top-trades/route.ts
const trades = await prisma.trade.findMany({
  where: whereClause,
  orderBy: { tradeValue: 'desc' },
  take: limit + 1,
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
  include: { walletProfile: true },
});
...
const anomalies = trades.map(trade => {
  const value = trade.tradeValue;
  const price = trade.price;
  let type: 'GOD_WHALE' | 'SUPER_WHALE' | 'MEGA_WHALE' | 'WHALE' | 'STANDARD' = 'STANDARD';
  if (value > 100000) type = 'GOD_WHALE';
  else if (value > 50000) type = 'SUPER_WHALE';
  else if (value > 15000) type = 'MEGA_WHALE';
  else if (value > 8000) type = 'WHALE';
  const marketMeta = trade.conditionId ? marketsByCondition.get(trade.conditionId) : undefined;
  const image = marketMeta?.image || trade.image || undefined;
  return {
    id: trade.id,
    type,
    event: trade.question || 'Unknown Market',
    outcome: trade.outcome || 'Unknown',
    odds: Math.round(price * 100),
    value,
    timestamp: trade.timestamp.getTime(),
    side: trade.side as 'BUY' | 'SELL',
    image,
    wallet_context: {
      address: (trade.walletProfile?.id && trade.walletProfile.id.trim()) || (trade.walletAddress && trade.walletAddress.trim()) || null,
      label: (trade.walletProfile?.label && trade.walletProfile.label.trim()) || 'Unknown',
      pnl_all_time: trade.walletProfile?.totalPnl ? `$${trade.walletProfile.totalPnl.toLocaleString()}` : '$0',
      win_rate: trade.walletProfile?.winRate ? `${(trade.walletProfile.winRate * 100).toFixed(0)}%` : '0%',
      is_fresh_wallet: trade.walletProfile?.isFresh || false,
    },
    trader_context: {
      tx_count: trade.walletProfile?.txCount || 0,
      max_trade_value: trade.walletProfile?.maxTradeValue || 0,
      activity_level: trade.walletProfile?.activityLevel || null,
    },
    analysis: {
      tags: [
        trade.isWhale && 'WHALE',
        trade.isSmartMoney && 'SMART_MONEY',
        trade.isFresh && 'FRESH_WALLET',
        trade.isSweeper && 'SWEEPER',
        (trade.walletProfile?.activityLevel === 'LOW' && (trade.walletProfile?.winRate || 0) > 0.7 && (trade.walletProfile?.totalPnl || 0) > 10000) && 'INSIDER',
      ].filter(Boolean) as string[],
    },
  };
});
```

```
4:154:app/api/leaderboard/route.ts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'snapshots';
    if (format === 'legacy') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const topWallets = await prisma.trade.groupBy({
        by: ['walletAddress'],
        where: { timestamp: { gte: sevenDaysAgo } },
        _sum: { tradeValue: true },
        _count: { id: true },
        orderBy: { _sum: { tradeValue: 'desc' } },
        take: 10,
      });
      const enriched = await Promise.all(
        topWallets.map(async (wallet) => {
          const profile = await prisma.walletProfile.findUnique({
            where: { id: wallet.walletAddress },
          });
          return {
            address: wallet.walletAddress,
            volume: wallet._sum.tradeValue || 0,
            tradeCount: wallet._count.id || 0,
            label: profile?.label || null,
            totalPnl: profile?.totalPnl || 0,
            winRate: profile?.winRate || 0,
          };
        })
      );
      return NextResponse.json(enriched);
    }

    const periods = ['Daily', 'Weekly', 'Monthly', 'All Time'];
    const result: Record<string, Array<{
      period: string;
      rank: number;
      totalPnl: number;
      accountName?: string | null;
      rankChange?: number | null;
    }>> = {};
    for (const period of periods) {
      const recentSnapshots = await prisma.walletLeaderboardSnapshot.findMany({
        where: { period },
        orderBy: { snapshotAt: 'desc' },
        select: { snapshotAt: true },
        distinct: ['snapshotAt'],
        take: 2,
      });
      if (recentSnapshots.length === 0) {
        continue;
      }
      const latestSnapshotAt = recentSnapshots[0].snapshotAt;
      const previousSnapshotAt = recentSnapshots.length > 1 ? recentSnapshots[1].snapshotAt : null;
      const latestSnapshots = await prisma.walletLeaderboardSnapshot.findMany({
        where: { period, snapshotAt: latestSnapshotAt, rank: { lte: 20 } },
        orderBy: { rank: 'asc' },
        select: { walletAddress: true, rank: true, accountName: true, totalPnl: true },
      });
      const previousRanks: Record<string, number> = {};
      if (previousSnapshotAt) {
        const previousSnapshots = await prisma.walletLeaderboardSnapshot.findMany({
          where: { period, snapshotAt: previousSnapshotAt, rank: { lte: 20 } },
          select: { walletAddress: true, rank: true },
        });
        for (const prev of previousSnapshots) {
          previousRanks[prev.walletAddress.toLowerCase()] = prev.rank;
        }
      }
      for (const snapshot of latestSnapshots) {
        const walletKey = snapshot.walletAddress.toLowerCase();
        if (!result[walletKey]) {
          result[walletKey] = [];
        }
        const previousRank = previousRanks[walletKey];
        let rankChange: number | null = null;
        if (previousRank !== undefined) {
          rankChange = previousRank - snapshot.rank;
        }
        result[walletKey].push({
          period,
          rank: snapshot.rank,
          totalPnl: snapshot.totalPnl,
          accountName: snapshot.accountName,
          rankChange,
        });
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
```

```
5:118:app/api/portfolio/route.ts
const searchParams = request.nextUrl.searchParams;
const address = searchParams.get('address');
...
const existingSnapshot = await prisma.walletPortfolioSnapshot.findFirst({
  where: { walletAddress, timestamp: { gt: fiveMinutesAgo } },
  orderBy: { timestamp: 'desc' },
});
...
const portfolio = await fetchPortfolio(walletAddress);
...
await prisma.walletProfile.upsert({
  where: { id: walletAddress },
  update: {},
  create: {
    id: walletAddress,
    totalPnl: portfolio.totalPnl,
    winRate: 0,
  },
});
const newSnapshot = await prisma.walletPortfolioSnapshot.create({
  data: {
    walletAddress,
    totalValue: portfolio.totalValue,
    totalPnl: portfolio.totalPnl,
    positions: portfolio.positions as any,
    timestamp: new Date(),
  },
});
```

#### Market & Intelligence Helpers
- `lib/config.ts` centralizes thresholds (MIN 1000, whale tiers 8k/15k/50k/100k), Polymarket endpoints (Gamma markets/portfolio, RTDS WebSocket, Data API trades), odds threshold 0.97, metadata refresh/heartbeat intervals, and enrichment tolerances.
- `lib/polymarket.ts` caches Gamma markets for 5 minutes (`fetchMarketsFromGamma`), parses market data into `marketsByCondition` and `assetIdToOutcome` maps (`parseMarketData`), provides Data API helpers (`fetchTradesFromDataAPI`, `fetchActivityFromDataAPI`), and `enrichTradeWithDataAPI` (tx hash or price/size/time matching) used by deprecated pipeline.
- `lib/intelligence.ts` sets up Redis cache with 24h TTL for trader profiles, uses Polygon RPC to count transactions for freshness, aggregates Polymarket positions to derive labels/whale flags, computes activity level, and analyzes order books for sweepers. Also decodes OrderFilled logs via viem for fallback tx parsing.

```
1:33:lib/config.ts
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
        METADATA_REFRESH_INTERVAL: 5 * 60 * 1000,
        HEARTBEAT_INTERVAL: 30000,
    },
    ENRICHMENT: {
        RATE_LIMIT_DELAY_MS: 200,
        BATCH_SIZE: 50,
        BATCH_INTERVAL_MS: 60 * 1000,
        TIME_WINDOW_MS: 5000,
        PRICE_TOLERANCE: 0.001,
        SIZE_TOLERANCE: 0.01,
        MAX_AGE_HOURS: 24,
    }
};
```

```
23:124:lib/polymarket.ts
export async function fetchMarketsFromGamma(init?: RequestInit): Promise<PolymarketMarket[]> {
    if (marketsCache && (Date.now() - marketsCache.timestamp < CACHE_TTL)) {
        return marketsCache.data;
    }
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
    const normalizedData = normalizeMarketResponse(data);
    marketsCache = { data: normalizedData, timestamp: Date.now() };
    return normalizedData;
}
...
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
        ...
        marketsByCondition.set(market.conditionId, meta);
        if (tokenIds && Array.isArray(tokenIds) && outcomes && Array.isArray(outcomes)) {
            tokenIds.forEach((assetId, index) => {
                const outcomeLabel = outcomes[index] || 'Unknown';
                assetIdToOutcome.set(assetId, { outcomeLabel, conditionId: market.conditionId });
                allAssetIds.push(assetId);
            });
        }
    });
    return { marketsByCondition, assetIdToOutcome, allAssetIds };
}
```

```
6:172:lib/intelligence.ts
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { ... });
...
export async function getTraderProfile(address: string): Promise<TraderProfile> {
  const cacheKey = `wallet:${address.toLowerCase()}`;
  const cacheTTL = 24 * 60 * 60;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const profile = JSON.parse(cached) as TraderProfile;
      return profile;
    }
  } catch (error) {}
  const [apiProfile, txCount] = await Promise.all([
    fetchTraderProfileFromAPI(address),
    checkWalletFreshness(address as `0x${string}`),
  ]);
  let activityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (txCount > 500) activityLevel = 'HIGH';
  else if (txCount > 50) activityLevel = 'MEDIUM';
  const profile: TraderProfile = {
    address: address.toLowerCase(),
    label: apiProfile.label || null,
    totalPnl: apiProfile.totalPnl || 0,
    winRate: apiProfile.winRate || 0,
    isFresh: txCount < 10,
    txCount,
    maxTradeValue: 0,
    activityLevel,
    isSmartMoney: apiProfile.isSmartMoney || false,
    isWhale: apiProfile.isWhale || false,
  };
  await redis.setex(cacheKey, cacheTTL, JSON.stringify(profile));
  return profile;
}
...
export async function analyzeMarketImpact(assetId: string, tradeSize: number, side: 'BUY' | 'SELL'): Promise<{ isSweeper: boolean; liquidityAvailable: number; priceImpact: number; }> {
  const url = `https://clob.polymarket.com/book?token_id=${assetId}`;
  const response = await fetch(url);
  ...
  const isSweeper = accumulatedLiquidity < tradeSize || levelsSwept > 3;
  return { isSweeper, liquidityAvailable: accumulatedLiquidity, priceImpact };
}
```

#### Background Worker (`server/worker.ts`)
- Sets up Socket.io server on port 3001 with health endpoint. Maintains bounded caches (`marketsByCondition`, `assetIdToOutcome`) refreshed via Gamma metadata. Adaptive rate limiter tracks error counts for backoff.
- `processRTDSTrade` is primary ingestion path: filters low-value/high-odds trades, resolves asset/condition metadata, uses `proxyWallet` directly, emits initial `EnrichedTrade` to UI and saves to DB (upsert wallet profile, create trade marked enriched). Then fetches trader profile and market impact, updates wallet profile and trade flags, triggers portfolio enrichment for whales/smart money, emits fully enriched trade, and sends Discord alerts for whale/smart money.
- Deprecated `processTrade` and `runBatchEnrichment` remain for legacy CLOB/Data-API flows but not invoked.
- `connectToPolymarket` initializes metadata, connects to RTDS WebSocket (`wss://ws-live-data.polymarket.com`), subscribes to activity trades, dispatches messages to `processRTDSTrade`, and schedules metadata refresh (5m), leaderboard scraping (hourly), and cache cleanup (10m). Reconnects with exponential backoff (max 30s).
- `scrapeLeaderboard` fetches top 20 per timeframe from Polymarket leaderboard pages, normalizes profit/volume labels, and stores snapshots in DB for use by API/UI.

```
447:717:server/worker.ts
export async function processRTDSTrade(payload: RTDSTradePayload) {
  try {
    if (!payload.price || !payload.size || !payload.asset) return;
    const price = payload.price;
    const size = payload.size;
    const value = price * size;
    if (value < CONFIG.THRESHOLDS.MIN_VALUE) return;
    if (price > CONFIG.CONSTANTS.ODDS_THRESHOLD) return;
    const assetInfo = assetIdToOutcome.get(payload.asset);
    if (!assetInfo) {
      return;
    }
    const marketMeta = marketsByCondition.get(payload.conditionId || assetInfo.conditionId);
    if (!marketMeta) {
      return;
    }
    const side = payload.side || "BUY";
    const isWhale = value >= CONFIG.THRESHOLDS.WHALE;
    const isMegaWhale = value >= CONFIG.THRESHOLDS.MEGA_WHALE;
    const isSuperWhale = value >= CONFIG.THRESHOLDS.SUPER_WHALE;
    const isGodWhale = value >= CONFIG.THRESHOLDS.GOD_WHALE;
    const walletAddress = payload.proxyWallet?.toLowerCase() || "";
    if (!walletAddress) {
      return;
    }
    const timestamp = new Date(payload.timestamp * 1000);
    const initialEnrichedTrade: EnrichedTrade = {
      type: "UNUSUAL_ACTIVITY",
      market: {
        question: payload.title || marketMeta.question,
        outcome: payload.outcome || assetInfo.outcomeLabel,
        conditionId: payload.conditionId || assetInfo.conditionId,
        odds: Math.round(price * 100),
        image: payload.icon || marketMeta.image || null,
      },
      trade: { assetId: payload.asset, size, side, price, tradeValue: value, timestamp },
      analysis: {
        tags: [
          isGodWhale && "GOD_WHALE",
          isSuperWhale && "SUPER_WHALE",
          isMegaWhale && "MEGA_WHALE",
          isWhale && "WHALE",
        ].filter(Boolean) as string[],
        wallet_context: {
          address: walletAddress,
          label: payload.pseudonym || walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4),
          pnl_all_time: "...",
          win_rate: "...",
          is_fresh_wallet: false,
        },
        market_impact: { swept_levels: 0, slippage_induced: "0%" },
        trader_context: { tx_count: 0, max_trade_value: 0, activity_level: null },
      },
    };
    io.emit("trade", initialEnrichedTrade);
    let dbTrade: Awaited<ReturnType<typeof prisma.trade.create>> | undefined;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.walletProfile.upsert({
          where: { id: walletAddress },
          update: { lastUpdated: new Date() },
          create: {
            id: walletAddress,
            label: payload.pseudonym || null,
            totalPnl: 0,
            winRate: 0,
            isFresh: false,
            txCount: 0,
            maxTradeValue: value,
            activityLevel: null,
            lastUpdated: new Date(),
          },
        });
        dbTrade = await tx.trade.create({
          data: {
            assetId: payload.asset,
            side,
            size,
            price,
            tradeValue: value,
            timestamp,
            walletAddress: walletAddress,
            isWhale,
            isSmartMoney: false,
            isFresh: false,
            isSweeper: false,
            conditionId: payload.conditionId || assetInfo.conditionId,
            outcome: payload.outcome || assetInfo.outcomeLabel,
            question: payload.title || marketMeta.question,
            image: payload.icon || marketMeta.image || null,
            transactionHash: payload.transactionHash || null,
            enrichmentStatus: "enriched",
          },
        });
      });
    } catch (dbError) {
      return;
    }

    const profile = await getTraderProfile(walletAddress);
    const impact = await analyzeMarketImpact(payload.asset, size, side as "BUY" | "SELL");
    const isSmartMoney = profile.isSmartMoney;
    const isFresh = profile.isFresh;
    const isSweeper = impact.isSweeper;
    const isInsider =
      profile.activityLevel === "LOW" &&
      profile.winRate > 0.7 &&
      profile.totalPnl > 10000;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.walletProfile.upsert({
          where: { id: walletAddress },
          update: {
            label: profile.label || payload.pseudonym || null,
            totalPnl: profile.totalPnl,
            winRate: profile.winRate,
            isFresh: profile.isFresh,
            txCount: profile.txCount,
            maxTradeValue: Math.max(profile.maxTradeValue, value),
            activityLevel: profile.activityLevel,
            lastUpdated: new Date(),
          },
          create: {
            id: walletAddress,
            label: profile.label || payload.pseudonym || null,
            totalPnl: profile.totalPnl,
            winRate: profile.winRate,
            isFresh: profile.isFresh,
            txCount: profile.txCount,
            maxTradeValue: value,
            activityLevel: profile.activityLevel,
          },
        });
        if (!dbTrade) return;
        await tx.trade.update({
          where: { id: dbTrade.id },
          data: {
            isSmartMoney,
            isFresh,
            isSweeper,
            enrichmentStatus: "enriched",
          }
        });
      });
      if (isWhale || isSmartMoney || isGodWhale || isSuperWhale || isMegaWhale) {
        enrichWalletPortfolio(walletAddress).catch(err =>
          console.error(`[Worker] Background portfolio enrichment failed:`, err)
        );
      }
    } catch (dbUpdateError) {}

    const fullEnrichedTrade: EnrichedTrade = {
      ...initialEnrichedTrade,
      analysis: {
        tags: [
          isGodWhale && "GOD_WHALE",
          isSuperWhale && "SUPER_WHALE",
          isMegaWhale && "MEGA_WHALE",
          isWhale && "WHALE",
          isSmartMoney && "SMART_MONEY",
          isFresh && "FRESH_WALLET",
          isSweeper && "SWEEPER",
          isInsider && "INSIDER",
        ].filter(Boolean) as string[],
        wallet_context: {
          address: walletAddress,
          label: profile.label || payload.pseudonym || "Unknown",
          pnl_all_time: `$${profile.totalPnl.toLocaleString()}`,
          win_rate: `${(profile.winRate * 100).toFixed(0)}%`,
          is_fresh_wallet: isFresh,
        },
        market_impact: {
          swept_levels: impact.isSweeper ? 3 : 0,
          slippage_induced: `${impact.priceImpact.toFixed(2)}%`,
        },
        trader_context: {
          tx_count: profile.txCount,
          max_trade_value: Math.max(profile.maxTradeValue, value),
          activity_level: profile.activityLevel,
        },
      }
    };
    io.emit("trade", fullEnrichedTrade);
    if (isGodWhale || isSuperWhale || isMegaWhale || isWhale) {
      await sendDiscordAlert(fullEnrichedTrade, "WHALE_MOVEMENT");
    } else if (isSmartMoney) {
      await sendDiscordAlert(fullEnrichedTrade, "SMART_MONEY_ENTRY");
    }
  } catch (error) {
  }
}
```

```
1214:1337:server/worker.ts
function connectToPolymarket() {
  let ws: WebSocket | null = null;
  let heartbeatInterval: NodeJS.Timeout;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_DELAY = 30000;
  const connect = async () => {
    await updateMarketMetadata();
    ws = new WebSocket(CONFIG.URLS.WS_RTDS);
    ws.on("open", () => {
      const subscribeMsg = {
        action: "subscribe",
        subscriptions: [
          { topic: "activity", type: "trades", filters: "" }
        ]
      };
      ws?.send(JSON.stringify(subscribeMsg));
      heartbeatInterval = setInterval(() => {}, CONFIG.CONSTANTS.HEARTBEAT_INTERVAL);
      setInterval(async () => { await updateMarketMetadata(); }, CONFIG.CONSTANTS.METADATA_REFRESH_INTERVAL);
      setInterval(scrapeLeaderboard, LEADERBOARD_SCRAPE_INTERVAL_MS);
      setTimeout(scrapeLeaderboard, 30000);
      setInterval(() => {
        const now = Date.now();
        for (const [key, value] of userAlertCache.entries()) {
          if (value.expires < now) {
            userAlertCache.delete(key);
          }
        }
      }, 10 * 60 * 1000);
    });
    ws.on("message", (data: WebSocket.Data) => {
      const parsed: RTDSMessage = JSON.parse(data.toString());
      if (parsed.topic !== "activity" || parsed.type !== "trades" || !parsed.payload) {
        return;
      }
      const payload = parsed.payload;
      if (!payload.asset || !payload.price || !payload.size || !payload.proxyWallet) {
        return;
      }
      processRTDSTrade(payload).catch(console.error);
    });
    ws.on("error", (error) => {});
    ws.on("close", () => {
      clearInterval(heartbeatInterval);
      setTimeout(connect, Math.min(1000 * Math.pow(2, reconnectAttempts++), MAX_RECONNECT_DELAY));
    });
  };
  connect();
}
```

```
166:239:server/worker.ts
async function scrapeLeaderboard() {
  const allRows: LeaderboardRow[] = [];
  try {
    for (const { url, timeframe } of LEADERBOARD_URLS) {
      const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ..." } }).then((r) => r.text());
      const $ = load(html);
      const rows: LeaderboardRow[] = [];
      $(".flex.flex-col.gap-2.py-5.border-b").each((i, row) => {
        if (i >= 20) return;
        const $row = $(row);
        const usernameAnchor = $row.find('a[href^="/profile/"]').last();
        const displayName = usernameAnchor.text().trim();
        const wallet = usernameAnchor.attr("href")!.replace("/profile/", "");
        const profitLabel = $row.find("p.text-text-primary").text().trim();
        const volumeLabel = $row.find("p.text-text-secondary").text().trim();
        rows.push({ timeframe, rank: i + 1, displayName, wallet, profitLabel, volumeLabel });
      });
      allRows.push(...rows);
    }
    if (allRows.length > 0) {
      const snapshotAt = new Date();
      const rowsToInsert = allRows.map((row) => ({
        walletAddress: row.wallet,
        period: row.timeframe,
        rank: row.rank,
        totalPnl: parseCurrency(row.profitLabel) ?? 0,
        totalVolume: parseCurrency(row.volumeLabel) ?? 0,
        winRate: 0,
        snapshotAt,
        accountName: row.displayName,
      }));
      await prisma.walletLeaderboardSnapshot.createMany({ data: rowsToInsert });
    }
  } catch (error) {}
}
```

#### Database Schema (Prisma)
- `Trade` stores assetId, side/size/price/value, timestamp, walletAddress (FK to `WalletProfile`), intelligence flags (`isWhale`, `isSmartMoney`, `isFresh`, `isSweeper`), conditionId/outcome/question/image, transaction metadata (hash, blockNumber, logIndex), and `enrichmentStatus` with indexes on wallet/timestamp/flags.
- `WalletProfile` tracks labels, totalPnl/winRate, freshness, txCount, maxTradeValue, activityLevel, lastUpdated.
- `WalletLeaderboardSnapshot` records rank snapshots per period with totalPnl/volume, accountName, snapshotAt.
- `WalletPortfolioSnapshot` stores Gamma positions per wallet with totalValue/totalPnl and timestamp.

```
23:58:prisma/schema.prisma
model Trade {
  id            String   @id @default(cuid())
  assetId       String
  side          String
  size          Float
  price         Float
  tradeValue    Float
  timestamp     DateTime
  walletAddress String   @default("")
  walletProfile WalletProfile? @relation(fields: [walletAddress], references: [id])
  isWhale       Boolean  @default(false)
  isSmartMoney  Boolean  @default(false)
  isFresh       Boolean  @default(false)
  isSweeper     Boolean  @default(false)
  conditionId   String?
  outcome       String?
  question      String?
  image         String?
  transactionHash  String?
  blockNumber      BigInt?
  logIndex         Int?
  enrichmentStatus String?  @default("pending")
  @@index([walletAddress])
  @@index([timestamp])
  @@index([isWhale, timestamp])
  @@index([transactionHash])
  @@index([enrichmentStatus, timestamp])
  @@map("trades")
}
```

### Data Flow
1. Worker loads market metadata then connects to RTDS WebSocket, subscribes to `activity:trades`, and dispatches validated payloads to `processRTDSTrade` (`server/worker.ts`).
2. `processRTDSTrade` filters/classifies trade, resolves metadata, emits initial trade to Socket.io, persists trade/wallet, enriches with trader profile and market impact, updates DB, emits full enriched trade, and optionally triggers Discord alerts/portfolio enrichment.
3. Client `startStream` connects to Socket.io, receives trade events, normalizes to `Anomaly`, and stores if it passes current preferences (`lib/store.ts`).
4. On load, client fetches `/api/history` for last 24h whale trades; infinite scroll uses cursor pagination.
5. Top trades panel fetches `/api/top-trades` for selected period with cursor pagination.
6. Leaderboard ranks derive from snapshot API (new format) or legacy top-volume aggregation; ranks feed front-end top-20 filtering and display.
7. Portfolio API returns recent or cached Gamma positions; used in wallet portfolio views inside modal.

### Key Patterns
- RTDS → Socket.io fan-out with two-phase emission (initial then enriched) for low-latency UI updates.
- In-memory caches: Gamma markets (5m TTL) plus bounded maps for metadata; Redis caching of trader profiles (24h TTL).
- Cursor pagination pattern (limit+1) across history and top-trades APIs.
- Leaderboard snapshots scraped hourly and served via API with rank deltas.
- LocalStorage-backed preferences with auto-save on change.

### Configuration
- Whale thresholds and odds cutoffs in `lib/config.ts`.
- RTDS endpoint `wss://ws-live-data.polymarket.com`; Socket.io server default `http://localhost:3001`.
- Metadata refresh 5 minutes; leaderboard scrape hourly; cache cleanup 10 minutes; Socket heartbeat 30s.
- Enrichment tolerances: 0.1% price, 1% size, ±5s window for legacy Data API matching.

### Type Definitions
- `Anomaly` (frontend shape with wallet/trader/impact contexts) in `lib/types.ts`.
- `EnrichedTrade` (worker->client payload) in `lib/types.ts`.
- `RTDSTradePayload` / `RTDSMessage` structure for WebSocket messages in `lib/types.ts`.
- Market/trade helper types (`MarketMeta`, `AssetOutcome`, `DataAPITrade/Activity`) in `lib/types.ts`.

### Error Handling & Resilience
- Worker WebSocket reconnects with exponential backoff; heartbeat/cleanup timers guard stale connections.
- Trade processing, API routes, and enrichment wrap operations in try/catch with logging and non-fatal fallbacks.
- Redis/cache failures and DB write errors log but do not crash worker or API.
