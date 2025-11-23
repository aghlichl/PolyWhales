## Analysis: OddsGods Trading Platform

### Overview

OddsGods is a real-time trading intelligence platform that monitors Polymarket trades, identifies whale activity and market anomalies, and displays them through a live feed interface. The system ingests live trading data via WebSocket, analyzes it using statistical models and trader intelligence, stores it in PostgreSQL, and serves both historical and real-time anomaly data through a Next.js frontend.

### Entry Points

- `app/page.tsx:10` - Main Home component that initializes the market store and starts streaming
- `app/api/history/route.ts:4` - GET endpoint for fetching historical whale trades
- `app/api/leaderboard/route.ts:4` - GET endpoint for top trader rankings
- `app/api/proxy/polymarket/markets/route.ts:3` - Proxy endpoint for Polymarket market metadata
- `server/worker.ts:385` - Background worker that ingests and processes live trading data

### Core Implementation

#### 1. Frontend State Management (`lib/store.ts:14-50`)

- Zustand store manages anomalies, volume, and ticker data
- `loadHistory()` fetches historical anomalies from `/api/history` on initialization
- `startStream()` connects to live WebSocket feed and adds new anomalies
- Maintains rolling list of 100 anomalies and 20 ticker items

#### 2. Real-time Data Streaming (`lib/market-stream.ts:118-288`)

- WebSocket connection to `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- Fetches market metadata from Polymarket API via proxy endpoint
- Subscribes to trade events for all active market assets
- Processes trades with value > $1,000, filters noise and likely outcomes
- Calculates z-scores using running statistics per market
- Classifies trades as STANDARD, WHALE, or MEGA_WHALE based on trade value

#### 3. Historical Data API (`app/api/history/route.ts:4-60`)

- Queries PostgreSQL for trades with `tradeValue > 10000` from last 30 minutes
- Includes wallet profile data for each trade
- Transforms database records to Anomaly interface format
- Returns chronological list (newest first) for display

#### 4. Leaderboard API (`app/api/leaderboard/route.ts:4-58`)

- Aggregates wallet performance over last 7 days
- Groups by wallet address, sums trade values and counts trades
- Enriches with wallet profile data (labels, PnL, win rates)
- Returns top 10 wallets by total volume

#### 5. Data Ingestion Worker (`server/worker.ts:292-387`)

- Maintains persistent WebSocket connection to Polymarket
- Processes incoming trade events in real-time
- Enriches each trade with intelligence analysis (trader profiles, market impact)
- Stores trades and wallet profiles in PostgreSQL database
- Broadcasts enriched trades via Socket.io to connected clients

#### 6. Trader Intelligence System (`lib/intelligence.ts:118-150`)

- Fetches trader profiles from Polymarket Data API with 24-hour Redis caching
- Analyzes historical PnL, win rates, and position sizes
- Classifies traders as "Smart Whale", "Whale", "Smart Money", or "Degen"
- Checks wallet freshness via Polygon RPC (< 10 transactions)

### Data Flow

1. **Market Data Fetching**: `startFirehose()` in `lib/market-stream.ts:118` fetches market metadata and establishes WebSocket connection

2. **Real-time Processing**: Worker in `server/worker.ts:335` receives trade events, processes via `processTrade()` function

3. **Intelligence Enrichment**: `getTraderProfile()` in `lib/intelligence.ts:118` fetches trader data with caching

4. **Database Storage**: Worker stores enriched trades and profiles in PostgreSQL via Prisma

5. **Frontend Display**: Store loads historical data from `/api/history` and receives live updates via WebSocket

6. **Socket.io Broadcasting**: Worker broadcasts enriched trades to connected frontend clients

### Key Patterns

- **WebSocket Streaming**: Persistent connections for real-time data ingestion from Polymarket
- **Statistical Analysis**: Running z-score calculations per market using Welford's algorithm
- **Intelligence Layer**: Multi-source trader profiling with API calls and on-chain analysis
- **State Management**: Zustand for client-side state with rolling data windows
- **Proxy Pattern**: API routes proxy external Polymarket data to avoid CORS issues
- **Repository Pattern**: Prisma provides database abstraction layer
- **Observer Pattern**: Socket.io enables real-time updates between worker and frontend

### Configuration

- **Database**: PostgreSQL connection via `DATABASE_URL` environment variable
- **Redis**: Optional caching at `REDIS_URL` for trader profiles (24-hour TTL)
- **WebSocket**: Polymarket at `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- **Socket.io**: Runs on port 3001, configurable via `process.env.FRONTEND_URL`
- **Polygon RPC**: Wallet freshness checks via `POLYGON_RPC_URL`
- **Trade Thresholds**: $1,000 minimum value, $8,000 whale, $15,000 mega whale

### Error Handling

- **WebSocket Reconnection**: Automatic reconnection with 3-second delay on disconnect
- **API Resilience**: Graceful fallback when external APIs unavailable
- **Database Errors**: Logged but don't crash the ingestion worker
- **Cache Failures**: Redis errors logged, system continues without caching
- **Frontend Fallback**: Displays "WAITING FOR SIGNAL..." when no data available
