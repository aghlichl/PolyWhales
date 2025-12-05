## Analysis: OddsGods Trading Platform (2025-12-05)

### Overview
OddsGods ingests live Polymarket trades via RTDS (Real-Time Data Stream) WebSocket, enriches them with market metadata and trader intelligence, persists records to PostgreSQL, and streams enriched trades to a Next.js UI via Socket.io. The frontend renders live anomalies, historical trades, and top trades with user-controlled filters. A background worker handles RTDS WebSocket ingestion, trader profile enrichment, database writes, Discord alerts, and periodic leaderboard scraping.

### Entry Points
- `app/page.tsx:54-258` – Client home page wiring filters, infinite scroll, and three-panel desktop layout
- `lib/store.ts:57-325` – Zustand stores for preferences (localStorage-backed), live anomalies, and top trades
- `app/api/history/route.ts:5-110` – Paginated history API returning enriched anomalies from last 24h
- `app/api/top-trades/route.ts:31-159` – Period-based top trades API with cursor pagination
- `app/api/leaderboard/route.ts:4-58` – Leaderboard aggregation API grouping trades by wallet
- `server/worker.ts:377-1365` – Socket.io server (port 3001) plus RTDS ingestion/enrichment worker
- `lib/polymarket.ts:23-376` / `lib/intelligence.ts:6-315` – External data helpers and trader intelligence

### Core Implementation

#### 1) Frontend Surface (`app/page.tsx`)
- Filters anomalies through `passesPreferences` checking type toggles, sports suppression (events containing "vs."), and min value threshold before rendering (`23-52`).
- Loads saved preferences on mount via `loadPreferences()` and starts Socket.io stream once with dynamic preference getter (`112-120`).
- Infinite scroll uses IntersectionObserver on sentinel element to call `loadMoreHistory` when entering viewport (`62-72`, `185-189`).
- Search and quick filters combine active filter text with preference-based filtering using fuzzy word matching (`81-110`).
- Three-page layout: Preferences (mobile), Live Feed (main), Top Whales. Desktop uses `DesktopLayout` with left/right panels, center content, `Ticker`, `QuickSearchFilters`, `PeriodSelector`, and `TopWhales` slots. Mobile shows bottom carousel navigation (`138-239`).

#### 2) Client State & Streaming (`lib/store.ts`)
- Preferences store (`57-89`) persists to localStorage after initial load; defaults show all anomaly tiers with zero threshold (`39-47`). Auto-saves on preference changes after initial load.
- Market store tracks anomalies array (max 2,000), rolling ticker strings, volume accumulator, pagination cursors (`historyCursor`, `hasMoreHistory`), and top-trades state (`131-145`).
- `addAnomaly` de-duplicates by id, keeps up to 2,000 anomalies (FIFO), prepends ticker strings, and accumulates volume (`146-171`).
- `loadHistory` fetches `/api/history` with cursor+limit (default 100), replacing list on first load and appending on pagination; sets `historyCursor`/`hasMoreHistory` (`172-210`).
- `startStream` opens Socket.io to `NEXT_PUBLIC_SOCKET_URL` (fallback localhost:3001), loads history first, emits reconnection logging, converts worker `EnrichedTrade` payloads into `Anomaly` objects with tags-to-type mapping (`GOD_WHALE`/`SUPER_WHALE`/`MEGA_WHALE`/`WHALE`/`STANDARD`), maps timestamp from Date to number, includes `trader_context` and `market_impact`, and conditionally stores them against current preferences via getter function (`217-275`).
- Top trades helpers fetch `/api/top-trades` by period (`today`/`weekly`/`monthly`/`yearly`/`max`) with pagination and expose `loadMoreTopTrades` and `setSelectedPeriod` (`279-324`).

