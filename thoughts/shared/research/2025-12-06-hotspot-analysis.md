# OddsGods Hotspot Analysis (2025-12-06)

## Largest / most complex files
- `server/worker.ts` (~1436 LOC): RTDS websocket, enrichment pipeline, DB writes, alerts, leaderboard scraping, timers, caches, adaptive rate limiter all in one file; mixes orchestration, IO, and business rules; includes deprecated paths.
- `components/feed/trade-details-modal.tsx` (~845 LOC): UI, data fetching (`/api/market-history`), chart prep, formatting, wallet/market stats, and modal state all combined; hard to test and reuse.
- `components/feed/anomaly-card.tsx` (~833 LOC): Heavy presentational/styling logic plus league/team resolution, badge computation, modal triggers; mixes data shaping with animations.
- `lib/store.ts` (~474 LOC): Zustand stores bundle Socket.io wiring, history/top-trades pagination, normalization to `Anomaly`, preference persistence, and leaderboard ranks; networking + state + transformation in one place.
- `lib/polymarket.ts` (~472 LOC): Gamma/Data API fetchers, caching, trade enrichment, holder metrics references, and parsing; domain logic shared across worker/APIs without clear boundaries.
- `lib/intelligence.ts` (~368 LOC): Trader profile aggregation (Data API + Redis), tx freshness via RPC, market impact via orderbook, and tx log parsing; multiple external dependencies in one module.

## Cross-cutting concerns
- **Anomaly/enriched trade shaping duplicated** across worker emits, `/api/history`, `/api/top-trades`, and `lib/store` mapping. Risk of drift in tag logic, image/metadata selection, and type buckets.
- **Polymarket data parsing & caching scattered**: `lib/polymarket` cache used in worker; API routes re-fetch/parse Gamma (history, top-trades, market-history) with their own caches; holder metrics cache referenced but centralized store not visible.
- **Enrichment & intelligence rules split**: worker embeds thresholds from `lib/config`, enrichment steps in worker, profile/stats in `lib/intelligence`, while APIs recalculate type buckets and tags; no shared domain layer for thresholds/buckets/market context.
- **State/config leakage**: `lib/store` mixes client state with network addresses (`NEXT_PUBLIC_SOCKET_URL`), normalization rules, and pagination constants; config lives in `lib/config` but odds/threshold logic reimplemented in routes.
- **Testing surface is thin**: Only `tests/polymarket.test.ts` and style/output samples; no coverage for worker flows, API integration, or store mapping.
