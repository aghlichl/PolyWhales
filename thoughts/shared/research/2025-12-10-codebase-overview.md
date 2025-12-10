## Analysis: Leaderboard Scraper

### Overview
- Leaderboard data is collected by a Cheerio-based HTML scraper in `server/worker.ts`. It visits four timeframe-specific leaderboard pages (Daily, Weekly, Monthly, All Time), discovers up to five pagination pages per timeframe, parses the visible rows, converts profit/volume labels to numbers, and stores snapshots in Prisma. The scraper is scheduled hourly when the worker boots. A standalone test harness in `tests/test-leaderboard-scraper.ts` mirrors the scrape for ad-hoc runs.

### Entry Points
- `server/worker.ts:1320-1325` – `connectToPolymarket()` starts the hourly scrape schedule and an initial delayed run inside the RTDS WebSocket bootstrap.
- `server/worker.ts:228-307` – `scrapeLeaderboard()` performs the full scrape and persistence flow.

### Core Implementation
- URL/timeframe configuration and scrape cadence
  - `server/worker.ts:101-111` defines four leaderboard URLs and timeframes, plus page/interval constants.
  - `server/worker.ts:1320-1325` schedules `scrapeLeaderboard` hourly and once 30s after startup.
- Pagination and row extraction helpers
  - `server/worker.ts:125-173` `extractPageLinks` builds a list of up to five page URLs by inspecting pagination elements, normalizing relative links.
  - `server/worker.ts:175-205` `scrapeLeaderboardRowsFromPage` parses each leaderboard page’s row markup and returns typed `LeaderboardRow` objects (rank, displayName, wallet, profitLabel, volumeLabel) capped at 20 per page.
  - `server/worker.ts:114-123` `parseCurrency` converts formatted profit/volume labels (handles currency symbols, commas, leading "+", em dash placeholder) to numbers or null.
- Main scrape-and-persist flow
  - `server/worker.ts:228-307` `scrapeLeaderboard` loops through configured timeframes, fetches the base page with a browsery User-Agent, discovers pagination via `extractPageLinks`, fetches each page (reusing base HTML for page 1), loads HTML with `cheerio`, and accumulates rows via `scrapeLeaderboardRowsFromPage`.
  - After scraping, it converts labels to numbers with `parseCurrency`, stamps `snapshotAt`, maps rows into `walletLeaderboardSnapshot` records, and inserts them in bulk with `prisma.walletLeaderboardSnapshot.createMany`.
- Related test harness (mirrors scrape logic)
  - `tests/test-leaderboard-scraper.ts:75-177` runs a single-timeframe scrape, limits to two rows, inserts snapshots via Prisma, and additionally fetches positions per wallet from the data API for exploratory storage in `whalePositionSnapshot`.

### Data Flow
1. `connectToPolymarket()` bootstraps the worker, then schedules `scrapeLeaderboard` hourly and once after 30s.
2. `scrapeLeaderboard()` iterates `LEADERBOARD_URLS`, fetches HTML per timeframe, collects pagination links (`extractPageLinks`), and fetches up to five pages.
3. Each page HTML is parsed with Cheerio; `scrapeLeaderboardRowsFromPage` extracts rank/displayName/wallet/profitLabel/volumeLabel (20 rows per page), appending to `allRows`.
4. After all timeframes/pages, `parseCurrency` converts labels; rows are mapped into Prisma `walletLeaderboardSnapshot` objects with `snapshotAt` and inserted via `createMany`.

### Replacement Touchpoints (for swapping out the HTML scrape)
- Network + HTML parsing: `scrapeLeaderboard`’s fetch calls and `cheerio` usage are the sole sources of leaderboard data (`server/worker.ts:238-277`). These are the parts to swap if using a direct JSON endpoint instead of HTML.
- Row construction: `scrapeLeaderboardRowsFromPage` builds `LeaderboardRow` objects from DOM nodes (`server/worker.ts:175-205`). With a JSON payload, this structure would come directly from the JSON fields rather than DOM extraction.
- Numeric conversion + persistence: `parseCurrency` and the mapping into `walletLeaderboardSnapshot.createMany` (`server/worker.ts:285-301`) are the post-parse steps that remain the same data-shaping boundary before DB insert; upstream source values would feed into the same mapping.

### Key Configuration & Limits
- Timeframes/URLs: `LEADERBOARD_URLS` (`server/worker.ts:101-106`).
- Cadence: hourly interval `LEADERBOARD_SCRAPE_INTERVAL_MS` (`server/worker.ts:108`).
- Page bounds: `LEADERBOARD_PAGE_SIZE` = 20, `MAX_LEADERBOARD_PAGES` = 5 (`server/worker.ts:109-110`).

### Error Handling & Logging
- Logs progress per timeframe/page and total rows; errors in `scrapeLeaderboard` are caught and logged (`server/worker.ts:228-306`). Failed fetches in the test harness log warnings; production scraper relies on try/catch around the whole scrape.

