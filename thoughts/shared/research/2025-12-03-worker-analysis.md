## Analysis: Polymarket Intelligence Worker

### Overview

The worker.ts file implements a real-time Polymarket trading intelligence system that connects to Polymarket's WebSocket API, processes trade data, enriches it with wallet intelligence, and provides live updates to a frontend application. It also scrapes leaderboard data, manages portfolio snapshots, and sends Discord alerts for significant trading activity.

### Entry Points

- `server/worker.ts:952-955` - Main execution entry point that checks if script is run as "worker.ts" and calls `connectToPolymarket()`
- `server/worker.ts:286-290` - Socket.io server initialization on port 3001

### Core Implementation

#### 1. WebSocket Connection (`server/worker.ts:850-941`)

- Establishes persistent WebSocket connection to Polymarket's CLOB API at `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- Subscribes to trade events for all known asset IDs using message format with `type: "market"`, `assets_ids`, and `channel: "trades"`
- Implements automatic reconnection with 3-second delay on connection loss
- Refreshes market metadata every 5 minutes and resubscribes to updated asset list
- Maintains heartbeat interval of 30 seconds for connection monitoring

#### 2. Trade Processing Pipeline (`server/worker.ts:382-695`)

- Filters incoming trades by minimum value threshold ($1000) and odds threshold (0.97) at lines 391-394
- Creates initial `EnrichedTrade` object with basic market data and emits immediately to UI via Socket.io at line 461
- Saves trade to database with "pending" enrichment status at lines 466-486
- Attempts wallet identification through three-tier enrichment:
  - Fast path: WebSocket fields (`trade.user`, `trade.maker`, `trade.taker`, `trade.wallet`) at lines 504-508
  - Data-API matching using `enrichTradeWithDataAPI()` at lines 511-535
  - Transaction log parsing using `getWalletsFromTx()` at lines 538-552
- Fetches trader profile via `getTraderProfile()` and market impact via `analyzeMarketImpact()` at lines 562-569
- Updates wallet profile using Prisma upsert operation at lines 581-603
- Constructs full enriched trade object with intelligence tags and emits update to UI at lines 630-663

#### 3. Leaderboard Scraping (`server/worker.ts:109-229`)

- Scrapes four timeframes (Daily, Weekly, Monthly, All Time) from Polymarket leaderboard URLs at lines 69-74
- Uses Cheerio to parse HTML and extract top 20 traders per timeframe at lines 126-150
- Parses currency values from profit and volume labels using `parseCurrency()` function at lines 76-85
- Saves leaderboard snapshots and positions in database transaction at lines 162-222
- Includes 200ms delays between API calls to respect rate limits at line 182

#### 4. Batch Enrichment System (`server/worker.ts:701-845`)

- Runs every minute to retry enrichment on trades with empty wallet addresses or "pending" status
- Processes trades from last 24 hours with transaction hashes, limited to 50 trades per batch
- Attempts enrichment using Data-API first, then transaction parsing as fallback
- Updates wallet profiles and trade records with enriched intelligence flags
- Implements 200ms rate limiting delays to stay under 75 requests per 10 seconds limit

#### 5. Alert System (`server/worker.ts:233-269`)

- Queries database for users with alert preferences matching the alert type ("WHALE_MOVEMENT" or "SMART_MONEY_ENTRY")
- Formats alerts using `formatDiscordAlert()` from `lib/alerts/formatters.ts`
- Sends HTTP POST requests to user-configured Discord webhooks
- Fails silently on individual webhook errors to maintain system stability

#### 6. Portfolio Enrichment (`server/worker.ts:333-372`)

- Rate-limited to once every 5 minutes per wallet using database timestamp checks
- Fetches portfolio data from Gamma API and stores snapshots in `walletPortfolioSnapshot` table
- Triggers automatically for wallets identified as whales or smart money traders

#### 7. Market Metadata Management (`server/worker.ts:309-327`)

