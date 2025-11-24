```mermaid
sequenceDiagram
    participant Frontend as Frontend (React)
    participant APIRoutes as API Routes (Next.js)
    participant Database as PostgreSQL (Prisma)
    participant Worker as Background Worker
    participant WS as WebSocket Server
    participant Polymarket as Polymarket APIs

    %% Initialization and Setup
    rect rgb(240, 240, 240)
        note over Frontend, Polymarket: Application Startup & Initialization
        Frontend->>APIRoutes: GET /api/proxy/polymarket/markets
        APIRoutes->>Polymarket: GET https://gamma-api.polymarket.com/markets
        Polymarket-->>APIRoutes: Market metadata (markets, conditions, assets)
        APIRoutes-->>Frontend: Market metadata

        Frontend->>Worker: Start background worker
        Worker->>Polymarket: GET https://gamma-api.polymarket.com/markets (metadata refresh)
        Polymarket-->>Worker: Market metadata
        Worker->>WS: Start Socket.io server (port 3001)
    end

    %% Real-time Trade Streaming
    rect rgb(255, 250, 205)
        note over Frontend, Database: Real-time Trade Processing
        Worker->>Polymarket: WebSocket connect wss://ws-subscriptions-clob.polymarket.com/ws/market
        Polymarket-->>Worker: Real-time trade events (trade/last_trade_price)

        loop Process each trade
            Worker->>Worker: Extract wallet address from trade data
            Worker->>Polymarket: GET https://data-api.polymarket.com/positions?user={address}
            Polymarket-->>Worker: Trader positions & PnL data

            Worker->>Polymarket: GET https://clob.polymarket.com/book?token_id={assetId}
            Polymarket-->>Worker: Order book data (liquidity analysis)

            Worker->>Database: UPSERT wallet_profiles (create/update trader profile)
            Worker->>Database: INSERT trades (save enriched trade)
            Worker->>WS: Emit 'trade' event to connected clients
        end
    end

    %% Frontend Data Loading
    rect rgb(255, 230, 230)
        note over Frontend, Database: Frontend Data Loading
        Frontend->>APIRoutes: GET /api/history (load recent whale trades)
        APIRoutes->>Database: SELECT trades + wallet_profiles (last 24hrs, >$10k)
        Database-->>APIRoutes: Trade data with wallet profiles
        APIRoutes-->>Frontend: Anomalies array

        Frontend->>Polymarket: WebSocket connect wss://ws-subscriptions-clob.polymarket.com/ws/market
        Polymarket-->>Frontend: Real-time trade events
        Frontend->>Frontend: Process trades → create Anomaly objects
    end

    %% User Interactions - Trade Details
    rect rgb(220, 240, 255)
        note over Frontend, Database: Trade Details Modal
        Frontend->>APIRoutes: GET /api/market-history?question={}&outcome={}&walletAddress={}
        APIRoutes->>Database: SELECT trades WHERE question AND outcome (price history)
        APIRoutes->>Database: SELECT trades WHERE walletAddress (wallet activity)
        Database-->>APIRoutes: Price history + wallet trades
        APIRoutes-->>Frontend: Chart data for modal
    end

    %% User Interactions - Top Trades
    rect rgb(220, 255, 220)
        note over Frontend, Database: Top Trades View
        Frontend->>APIRoutes: GET /api/top-trades?period={today|weekly|monthly|yearly|max}
        APIRoutes->>Database: SELECT trades ORDER BY tradeValue DESC (top 100 by period)
        Database-->>APIRoutes: Top trades with wallet profiles
        APIRoutes-->>Frontend: Top trades data
    end

    %% User Interactions - Leaderboard
    rect rgb(255, 220, 240)
        note over Frontend, Database: Leaderboard View
        Frontend->>APIRoutes: GET /api/leaderboard
        APIRoutes->>Database: SELECT trades GROUP BY walletAddress (7-day volume aggregation)
        APIRoutes->>Database: SELECT wallet_profiles (enrich with profile data)
        Database-->>APIRoutes: Top 10 wallets by volume
        APIRoutes-->>Frontend: Leaderboard data
    end

    %% Metadata Refresh (Background)
    rect rgb(250, 240, 220)
        note over Worker, Frontend: Metadata Refresh (every 5 minutes)
        Worker->>Polymarket: GET https://gamma-api.polymarket.com/markets
        Polymarket-->>Worker: Updated market metadata
        Worker->>Polymarket: WebSocket subscribe to new assets
        Worker->>Frontend: Metadata updates via WebSocket
    end

    %% State Management
    rect rgb(240, 240, 250)
        note over Frontend: Frontend State Updates
        WS-->>Frontend: Real-time trade events
        Frontend->>Frontend: Zustand store updates (addAnomaly, updateVolume, updateTicker)
        Frontend->>Frontend: React components re-render with new data
    end
```

