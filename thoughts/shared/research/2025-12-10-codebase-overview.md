# OddsGods Codebase Overview (High Level)

## App Shell & Theming
- Root layout loads local Spotify Mix font and wraps all pages with Privy provider; body uses `font-sans`, dark theme, and background/foreground tokens.
```26:43:app/layout.tsx
return (
  <html className={`${spotifyMix.variable} dark`} ...>
    <body className="antialiased bg-background text-foreground font-sans">
      <PrivyWrapper>{children}</PrivyWrapper>
```
- Global design tokens define colors, radii, ticker defaults, and set both sans/mono to Spotify Mix; numerous animation keyframes declared for visual effects.
```1:99:app/globals.css
:root { --background: #050505; --primary: #00FF94; ... --radius-full: 9999px; }
@font-face { font-family: 'Spotify Mix'; src: url('/fonts/Spotify Mix.ttf'); }
@theme inline { --color-background: var(--background); --font-sans: var(--font-spotify-mix); ... }
```

## State & Data Sources (Zustand Store)
- `useMarketStore` maintains anomalies, history pagination, top trades, leaderboard ranks, and socket streaming. History fetched via REST, merged de-duplicated; real-time trades arrive over Socket.io and converted to anomalies before insertion if matching current preferences.
```179:318:lib/store.ts
startStream: () => { loadHistory(); const socket = io(...); socket.on('trade', enriched => { const anomaly = enrichedTradeToAnomaly(enriched); if (passesPreferences(...)) addAnomaly(anomaly); }); }
loadHistory: fetchHistoryApi -> merge unique anomalies; paginate with cursor.
```
- `usePreferencesStore` persists display filters (value/odds thresholds, whale tiers, sports toggle, top-player-only) to localStorage.
```114:147:lib/store.ts
setPreferences merges and auto-saves; loadPreferences reads from localStorage or defaults.
```
- `getTop20Wallets` derives the top-ranked wallet set (configurable threshold) from leaderboard ranks for filtering UI.
```17:34:lib/store.ts
wallets sorted by best rank; slice(0, CONFIG.LEADERBOARD.TOP_RANK_THRESHOLD) -> Set of addresses.
```

## Home Page Composition
- `app/page.tsx` orchestrates four panels inside `DesktopLayout`: AI Insights (left), Live Market feed (center via SlotReel + AnomalyCards), Top Traders (right), and Top Whales (fourth). Mobile view swaps panels per page with bottom carousel.
```191:286:app/page.tsx
<DesktopLayout leftPanel={<AIInsightsPanel />} rightPanel={<TopTradersPanel />} fourthPanel={<TopWhales />} ...>
  {currentPage === 1 && <SlotReel>{visibleAnomalies.map(AnomalyCard)}</SlotReel>}
  Bottom nav carousel controls page switching; SearchButton & ScrollToTop only on feed page.
```
- Anomalies filtered by user preferences, search, and top-ranked wallets; infinite scroll reveals more locally then requests more history if available.
```23:159:app/page.tsx
passesPreferences checks thresholds/tiers/sports; intelligentSearch does fuzzy match; filteredAnomalies -> visibleAnomalies sliced by visibleCount; IntersectionObserver increments visibleCount or triggers loadMoreHistory.
```