- Updates local caches of market metadata and asset-to-outcome mappings using `fetchMarketsFromGamma()` and `parseMarketData()`
- Maintains mutable Maps for fast lookups during trade processing
- Called on startup and every 5 minutes during WebSocket operation

### Data Flow

1. **Initialization**: Worker starts Socket.io server on port 3001 and connects to Polymarket WebSocket
2. **Metadata Loading**: Fetches market metadata and caches asset-to-outcome mappings
3. **WebSocket Subscription**: Subscribes to trade events for all known assets
4. **Trade Reception**: Receives trade events from Polymarket WebSocket
5. **Filtering**: Applies value and odds thresholds to filter noise
6. **Immediate UI Update**: Creates basic trade object and emits to connected clients
7. **Database Persistence**: Saves trade with pending enrichment status
8. **Wallet Enrichment**: Attempts to identify trader wallet through multiple API calls
9. **Intelligence Analysis**: Fetches trader profile and analyzes market impact
10. **Database Updates**: Updates trade and wallet profile records
11. **Full UI Update**: Emits enriched trade object with intelligence data
12. **Alert Generation**: Sends Discord alerts for significant trades
13. **Portfolio Enrichment**: Triggers portfolio snapshots for interesting wallets
14. **Scheduled Tasks**: Runs leaderboard scraping every 2 hours and batch enrichment every minute

### Key Patterns

- **Real-time Processing**: Immediate UI updates followed by background enrichment to maintain responsiveness
- **Multi-tier Enrichment**: Progressive fallback from fast WebSocket fields to slower API calls and transaction parsing
- **Transactional Database Operations**: Uses Prisma transactions for data consistency in leaderboard scraping
- **Rate Limiting**: Implements delays between API calls to respect service limits (200ms for enrichment, 5-minute portfolio cooldown)
- **Silent Error Handling**: Alerts and background tasks fail gracefully without stopping main processing
- **Background Job Scheduling**: Uses `setInterval()` for periodic tasks (leaderboard scraping, metadata refresh, batch enrichment)
- **Connection Resilience**: Automatic WebSocket reconnection with exponential backoff

### Configuration

- **Trade Thresholds**: Minimum $1000 value, whale tiers at $8001/$15000/$50000/$100000 from `lib/config.ts:2-8`
- **Odds Filtering**: Excludes trades with >97% odds (very likely outcomes) at `lib/config.ts:16`
- **Rate Limits**: 200ms delays for enrichment API calls, 75 requests per 10 seconds limit from `lib/config.ts:24`
- **Batch Processing**: 50 trades per batch, every 60 seconds, 24-hour age limit from `lib/config.ts:25-30`
- **Refresh Intervals**: 5-minute metadata refresh, 2-hour leaderboard scraping from `lib/config.ts:19,26`
- **API Endpoints**: Polymarket WebSocket, Gamma API, Data API URLs from `lib/config.ts:9-14`

### Error Handling

- **WebSocket Errors**: Automatic reconnection with 3-second delay, logs warnings but continues operation
- **API Failures**: Enrichment methods fail gracefully, marking trades as "failed" status, logs warnings
- **Database Errors**: Transaction rollbacks for consistency, logs errors but continues processing
- **Alert Failures**: Individual webhook failures are logged but don't stop alert processing for other users
- **Graceful Shutdown**: SIGINT handler disconnects from Prisma and Redis before exit

### External Dependencies

- **Prisma**: Database ORM for trade, wallet profile, and snapshot persistence
- **Redis**: Connection initialized but not actively used in current implementation
- **Socket.io**: Real-time communication with frontend clients on port 3001
- **WebSocket**: Connection to Polymarket's CLOB API for live trade data
- **Cheerio**: HTML parsing for leaderboard scraping
- **Node Fetch**: HTTP requests for API calls and Discord webhooks
- **Intelligence Library**: Custom functions for trader profile analysis and market impact assessment
- **Polymarket Library**: Market data fetching and trade enrichment utilities
