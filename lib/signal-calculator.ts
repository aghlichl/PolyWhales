/**
 * Quant-Level Signal Calculator
 * 
 * Provides sophisticated statistical analysis for AI insights:
 * - Z-Score volume anomaly detection
 * - Exponential time decay weighting
 * - Rank-weighted scoring (exponential)
 * - HHI concentration index
 * - Buy/sell pressure logistic scoring
 * - Composite confidence with percentile ranking
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Time decay rate (λ). 0.1 gives ~60% weight to trades < 5 hours old */
const DECAY_LAMBDA = 0.1;

/** Rank decay rate. 0.15 gives #1 whale ~20x impact of #20 */
const RANK_DECAY_RATE = 0.15;

/** Maximum rank to consider (beyond this, minimal contribution) */
const MAX_RANK = 100;

/** Z-score threshold for "unusual activity" flag */
export const UNUSUAL_ZSCORE_THRESHOLD = 2.0;

/** HHI threshold for "concentrated" whale consensus */
export const CONCENTRATED_HHI_THRESHOLD = 0.25;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TradeInput {
    tradeValue: number;
    timestamp: Date;
    side: 'BUY' | 'SELL' | string;
    walletAddress: string;
    rank: number | null; // null if not a top wallet
}

export interface MarketBaseline {
    meanVolume: number;
    stdDevVolume: number;
    meanTop20Volume: number;
    stdDevTop20Volume: number;
}

export interface SignalFactors {
    volumeContribution: number;
    rankContribution: number;
    concentrationContribution: number;
    recencyContribution: number;
    directionContribution: number;
    alignmentContribution?: number;
}

export interface EnhancedSignalMetrics {
    // Core statistical metrics
    volumeZScore: number;
    hhiConcentration: number;
    rankWeightedScore: number;
    timeDecayedVolume: number;
    directionConviction: number;

    // Composite scores
    rawConfidence: number;
    confidencePercentile: number;

    // Factor breakdown for explainability
    signalFactors: SignalFactors;

    // Flags
    isUnusualActivity: boolean;
    isConcentrated: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICAL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min = 0, max = 1): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Calculate mean of an array of numbers
 */
export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
export function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = mean(values);
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate Z-score: how many standard deviations from the mean
 */
export function zScore(observed: number, avg: number, std: number): number {
    if (std === 0) return observed > avg ? 3 : 0; // Cap at 3 if no variance
    return (observed - avg) / std;
}

/**
 * Sigmoid function for smooth 0-1 mapping
 */
export function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME DECAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate exponential time decay weight
 * More recent trades get higher weight
 * 
 * @param timestamp - Trade timestamp
 * @param now - Current time (defaults to now)
 * @param lambda - Decay rate (higher = faster decay)
 * @returns Weight between 0 and 1
 */
export function timeDecayWeight(
    timestamp: Date,
    now: Date = new Date(),
    lambda: number = DECAY_LAMBDA
): number {
    const hoursAgo = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    return Math.exp(-lambda * Math.max(0, hoursAgo));
}

/**
 * Calculate time-decayed sum of values
 */
