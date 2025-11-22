## Analysis: OddsGods - Prediction Market Aggregator

### Overview

OddsGods is a real-time prediction market aggregator that monitors Polymarket trades, identifies anomalous trading activity, and provides a live feed of "whale" trades to users. The application consists of a Next.js frontend with WebSocket-based real-time data streaming, a background worker that processes trades and stores them in PostgreSQL, and intelligence features for trader profiling and market analysis.

The system processes live trade data from Polymarket's WebSocket API, enriches trades with statistical analysis and trader intelligence, filters them based on user preferences, and displays them in a retro-styled UI with anomaly classification (STANDARD, WHALE, MEGA_WHALE).

### Entry Points

- `app/page.tsx:38` - Home component renders the main application interface
- `server/worker.ts` - Background worker connects to Polymarket WebSocket
- `lib/market-stream.ts` - startFirehose() initiates real-time data streaming
- `app/api/history/route.ts` - GET /api/history endpoint serves historical trades
- `app/api/top-trades/route.ts` - GET /api/top-trades endpoint serves top trades by period
- `app/api/leaderboard/route.ts` - GET /api/leaderboard endpoint serves top trader leaderboard

### Core Implementation

#### 1. Shared Libraries (Refactored)

To improve maintainability and reduce code duplication, core logic is centralized in `lib/`:

- `lib/types.ts`: Centralized type definitions (Anomaly, MarketMeta, UserPreferences).
- `lib/config.ts`: Configuration constants for thresholds, URLs, and intervals.
- `lib/polymarket.ts`: Shared logic for fetching and parsing Polymarket metadata.
- `lib/intelligence.ts`: Trader profiling and market impact analysis.
- `lib/stats.ts`: Statistical analysis (z-score calculation).

#### 2. Real-Time Data Streaming (`lib/market-stream.ts`)

- Connects to Polymarket WebSocket using `CONFIG.URLS.WS_CLOB`.
- Fetches market metadata via `/api/proxy/polymarket/markets` (frontend proxy).
- Uses `parseMarketData` from `lib/polymarket` to map assets and markets.
- Subscribes to trade events for all active market assets.
- Filters trades using `CONFIG.THRESHOLDS` and processes anomalies.
- Maintains running statistics per market using `RunningStats`.
- Classifies anomalies and applies user preference filtering.

#### 3. Background Trade Processing (`server/worker.ts`)

- Maintains separate WebSocket connection to Polymarket for comprehensive trade processing.
- Fetches market metadata directly from Gamma API using `fetchMarketsFromGamma`.
- Processes trades via shared logic and enriches with trader intelligence.
- Persists enriched trades to PostgreSQL using Prisma ORM.
- Broadcasts processed trades to Socket.io clients.
- Uses `lib/polymarket` for consistent market data parsing.

#### 4. Frontend State Management (`lib/store.ts`)

- Uses Zustand for global state with `usePreferencesStore` and `useMarketStore`.
- Manages user filtering preferences and anomaly feed.
- Handles top trades fetching and historical data loading.

#### 5. Database Schema (`prisma/schema.prisma`)

- `WalletProfile` model stores trader intelligence (PnL, win rate, labels).
- `Trade` model captures enriched trade data with foreign key to wallet profiles.
- Indexed on wallet address and timestamp for efficient queries.

### Data Flow

1. **Market Data Ingestion**: Worker and Frontend fetch market metadata (via Gamma API or Proxy).
2. **Real-Time Processing**: Both establish WebSocket connections to Polymarket CLOB.
3. **Trade Enrichment**:
    - **Frontend**: Statistical enrichment (z-score), filtering.
    - **Worker**: Intelligence enrichment (wallet profile, market impact), DB persistence.
4. **Database Persistence**: Enriched trades stored in PostgreSQL.
5. **Frontend Display**: Real-time anomalies displayed in UI, historical data fetched from API.

### Key Patterns

- **Shared Logic Library**: Common logic extracted to `lib/` (types, config, polymarket).
- **WebSocket Streaming**: Dual connections for display and processing.
- **Repository Pattern**: Prisma ORM for database operations.
- **Observer Pattern**: Socket.io broadcasting.
- **Statistical Anomaly Detection**: Online algorithm for z-score.

### Configuration

- **Centralized Config**: `lib/config.ts` manages thresholds and URLs.
- Environment variables: `REDIS_URL`, `POLYGON_RPC_URL`, `FRONTEND_URL`.
- Trade thresholds defined in `CONFIG.THRESHOLDS`.

### Error Handling

- WebSocket reconnection with backoff.
- Graceful Redis degradation.
- Normalized API response handling in `lib/polymarket`.
- Frontend loading states and error boundaries.

### Intelligence Features

#### Trader Profiling (`lib/intelligence.ts`)
- Fetches position data and calculates PnL/win rate.
- Checks wallet freshness via Polygon RPC.
- Caches profiles in Redis.

#### Market Impact Analysis (`lib/intelligence.ts`)
- Analyzes order book depth to detect sweepers.
- Calculates price impact.

### UI Components

- **Anomaly Feed**: Renders trade cards with visual indicators.
- **User Preferences**: Controls filtering via toggle switches.
- **Top Whales**: Displays leaderboard of top traders.

### API Routes

- **History/Top-Trades/Leaderboard**: Serve aggregated data from DB.
- **Proxy APIs**:
    - `app/api/proxy/polymarket/markets`: Proxies Gamma API, uses shared `fetchMarketsFromGamma`.
