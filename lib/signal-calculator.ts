/**
 * Quant-Level Signal Calculator
 * 
 * HYBRID SCORING MODEL (v2.0)
 * ===========================
 * Uses a base + modifier architecture where weak factors REDUCE the final score:
 * 
 * - BASE SCORE: Volume anomaly + Rank quality (the foundation)
 * - MODIFIERS: Recency, Direction, Concentration, Alignment (0.5–1.2 multipliers)
 * - FINAL = BASE × Π(MODIFIERS) (multiplicative gating)
 * 
 * This prevents "everything is 95%+" by ensuring weak factors drag down scores.
 * Only markets with strong convergence across ALL factors reach exceptional confidence.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Signal quality classification based on raw confidence */
export type SignalQuality = 'weak' | 'moderate' | 'strong' | 'exceptional';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS

/** Time decay rate (λ). 0.1 gives ~60% weight to trades < 5 hours old */
const DECAY_LAMBDA = 0.1;

/** Rank decay rate. 0.15 gives #1 whale ~20x impact of #20 */
const RANK_DECAY_RATE = 0.15;

/** Maximum rank to consider (beyond this, minimal contribution) */
const MAX_RANK = 200;

/** Z-score threshold for "unusual activity" flag */
export const UNUSUAL_ZSCORE_THRESHOLD = 2.0;

// ═══════════════════════════════════════════════════════════════════════════════
// TIER WEIGHTS - Differentiate trader quality within top 200
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tier weight multipliers for trader count calculations
 * Elite traders have 10x the signal weight of bronze traders
 */
export const TIER_WEIGHTS = {
    ELITE: 1.0,    // Rank 1-10: Full impact (the best of the best)
    GOLD: 0.6,     // Rank 11-30: Strong impact
    SILVER: 0.3,   // Rank 31-100: Moderate impact
    BRONZE: 0.1,   // Rank 101-200: Minor impact
} as const;

/** Tier boundaries (inclusive upper bounds) */
export const TIER_BOUNDS = {
    ELITE: 10,
    GOLD: 30,
    SILVER: 100,
    BRONZE: 200,
} as const;

/** Breakdown of traders by tier */
export interface TierBreakdown {
    elite: number;
    gold: number;
    silver: number;
    bronze: number;
}

/**
 * Get the tier for a given rank
 */
export function getTierForRank(rank: number): keyof typeof TIER_WEIGHTS | null {
    if (rank <= 0) return null;
    if (rank <= TIER_BOUNDS.ELITE) return 'ELITE';
    if (rank <= TIER_BOUNDS.GOLD) return 'GOLD';
    if (rank <= TIER_BOUNDS.SILVER) return 'SILVER';
    if (rank <= TIER_BOUNDS.BRONZE) return 'BRONZE';
    return null;
}

/**
 * Get tier weight for a given rank
 */
export function getTierWeight(rank: number): number {
    const tier = getTierForRank(rank);
    if (!tier) return 0;
    return TIER_WEIGHTS[tier];
}

/**
 * Calculate tier breakdown from an array of ranks
 */
export function calculateTierBreakdown(ranks: number[]): TierBreakdown {
    const breakdown: TierBreakdown = { elite: 0, gold: 0, silver: 0, bronze: 0 };

    for (const rank of ranks) {
        const tier = getTierForRank(rank);
        if (tier === 'ELITE') breakdown.elite++;
        else if (tier === 'GOLD') breakdown.gold++;
        else if (tier === 'SILVER') breakdown.silver++;
        else if (tier === 'BRONZE') breakdown.bronze++;
    }

    return breakdown;
}

/**
 * Calculate weighted trader count using tier weights
 * 1 elite trader = 10 bronze traders in signal weight
 */
export function calculateWeightedTraderCount(ranks: number[]): number {
    let weightedCount = 0;

    for (const rank of ranks) {
        weightedCount += getTierWeight(rank);
    }

    return weightedCount;
}

/**
 * Calculate weighted trader count with buy/sell breakdown
 */
export function calculateWeightedTraderCountBySide(
    buyRanks: number[],
    sellRanks: number[]
): { buyWeighted: number; sellWeighted: number; totalWeighted: number } {
    const buyWeighted = calculateWeightedTraderCount(buyRanks);
    const sellWeighted = calculateWeightedTraderCount(sellRanks);

    return {
        buyWeighted,
        sellWeighted,
        totalWeighted: buyWeighted + sellWeighted,
    };
}

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

    // Hybrid model v2.0 fields
    signalQuality: SignalQuality;
    modifierProduct: number;  // Product of all modifier factors (for debugging)

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

