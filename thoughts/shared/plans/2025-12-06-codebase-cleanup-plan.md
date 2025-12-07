# OddsGods Codebase Cleanup Plan – 2025-12-06

## Goals
- Improve worker throughput and stability (RTDS ingestion, backoff, caching, alerts).
- Reduce coupling by isolating domain logic for trades/markets across worker, APIs, and UI.
- Tighten type safety between Prisma models and shared types; centralize thresholds/config.
- Increase maintainability of UI/state by decomposing oversized components and stores.
- Raise confidence via targeted integration tests for worker → DB → API → UI flows.

## Guiding Principles
- Keep behavior identical; focus on structure, clarity, and safety.
- Prefer small, incremental PR-sized steps with measurable impacts.
- Avoid breaking external APIs/DB schema unless explicitly called out.
- Consolidate shared transformations instead of duplicating logic per route/component.

## Priority 0 – Fast Wins (1–2 days)
- [ ] Extract a shared `tradeToAnomaly`/tagging helper used by worker emits and API routes (`app/api/history`, `app/api/top-trades`) to eliminate drift in buckets/tags/metadata.
      - Context: Tag/type logic is duplicated in worker and API routes; mismatches risk inconsistent UI.
      - Files: `lib/polymarket.ts` (new helper), `server/worker.ts`, `app/api/history/route.ts`, `app/api/top-trades/route.ts`.
      - Expected impact: Consistent anomaly shaping, easier future changes.
- [ ] Centralize Gamma market fetch/cache usage so API routes reuse the worker’s parsed metadata instead of re-fetching/parsing per request.
      - Context: History/top-trades/market-history each re-fetch Gamma with their own caches; increases latency and drift.
      - Files: `lib/polymarket.ts` (cache export), `server/worker.ts`, `app/api/history/route.ts`, `app/api/top-trades/route.ts`, `app/api/market-history/route.ts`.
      - Expected impact: Lower API latency, fewer upstream calls, consistent images/context.
- [ ] Split UI-only styling chunks from `components/feed/anomaly-card.tsx` into smaller presentational pieces.
      - Context: 800+ LOC component mixes styling, league resolution, modal trigger logic; hard to change safely.
      - Files: `components/feed/anomaly-card.tsx` (+ new subcomponents).
      - Expected impact: Easier to test/iterate visuals without breaking data logic.

## Priority 1 – Structural Refactors (3–7 days)
- [ ] Create a `lib/domain/trades` module owning enrichment types, thresholds, bucket logic, and tag derivation shared by worker, APIs, and store mapping.
      - Context: Thresholds live in `lib/config.ts` but classification/tagging is duplicated; `lib/types.ts` and Prisma overlap without a domain layer.
      - Files: `lib/types.ts`, `lib/config.ts`, `lib/polymarket.ts`, `lib/intelligence.ts`, `server/worker.ts`, API routes, `lib/store.ts`.
      - Expected impact: Single source of truth for trade shapes; fewer regressions.
- [ ] Modularize `server/worker.ts` into focused files (RTDS client, enrichment pipeline, persistence, alerts, scheduler/cron).
      - Context: 1.4k LOC monolith with timers, scraping, Socket.io, and enrichment logic intertwined.
      - Files: `server/worker.ts` → `server/worker/` modules (new), `lib/intelligence.ts`, `lib/polymarket.ts`.
      - Expected impact: Better readability, targeted tests/mocks, easier performance tuning.
- [ ] Refactor `lib/store.ts` to separate networking (Socket.io, fetches) from state shape and selectors; extract pagination helpers.
      - Context: Store currently holds IO + state + transformations; complicates testing and hydration.
      - Files: `lib/store.ts`, new `lib/client/api` helpers.
      - Expected impact: Clearer client boundaries, easier SSR/data fetching evolution.
- [ ] Standardize config typing and env handling for worker/UI/API (e.g., socket URL, Redis, Gamma/Data API endpoints) in one module.
      - Context: Values spread across `lib/config.ts`, env usage in worker/store/alerts without a typed schema.
      - Files: `lib/config.ts`, `server/worker.ts`, `lib/store.ts`, API routes.
      - Expected impact: Safer deploys, simpler configuration changes.

## Priority 2 – Deeper Improvements (7–14 days)
- [ ] Improve worker resilience: explicit reconnection/backoff policy, metrics/logging hooks, and bounded queues for Discord alerts to avoid user-level fan-out failures.
      - Context: Worker handles alerts inline; error metrics are counters only; timers are scattered.
      - Files: `server/worker.ts` (modularized), `lib/alerts/formatters.ts`.
      - Expected impact: More stable RTDS ingestion and alert delivery under load.
- [ ] Normalize timestamp handling and type alignment across Prisma `Trade`, `EnrichedTrade`, and API responses; remove `any` casts (e.g., positions JSON) with zod/io-ts validators.
      - Context: Mixed Date/number/string handling in store and APIs; casts for positions; potential serialization bugs.
      - Files: `lib/types.ts`, API routes, `lib/store.ts`, `lib/gamma.ts`.
      - Expected impact: Fewer runtime inconsistencies, safer client serialization.
- [ ] Add integration tests covering worker→DB→API→UI mapping for a sample trade; add contract tests for `lib/domain/trades` helper.
      - Context: Current tests limited to `lib/polymarket`; no coverage for critical flows.
      - Files: `tests/` (new integration suite), `server/worker` (mocked), API routes, `lib/domain/trades`.
      - Expected impact: Confidence in refactors and releases.

## Nice-to-Haves / Future Ideas
- [ ] CLI/script to replay synthetic RTDS trade payloads through worker and measure latency/end-to-end emission.
- [ ] Basic metrics exporter (Prometheus-compatible) for worker error counts, reconnects, and enrichment timings.
- [ ] Storybook snippets for decomposed feed components to speed UI iteration.
