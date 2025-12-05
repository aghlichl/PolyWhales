## Analysis: OddsGods Trading Platform (2025-12-05)

### Overview
OddsGods ingests Polymarket RTDS trades in a worker, enriches them with market metadata and trader intelligence, stores them in Postgres, fans out updates via Socket.io to a Next.js client, and serves API routes for history, top trades, leaderboard snapshots, portfolios, and proxy market data. The client streams live anomalies with filters/search, renders top whales and a leaderboard page, and is wrapped in a Privy auth provider.

### Entry Points
- `app/page.tsx` – live feed UI (filters, search, infinite scroll, stream start).
- `app/leaderboard/page.tsx` + `app/actions/leaderboard.ts` – server-rendered whale leaderboard backed by Prisma snapshots/positions.
- `lib/store.ts` – Zustand stores for preferences, anomalies, history/top trades, leaderboard ranks.
- `server/worker.ts` – RTDS ingestion/enrichment, DB writes, Socket.io broadcast, Discord alerts, leaderboard scraping.
- API routes: `app/api/history`, `top-trades`, `top-whales`, `market-history`, `leaderboard`, `portfolio`, `proxy/polymarket/markets`, `save-trade`.

### Client Surface (app/page.tsx & components)
- Filters by value/odds, optional top-20 leaderboard wallets, sports toggle, plus search; uses QuickSearchFilters and BottomCarousel for mobile paging. Stream starts once on mount; an intersection observer loads additional history when the sentinel enters view.

```22:70:app/page.tsx
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
  const isSports = Boolean(anomaly.sport || anomaly.analysis?.market_context?.sport || anomaly.analysis?.market_context?.league);
  const sportsKeywordMatch = ['vs.', 'spread:', 'win on 202', 'counter-strike'].some(keyword => anomaly.event.toLowerCase().includes(keyword));
  if (!preferences.showSports && (isSports || sportsKeywordMatch)) {
    return false;
  }
  switch (anomaly.type) {
    case 'STANDARD': return preferences.showStandard;
    case 'WHALE': return preferences.showWhale;
    case 'MEGA_WHALE': return preferences.showMegaWhale;
    case 'SUPER_WHALE': return preferences.showSuperWhale;
    case 'GOD_WHALE': return preferences.showGodWhale;
    default: return true;
  }
}
```

- Center feed uses `SlotReel` with `AnomalyCard`; right panel `TopWhales` consumes top-trades store; left panel `UserPreferences`. Floating search and scroll-to-top buttons; Privy provider wraps the app in `app/layout.tsx`.

### State & Streaming (lib/store.ts)
- Preferences store persists to localStorage after initial load; defaults allow all tiers, odds 1–99, no threshold.
- Market store manages anomalies (dedup, cap 2k), volume, ticker, history pagination, top-trades pagination, leaderboard ranks. `startStream` opens Socket.io to the worker, maps `EnrichedTrade` payloads into `Anomaly` with metadata/crowding/event contexts, validates timestamps, then stores if preferences pass. History/top-trades use limit+1 cursor pagination; leaderboard ranks fetched once in snapshot format.

```208:234:lib/store.ts
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
  return { anomalies: newAnomalies, volume: newVolume, tickerItems: newTickerItems };
}),
```