export function timeDecayedSum(
    trades: Array<{ value: number; timestamp: Date }>,
    now: Date = new Date()
): number {
    return trades.reduce((sum, trade) => {
        const weight = timeDecayWeight(trade.timestamp, now);
        return sum + trade.value * weight;
    }, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RANK-WEIGHTED SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate rank-weighted score using exponential decay
 * Rank 1 = 100 points, Rank 20 ≈ 5 points
 * 
 * @param rank - Wallet rank (1 = best)
 * @returns Score from 0 to 100
 */
export function rankScore(rank: number): number {
    if (rank <= 0 || rank > MAX_RANK) return 0;
    return 100 * Math.exp(-RANK_DECAY_RATE * (rank - 1));
}

/**
 * Calculate aggregate rank-weighted score for a set of trades
 * Each whale's contribution is weighted by their rank
 */
export function aggregateRankScore(
    walletRanks: Map<string, number>,
    walletVolumes: Map<string, number>,
    totalVolume: number
): number {
    if (totalVolume === 0) return 0;

    let weightedSum = 0;
    let volumeSum = 0;

    for (const [wallet, volume] of walletVolumes) {
        const rank = walletRanks.get(wallet);
        if (rank !== undefined && rank > 0) {
            const rScore = rankScore(rank);
            const volumeShare = volume / totalVolume;
            weightedSum += rScore * volumeShare;
            volumeSum += volume;
        }
    }

    // Normalize: multiply by whale volume share of total
    const whaleShare = volumeSum / totalVolume;
    return weightedSum * whaleShare;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HHI CONCENTRATION INDEX
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Herfindahl-Hirschman Index (HHI) for concentration
 * 
 * HHI = sum of squared market shares
 * - HHI = 1.0: Single whale controls everything (maximum concentration)
 * - HHI = 0.25: 4 equal whales
 * - HHI → 0: Many small, equal participants
 * 
 * @param shares - Array of volume shares (should sum to 1)
 * @returns HHI value between 0 and 1
 */
export function calculateHHI(shares: number[]): number {
    if (shares.length === 0) return 0;

    // Normalize shares to sum to 1
    const total = shares.reduce((sum, s) => sum + s, 0);
    if (total === 0) return 0;

    const normalizedShares = shares.map(s => s / total);
    return normalizedShares.reduce((sum, share) => sum + share * share, 0);
}

/**
 * Calculate HHI from wallet volumes
 */
export function calculateHHIFromVolumes(walletVolumes: Map<string, number>): number {
    const volumes = Array.from(walletVolumes.values());
    const total = volumes.reduce((sum, v) => sum + v, 0);
    if (total === 0) return 0;

    const shares = volumes.map(v => v / total);
    return calculateHHI(shares);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUY/SELL PRESSURE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate directional conviction using logistic transformation
 * 
 * Returns a value from 0 to 1:
 * - 1.0 = extreme buy pressure
 * - 0.5 = balanced
 * - 0.0 = extreme sell pressure
 */
export function directionConviction(buyVolume: number, sellVolume: number): number {
    // Add small epsilon to avoid division by zero
    const epsilon = 1;
    const logit = Math.log((buyVolume + epsilon) / (sellVolume + epsilon));

    // Scale the logit to make the sigmoid more sensitive
    // Without scaling, you need huge volume differences for conviction
    const scaledLogit = logit * 0.5;

    return sigmoid(scaledLogit);
}

/**
 * Calculate the strength of directional conviction (regardless of direction)
 * Returns 0-1 where 1 = strongest conviction either way
 */
export function directionStrength(buyVolume: number, sellVolume: number): number {
    const conviction = directionConviction(buyVolume, sellVolume);
    // Convert 0-1 scale to 0-1 strength (0.5 = weakest, 0 or 1 = strongest)
    return Math.abs(conviction - 0.5) * 2;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE SIGNAL CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Factor weights for composite signal
 * These are derived from backtesting intuition and can be tuned
 */
const FACTOR_WEIGHTS = {
    volume: 0.14,        // Z-score based unusual volume
    rank: 0.20,          // Quality of whales involved
    concentration: 0.10, // HHI - conviction from consensus
    recency: 0.12,       // Time-decayed volume freshness
    direction: 0.09,     // Buy/sell pressure clarity
    alignment: 0.35,     // Strong weight for multi-top-trader alignment with volume
} as const;

export interface CompositeSignalInput {
    // Volume metrics
    totalVolume: number;
    top20Volume: number;
    timeDecayedTop20Volume: number;

    // Market baseline for Z-scores
    baseline: MarketBaseline;

    // Rank data
    walletRanks: Map<string, number>;  // wallet -> rank
    walletVolumes: Map<string, number>; // wallet -> volume

    // Direction data
    buyVolume: number;
    sellVolume: number;

    // Top trader volume dominance
    topTraderVolume: {
        buyVolume: number;
        sellVolume: number;
        totalVolume: number;
    };

    // Alignment data (unique top traders per side)
    topTraderAlignment: {
        totalTopTraders: number;
        buyCount: number;
        sellCount: number;
    };
}

/**
 * Calculate composite signal with full metrics
 */
export function calculateCompositeSignal(input: CompositeSignalInput): Omit<EnhancedSignalMetrics, 'confidencePercentile'> {
    const {
        totalVolume,
        top20Volume,
        timeDecayedTop20Volume,
        baseline,
        walletRanks,
        walletVolumes,
        buyVolume,
        sellVolume,
        topTraderAlignment,
        topTraderVolume,
    } = input;

    // 1. Volume Z-Score
    const volumeZ = zScore(top20Volume, baseline.meanTop20Volume, baseline.stdDevTop20Volume);
    const volumeScore = clamp(sigmoid(volumeZ - 1) * 2 - 0.5); // Shift sigmoid for better scaling

    // 2. Rank-weighted score
    const rankWeighted = aggregateRankScore(walletRanks, walletVolumes, totalVolume);
    const rankNormalized = clamp(rankWeighted / 50); // Normalize: 50 = excellent avg rank score

    // 3. HHI Concentration
    const hhi = calculateHHIFromVolumes(walletVolumes);
    // Invert and scale: We want some concentration (conviction) but not too much
    // Sweet spot is around 0.25-0.5 (2-4 major whales agreeing)
    const concentrationScore = hhi > 0.5
        ? 1 - (hhi - 0.5) * 2  // Penalize extreme concentration
        : hhi * 2;              // Reward moderate concentration

    // 4. Recency score (time-decayed volume as ratio of total)
    const recencyRatio = top20Volume > 0 ? timeDecayedTop20Volume / top20Volume : 0;
    const recencyScore = clamp(recencyRatio);

    // 5. Direction conviction
    const conviction = directionConviction(buyVolume, sellVolume);
    const dirStrength = directionStrength(buyVolume, sellVolume);

    // 6. Alignment of unique top traders on a single side
    const { totalTopTraders, buyCount, sellCount } = topTraderAlignment;
    const { buyVolume: topTraderBuyVol, sellVolume: topTraderSellVol, totalVolume: topTraderTotalVol } = topTraderVolume;
    const dominantCount = Math.max(buyCount, sellCount);
    const engagementScore = clamp(totalTopTraders / 5); // 5+ top traders caps the engagement benefit
    const alignmentRatio = totalTopTraders > 0 ? dominantCount / totalTopTraders : 0;
    const clusterBoost = clamp(dominantCount / 3); // Strong boost once 3+ top traders align
    const alignmentScoreCounts = clamp(0.5 * alignmentRatio + 0.5 * clusterBoost);
    const dominantTopTraderVol = Math.max(topTraderBuyVol, topTraderSellVol);
    const topTraderVolDominance = topTraderTotalVol > 0 ? dominantTopTraderVol / topTraderTotalVol : 0;
    const topTraderMarketShare = totalVolume > 0 ? topTraderTotalVol / totalVolume : 0;
    const volumeAlignmentScore = clamp(
        0.65 * topTraderVolDominance +
        0.35 * clamp(topTraderMarketShare * 1.5)
    );
    const alignmentScore = clamp(0.55 * alignmentScoreCounts + 0.45 * volumeAlignmentScore);

    // Calculate factor contributions
    const signalFactors: SignalFactors = {
        volumeContribution: volumeScore * FACTOR_WEIGHTS.volume,
        rankContribution: rankNormalized * FACTOR_WEIGHTS.rank,
        concentrationContribution: concentrationScore * FACTOR_WEIGHTS.concentration,
        recencyContribution: recencyScore * FACTOR_WEIGHTS.recency,
        directionContribution: dirStrength * FACTOR_WEIGHTS.direction,
        alignmentContribution: alignmentScore * FACTOR_WEIGHTS.alignment + engagementScore * 0.05,
    };

    // Composite raw confidence (0-1)
    const rawConfidence =
        signalFactors.volumeContribution +
        signalFactors.rankContribution +
        signalFactors.concentrationContribution +
        signalFactors.recencyContribution +
        signalFactors.directionContribution +
        (signalFactors.alignmentContribution ?? 0);

    return {
        volumeZScore: volumeZ,
        hhiConcentration: hhi,
        rankWeightedScore: rankWeighted,
        timeDecayedVolume: timeDecayedTop20Volume,
        directionConviction: conviction,
        rawConfidence: clamp(rawConfidence),
        signalFactors,
        isUnusualActivity: volumeZ >= UNUSUAL_ZSCORE_THRESHOLD,
        isConcentrated: hhi >= CONCENTRATED_HHI_THRESHOLD,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERCENTILE RANKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate percentile rank for an array of scores
 * Returns array of percentiles (0-100) in same order as input
 */
export function calculatePercentiles(scores: number[]): number[] {
    if (scores.length === 0) return [];
    if (scores.length === 1) return [50]; // Single item = median

    // Create sorted indices
    const indexed = scores.map((score, idx) => ({ score, idx }));
    indexed.sort((a, b) => a.score - b.score);

    // Assign percentiles
    const percentiles = new Array<number>(scores.length);
    for (let i = 0; i < indexed.length; i++) {
        const percentile = ((i + 0.5) / indexed.length) * 100;
        percentiles[indexed[i].idx] = Math.round(percentile);
    }

    return percentiles;
}

/**
 * Calculate market baselines from historical volume data
 */
export function calculateMarketBaseline(
    marketVolumes: number[],
    marketTop20Volumes: number[]
): MarketBaseline {
    return {
        meanVolume: mean(marketVolumes),
        stdDevVolume: stdDev(marketVolumes),
        meanTop20Volume: mean(marketTop20Volumes),
        stdDevTop20Volume: stdDev(marketTop20Volumes),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert enhanced metrics to legacy confidence score (0-100)
 * For backwards compatibility with existing UI
 */
export function toLegacyConfidence(metrics: EnhancedSignalMetrics): number {
    return Math.round(metrics.confidencePercentile);
}
