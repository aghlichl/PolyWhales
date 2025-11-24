## Analysis: OddsGods - Polymarket Trading Intelligence Platform

### Overview

OddsGods is a Next.js 16 application that streams real-time Polymarket trading data, processes trades through an intelligence layer, and displays market anomalies to users. The platform categorizes trades by size (STANDARD, WHALE, MEGA_WHALE, SUPER_WHALE, GOD_WHALE) and enriches them with trader profiling data including win rates, PnL, and activity levels. Users can filter anomalies by type and value thresholds, with real-time updates via WebSocket connections.

### Entry Points

- `app/page.tsx:41` - Main Home component that renders the anomaly feed interface
- `app/api/history/route.ts:4` - GET /api/history endpoint for fetching historical trades
- `app/api/save-trade/route.ts:19` - POST /api/save-trade endpoint for storing trades
- `app/api/top-trades/route.ts:30` - GET /api/top-trades endpoint for ranked trade data
- `server/worker.ts:314` - Background worker process that streams from Polymarket WebSocket
- `lib/market-stream.ts:110` - startFirehose() function that initiates real-time data streaming

### Core Implementation

#### 1. Real-Time Data Streaming (`lib/market-stream.ts:110-272`)

- Establishes WebSocket connection to Polymarket CLOB at `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- Subscribes to trade events for all active market assets
- Filters trades below $1000 minimum threshold at `lib/market-stream.ts:177-178`
- Classifies trades into anomaly types based on value thresholds at `lib/market-stream.ts:201-207`:
  - GOD_WHALE: >$100,000
  - SUPER_WHALE: >$50,000  
  - MEGA_WHALE: >$15,000
  - WHALE: >$8,000
  - STANDARD: >$1,000
- Applies user preference filtering before displaying anomalies at `lib/market-stream.ts:245-250`

#### 2. Background Trade Processing (`server/worker.ts:59-225`)

- Receives raw trade data from Polymarket WebSocket at `server/worker.ts:273-289`
- Enriches trades with trader profiles via `getTraderProfile()` at `server/worker.ts:112`
- Analyzes market impact using order book data at `server/worker.ts:115`
- Tags trades with intelligence flags at `server/worker.ts:118-122`:
  - WHALE: Large trade value or profile indicates whale status
  - SMART_MONEY: High win rate and PnL combination
  - FRESH_WALLET: <10 transactions
  - SWEEPER: Trade that swept multiple order book levels
  - INSIDER: Low activity with high win rate and PnL
- Persists enriched data to PostgreSQL via Prisma at `server/worker.ts:169-216`
- Broadcasts processed trades to Socket.io clients at `server/worker.ts:219`

#### 3. Frontend State Management (`lib/store.ts:104-229`)

- Uses Zustand for client-side state with two main stores:
  - `usePreferencesStore`: Manages user filtering preferences stored in localStorage
  - `useMarketStore`: Manages anomaly feed, history, and top trades data
- Implements infinite scroll for historical data at `lib/store.ts:164-169`
- Loads initial history and starts WebSocket streaming at `lib/store.ts:170-179`
- Fetches top trades with cursor-based pagination at `lib/store.ts:182-228`

#### 4. Intelligence Layer (`lib/intelligence.ts:122-170`)

- Caches trader profiles in Redis for 24 hours at `lib/intelligence.ts:123-124`
- Fetches trader statistics from Polymarket Data API at `lib/intelligence.ts:54-101`
- Determines trader labels based on PnL and win rate thresholds at `lib/intelligence.ts:79-88`
- Checks wallet freshness via Polygon RPC transaction count at `lib/intelligence.ts:106-116`
- Analyzes market impact by checking order book sweep at `lib/intelligence.ts:175-226`

#### 5. Database Layer (`prisma/schema.prisma:13-114`)

- Stores wallet profiles with aggregated statistics in `WalletProfile` model
- Records individual trades with market context in `Trade` model
- Supports user authentication and watchlists for premium features
- Uses indexed fields for efficient querying of trades by wallet and timestamp

### Data Flow

1. **Market Data Ingestion**: WebSocket connects to Polymarket at `lib/market-stream.ts:124`, subscribes to all active assets
2. **Trade Filtering**: Raw trades filtered by value and odds thresholds at `lib/market-stream.ts:177-212`
3. **Intelligence Enrichment**: Background worker processes trades at `server/worker.ts:59-225`, adding trader profiles and market impact analysis
4. **Database Persistence**: Enriched trades saved to PostgreSQL at `server/worker.ts:169-216`
5. **Real-Time Distribution**: Processed anomalies broadcast via Socket.io at `server/worker.ts:219`
6. **Frontend Display**: Anomalies rendered with filtering at `app/page.tsx:140-158`, using Zustand state management
7. **Historical Loading**: API endpoints serve paginated data at `app/api/history/route.ts:14-90` and `app/api/top-trades/route.ts:59-136`

### Key Patterns

- **WebSocket Streaming Pattern**: Dual WebSocket connections - one for raw data ingestion (`server/worker.ts:230-303`), one for client updates (`lib/market-stream.ts:110-272`)
- **Intelligence Pipeline Pattern**: Raw trades → Enrichment → Tagging → Persistence → Broadcasting (`server/worker.ts:59-225`)
- **Cursor-Based Pagination**: Used for efficient historical data loading (`lib/store.ts:125-163`, `app/api/history/route.ts:26-38`)
- **Preference Filtering Pattern**: Client-side filtering applied before anomaly display (`lib/market-stream.ts:245-250`, `app/page.tsx:95-97`)
- **Repository Pattern**: Database access abstracted through Prisma ORM with typed models
- **Observer Pattern**: Real-time updates distributed via Socket.io pub/sub

### Configuration

- **Trade Thresholds**: Defined in `lib/config.ts:2-9` with GOD_WHALE at $100k, WHALE at $8k minimum
- **API URLs**: Polymarket Gamma API for markets, CLOB WebSocket for trades (`lib/config.ts:9-11`)
- **Intelligence Constants**: Odds threshold at 0.97 (97%), metadata refresh every 5 minutes (`lib/config.ts:13-18`)
- **User Preferences**: Stored in localStorage with default show-all settings (`lib/store.ts:13-20`)

### Error Handling

- **WebSocket Resilience**: Automatic reconnection with 3-second delay at `lib/market-stream.ts:258-264` and `server/worker.ts:295-299`
- **API Failure Grace**: Continues processing without trader profiles if Polymarket Data API fails (`lib/intelligence.ts:59-62`)
- **Database Error Isolation**: Trade processing continues if database save fails (`server/worker.ts:214-216`)
- **Cache Degradation**: Falls back to API calls if Redis is unavailable (`lib/intelligence.ts:16-22`)

### Component Architecture

- **AnomalyCard**: Complex visual component with tier-specific animations and styling at `components/feed/anomaly-card.tsx:21-462`
- **BottomCarousel**: Navigation between Live Feed, Preferences, and Top Whales pages at `app/page.tsx:186-191`
- **SlotReel**: Virtualized feed rendering with infinite scroll at `app/page.tsx:142-152`
- **UserPreferences**: Settings panel for anomaly filtering at `components/user-preferences.tsx`
- **TopWhales**: Paginated leaderboard view at `components/top-whales.tsx`