```287:375:lib/store.ts
startStream: (getPreferences) => {
  get().loadHistory();
  const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', { transports: ['websocket'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5 });
  socket.on('trade', (enrichedTrade) => {
    const walletContext = enrichedTrade.analysis?.wallet_context;
    if (!walletContext || !walletContext.address) return;
    const tsRaw = enrichedTrade.trade.timestamp;
    const ts = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);
    if (Number.isNaN(ts.getTime())) return;
    const marketContext = enrichedTrade.analysis?.market_context;
    const eventContext = enrichedTrade.analysis?.event;
    const crowding = enrichedTrade.analysis?.crowding;
    const anomaly: Anomaly = {
      id: enrichedTrade.trade.assetId + '_' + ts.getTime(),
      type: enrichedTrade.analysis.tags.includes('GOD_WHALE') ? 'GOD_WHALE' :
        enrichedTrade.analysis.tags.includes('SUPER_WHALE') ? 'SUPER_WHALE' :
          enrichedTrade.analysis.tags.includes('MEGA_WHALE') ? 'MEGA_WHALE' :
            enrichedTrade.analysis.tags.includes('WHALE') ? 'WHALE' : 'STANDARD',
      event: enrichedTrade.market.question,
      outcome: enrichedTrade.market.outcome,
      odds: enrichedTrade.market.odds,
      value: enrichedTrade.trade.tradeValue,
      timestamp: ts.getTime(),
      side: enrichedTrade.trade.side as 'BUY' | 'SELL',
      image: enrichedTrade.market.image,
      category: marketContext?.category || null,
      sport: marketContext?.sport || null,
      league: marketContext?.league || null,
      feeBps: marketContext?.feeBps ?? null,
      liquidity: marketContext?.liquidity ?? null,
      volume24h: marketContext?.volume24h ?? null,
      closeTime: marketContext?.closeTime || null,
      openTime: marketContext?.openTime || null,
      resolutionTime: marketContext?.resolutionTime || null,
      resolutionSource: marketContext?.resolutionSource || null,
      denominationToken: marketContext?.denominationToken || null,
      liquidity_bucket: marketContext?.liquidity_bucket || null,
      time_to_close_bucket: marketContext?.time_to_close_bucket || null,
      eventId: eventContext?.id || null,
      eventTitle: eventContext?.title || null,
      tags: enrichedTrade.analysis.tags,
      crowding,
      wallet_context: {
        address: walletContext.address,
        label: walletContext.label || walletContext.address.slice(0, 6) + '...' + walletContext.address.slice(-4),
        pnl_all_time: walletContext.pnl_all_time || '...',
        win_rate: walletContext.win_rate || '...',
        is_fresh_wallet: walletContext.is_fresh_wallet || false,
      },
      trader_context: enrichedTrade.analysis.trader_context,
      market_impact: enrichedTrade.analysis.market_impact,
      analysis: { tags: enrichedTrade.analysis.tags, event: eventContext, market_context: marketContext, crowding }
    };
    const currentPreferences = getPreferences?.();
    if (!currentPreferences || passesPreferences(anomaly, currentPreferences)) {
      get().addAnomaly(anomaly);
    }
  });
  return () => socket.disconnect();
},
```

### UI Components
- `components/feed/anomaly-card.tsx` resolves team logos via `teamResolver`, surfaces leaderboard ranks (name only if top-20), and shows market metadata (sport/league buckets, liquidity, time-to-close).
- `components/feed/trade-details-modal.tsx` fetches `/api/market-history` when opened, charts price and wallet trades, computes P/L via `calculatePositionPL`, shows crowding stats and wallet leaderboard ranks, and embeds `WalletPortfolio` with `/api/portfolio`.
- `components/top-whales.tsx` loads top trades for the selected period with rank badges and a load-more button.
- `components/leaderboard/leaderboard-table.tsx` renders server-fetched snapshot rows with tabs per period and expandable top positions.
- `components/wallet-portfolio.tsx` fetches the latest portfolio snapshot or stale fallback for a wallet.

### API Routes
- `app/api/history/route.ts` – last 24h trades (`tradeValue > 5000`), cursor pagination, enriched with current market metadata (category/sport/league/fee/liquidity/volume/buckets), wallet profile context, and crowding tags reconstructed from flags.