## AI Insights Pipeline (Backend -> UI)
- API aggregates last 24h trades, groups by market/outcome, enriches with top-ranked wallets (from leaderboard snapshots), computes enhanced metrics and legacy confidence, ranks by percentile, and returns active picks only (requires top-ranked activity).
```116:491:app/api/ai-insights/route.ts
Phase 1 aggregate trades -> buy/sell/top20 metrics; Phase 3 compute topTrader counts, bestRank, stance, then calculateCompositeSignal(signalInput); legacy confidence stored in pick.confidence; Phase 4 percentiles over raw factor sums; filter picks with top20Trades > 0 and sort by confidencePercentile.
```
- Composite signal factors (volume Z-score vs baseline, rank-weighted score, HHI concentration, recency, directional strength, alignment/engagement) weighted per `FACTOR_WEIGHTS`; flags unusual activity and concentration.
```328:413:lib/signal-calculator.ts
volumeZ = zScore(top20Volume,...); rankWeighted=aggregateRankScore(...); concentrationScore from HHI; recency from timeDecayedTop20Volume ratio; directionStrength via buy/sell logit; alignment blends trader counts and whale volume dominance; rawConfidence = sum of weighted contributions (clamped), with flags isUnusualActivity / isConcentrated.
```
- UI display adjusts percentile/legacy confidence by whale share and consensus to produce a 1–99 score and letter grade.
```23:88:components/ai-insights-panel.tsx
base = pick.confidencePercentile ?? pick.confidence;
consensus from count/volume dominance; crowdFactor scales with topTraderCount; factor = dominanceFactor*shareFactor*crowdFactor (clamped 0.45–1.05); displayConfidence = clamp(round(base*factor), 1, 99); confidenceToGrade maps A+..F.
```

## Leaderboard & Top Traders APIs
- `app/api/leaderboard/route.ts` returns either legacy 7-day volume winners or snapshot-based ranks for Daily/Weekly/Monthly/All Time, including rank deltas; limits rows via `CONFIG.LEADERBOARD.FETCH_LIMIT`.
```5:155:app/api/leaderboard/route.ts
Legacy path aggregates trade volume; snapshot path fetches latest two snapshots per period, computes rankChange, groups by wallet address with accountName/totalPnl.
```
- `app/api/top-traders/route.ts` serves period-filtered top ranked wallets with rank change and P&L history, deduping wallets and honoring fetch limit.
```34:167:app/api/top-traders/route.ts
Determines period via query; finds recent snapshots; fetches top wallets (distinct by walletAddress, rank<=FETCH_LIMIT); builds previous rank map; collects historical PnL per wallet across snapshot dates; returns traders with rankChange and pnlHistory.
```

## Top Traders & Whales UI
- `TopTradersPanel` fetches leaderboard ranks on mount, requests `/api/top-traders` per selected period, deduplicates traders client-side, paginates with IntersectionObserver, and highlights account names only when rank <= configured threshold.
```333:514:components/top-traders-panel.tsx
fetchTraders -> setTraders + visibleCount; uniqueTraders filter duplicates; visibleTraders sliced by PAGE_SIZE with infinite scroll sentinel; displayAccountName only if rank <= CONFIG.LEADERBOARD.TOP_RANK_THRESHOLD.
```
- `TopWhales` lists top trades from store (`topTrades`), paginates locally and via `loadMoreTopTrades` when sentinel observed; period selector drives store fetch.
```15:139:components/top-whales.tsx
visibleTrades = topTrades slice by PAGE_SIZE; IntersectionObserver expands visibleCount then calls loadMoreTopTrades if more pages; uses period from store.
```

## Live Trade Stream & History
- Socket.io stream connects to worker URL (`clientEnv.socketUrl`), listens to `trade` events, transforms to anomalies, filters by current preferences, and injects into store; maintains latest `volume` and ticker items for up to 20 entries.
```272:318:lib/store.ts
socket.on('trade', enrichedTrade => { const anomaly = enrichedTradeToAnomaly(enrichedTrade); if (passesPreferences(...)) addAnomaly(anomaly); });
addAnomaly preserves wallet_context on updates, caps list length at 2000, updates volume and tickerItems for new entries.
```
- History API consumption merges paged results while de-duplicating to keep live-streamed items present.
```233:270:lib/store.ts
fetchHistoryApi({cursor,limit:100}); merge by id with Set; updates historyCursor/hasMoreHistory.
```

## Configuration Anchors
- Central thresholds for whale tiers, odds, leaderboard limits, enrichment batch settings, and external endpoints are defined in `CONFIG`.
```1:39:lib/config.ts
THRESHOLDS {MIN_VALUE, WHALE/MEGA/SUPER/GOD}; CONSTANTS {ODDS_THRESHOLD,...}; LEADERBOARD {TOP_RANK_THRESHOLD,FETCH_LIMIT}; ENRICHMENT batch/time/limits; URLS for Gamma, WS, Data API.
```