```mermaid
graph TB
    %% External Services
    subgraph "External APIs"
        PM[Polymarket APIs]
        PM_WS[Polymarket WebSocket<br/>wss://ws-subscriptions-clob...]
        PM_Gamma[Gamma API<br/>gamma-api.polymarket.com]
        PM_Data[Data API<br/>data-api.polymarket.com]
        PM_CLOB[CLOB API<br/>clob.polymarket.com]
    end

    %% Application Components
    subgraph "Frontend (Next.js)"
        FE[React Components]
        Store[Zustand Store<br/>useMarketStore]
        WS_Client[WebSocket Client]
    end

    subgraph "Backend (Next.js API Routes)"
        HistoryAPI[/api/history]
        TopTradesAPI[/api/top-trades]
        LeaderboardAPI[/api/leaderboard]
        MarketHistoryAPI[/api/market-history]
        ProxyMarketsAPI[/api/proxy/polymarket/markets]
        ProxyEventsAPI[/api/proxy/polymarket]
    end

    subgraph "Background Worker (Node.js)"
        Worker[Trade Processor<br/>server/worker.ts]
        WS_Server[Socket.io Server<br/>Port 3001]
        Intelligence[Intelligence Module<br/>lib/intelligence.ts]
    end

    subgraph "Database (PostgreSQL)"
        Trades[trades table]
        WalletProfiles[wallet_profiles table]
    end

    %% Data Flow Connections
    FE --> Store
    Store --> WS_Client
    Store --> HistoryAPI
    Store --> TopTradesAPI
    Store --> LeaderboardAPI

    FE --> MarketHistoryAPI
    FE --> ProxyMarketsAPI

    HistoryAPI --> Trades
    HistoryAPI --> WalletProfiles

    TopTradesAPI --> Trades
    TopTradesAPI --> WalletProfiles

    LeaderboardAPI --> Trades
    LeaderboardAPI --> WalletProfiles

    MarketHistoryAPI --> Trades
    MarketHistoryAPI --> WalletProfiles

    ProxyMarketsAPI --> PM_Gamma
    ProxyEventsAPI --> PM_Gamma

    Worker --> PM_WS
    Worker --> WS_Server
    Worker --> Intelligence

    Intelligence --> PM_Data
    Intelligence --> PM_CLOB

    Worker --> Trades
    Worker --> WalletProfiles

    WS_Server --> WS_Client

    %% Styling
    classDef apiRoutes fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef external fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef database fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef worker fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef frontend fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class HistoryAPI,TopTradesAPI,LeaderboardAPI,MarketHistoryAPI,ProxyMarketsAPI,ProxyEventsAPI apiRoutes
    class PM,PM_WS,PM_Gamma,PM_Data,PM_CLOB external
    class Trades,WalletProfiles database
    class Worker,WS_Server,Intelligence worker
    class FE,Store,WS_Client frontend
```

## API Calls and Database Operations Summary

### API Endpoints
1. **GET /api/history** - Recent whale trades (24hrs, >$10k)
2. **GET /api/top-trades?period={period}** - Largest trades by time period
3. **GET /api/leaderboard** - Top 10 wallets by 7-day volume
4. **GET /api/market-history?question={}&outcome={}&walletAddress={opt}** - Price history + wallet activity
5. **GET /api/proxy/polymarket/markets** - Market metadata from Polymarket
6. **GET /api/proxy/polymarket** - Events data from Polymarket

### Database Operations
- **INSERT trades** - New trade records from WebSocket
- **UPSERT wallet_profiles** - Create/update trader intelligence
- **SELECT trades** with **JOIN wallet_profiles** - Various queries for frontend

### External API Calls
- **WebSocket**: `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- **Gamma API**: `https://gamma-api.polymarket.com/markets`
- **Data API**: `https://data-api.polymarket.com/positions?user={address}`
- **CLOB API**: `https://clob.polymarket.com/book?token_id={assetId}`

### Real-time Data Flow
1. Polymarket WebSocket → Background Worker → Intelligence enrichment → Database → Socket.io → Frontend
2. Frontend WebSocket → Direct processing → Zustand store → React components

### Key Data Transformations
- Raw trades → Enriched anomalies (market metadata + trader profiles)
- Database records → Frontend-compatible anomaly objects
- WebSocket events → UI state updates