```88:145:app/api/history/route.ts
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
  const marketContext = { category: marketMeta?.category || trade.marketCategory || null, sport: marketMeta?.sport || trade.sport || null, league: marketMeta?.league || trade.league || null, feeBps: marketMeta?.feeBps ?? trade.feeBps ?? null, liquidity: marketMeta?.liquidity ?? trade.liquidity ?? null, volume24h: marketMeta?.volume24h ?? trade.volume24h ?? null, closeTime: marketMeta?.closeTime || trade.closeTime?.toISOString() || null, openTime: marketMeta?.openTime || trade.openTime?.toISOString() || null, resolutionTime: marketMeta?.resolutionTime || trade.resolutionTime?.toISOString() || null, resolutionSource: marketMeta?.resolutionSource || trade.resolutionSource || null, denominationToken: marketMeta?.denominationToken || trade.denominationToken || null, liquidity_bucket: trade.marketDepthBucket || null, time_to_close_bucket: trade.timeToCloseBucket || null };
  const eventContext = { id: trade.eventId || undefined, title: trade.eventTitle || undefined, slug: trade.eventSlug || null };
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
    category: trade.marketCategory || null,
    sport: trade.sport || null,
    league: trade.league || null,
    feeBps: trade.feeBps ?? null,
    liquidity: trade.liquidity ?? null,
    volume24h: trade.volume24h ?? null,
    closeTime: trade.closeTime?.toISOString() || null,
    openTime: trade.openTime?.toISOString() || null,
    resolutionTime: trade.resolutionTime?.toISOString() || null,
    resolutionSource: trade.resolutionSource || null,
    denominationToken: trade.denominationToken || null,
    liquidity_bucket: trade.marketDepthBucket || null,
    time_to_close_bucket: trade.timeToCloseBucket || null,
    eventId: trade.eventId || null,
    eventTitle: trade.eventTitle || null,
    tags: trade.tags || [],
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
        ...(trade.tags || []),
      ].filter(Boolean) as string[],
      event: eventContext,
      market_context: marketContext,
      crowding: {
        top5_share: trade.holderTop5Share ?? null,
        top10_share: trade.holderTop10Share ?? null,
        holder_count: trade.holderCount ?? null,
        smart_holder_count: trade.smartHolderCount ?? null,
        label: trade.holderTop5Share ? 'crowding' : null,
      },
    },
  };
});
```

- `app/api/top-trades/route.ts` – period filter (today/weekly/monthly/yearly/max), `tradeValue > 1000`, sorted by value desc, cursor pagination, returns anomalies with event/market contexts and tags (whale/smart/fresh/sweeper/insider plus stored tags).

```96:190:app/api/top-trades/route.ts
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
  const marketContext = {
    category: trade.marketCategory || null,
    sport: trade.sport || null,
    league: trade.league || null,
    feeBps: trade.feeBps ?? null,
    liquidity: trade.liquidity ?? null,
    volume24h: trade.volume24h ?? null,
    closeTime: trade.closeTime?.toISOString() || null,
    openTime: trade.openTime?.toISOString() || null,
    resolutionTime: trade.resolutionTime?.toISOString() || null,
    resolutionSource: trade.resolutionSource || null,
    denominationToken: trade.denominationToken || null,
    liquidity_bucket: trade.marketDepthBucket || null,
    time_to_close_bucket: trade.timeToCloseBucket || null,
  };
  const eventContext = { id: trade.eventId || undefined, title: trade.eventTitle || undefined, slug: trade.eventSlug || null };
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
    category: trade.marketCategory || null,
    sport: trade.sport || null,
    league: trade.league || null,
    feeBps: trade.feeBps ?? null,
    liquidity: trade.liquidity ?? null,
    volume24h: trade.volume24h ?? null,
    closeTime: trade.closeTime?.toISOString() || null,
    openTime: trade.openTime?.toISOString() || null,
    resolutionTime: trade.resolutionTime?.toISOString() || null,
    resolutionSource: trade.resolutionSource || null,
    denominationToken: trade.denominationToken || null,
    liquidity_bucket: trade.marketDepthBucket || null,
    time_to_close_bucket: trade.timeToCloseBucket || null,
    eventId: trade.eventId || null,
    eventTitle: trade.eventTitle || null,
    tags: trade.tags || [],
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
        ...(trade.tags || []),
      ].filter(Boolean) as string[],
      event: eventContext,
      market_context: marketContext,
      crowding: {
        top5_share: trade.holderTop5Share ?? null,
        top10_share: trade.holderTop10Share ?? null,
        holder_count: trade.holderCount ?? null,
        smart_holder_count: trade.smartHolderCount ?? null,
        label: trade.holderTop5Share ? 'crowding' : null,
      },
    },
  };
});
```

- `app/api/market-history/route.ts` – caches markets (5m) and wallet activity (10m), fetches price history around trade timestamp from DB, pulls last 50 wallet trades from Polymarket Data API with market name lookup, and calculates win-rate/PnL stats for last 5/10/50 trades.