#### 3) UI Presentation
- `components/feed/anomaly-card.tsx:34-509` resolves team/league logos via `resolveTeamFromMarket` with Polymarket image fallback (`38-71`), classifies whale tiers for styling (God/Super/Mega/Whale with distinct color themes), shows outcome/odds gauge plus timestamp footer, and opens `TradeDetailsModal` on click (`79-85`, `499-505`).
- `components/feed/trade-details-modal.tsx:29-623` displays full trade details with price history charts, wallet activity, portfolio view, and always shows Polymarket profile link (removed "Profile Unavailable" fallback since RTDS provides `proxyWallet`). Fetches `/api/market-history` for chart data on open (`88-106`).
- `components/top-whales.tsx:18-80` loads top trades once on mount, renders ranked `AnomalyCard` list, and exposes load-more control.

#### 4) API Routes
- History API (`app/api/history/route.ts:18-102`) queries trades > $5k from last 24h with non-empty wallet addresses, includes wallet profiles via Prisma relation, paginates via cursor (limit+1 pattern), maps DB rows to `Anomaly` shape with whale type classification, and returns `nextCursor`. Images prefer fresh market metadata from Gamma (`15-17`, `60-63`).
- Top-trades API (`app/api/top-trades/route.ts:31-151`) filters by period-derived date range, orders by `tradeValue` desc, paginates, and maps to anomalies with wallet/trader tags reconstructed from profile flags (`isWhale`, `isSmartMoney`, `isFresh`, `isSweeper`, `INSIDER` logic).
- Leaderboard API (`app/api/leaderboard/route.ts:10-48`) groups trades from past 7 days by wallet, sums volume and counts trades, then enriches with `walletProfile` data.
- Proxy endpoint forwards Polymarket market metadata via `fetchMarketsFromGamma` with 60s cache (`app/api/proxy/polymarket/markets/route.ts:4-19`).

#### 5) Market/Activity Utilities (`lib/polymarket.ts`)
- `fetchMarketsFromGamma` (`23-52`) caches active markets for 5 minutes in-memory with normalized payload handling (handles array or `{data: []}` shapes).
- `parseMarketData` (`54-124`) builds maps of `conditionId→MarketMeta` and `assetId→AssetOutcome`, extracting event images, questions, outcomes, and clob token IDs; returns all asset ids for subscription.
- Data API helpers: `fetchTradesFromDataAPI` (trades by asset/time window) and `fetchActivityFromDataAPI` with proxy resolution fallback (`141-245`).
- `enrichTradeWithDataAPI` (`302-376`) matches trades by tx hash first, otherwise by price/size/timestamp tolerances within a window to return maker/taker wallet hints. Marked for deprecated `processTrade` function only.

#### 6) Trader Intelligence (`lib/intelligence.ts`)
- Redis client (lazy connect, retry) caches trader profiles with 24h TTL; Polygon RPC client checks transaction counts via `checkWalletFreshness` (`6-29`).
- `fetchTraderProfileFromAPI` (`55-103`) aggregates position PnL and win-rate from Polymarket positions API, labeling wallets (Smart Whale/Whale/Smart Money/Degen) and detecting whales on large positions.
- `getTraderProfile` (`124-172`) consults Redis cache first, then fetches profile + txCount in parallel, derives activity level (`LOW`/`MEDIUM`/`HIGH` based on tx count thresholds) and freshness (`txCount < 10`), and caches result.
- `analyzeMarketImpact` (`177-224`) pulls order book from Gamma, computes liquidity swept, and estimates price impact for BUY/SELL sides to detect sweepers.
- `getWalletsFromTx` (`252-315`) decodes OrderFilled events from transaction receipts via ABI or topic fallback to recover maker/taker. Marked for deprecated `processTrade` function only.