## Code References
```101:111:server/worker.ts
const LEADERBOARD_URLS = [
  { url: "https://polymarket.com/leaderboard/overall/today/profit", timeframe: "Daily" },
  { url: "https://polymarket.com/leaderboard/overall/weekly/profit", timeframe: "Weekly" },
  { url: "https://polymarket.com/leaderboard/overall/monthly/profit", timeframe: "Monthly" },
  { url: "https://polymarket.com/leaderboard/overall/all/profit", timeframe: "All Time" },
];
const LEADERBOARD_SCRAPE_INTERVAL_MS = 60 * 60 * 1000; // Every 1 hour
const LEADERBOARD_PAGE_SIZE = 20;
```
```125:173:server/worker.ts
function extractPageLinks(
  $: CheerioAPI,
  baseUrl: string
): { pageNum: number; url: string }[] {
  const pages = new Map<number, string>();
  const normalizedBase = new URL(baseUrl).toString();
  // ... parses pagination nav elements, normalizes hrefs, caps at MAX_LEADERBOARD_PAGES
  return Array.from(pages.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pageNum, url]) => ({ pageNum, url }));
}
```
```175:205:server/worker.ts
function scrapeLeaderboardRowsFromPage(
  $: CheerioAPI,
  timeframe: LeaderboardRow["timeframe"],
  pageNum: number
): LeaderboardRow[] {
  const rows: LeaderboardRow[] = [];
  $(".flex.flex-col.gap-2.py-5.border-b").each((i, row) => {
    if (i >= LEADERBOARD_PAGE_SIZE) return;
    const $row = $(row);
    const usernameAnchor = $row.find('a[href^="/profile/"]').last();
    const displayName = usernameAnchor.text().trim();
    const wallet = usernameAnchor.attr("href")!.replace("/profile/", "");
    const profitLabel = $row.find("p.text-text-primary").text().trim();
    const volumeLabel = $row.find("p.text-text-secondary").text().trim();
    rows.push({ timeframe, rank: (pageNum - 1) * LEADERBOARD_PAGE_SIZE + (i + 1), displayName, wallet, profitLabel, volumeLabel });
  });
  return rows;
}
```
```228:301:server/worker.ts
async function scrapeLeaderboard() {
  console.log("[Worker] Starting leaderboard scrape...");
  const allRows: LeaderboardRow[] = [];
  for (const { url, timeframe } of LEADERBOARD_URLS) {
    const baseHtml = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, }).then((r) => r.text());
    let $ = load(baseHtml);
    const pageLinks = extractPageLinks($, url);
    for (const { pageNum, url: pageUrl } of pageLinks) {
      const html = pageNum === 1 ? baseHtml : await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", }, }).then((r) => r.text());
      $ = load(html);
      const pageRows = scrapeLeaderboardRowsFromPage($, timeframe, pageNum);
      allRows.push(...pageRows);
    }
  }
  if (allRows.length > 0) {
    const snapshotAt = new Date();
    const rowsToInsert = allRows.map((row) => ({ walletAddress: row.wallet, period: row.timeframe, rank: row.rank, totalPnl: parseCurrency(row.profitLabel) ?? 0, totalVolume: parseCurrency(row.volumeLabel) ?? 0, winRate: 0, snapshotAt, accountName: row.displayName, }));
    await prisma.walletLeaderboardSnapshot.createMany({ data: rowsToInsert });
  }
}
```
```1320:1325:server/worker.ts
// Start leaderboard scraper (hourly)
console.log("[Worker] Starting leaderboard scraper schedule (hourly)...");
setInterval(scrapeLeaderboard, LEADERBOARD_SCRAPE_INTERVAL_MS);
// Run once on startup after a delay
setTimeout(scrapeLeaderboard, 30000);
```
```75:139:tests/test-leaderboard-scraper.ts
async function testScrape() {
  console.log("Starting test scrape...");
  const allRows: LeaderboardRow[] = [];
  for (const { url, timeframe } of LEADERBOARD_URLS) {
    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", }, }).then((r) => r.text());
    const $ = load(html);
    $(".flex.flex-col.gap-2.py-5.border-b").each((i, row) => {
      if (i >= 2) return; // Limit to 2 for testing positions
      const $row = $(row);
      const usernameAnchor = $row.find('a[href^="/profile/"]').last();
      const displayName = usernameAnchor.text().trim();
      const wallet = usernameAnchor.attr("href")!.replace("/profile/", "");
      const profitLabel = $row.find("p.text-text-primary").text().trim();
      const volumeLabel = $row.find("p.text-text-secondary").text().trim();
      allRows.push({ timeframe, rank: i + 1, displayName, wallet, profitLabel, volumeLabel });
    });
  }
  // ... inserts snapshots and fetches positions per wallet for testing
}
```