```24:190:app/api/market-history/route.ts
let marketCache: { data: Map<string, any>; timestamp: number } | null = null;
let walletCache: { [key: string]: { data: any[]; timestamp: number } } = {};
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const question = searchParams.get('question');
  const outcome = searchParams.get('outcome');
  const walletAddress = searchParams.get('walletAddress');
  const tradeTimestamp = searchParams.get('tradeTimestamp');
  if (!question || !outcome) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }
  try {
    let marketsByCondition = new Map<string, any>();
    if (!marketCache || Date.now() - marketCache.timestamp > 5 * 60 * 1000) {
      const markets = await fetchMarketsFromGamma();
      const result = parseMarketData(markets);
      marketCache = { data: result.marketsByCondition, timestamp: Date.now() };
    }
    marketsByCondition = marketCache.data;
    const whereClause: any = { question, outcome };
    let takeLimit = 100;
    if (tradeTimestamp) {
      const tradeTime = new Date(parseInt(tradeTimestamp));
      const startTime = new Date(tradeTime.getTime() - 12 * 60 * 60 * 1000);
      const endTime = new Date(tradeTime.getTime() + 12 * 60 * 60 * 1000);
      whereClause.timestamp = { gte: startTime, lte: endTime };
      takeLimit = 500;
    }
    const priceHistory = await prisma.trade.findMany({ where: whereClause, orderBy: { timestamp: 'desc' }, take: takeLimit, select: { timestamp: true, price: true, tradeValue: true, side: true } });
    let walletHistory: Array<{ timestamp: Date; question: string; outcome: string; side: string; price: number; tradeValue: number; conditionId?: string; }> = [];
    if (walletAddress) {
      let activities;
      const cached = walletCache[walletAddress];
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
        activities = cached.data;
      } else {
        activities = await fetchActivityFromDataAPI({ user: walletAddress, type: 'TRADE', limit: 50, sortBy: 'TIMESTAMP', sortDirection: 'DESC' });
        walletCache[walletAddress] = { data: activities, timestamp: Date.now() };
      }
      walletHistory = activities.map(activity => {
        const marketMeta = marketsByCondition.get(activity.conditionId);
        const marketName = marketMeta?.question || activity.market || 'Unknown Market';
        return {
          timestamp: new Date(activity.timestamp * 1000),
          question: marketName,
          outcome: activity.outcome || 'Unknown',
          side: activity.side,
          price: parseFloat(activity.price),
          tradeValue: parseFloat(activity.usdcSize),
          conditionId: activity.conditionId,
        };
      });
    }
    const sortedPriceHistory = priceHistory.reverse().map(t => ({ ...t, timestamp: t.timestamp.getTime(), price: t.price * 100 }));
    const sortedWalletHistory = walletHistory.slice().reverse().map(t => ({ ...t, timestamp: t.timestamp.getTime(), price: t.price * 100 }));
    return NextResponse.json({ priceHistory: sortedPriceHistory, walletHistory: sortedWalletHistory, stats: calculateStats(walletHistory, marketsByCondition) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch market history' }, { status: 500 });
  }
}
```

- `app/api/leaderboard/route.ts` – `format=snapshots` returns top-20 per period with rank deltas between the two latest snapshots; `format=legacy` aggregates 7d volume/trade count with wallet profile enrichment.
- `app/api/portfolio/route.ts` – returns a 5-minute fresh snapshot or fetches from Gamma, upserts wallet profile, stores snapshot, and falls back to the newest stale snapshot on errors.
- `app/api/top-whales/route.ts` – top 20 `walletProfile` rows by total PnL with trade counts.
- `app/api/save-trade/route.ts` – manual trade ingestion with wallet upsert and enriched trade record.
- `app/api/proxy/polymarket/markets/route.ts` – cached 60s proxy to Gamma markets via the shared helper.

### Worker Pipeline (server/worker.ts)
- Initializes Socket.io server (port 3001) with a health check, bounded metadata caches, adaptive rate limiter, and user alert preference cache. `updateMarketMetadata` refreshes Gamma markets into bounded maps for conditionId/assetId lookups.
- `processRTDSTrade` handles RTDS activity trades: validates thresholds/odds, resolves asset/market metadata, builds market/event contexts, merges whale tags with market tags, emits initial `EnrichedTrade`, persists trade + wallet profile, enriches with trader profile & trade stats & market impact, updates DB flags, optionally enriches wallet portfolio, emits the full trade, and sends Discord alerts per user webhook for whale/smart-money entries.

