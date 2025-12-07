# OddsGods Codebase Audit Overview (2025-12-06)

## Architecture Overview
- Next.js App Router front-end (`app/page.tsx`, `app/leaderboard/page.tsx`) renders live feed, leaderboard, top whales, and modals; wrapped with Privy auth provider.
- Worker (`server/worker.ts`) ingests Polymarket RTDS trades, enriches via Gamma/Data API/intelligence, persists to Postgres (Prisma), emits Socket.io events to UI, and sends Discord alerts.
- API layer under `app/api/**` provides history/top-trades/top-whales/market-history/leaderboard/portfolio/proxy endpoints that hydrate UI and modals from Prisma + Gamma/Data API.
- Shared libs: `lib/store.ts` (Zustand stores for feed/preferences/top-trades/leaderboard), `lib/polymarket.ts` (Gamma/Data API + market parsing), `lib/intelligence.ts` (profiles/impact/tx parsing + Redis), `lib/alerts/formatters.ts` (Discord embeds), `lib/types.ts` (shared types).
- Persistence: Prisma schema models trades, wallet profiles, leaderboard and portfolio snapshots, alerts, watchlists. Generated client in `generated/`.

## Data Flow: Polymarket → Worker → DB → API → UI
- RTDS trade → `server/worker.ts/processRTDSTrade`: threshold/odds filter → market metadata lookup (`lib/polymarket.parseMarketData` cache) → initial enriched trade emit + DB write → profile/stats/impact enrichment (`lib/intelligence`) → DB update → full emit + Discord alert.
- Worker periodically refreshes market metadata, scrapes leaderboard, and cleans caches; Socket.io (3001) serves UI stream and health checks.
- UI `lib/store.startStream` connects to Socket.io, normalizes `EnrichedTrade` to `Anomaly`, applies user prefs, and appends to feed; initial history fetched from `/api/history` with cursor pagination; top trades from `/api/top-trades`.
- Modals/widgets: `/api/market-history` pulls price history + wallet trades (Data API, Prisma), `/api/portfolio` fetches Gamma snapshot with DB fallback; leaderboard page fetches snapshots via `app/actions/leaderboard`.

## Key Modules (Responsibilities, Important Files, Noted Smells)
- **Frontend pages & layout**: `app/page.tsx`, `app/leaderboard/page.tsx`, `app/layout.tsx`.
  - Responsibilities: live feed rendering, filtering/search, pagination; leaderboard SSR view; app shell/fonts/auth provider.
  - Smells: `app/page.tsx` is large (300+ lines) mixing UI state, filtering, and scroll logic; no suspense/data hooks separation.
- **UI components (feed/leaderboard/top whales/modals)**: `components/feed/anomaly-card.tsx` (~833 LOC), `components/feed/trade-details-modal.tsx` (~845 LOC), `components/top-whales.tsx`, `components/leaderboard/leaderboard-table.tsx`, `components/wallet-portfolio.tsx`, etc.
  - Responsibilities: display anomalies with rich styling, open trade detail modal, render tables/carousels, fetch modal data.
  - Smells: Very large monolithic components with styling, data shaping, and business rules intertwined; duplicated formatting across feed, modal, and alerts; modal fetch logic embedded in component.
- **State management**: `lib/store.ts` (~474 LOC) with preferences + market/top-trades/leaderboard stores.
  - Responsibilities: manage Socket.io stream, history/top-trades pagination, leaderboard ranks, preference persistence.
  - Smells: Store owns networking, transformation, and filtering; mixes client-only concerns with domain mapping; long file.
- **Data layer (Gamma/Data API helpers)**: `lib/polymarket.ts` (~472 LOC), `lib/gamma.ts`, `lib/utils.ts`.
  - Responsibilities: fetch/normalize markets, activity, trades, positions; cache markets; enrich trades.
  - Smells: Ad-hoc caching and tolerance rules live here and inside worker/API routes; holder metrics cache referenced in worker but implementation is implicit; shared logic duplicated in APIs.
- **Intelligence/alerts**: `lib/intelligence.ts` (~368 LOC), `lib/alerts/formatters.ts`.
  - Responsibilities: trader profiles (Data API + Redis), trade stats, market impact via orderbook, tx log parsing, Discord embed formatting.
  - Smells: Multiple external calls per trade; error handling mostly logging; profile cache hydration logic intertwined with network calls.
- **Worker**: `server/worker.ts` (~1436 LOC).
  - Responsibilities: RTDS websocket, metadata refresh, enrichment, DB writes, alerts, leaderboard scrape, cache cleanup, adaptive rate limiter.
  - Smells: Single sprawling file mixing orchestration, enrichment, metrics, scraping, alert fan-out; deprecated paths still present; timers and long-lived state scattered.
- **API routes**: `app/api/history`, `top-trades`, `top-whales`, `market-history`, `leaderboard`, `portfolio`, `proxy/polymarket`, `save-trade`.
  - Responsibilities: expose snapshots/history/top lists/proxy data; hydrate modal details and portfolio snapshots.
  - Smells: Repeated anomaly shaping and market metadata merging across routes; mixed caching strategies; some pagination logic duplicated.
- **Types/models**: `lib/types.ts`, `prisma/schema.prisma`.
  - Responsibilities: shared frontend/backend types, Prisma models for trades, wallets, alerts, snapshots.
  - Smells: Overlap between `Anomaly`/`EnrichedTrade` and Prisma `Trade`; tags/context fields duplicated across layers; some nullable/any casts (e.g., positions JSON) hint at weak typing between domains.
