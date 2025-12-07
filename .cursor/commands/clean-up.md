You are an expert TypeScript / Next.js / Node.js engineer and codebase architect. You are operating inside the **OddsGods** repository.

## High-Level Goal

Perform a **codebase audit + cleanup proposal** for this repo and produce:
1. A concise **codebase map** (architecture + key flows).
2. A prioritized **refactor & cleanup plan** focused on:
   - Performance & worker efficiency
   - Code organization & boundaries
   - Type safety & DX
   - Maintainability & testability

⚠️ In this first pass:
- **Do NOT modify any existing source files.**
- Only **read**, analyze, and then **add new markdown planning docs**.

---

## Repository Context & Scope

Treat this as a production-grade app with:
- Next.js App Router front-end (React + TS)
- A worker (`server/worker.ts`) handling scraping + enrichment + persistence
- Prisma + Postgres backend
- Realtime trade feed + Polymarket integrations
- Zustand or similar global store (`lib/store.ts`)

**Focus your analysis on:**

- `app/**`
- `components/**`
- `lib/**`
- `server/**`
- `tests/**`
- `prisma/schema.prisma`

**Explicitly ignore or treat as generated/static:**

- `generated/**`
- `public/**` (logos, images, SVGs, etc.)
- `.cursor/**`
- `thoughts/**` (existing plans/research; you can reference but don’t modify)
- `package-lock.json`
- `prisma/migrations/**`

---

## Phase 1 – Codebase Mapping

1. **Scan structure & entry points**
   - Identify:
     - The primary user entry routes (e.g. `app/page.tsx`, `app/leaderboard/page.tsx`, etc.).
     - API routes under `app/api/**` and their responsibilities.
     - Worker entry (`server/worker.ts`) and its main responsibilities.
   - Map how data flows:
     - From Polymarket (websocket / HTTP) → worker → database → API → frontend components.

2. **Produce a codebase map document**

Create a new markdown file:

- `thoughts/shared/research/2025-12-06-codebase-audit-overview.md`

Content requirements:

- High-level architecture overview (1–2 sections).
- Bullet list of **key modules**:
  - Frontend (pages + layout + main UI components)
  - Data layer (APIs, lib/polymarket, lib/intelligence, lib/alerts, etc.)
  - Worker (scraping, enrichment, persistence)
  - Types/models (lib/types, Prisma models)
- For each key area, capture:
  - Main responsibilities
  - Important files
  - Any obvious smells (e.g. “this file is >500 LOC”, “UI + business logic tightly coupled”, etc.)

---

## Phase 2 – Hotspot & Complexity Analysis

Identify **hotspots** that are likely to benefit most from cleanup.

1. **Find large / complex files**
   - Look for:
     - Files > 400–500 lines (e.g. `components/feed/anomaly-card.tsx`, `components/feed/trade-details-modal.tsx`, etc.).
     - Mixed responsibilities (UI + data fetching + business logic in the same file).
     - Repeated patterns across components or APIs.

2. **Check shared libs & types**
   - Inspect:
     - `lib/polymarket.ts`
     - `lib/intelligence.ts`
     - `lib/alerts/**`
     - `lib/teamMeta.ts`
     - `lib/types.ts`
   - Identify:
     - Duplicate type definitions vs what exists in Prisma or generated models.
     - Any ad-hoc parsing/transform logic that could be centralized.
     - Any “god functions” that should be decomposed.

3. **Check state and configuration**
   - Inspect:
     - `lib/store.ts`
     - `lib/config.ts`
   - Answer:
     - Is global state minimal and purposeful?
     - Are config values centralized and typed?
     - Are there UI-only things leaking into shared libs or vice versa?

4. **Output hotspot report**

Create a new markdown file:

- `thoughts/shared/research/2025-12-06-hotspot-analysis.md`

Content requirements:

- Section: `## Largest / most complex files`
  - Bullet list of files with:
    - Approx LOC
    - Brief description of role
    - Why they’re a hotspot (coupling, branching, state, etc.)

- Section: `## Cross-cutting concerns`
  - Note repeated logic (e.g. Polymarket data parsing, wallet enrichment, timestamp normalization, etc.).
  - Note any obvious boundary violations (e.g. UI layer knowing too much about worker internals).

---

## Phase 3 – Refactor & Cleanup Plan (Prioritized)

Based on Phases 1–2, create a **concrete, prioritized plan** that can be executed incrementally without destabilizing the app.

Create:

- `thoughts/shared/plans/2025-12-06-codebase-cleanup-plan.md`

This plan should be extremely actionable and structured like this:

```markdown
# OddsGods Codebase Cleanup Plan – 2025-12-06

## Goals
- (3–5 bullets: performance, maintainability, type safety, etc.)

## Guiding Principles
- Keep behavior identical; focus on structure, clarity, and safety.
- Prefer small, incremental PR-sized steps.
- Avoid breaking changes to external APIs or DB schema unless explicitly called out.

## Priority 0 – Fast Wins (1–2 days)
- [ ] Item: e.g. Extract shared Polymarket client from duplicate fetch logic in app/api and worker.
      - Context: (1–2 sentences)
      - Files touched: (list)
      - Expected impact: (perf / clarity / DX)

- [ ] Item: e.g. Split giant UI components (anomaly-card, trade-details-modal) into smaller presentational + container components.

## Priority 1 – Structural Refactors (3–7 days)
- [ ] Item: e.g. Introduce a dedicated `lib/domain/trades` module to own all trade-related transformations and types.
- [ ] Item: e.g. Normalize timestamp handling across worker, DB, and frontend.

## Priority 2 – Deeper Improvements (7–14 days)
- [ ] Item: e.g. Improve worker concurrency & backoff strategy, add metrics hooks, tighten typing around enrichment steps.
- [ ] Item: e.g. Add higher-level integration tests for the most important flows (worker → DB → API → UI).

## Nice-to-Haves / Future Ideas
- [ ] Item: e.g. CLI script to run synthetic workloads against the worker/API to measure performance.
