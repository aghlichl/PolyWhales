## Analysis: Confidence Rating Calculation

### Overview

The confidence rating system is a sophisticated multi-factor composite score that evaluates AI trading insights based on six key dimensions: volume anomaly detection, trader rank quality, concentration consensus, trade recency, directional conviction, and trader alignment. The system produces both a raw confidence score (0-1) and a percentile ranking (0-100) across all active markets, with the percentile serving as the primary display metric.

### Entry Points

- `app/api/ai-insights/route.ts:446` - Main calculation via `calculateCompositeSignal()` function
- `lib/signal-calculator.ts:437` - Core `calculateCompositeSignal()` implementation
- `components/ai-insights-panel.tsx:54` - Frontend `computeAdjustedConfidence()` for final display adjustments

### Core Implementation

#### 1. Data Aggregation Phase (`app/api/ai-insights/route.ts:212-363`)

The system first aggregates trade data from the past 24 hours, focusing on top 200 ranked traders:

- **Volume Metrics**: Total volume, top 20 volume, buy/sell split, time-decayed volume
- **Trader Tracking**: Unique wallets by rank tier (Elite: 1-10, Gold: 11-30, Silver: 31-100, Bronze: 101-200)
- **Time Decay**: Recent trades (< 5 hours) get ~60% higher weight using exponential decay (λ = 0.1)

#### 2. Market Baseline Calculation (`app/api/ai-insights/route.ts:365-383`)

Statistical baselines are computed across all active markets to enable Z-score comparisons:

```typescript:app/api/ai-insights/route.ts
const baseline: MarketBaseline = calculateMarketBaseline(allTotalVolumes, allTop20Volumes);
```

- **Mean Top 20 Volume**: Average volume from top traders across markets
- **Standard Deviation**: Measures volatility for Z-score calculations
- **Z-Score Threshold**: 2.0 standard deviations flags "unusual activity"

#### 3. Composite Signal Calculation (`lib/signal-calculator.ts:437-546`)

The core algorithm combines six weighted factors:

##### Volume Contribution (15% weight)
```typescript:lib/signal-calculator.ts
const volumeZ = zScore(top20Volume, baseline.meanTop20Volume, baseline.stdDevTop20Volume);
const volumeScore = clamp(sigmoid(volumeZ - 1) * 2 - 0.5);
```
- Measures how unusual the top trader volume is compared to market averages
- Uses sigmoid transformation to create smooth 0-1 scaling
- Z-score > 2.0 triggers "unusual activity" flag

##### Rank Contribution (28% weight)
```typescript:lib/signal-calculator.ts
const rankWeighted = aggregateRankScore(walletRanks, walletVolumes, totalVolume);
const rankNormalized = clamp(rankWeighted / 50);
```
- Elite traders (rank 1-10) get full weight (1.0)
- Gold (11-30): 0.6x weight, Silver (31-100): 0.3x, Bronze (101-200): 0.1x
- Exponential decay: rank 1 = 100 points, rank 20 ≈ 5 points
- Normalizes against 50-point benchmark

##### Concentration Contribution (12% weight)
```typescript:lib/signal-calculator.ts
const hhi = calculateHHIFromVolumes(walletVolumes);
const concentrationScore = hhi > 0.5
    ? 1 - (hhi - 0.5) * 2  // Penalize extreme concentration
    : hhi * 2;              // Reward moderate concentration
```
- Herfindahl-Hirschman Index measures market share concentration
- Sweet spot: 0.25-0.5 (2-4 major whales agreeing)
- HHI > 0.25 flags "concentrated" consensus

##### Recency Contribution (12% weight)
```typescript:lib/signal-calculator.ts
const recencyRatio = top20Volume > 0 ? timeDecayedTop20Volume / top20Volume : 0;
const recencyScore = clamp(recencyRatio);
```
- Ratio of time-decayed volume to total volume
- Recent trades (< 5 hours) carry more weight
- Exponential decay with λ = 0.1

##### Direction Contribution (8% weight)
```typescript:lib/signal-calculator.ts
const conviction = directionConviction(buyVolume, sellVolume);
const dirStrength = directionStrength(buyVolume, sellVolume);
```
- Logistic transformation of buy/sell volume ratio
- Returns 0-1 scale where 0.5 = balanced, 0/1 = extreme conviction
- Direction strength measures conviction intensity regardless of side

