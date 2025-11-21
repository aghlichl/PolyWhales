## Analysis: OddsGods - Prediction Market Intelligence Platform

### Overview

OddsGods is a real-time prediction market aggregator that monitors Polymarket trades, identifies significant market anomalies using statistical analysis, and provides live visualization of trading activity. The application streams market data via WebSocket connections, processes trades through an intelligence pipeline that analyzes trader profiles and market impact, and displays anomalies in a slot-machine style interface with visual indicators for different anomaly types (standard, whale, mega-whale).

### Entry Points

- `app/page.tsx:10` - Home component that initializes market stream and renders anomaly feed
- `server/worker.ts:365` - Background worker that connects to Polymarket WebSocket and processes trades
- `app/api/proxy/polymarket/markets/route.ts:3` - API endpoint that proxies Polymarket market data
- `app/api/history/route.ts:4` - API endpoint that retrieves enriched trade history
- `app/api/leaderboard/route.ts:4` - API endpoint that calculates top trader rankings

### Core Implementation

#### 1. Real-time Market Streaming (`lib/market-stream.ts:117-284`)

- Establishes WebSocket connection to `wss://ws-subscriptions-clob.polymarket.com/ws/market` at line 131
- Subscribes to trades channel for all active market assets at line 140
- Fetches market metadata from `/api/proxy/polymarket/markets` at line 50
- Maps asset IDs to market outcomes and conditions at lines 92-102
- Processes incoming trade messages at line 166, filtering for `last_trade_price` and `trade` events
- Applies statistical analysis using `RunningStats` class at lines 225-228
- Classifies anomalies based on trade value thresholds at lines 233-235
- Filters out noise trades (< $50) at line 185 and 99¢/100¢ bets at lines 242-243
- Creates anomaly objects with z-score multipliers at lines 240-259

#### 2. State Management (`lib/store.ts:12-28`)

- Uses Zustand for client-side state management at line 12
- Maintains anomalies array limited to 50 items at line 17
- Tracks total trading volume at line 18
- Maintains ticker items for scrolling display at line 19
- Starts WebSocket stream on initialization at lines 21-27

#### 3. Trade Intelligence Pipeline (`lib/intelligence.ts:49-213`)

- Fetches trader profiles from Polymarket Data API at `https://data-api.polymarket.com/positions` at line 51
- Caches profiles in Redis with 24-hour TTL at line 150
- Checks wallet freshness (< 10 transactions) using Polygon RPC at line 102
- Analyzes market impact by querying order book at `https://clob.polymarket.com/book` at line 168
- Determines trader labels (Smart Whale, Degen, etc.) based on PnL and win rate at lines 75-82

#### 4. Database Persistence (`prisma/schema.prisma:13-51`)

- Stores wallet profiles with PnL, win rate, and labels at lines 14-23
- Maintains trade records with intelligence flags at lines 26-51
- Uses PostgreSQL with indexed fields for timestamp and whale status

#### 5. Background Processing (`server/worker.ts:138-275`)

- Runs separate Socket.io server on port 3001 at line 21
- Processes trades through intelligence pipeline at line 176-179
- Tags trades with analysis metadata at lines 182-185
- Persists enriched trades to database at lines 225-263
- Broadcasts processed trades to frontend clients at line 269

### Data Flow

1. **Market Data Ingestion**: `server/worker.ts:284` connects to Polymarket WebSocket → fetches market metadata → subscribes to all asset trades

2. **Trade Processing**: WebSocket messages arrive at `server/worker.ts:322` → parsed and filtered at lines 332-334 → enriched with intelligence at `server/worker.ts:176-179` → persisted to database at lines 225-263 → broadcast via Socket.io at line 269

3. **Frontend Streaming**: `lib/market-stream.ts:117` establishes client WebSocket → processes anomalies at lines 170-262 → updates Zustand store at `lib/store.ts:16`

4. **UI Rendering**: `app/page.tsx:13` starts stream → `components/feed/anomaly-card.tsx:22` renders each anomaly → `components/feed/slot-reel.tsx:5` animates entry/exit

5. **Historical Data**: `app/api/history/route.ts:7` queries whale trades → transforms to frontend format at lines 21-55 → `app/api/leaderboard/route.ts:11` aggregates wallet volumes

### Key Patterns

- **WebSocket Streaming**: Real-time data pipeline from Polymarket to frontend via dual WebSocket connections
- **Intelligence Enrichment**: Multi-stage trade analysis combining statistical modeling, trader profiling, and market impact assessment
- **Statistical Anomaly Detection**: Running z-score calculations for market-specific trade value distributions
- **Repository Pattern**: Database access abstracted through Prisma ORM with intelligence flags
- **State Management**: Client-side Zustand store for reactive anomaly feed updates
- **Microservices Architecture**: Separate worker process for data processing and Socket.io server for real-time updates

### Configuration

- WebSocket heartbeat intervals: 30 seconds (`server/worker.ts:304`), 5 seconds (`lib/market-stream.ts:144`)
- Market metadata refresh: 5 minutes (`server/worker.ts:309`, `lib/market-stream.ts:148`)
- API caching: 60 seconds for market data (`app/api/proxy/polymarket/markets/route.ts:14`)
- Redis caching: 24 hours for trader profiles (`lib/intelligence.ts:119`)
- Database retention: Rolling 50 anomalies in memory, unlimited persistence

### Error Handling

- WebSocket reconnection with 3-second delays at `server/worker.ts:349` and `lib/market-stream.ts:274`
- Graceful Redis failure at `lib/intelligence.ts:19-21`
- API error responses with HTTP status codes at `app/api/proxy/polymarket/markets/route.ts:18-22`
- Database operation error logging at `server/worker.ts:264-266`
- Market metadata fetch retry logic at `lib/market-stream.ts:123-127`