/**
 * HYBRID SCORING MODEL v2.0
 * 
 * Architecture:
 * - BASE SCORE: Volume anomaly (35%) + Rank quality (65%) → foundation of the signal
 * - MODIFIERS: Recency, Direction, Concentration, Alignment → multiply base (0.5–1.2 range)
 * - FINAL = BASE × Π(MODIFIERS)
 * 
 * This design ensures weak factors REDUCE scores (unlike pure additive models).
 * Top scores require strong performance across ALL dimensions.
 */

/** Base score weights (must sum to 1.0) */
const BASE_WEIGHTS = {
    volume: 0.35,   // Z-score based unusual volume
    rank: 0.65,     // Quality of whales involved
} as const;

/** Modifier ranges - weak factors drag score down, strong factors boost it */
const MODIFIER_RANGES = {
    recency: { min: 0.6, max: 1.15 },      // Fresh trades boost, stale drags
    direction: { min: 0.5, max: 1.2 },     // Clear direction boosts, split penalizes
    concentration: { min: 0.7, max: 1.1 }, // Sweet spot concentration boosts
    alignment: { min: 0.5, max: 1.2 },     // Strong alignment boosts, weak drags
} as const;

/**
 * Map a 0-1 score to a modifier range
 * score=0 → min, score=0.5 → 1.0, score=1 → max
 */
function toModifier(score: number, range: { min: number; max: number }): number {
    // Center at 0.5 = 1.0 (neutral), scale to range
    if (score <= 0.5) {
        // Below neutral: interpolate from min to 1.0
        return range.min + (1.0 - range.min) * (score / 0.5);
    } else {
        // Above neutral: interpolate from 1.0 to max
        return 1.0 + (range.max - 1.0) * ((score - 0.5) / 0.5);
    }
}

/**
 * Classify raw confidence into signal quality tiers
 */
function classifySignalQuality(rawConfidence: number): SignalQuality {
    if (rawConfidence >= 0.70) return 'exceptional';
    if (rawConfidence >= 0.50) return 'strong';
    if (rawConfidence >= 0.30) return 'moderate';
    return 'weak';
}

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

    // Tier-weighted trader data
    weightedTraderData?: {
        buyWeighted: number;
        sellWeighted: number;
        totalWeighted: number;
        tierBreakdown: TierBreakdown;
    };
}

