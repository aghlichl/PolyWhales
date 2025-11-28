## Analysis: OddsGods - Prediction Market Intelligence Platform

### Overview

OddsGods is a real-time prediction market intelligence platform that monitors Polymarket trades, enriches them with sophisticated wallet profiling and market impact analysis, and provides live alerts and visualizations. The platform processes over $5,000 trades in real-time, categorizing them into tiered whale classifications (GOD_WHALE > $100k, SUPER_WHALE > $50k, MEGA_WHALE > $15k, WHALE > $8k), and delivers Discord notifications for significant market movements. The system integrates with multiple sports leagues (NBA, NFL, MLB, NHL, MLS, UEFA) and provides both web and mobile interfaces with responsive design.

### Entry Points

- `app/page.tsx:54` - Home component with three-panel desktop layout (preferences, live feed, top whales)
- `server/worker.ts:722` - Background worker process connecting to Polymarket WebSocket
- `app/api/history/route.ts:5` - REST API endpoint for historical trade data
- `app/api/top-trades/route.ts` - API endpoint for top trades leaderboard
- `app/api/portfolio/route.ts` - API endpoint for wallet portfolio data

### Core Implementation

#### 1. Real-Time Trade Processing (`server/worker.ts:179-471`)

- Processes incoming Polymarket WebSocket trades with value filtering (> $1k, < 97¢ odds)
- Enriches trades through three-stage wallet identification pipeline:
  - WebSocket fields (fast path, ~10-20% success rate)
  - Data-API matching using transaction hashes (primary method)
  - Transaction log parsing (ABI decoding fallback)
- Applies intelligent classification based on trade value, wallet profile, and market impact
- Persists enriched data to PostgreSQL and broadcasts via Socket.io

#### 2. Wallet Intelligence System (`lib/intelligence.ts:124-172`)

- Caches trader profiles in Redis (24-hour TTL) to avoid API rate limits
- Fetches wallet statistics from Polymarket Data API positions endpoint
- Analyzes wallet freshness (< 10 transactions) and activity levels
- Classifies wallets as "Smart Money", "Whale", or "Degen" based on PnL and win rate
- Checks Polygon blockchain for transaction counts via viem public client

#### 3. Market Impact Analysis (`lib/intelligence.ts:177-228`)

- Analyzes order book depth to detect market sweeping behavior
- Fetches real-time order book from Polymarket CLOB API
- Calculates liquidity available and price impact for large trades
- Flags trades that consume significant portions of available liquidity

#### 4. State Management (`lib/store.ts:131-305`)

- Uses Zustand for client-side state with real-time Socket.io integration
- Maintains live trade stream with user preference filtering
- Implements infinite scroll for historical data with cursor-based pagination
- Manages top trades leaderboard with period selection (today/weekly/monthly/yearly/max)

#### 5. Frontend UI Components (`components/feed/anomaly-card.tsx:34-432`)

- Renders trade cards with visual effects based on whale tier (GOD_WHALE gets demonic aura effects)
- Resolves team logos from market questions using sports league metadata
- Displays wallet context, trader performance metrics, and market impact data
- Supports modal detail views with comprehensive trade information

### Data Flow

1. **Trade Ingestion**: Polymarket WebSocket → `server/worker.ts:processTrade()` → wallet enrichment pipeline
2. **Intelligence Enrichment**: Raw trade → wallet profile lookup → market impact analysis → classification tagging
3. **Persistence**: Enriched trade → Prisma database → Socket.io broadcast
4. **Frontend Display**: Socket.io event → Zustand store → React components → user interface
5. **Alert Generation**: Significant trades → Discord webhook formatting → user notifications

### Key Patterns

- **Observer Pattern**: WebSocket listeners broadcast trade events to multiple subscribers
- **Factory Pattern**: Market metadata parsing creates cached mappings for asset resolution
- **Repository Pattern**: Prisma ORM abstracts database operations with type-safe queries
- **Pipeline Pattern**: Multi-stage trade enrichment (WebSocket → Data-API → Tx logs)
- **Strategy Pattern**: Different alert formatting strategies based on whale tier
- **Decorator Pattern**: Trade objects progressively enriched with additional metadata

### Configuration

- **Trade Thresholds** (`lib/config.ts:2-8`): GOD_WHALE ($100k+), SUPER_WHALE ($50k+), MEGA_WHALE ($15k+), WHALE ($8k+)
- **API Rate Limits** (`lib/config.ts:23-30`): 75 Data-API requests per 10 seconds, 200ms delays between enrichment calls
- **WebSocket Settings** (`lib/config.ts:19-21`): 5-minute metadata refresh, 30-second heartbeat
- **Enrichment Window** (`lib/config.ts:29`): Process trades from last 24 hours for wallet matching

### Error Handling

- **WebSocket Resilience**: Automatic reconnection with exponential backoff (`server/worker.ts:703-708`)
- **API Failure Graceful Degradation**: Falls back to alternative enrichment methods when primary APIs fail
- **Database Error Isolation**: Trade processing continues even if database writes fail
- **Cache Miss Handling**: Redis failures don't block trade processing, just reduce performance
- **Rate Limit Management**: Built-in delays prevent API quota exhaustion

### Alert System

- **Discord Webhooks** (`lib/alerts/formatters.ts:42-146`): Tiered color coding (gold for GOD_WHALE, red for SUPER_WHALE, etc.)
- **Smart Filtering** (`server/worker.ts:444-456`): Only alerts for whale trades or smart money entries
- **Rich Embeds**: Include wallet performance, market impact, and trade context
- **User Subscriptions** (`server/worker.ts:30-66`): Per-user alert preferences with webhook URLs

### Database Schema

- **Trade Model** (`prisma/schema.prisma:47-81`): Core trade data with enrichment fields and intelligence flags
- **WalletProfile Model** (`prisma/schema.prisma:13-27`): Cached trader statistics and classifications
- **UserAlertSettings Model** (`prisma/schema.prisma:144-162`): Discord webhook configurations and alert preferences
- **WalletPortfolioSnapshot Model** (`prisma/schema.prisma:29-45`): Gamma API portfolio data for whale tracking

### External Integrations

- **Polymarket APIs**: WebSocket trades, Data-API enrichment, Gamma market metadata, CLOB order books
- **Polygon RPC**: Wallet transaction count analysis via viem
- **Discord Webhooks**: Real-time alert notifications
- **Redis**: High-performance caching for wallet profiles and market data