#### 7) Background Worker (`server/worker.ts`)
- Initializes Socket.io server on port 3001 with CORS for `FRONTEND_URL` and exposes health check endpoint (`377-412`).
- Adaptive rate limiter (`68-120`) adjusts delays based on API response times and error rates.
- Bounded maps (`415-437`) protect metadata caches with size limits (5,000 markets, 10,000 assets) to prevent memory accumulation.
- Market metadata refresh (`421-446`) uses Gamma to rebuild asset/condition maps and returns asset ids. Called on startup and every 5 minutes.
- `processRTDSTrade` (`499-745`) is the primary trade processing function:
  - Filters low-value trades (< $1k) and high-odds trades (> 97%).
  - Resolves market/outcome via asset lookup in `assetIdToOutcome` and `marketsByCondition` maps.
  - Extracts `proxyWallet` directly from RTDS payload (no enrichment needed).
  - Converts timestamp from seconds to Date object (`payload.timestamp * 1000`).
  - Classifies whale tiers based on trade value.
  - Emits initial `EnrichedTrade` to UI immediately with wallet already known (`588`).
  - Saves trade to DB with `enrichmentStatus: "enriched"` immediately (`593-617`).
  - Fetches trader profile via `getTraderProfile` for intelligence flags (`620`).
  - Analyzes market impact via `analyzeMarketImpact` (`623-627`).
  - Updates wallet profile and trade record with intelligence flags (`isSmartMoney`, `isFresh`, `isSweeper`, `INSIDER` detection) (`638-684`).
  - Triggers portfolio enrichment for interesting wallets (whales, smart money) (`676-680`).
  - Emits full enriched trade update to UI (`720`).
  - Generates Discord alerts for whale movements and smart money entries (`722-736`).
- Deprecated `processTrade` (`747-1067`) exists for reference but is not called. Previously used Data API and tx log enrichment pipeline.
- Batch enrichment job (`1078-1237`) is commented out and no longer scheduled. Previously retried enrichment on pending trades.
- RTDS WebSocket connection (`1242-1352`):
  - Connects to `wss://ws-live-data.polymarket.com` (`1264`).
  - Subscribes with message format: `{action: "subscribe", subscriptions: [{topic: "activity", type: "trades", filters: ""}]}` (`1271-1282`).
  - Parses `RTDSMessage` structure, validates `topic: "activity"` and `type: "trades"`, extracts `payload`, validates required fields (`asset`, `price`, `size`, `proxyWallet`), and dispatches to `processRTDSTrade` (`1315-1332`).
  - Handles reconnection with exponential backoff (max 30s delay) and heartbeat cleanup (`1250-1258`, `1344-1348`).
  - Schedules periodic metadata refresh (5 min), leaderboard scraping (2h), and cache cleanup (10 min) (`1288-1312`).
- Leaderboard scraping (`159-288`) crawls Polymarket leaderboard pages, parses top 20 rows per timeframe (`Daily`/`Weekly`/`Monthly`/`All Time`), and stores snapshots/positions via Prisma.

### Data Flow
1. Worker initializes market metadata cache and connects to RTDS WebSocket (`server/worker.ts:1260-1282`). On connection, subscribes to activity trades. Each incoming RTDS message with `topic: "activity"` and `type: "trades"` is parsed and validated, then dispatched to `processRTDSTrade` (`1315-1332`).
2. `processRTDSTrade` filters trades, resolves market metadata, extracts `proxyWallet` directly from payload, emits initial trade to Socket.io, saves to DB with `enrichmentStatus: "enriched"`, enriches with trader profile and market impact, updates DB with intelligence flags, and emits full enriched trade update (`499-745`).
3. Client store `startStream` connects to worker Socket.io, receives `trade` events (both initial and full updates), maps `EnrichedTrade` to `Anomaly` format with proper timestamp conversion, and stores anomalies/ticker entries respecting user preferences (`lib/store.ts:217-275`).
4. On page load, store fetches historical anomalies via `/api/history`; infinite scroll requests additional pages as sentinel enters viewport (`lib/store.ts:172-215`, `app/page.tsx:62-72`).
5. Top trades view fetches `/api/top-trades` for selected period and paginates (`lib/store.ts:279-319`, `components/top-whales.tsx:18-80`).
6. Leaderboard API aggregates DB trades and returns top wallets; separate worker scraper seeds wallet snapshots/positions for richer data (`app/api/leaderboard/route.ts:4-58`, `server/worker.ts:159-288`).