/**
 * Calculate composite signal using hybrid base + modifier architecture
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

    // ═══════════════════════════════════════════════════════════════════════════
    // BASE SCORE COMPONENTS (Volume + Rank)
    // ═══════════════════════════════════════════════════════════════════════════

    // 1. Volume Z-Score - measures how unusual the whale activity is
    const volumeZ = zScore(top20Volume, baseline.meanTop20Volume, baseline.stdDevTop20Volume);
    // Slower sigmoid: need Z > 2 to reach 0.5, Z > 3 for strong score
    const volumeScore = clamp(sigmoid(volumeZ - 2) * 1.8);

    // 2. Rank-weighted score - quality of whales involved
    const rankWeighted = aggregateRankScore(walletRanks, walletVolumes, totalVolume);
    // Stricter normalization: need score of 75 (was 50) to max out
    const rankNormalized = clamp(rankWeighted / 75);

    // BASE SCORE: Foundation of the signal
    const baseScore = volumeScore * BASE_WEIGHTS.volume + rankNormalized * BASE_WEIGHTS.rank;

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIER COMPONENTS (Multiply the base score)
    // ═══════════════════════════════════════════════════════════════════════════

    // 3. Recency - how fresh is the activity?
    const recencyRatio = top20Volume > 0 ? timeDecayedTop20Volume / top20Volume : 0;
    const recencyScore = clamp(recencyRatio);
    const recencyModifier = toModifier(recencyScore, MODIFIER_RANGES.recency);

    // 4. Direction conviction - how clear is the buy/sell signal?
    const conviction = directionConviction(buyVolume, sellVolume);
    const dirStrength = directionStrength(buyVolume, sellVolume);

    // Apply "conflicting whales" penalty for split direction
    const { buyCount, sellCount, totalTopTraders } = topTraderAlignment;
    const minSide = Math.min(buyCount, sellCount);
    const maxSide = Math.max(buyCount, sellCount);
    const isSplitDirection = totalTopTraders >= 2 && minSide > 0 && (minSide / maxSide > 0.4);

    // If whales are split, apply harsh penalty regardless of volume direction
    const effectiveDirStrength = isSplitDirection ? dirStrength * 0.3 : dirStrength;
    const directionModifier = toModifier(effectiveDirStrength, MODIFIER_RANGES.direction);

    // 5. Concentration - is there conviction from a focused group?
    const hhi = calculateHHIFromVolumes(walletVolumes);
    // Sweet spot is 0.25-0.5 (2-4 major whales agreeing)
    // Score peaks at HHI = 0.35, falls off on either side
    let concentrationScore: number;
    if (hhi < 0.1) {
        concentrationScore = 0.3;  // Too dispersed = weak
    } else if (hhi < 0.25) {
        concentrationScore = 0.3 + 0.7 * ((hhi - 0.1) / 0.15);  // Ramp up
    } else if (hhi <= 0.5) {
        concentrationScore = 1.0;  // Sweet spot
    } else {
        concentrationScore = Math.max(0.3, 1.0 - (hhi - 0.5) * 1.4);  // Penalize extremes
    }
    const concentrationModifier = toModifier(concentrationScore, MODIFIER_RANGES.concentration);

    // 6. Alignment - are top traders agreeing?
    const weightedData = input.weightedTraderData;
    const buyWeighted = weightedData?.buyWeighted ?? buyCount;
    const sellWeighted = weightedData?.sellWeighted ?? sellCount;
    const totalWeighted = weightedData?.totalWeighted ?? totalTopTraders;
    const dominantWeighted = Math.max(buyWeighted, sellWeighted);

    // SLOWER log scaling: need ~15 weighted traders to approach max (was 10)
    // log2(x+1)/log2(15): 0→0, 1→0.26, 2→0.41, 4→0.60, 8→0.82, 15→1.0
    const engagementScore = clamp(Math.log2(totalWeighted + 1) / Math.log2(15));

    // Alignment ratio: how dominant is the majority side?
    const alignmentRatio = totalWeighted > 0 ? dominantWeighted / totalWeighted : 0;

    // Cluster boost with slower log scaling
    const clusterBoost = clamp(Math.log2(dominantWeighted + 1) / Math.log2(8));

    // Volume-based alignment
    const { buyVolume: topTraderBuyVol, sellVolume: topTraderSellVol, totalVolume: topTraderTotalVol } = topTraderVolume;
    const dominantTopTraderVol = Math.max(topTraderBuyVol, topTraderSellVol);
    const topTraderVolDominance = topTraderTotalVol > 0 ? dominantTopTraderVol / topTraderTotalVol : 0;
    const topTraderMarketShare = totalVolume > 0 ? topTraderTotalVol / totalVolume : 0;

    // Combine all alignment factors
    const alignmentScore = clamp(
        0.25 * engagementScore +        // How many whales
        0.25 * alignmentRatio +         // How aligned by count
        0.25 * clusterBoost +           // Cluster of aligned whales
        0.25 * topTraderVolDominance    // Volume alignment
    );
    const alignmentModifier = toModifier(alignmentScore, MODIFIER_RANGES.alignment);

    // ═══════════════════════════════════════════════════════════════════════════
    // FINAL COMPOSITE SCORE
    // ═══════════════════════════════════════════════════════════════════════════

    // Multiply all modifiers together
    const modifierProduct = recencyModifier * directionModifier * concentrationModifier * alignmentModifier;

    // Final raw confidence: base × modifiers
    const rawConfidence = clamp(baseScore * modifierProduct);

    // Classify signal quality
    const signalQuality = classifySignalQuality(rawConfidence);

    // Calculate factor contributions for explainability (legacy format)
    // These are now informational rather than additive
    const signalFactors: SignalFactors = {
        volumeContribution: volumeScore * BASE_WEIGHTS.volume,
        rankContribution: rankNormalized * BASE_WEIGHTS.rank,
        concentrationContribution: concentrationScore * 0.1,  // Scaled for display
        recencyContribution: recencyScore * 0.1,
        directionContribution: effectiveDirStrength * 0.1,
        alignmentContribution: alignmentScore * 0.2,
    };

    return {
        volumeZScore: volumeZ,
        hhiConcentration: hhi,
        rankWeightedScore: rankWeighted,
        timeDecayedVolume: timeDecayedTop20Volume,
        directionConviction: conviction,
        rawConfidence,
        signalFactors,
        signalQuality,
        modifierProduct,
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