```472:599:server/worker.ts
export async function processRTDSTrade(payload: RTDSTradePayload) {
  if (!payload.price || !payload.size || !payload.asset) return;
  const price = payload.price; const size = payload.size; const value = price * size;
  if (value < CONFIG.THRESHOLDS.MIN_VALUE) return;
  if (price > CONFIG.CONSTANTS.ODDS_THRESHOLD) return;
  const assetInfo = assetIdToOutcome.get(payload.asset); if (!assetInfo) return;
  const marketMeta = marketsByCondition.get(payload.conditionId || assetInfo.conditionId); if (!marketMeta) return;
  const closeTimeIso = marketMeta.closeTime || null;
  const liquidityBucket = computeLiquidityBucket(marketMeta.liquidity);
  const timeToCloseBucket = computeTimeToCloseBucket(closeTimeIso);
  const additionalTags = (marketMeta.tagNames || []).filter(Boolean);
  const baseWhaleTags = [
    value >= CONFIG.THRESHOLDS.GOD_WHALE && "GOD_WHALE",
    value >= CONFIG.THRESHOLDS.SUPER_WHALE && "SUPER_WHALE",
    value >= CONFIG.THRESHOLDS.MEGA_WHALE && "MEGA_WHALE",
    value >= CONFIG.THRESHOLDS.WHALE && "WHALE",
  ].filter(Boolean) as string[];
  const mergedTags = Array.from(new Set([...baseWhaleTags, ...additionalTags]));
  const marketContext = { category: marketMeta.category || null, sport: marketMeta.sport || null, league: marketMeta.league || null, feeBps: marketMeta.feeBps ?? null, liquidity: marketMeta.liquidity ?? null, volume24h: marketMeta.volume24h ?? null, closeTime: marketMeta.closeTime || null, openTime: marketMeta.openTime || null, resolutionTime: marketMeta.resolutionTime || null, resolutionSource: marketMeta.resolutionSource || null, denominationToken: marketMeta.denominationToken || null, liquidity_bucket: liquidityBucket, time_to_close_bucket: timeToCloseBucket };
  const eventContext = { id: marketMeta.eventId || undefined, title: marketMeta.eventTitle || undefined, slug: marketMeta.eventSlug || null };
  const cachedCrowding = getCachedHolderMetrics(payload.asset);
  const crowdingContext = cachedCrowding ? { top5_share: cachedCrowding.top5Share, top10_share: cachedCrowding.top10Share, holder_count: cachedCrowding.holderCount, smart_holder_count: cachedCrowding.smartHolderCount, label: "crowding" } : undefined;
  const side = payload.side || "BUY";
  const isWhale = value >= CONFIG.THRESHOLDS.WHALE;
  const isMegaWhale = value >= CONFIG.THRESHOLDS.MEGA_WHALE;
  const isSuperWhale = value >= CONFIG.THRESHOLDS.SUPER_WHALE;
  const isGodWhale = value >= CONFIG.THRESHOLDS.GOD_WHALE;
  const walletAddress = payload.proxyWallet?.toLowerCase() || ""; if (!walletAddress) return;
  const timestamp = new Date(payload.timestamp * 1000);
  const initialEnrichedTrade: EnrichedTrade = {
    type: "UNUSUAL_ACTIVITY",
    market: { question: payload.title || marketMeta.question, outcome: payload.outcome || assetInfo.outcomeLabel, conditionId: payload.conditionId || assetInfo.conditionId, odds: Math.round(price * 100), image: payload.icon || marketMeta.image || null },
    trade: { assetId: payload.asset, size, side, price, tradeValue: value, timestamp },
    analysis: {
      tags: mergedTags,
      event: eventContext,
      market_context: marketContext,
      crowding: crowdingContext,
      wallet_context: { address: walletAddress, label: payload.pseudonym || walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4), pnl_all_time: "...", win_rate: "...", is_fresh_wallet: false },
      market_impact: { swept_levels: 0, slippage_induced: "0%" },
      trader_context: { tx_count: 0, max_trade_value: 0, activity_level: null },
    },
  };
  io.emit("trade", initialEnrichedTrade);
  await prisma.$transaction(async (tx) => {
    await tx.walletProfile.upsert({ where: { id: walletAddress }, update: { lastUpdated: new Date() }, create: { id: walletAddress, label: payload.pseudonym || null, totalPnl: 0, winRate: 0, isFresh: false, txCount: 0, maxTradeValue: value, activityLevel: null, lastUpdated: new Date() } });
    dbTrade = await tx.trade.create({ data: { assetId: payload.asset, side, size, price, tradeValue: value, timestamp, walletAddress, isWhale, isSmartMoney: false, isFresh: false, isSweeper: false, conditionId: payload.conditionId || assetInfo.conditionId, outcome: payload.outcome || assetInfo.outcomeLabel, question: payload.title || marketMeta.question, image: payload.icon || marketMeta.image || null, transactionHash: payload.transactionHash || null, enrichmentStatus: "enriched", marketCategory: marketMeta.category || null, marketType: marketMeta.marketType || null, formatType: marketMeta.formatType || null, feeBps: marketMeta.feeBps ?? null, denominationToken: marketMeta.denominationToken || null, liquidity: marketMeta.liquidity ?? null, volume24h: marketMeta.volume24h ?? null, openTime: marketMeta.openTime ? new Date(marketMeta.openTime) : null, closeTime: marketMeta.closeTime ? new Date(marketMeta.closeTime) : null, resolutionTime: marketMeta.resolutionTime ? new Date(marketMeta.resolutionTime) : null, resolutionSource: marketMeta.resolutionSource || null, eventId: marketMeta.eventId || null, eventTitle: marketMeta.eventTitle || null, eventSlug: marketMeta.eventSlug || null, eventStart: marketMeta.eventStartTime ? new Date(marketMeta.eventStartTime) : null, eventEnd: marketMeta.eventEndTime ? new Date(marketMeta.eventEndTime) : null, tags: additionalTags as any, sport: marketMeta.sport || null, league: marketMeta.league || null, marketGroup: marketMeta.eventId || marketMeta.eventSlug || null, marketDepthBucket: null, timeToCloseBucket: timeToCloseBucket || null, holderTop5Share: cachedCrowding?.top5Share ?? null, holderTop10Share: cachedCrowding?.top10Share ?? null, holderCount: cachedCrowding?.holderCount ?? null, smartHolderCount: cachedCrowding?.smartHolderCount ?? null } });
  });
}
```