##### Alignment Contribution (25% weight)
```typescript:lib/signal-calculator.ts
const engagementScore = clamp(Math.log2(totalWeighted + 1) / Math.log2(10));
const alignmentRatio = totalWeighted > 0 ? dominantWeighted / totalWeighted : 0;
const clusterBoost = clamp(Math.log2(dominantWeighted + 1) / Math.log2(5));
const alignmentScoreCounts = clamp(0.4 * alignmentRatio + 0.6 * clusterBoost);
```
- Tier-weighted trader counts (elite = 10x bronze impact)
- Logarithmic scaling prevents linear diminishing returns
- Combines count-based alignment (40%) and volume-based dominance (60%)

#### 4. Raw Confidence Calculation (`lib/signal-calculator.ts:527-533`)

```typescript:lib/signal-calculator.ts
const rawConfidence =
    signalFactors.volumeContribution +
    signalFactors.rankContribution +
    signalFactors.concentrationContribution +
    signalFactors.recencyContribution +
    signalFactors.directionContribution +
    (signalFactors.alignmentContribution ?? 0);
```

Factor weights total 100%:
- Volume: 15%, Rank: 28%, Concentration: 12%, Recency: 12%, Direction: 8%, Alignment: 25%

#### 5. Percentile Ranking (`app/api/ai-insights/route.ts:462-476`)

```typescript:app/api/ai-insights/route.ts
const percentiles = calculatePercentiles(rawConfidences);
```
- Ranks all active markets against each other
- Uses percentile rank formula: ((rank - 0.5) / total) * 100
- Primary display metric (0-100 scale)

### Data Flow

1. **Trade Aggregation** (`app/api/ai-insights/route.ts:212-363`)
   - Fetch 24-hour trades from top 200 traders
   - Group by market/outcome combinations
   - Calculate volume metrics and trader participation

2. **Baseline Computation** (`app/api/ai-insights/route.ts:365-383`)
   - Calculate market-wide averages for Z-score normalization
   - Only considers active (non-expired) markets

3. **Signal Calculation** (`lib/signal-calculator.ts:437-546`)
   - Apply statistical transformations to each market
   - Compute six factor contributions
   - Generate raw confidence score (0-1)

4. **Percentile Ranking** (`app/api/ai-insights/route.ts:462-476`)
   - Compare all markets against each other
   - Convert to percentile scale (0-100)

5. **Frontend Adjustment** (`components/ai-insights-panel.tsx:54-99`)
   - Apply conservative crowd/consensus multipliers (±15% max)
   - Logarithmic scaling for trader count effects
   - Final display confidence (1-99 range)

### Key Patterns

- **Tier-Weighted Analysis**: Elite traders have 10x the impact of bronze traders
- **Exponential Decay**: Recent trades and high-ranked traders get disproportionate weight
- **Relative Ranking**: Percentiles provide market-relative confidence rather than absolute scores
- **Multi-Factor Composite**: Six distinct signals prevent over-reliance on any single metric
- **Logarithmic Scaling**: Prevents linear growth in trader alignment effects

### Configuration

- **Decay Constants**: λ = 0.1 for time decay, 0.15 for rank weighting
- **Tier Boundaries**: Elite (1-10), Gold (11-30), Silver (31-100), Bronze (101-200)
- **Z-Score Threshold**: 2.0 for unusual activity detection
- **HHI Threshold**: 0.25 for concentrated consensus
- **Factor Weights**: Total 1.0 across six dimensions

### Error Handling

- **Division by Zero**: Epsilon values (1e-6) prevent NaN in ratios
- **Empty Datasets**: Returns 0 for missing data rather than failing
- **Outlier Protection**: Clamp functions prevent extreme values
- **Fallback Logic**: Legacy confidence calculation if new system fails

### Historical Tracking

- **Snapshot Frequency**: Every 5 minutes for active markets
- **Retention**: 24-hour history with automatic cleanup
- **Storage**: `AiInsightHistory` table with full metric breakdown
- **Visualization**: Sparkline charts showing confidence trends over time