### Key Patterns
- **RTDS WebSocket ingestion** with Socket.io fan-out to clients (`server/worker.ts:1242-1352`, `lib/store.ts:217-275`). RTDS provides `proxyWallet` directly, eliminating need for Data API or tx log enrichment.
- **Two-phase trade emission**: Initial trade emitted immediately with wallet known, then full enriched trade emitted after profile/intelligence enrichment (`server/worker.ts:588`, `720`).
- **Stateless API routes** that reshape Prisma records to frontend `Anomaly` format with cursor pagination (`app/api/history/route.ts:18-102`, `app/api/top-trades/route.ts:62-151`).
- **Caching layers**: In-memory market cache (5 min TTL), Redis-backed trader profiles (24h TTL), and Gamma metadata refresh intervals (`lib/polymarket.ts:16-52`, `lib/intelligence.ts:124-172`).
- **Bounded maps** prevent memory accumulation in metadata caches (`server/worker.ts:415-437`).
- **Alerting via Discord webhooks** per user alert preferences cached with TTL (`server/worker.ts:291-346`, `722-736`).

### Configuration
- Whale thresholds: MIN $1k, WHALE $8,001, MEGA $15k, SUPER $50k, GOD $100k (`lib/config.ts:2-8`).
- Polymarket endpoints: Gamma markets API, RTDS WebSocket (`wss://ws-live-data.polymarket.com`), Data API trades (deprecated), Socket.io on 3001; Redis at `REDIS_URL`; DB via `DATABASE_URL` (`lib/config.ts:9-15`, `lib/prisma.ts:9-24`, `lib/intelligence.ts:6-29`).
- Metadata refresh every 5 minutes, heartbeat every 30s, leaderboard scrape every 2h, cache cleanup every 10 min (`lib/config.ts:16-22`, `server/worker.ts:1288-1312`).

### Type Definitions
- `RTDSTradePayload` (`lib/types.ts:174-195`): Contains `asset`, `conditionId`, `outcome`, `price`, `size`, `proxyWallet`, `pseudonym`, `timestamp` (seconds), `transactionHash`, `title`, `icon`, and optional fields.
- `RTDSMessage` (`lib/types.ts:197-202`): Wrapper with `payload`, `topic`, `type`, `timestamp` (milliseconds), and optional `connection_id`.
- `EnrichedTrade` (`lib/types.ts:97-133`): Worker-emitted format with `market`, `trade`, and `analysis` (wallet_context, market_impact, trader_context, tags).
- `Anomaly` (`lib/types.ts:28-58`): Frontend format with `wallet_context`, `trader_context`, `market_impact`, `analysis.tags`, and numeric `timestamp`.

### Error Handling & Resilience
- RTDS WebSocket reconnection with exponential backoff (max 30s delay) and heartbeat cleanup (`server/worker.ts:1250-1258`, `1344-1348`).
- Trade processing errors are caught and logged without crashing worker (`server/worker.ts:742-744`).
- API routes return 500 JSON errors on exceptions (`app/api/history/route.ts:103-108`, `app/api/top-trades/route.ts:152-158`, `app/api/leaderboard/route.ts:51-56`).
- Redis/cache failures are warned but non-fatal (`lib/intelligence.ts:16-24`, `124-139`).
- Database write failures log error and return early (`server/worker.ts:614-617`, `682-684`).

### Recent Changes (RTDS Migration)
- Replaced CLOB WebSocket (`wss://ws-subscriptions-clob.polymarket.com/ws/market`) with RTDS (`wss://ws-live-data.polymarket.com`) (`lib/config.ts:13`, `server/worker.ts:1264`).
- Removed Data API and transaction log enrichment pipeline. RTDS provides `proxyWallet` directly in payload.
- `processRTDSTrade` is primary processing function; deprecated `processTrade` kept for reference.
- Batch enrichment job no longer scheduled (commented out at `1078-1237`).
- Frontend modal removed "Profile Unavailable" fallback since RTDS always provides wallet (`components/feed/trade-details-modal.tsx:596-610`).
- Store updated to use actual trade timestamps and include `trader_context`/`market_impact` in anomaly mapping (`lib/store.ts:240-265`).