```680:806:server/worker.ts
const [profile, tradeStats] = await Promise.all([ getTraderProfile(walletAddress), fetchWalletTradeStats(walletAddress) ]);
const impact = await analyzeMarketImpact(payload.asset, size, side as "BUY" | "SELL");
const isSmartMoney = profile.isSmartMoney;
const isFresh = tradeStats.tradeCount < 10;
const isSweeper = impact.isSweeper;
const isInsider = tradeStats.activityLevel === "LOW" && profile.winRate > 0.7 && profile.totalPnl > 10000;
await prisma.$transaction(async (tx) => {
  await tx.walletProfile.upsert({ where: { id: walletAddress }, update: { label: profile.label || payload.pseudonym || null, totalPnl: profile.totalPnl, winRate: profile.winRate, isFresh: tradeStats.tradeCount < 10, txCount: tradeStats.tradeCount, maxTradeValue: Math.max(tradeStats.maxTradeValue, value), activityLevel: tradeStats.activityLevel, lastUpdated: new Date() }, create: { id: walletAddress, label: profile.label || payload.pseudonym || null, totalPnl: profile.totalPnl, winRate: profile.winRate, isFresh: tradeStats.tradeCount < 10, txCount: tradeStats.tradeCount, maxTradeValue: Math.max(tradeStats.maxTradeValue, value), activityLevel: tradeStats.activityLevel } });
  if (!dbTrade) return;
  await tx.trade.update({ where: { id: dbTrade.id }, data: { isSmartMoney, isFresh, isSweeper, enrichmentStatus: "enriched" } });
});
if (isWhale || isSmartMoney || isGodWhale || isSuperWhale || isMegaWhale) {
  enrichWalletPortfolio(walletAddress).catch(err => console.error(`[Worker] Background portfolio enrichment failed:`, err));
}
const fullEnrichedTrade: EnrichedTrade = {
  ...initialEnrichedTrade,
  analysis: {
    tags: Array.from(new Set([
      isGodWhale && "GOD_WHALE",
      isSuperWhale && "SUPER_WHALE",
      isMegaWhale && "MEGA_WHALE",
      isWhale && "WHALE",
      isSmartMoney && "SMART_MONEY",
      isFresh && "FRESH_WALLET",
      isSweeper && "SWEEPER",
      isInsider && "INSIDER",
      ...additionalTags,
    ].filter(Boolean) as string[])),
    event: eventContext,
    market_context: marketContext,
    crowding: crowdingContext,
    wallet_context: {
      address: walletAddress,
      label: profile.label || payload.pseudonym || "Unknown",
      pnl_all_time: `$${profile.totalPnl.toLocaleString()}`,
      win_rate: `${(profile.winRate * 100).toFixed(0)}%`,
      is_fresh_wallet: isFresh,
    },
    market_impact: { swept_levels: impact.isSweeper ? 3 : 0, slippage_induced: `${impact.priceImpact.toFixed(2)}%` },
    trader_context: {
      tx_count: tradeStats.tradeCount,
      max_trade_value: Math.max(tradeStats.maxTradeValue, value),
      activity_level: tradeStats.activityLevel,
    },
  }
};
io.emit("trade", fullEnrichedTrade);
if (isGodWhale || isSuperWhale || isMegaWhale || isWhale) {
  await sendDiscordAlert(fullEnrichedTrade, "WHALE_MOVEMENT");
} else if (isSmartMoney) {
  await sendDiscordAlert(fullEnrichedTrade, "SMART_MONEY_ENTRY");
}
```

