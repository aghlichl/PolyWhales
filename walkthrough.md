# Walkthrough - Event Image Integration

I have integrated event images into the `AnomalyCard` component, fetching them from the Polymarket API and displaying them in the "Tactical HUD" header.

## Changes

### 1. Type Definitions (`lib/types.ts`)
-   Updated `PolymarketMarket` to include `image`, `icon`, and `twitterCardImage`.
-   Updated `MarketMeta` and `Anomaly` to include an `image` field.

### 2. Data Fetching (`lib/polymarket.ts`)
-   Updated `parseMarketData` to extract the image URL.
-   **Logic**: Prioritizes `twitterCardImage` > `image` > `icon`. Checks both the market object and the nested `events` array.

### 3. Market Stream (`lib/market-stream.ts`)
-   Updated the stream logic to pass the `image` from `MarketMeta` to the `Anomaly` object when a trade occurs.

### 4. UI Component (`components/feed/anomaly-card.tsx`)
-   Updated `AnomalyCard` to render the event image in the top-left header.
-   **Design**:
    -   Displays as a 40x40px (`w-10 h-10`) rounded square.
    -   Includes a border and shadow to match the "Tactical HUD" aesthetic.
    -   Features a "scanline" overlay for a tech feel.
    -   Gracefully handles loading errors by hiding the image element.

# Walkthrough - Lazy Loading History

I have implemented infinite scrolling for historical data to allow browsing past anomalies without performance impact.

## Changes

### 1. API Update (`app/api/history/route.ts`)
-   Added `cursor` and `limit` query parameters for pagination.
-   Returns `nextCursor` for sequential fetching.
-   Increased time window to 24 hours.

### 2. Store Update (`lib/store.ts`)
-   Added `historyCursor` and `hasMoreHistory` state.
-   Updated `loadHistory` to handle pagination.
-   Added `loadMoreHistory` action.
-   Increased anomaly list limit to 2000 items to accommodate history.

### 3. UI Integration (`app/page.tsx`)
-   Added `IntersectionObserver` sentinel at the bottom of the feed.
-   Triggers `loadMoreHistory` when user scrolls to bottom.
-   Displays loading indicator while fetching more data.

## Visuals

The image now appears to the left of the event title, providing immediate visual context for the market (e.g., a photo of a politician, a sports team logo, or a crypto icon). Users can seamlessly scroll down to view older trades.