- Alert formatting uses `lib/alerts/formatters.ts`; user alert settings are fetched and cached from Prisma. Heartbeat, metadata refresh, leaderboard scraping (hourly via cheerio), and cache cleanup are scheduled on RTDS connect. Legacy `processTrade` and `runBatchEnrichment` are retained but deprecated.

### Libraries & Helpers
- `lib/config.ts` – thresholds (min 1k; whale tiers 8k/15k/50k/100k), odds cutoff 0.97, metadata and heartbeat intervals.
- `lib/polymarket.ts` – Gamma markets fetch/cache + normalization, metadata parsing (event/tag/category/sport/fee/liquidity/volume/buckets), Data API trades/activity helpers with proxy wallet resolution and holder metrics cache, and trade enrichment with price/size/time tolerance.

```256:275:lib/polymarket.ts
export async function fetchActivityFromDataAPI(params: DataAPIActivityQuery): Promise<DataAPIActivity[]> {
  try {
    let userAddress = params.user;
    let activities = await fetchActivityWithAddress(userAddress, params);
    if (activities.length === 0) {
      const proxyWallet = await resolveProxyWallet(userAddress);
      if (proxyWallet && proxyWallet !== userAddress) {
        activities = await fetchActivityWithAddress(proxyWallet, { ...params, user: proxyWallet });
      }
    }
    return activities;
  } catch (error) {
    return [];
  }
}
```

- `lib/intelligence.ts` – Redis-backed trader profile cache (open+closed positions win-rate/PNL, freshness via Polygon tx count), trade stats via Data API, market impact via orderbook sweep analysis, tx log parsing via viem for OrderFilled events.

```173:221:lib/intelligence.ts
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
  try { await redis.setex(cacheKey, cacheTTL, JSON.stringify(profile)); } catch (error) {}
  return profile;
}
```

- `lib/gamma.ts` – fetches wallet portfolio from Gamma, normalizes positions, aggregates totals.

```8:72:lib/gamma.ts
export async function fetchPortfolio(walletAddress: string): Promise<GammaPortfolio | null> {
  try {
    const url = `${CONFIG.URLS.GAMMA_API_PORTFOLIO}?address=${walletAddress}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'OddsGods/1.0' } });
    if (!response.ok) return null;
    const data = await response.json();
    const rawPositions = Array.isArray(data) ? data : (data.positions || []);
    let totalValue = 0; let totalPnl = 0;
    const positions: GammaPosition[] = rawPositions.map((pos: any) => {
      const size = Number(pos.size || 0);
      const price = Number(pos.price || 0);
      const value = size * price;
      const avgPrice = Number(pos.avgPrice || pos.avg_price || 0);
      const pnl = (price - avgPrice) * size;
      totalValue += value; totalPnl += pnl;
      return { asset_id: pos.asset_id || '', condition_id: pos.condition_id || '', question: pos.question || '', outcome: pos.outcome || '', outcomeLabel: pos.outcomeLabel || pos.outcome_label || '', market: pos.market || '', size, price, value, avgPrice, pnl, pnlPercent: avgPrice > 0 ? (pnl / (avgPrice * size)) * 100 : 0, image: pos.image || '' };
    });
    return { address: walletAddress, totalValue, totalPnl, totalPnlPercent: totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0, positions };
  } catch (error) {
    return null;
  }
}
```

- `lib/alerts/formatters.ts` – maps `EnrichedTrade` tags to Discord embeds with style per tier/side; used by worker alerts.

### Database Schema (prisma/schema.prisma)
- `Trade` captures market context (category/sport/league/fee/liquidity/volume/outcome times/tags), intelligence flags, holder metrics, and enrichment metadata with indexes on wallet/timestamp/flags.

```23:88:prisma/schema.prisma
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
  marketCategory    String?
  marketType        String?
  formatType        String?
  feeBps            Float?
  denominationToken String?
  liquidity         Float?
  volume24h         Float?
  openTime          DateTime?
  closeTime         DateTime?
  resolutionTime    DateTime?
  resolutionSource  String?
  eventId           String?
  eventTitle        String?
  eventSlug         String?
  eventStart        DateTime?
  eventEnd          DateTime?
  tags              String[]
  sport             String?
  league            String?
  marketGroup       String?
  marketDepthBucket String?
  timeToCloseBucket String?
  holderTop5Share   Float?
  holderTop10Share  Float?
  holderCount       Int?
  smartHolderCount  Int?
  transactionHash  String?
  blockNumber      BigInt?
  logIndex         Int?
  enrichmentStatus String?  @default("pending")
  @@index([walletAddress])
  @@index([timestamp])
  @@index([isWhale, timestamp])
  @@index([transactionHash])
  @@index([enrichmentStatus, timestamp])
  @@index([eventId])
  @@index([marketCategory])
  @@index([closeTime])
  @@index([sport, league])
  @@map("trades")
}
```

- `WalletProfile`, `WalletPortfolioSnapshot`, `WalletLeaderboardSnapshot`, `WhalePositionSnapshot` (position snapshots per leaderboard), `User`/`UserAlertSettings`/`Alert`, and `Watchlist` support auth, alerts, and snapshots.

### Data Flow
1) Worker refreshes market metadata, connects to RTDS, subscribes to `activity:trades`.
2) RTDS trade → `processRTDSTrade` → initial Socket.io emit + DB write → enrichment (trader profile, trade stats, market impact) → full emit + Discord alerts.
3) Client `startStream` opens Socket.io, maps `EnrichedTrade` to `Anomaly`, stores if preferences pass.
4) On load, client pulls `/api/history`; infinite scroll uses cursor pagination.
5) Top trades panel fetches `/api/top-trades`; the top whales UI reuses this list.
6) Market modal fetches `/api/market-history`; portfolio widget calls `/api/portfolio`.
7) Leaderboard ranks come from `/api/leaderboard` snapshots; the server-rendered leaderboard page reads snapshots plus whale position snapshots.

### Configuration & Types
- Thresholds and endpoints live in `lib/config.ts`. Shared types for `Anomaly`, `EnrichedTrade`, `RTDSTradePayload`, market metadata, and Gamma portfolio are defined in `lib/types.ts` for front/back parity.

### Error Handling & Resilience
- Worker WebSocket reconnection with exponential backoff, heartbeat, bounded caches; adaptive rate limiter with error accounting; try/catch around DB/API calls with logging. API routes return 400/404/500 with cache fallbacks; portfolio/history/market-history degrade to cached or stale data when upstream requests fail.
