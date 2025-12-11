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
 * Rebalanced to reduce alignment dominance and prioritize rank quality
 * Total: 1.0 (100%)
 */
const FACTOR_WEIGHTS = {
    volume: 0.15,        // Z-score based unusual volume (was 0.14)
    rank: 0.28,          // Quality of whales involved - INCREASED (was 0.20)
    concentration: 0.12, // HHI - conviction from consensus (was 0.10)
    recency: 0.12,       // Time-decayed volume freshness (unchanged)
    direction: 0.08,     // Buy/sell pressure clarity (was 0.09)
    alignment: 0.25,     // Reduced from 0.35 - with tier weighting, need less raw alignment weight
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

    // Tier-weighted trader data (new)
    weightedTraderData?: {
        buyWeighted: number;
        sellWeighted: number;
        totalWeighted: number;
        tierBreakdown: TierBreakdown;
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

    // 6. Alignment of unique top traders on a single side (with tier weighting)
    const { totalTopTraders, buyCount, sellCount } = topTraderAlignment;
    const { buyVolume: topTraderBuyVol, sellVolume: topTraderSellVol, totalVolume: topTraderTotalVol } = topTraderVolume;
    
    // Use weighted counts if available, otherwise fall back to raw counts
    const weightedData = input.weightedTraderData;
    const buyWeighted = weightedData?.buyWeighted ?? buyCount;
    const sellWeighted = weightedData?.sellWeighted ?? sellCount;
    const totalWeighted = weightedData?.totalWeighted ?? totalTopTraders;
    
    const dominantWeighted = Math.max(buyWeighted, sellWeighted);
    
    // LOGARITHMIC SCALING: Replaces linear caps for diminishing returns
    // log2(x+1)/log2(10) gives: 0->0, 1->0.3, 2->0.48, 4->0.7, 8->0.95, 10->1.0
    // This means you need ~8 "weighted" traders to approach max engagement
    // With tier weights: 8 elite = 8, but 80 bronze = 8 weighted
    const engagementScore = clamp(Math.log2(totalWeighted + 1) / Math.log2(10));
    
    // Alignment ratio: how dominant is the majority side?
    const alignmentRatio = totalWeighted > 0 ? dominantWeighted / totalWeighted : 0;
    
    // Cluster boost with log scaling: need 2+ weighted traders for meaningful boost
    // log2(2+1)/log2(5) = 0.68, log2(4+1)/log2(5) = 1.0 (caps at ~4 weighted)
    const clusterBoost = clamp(Math.log2(dominantWeighted + 1) / Math.log2(5));
    
    // Combined count-based alignment (reduced weight since we're using quality metrics)
    const alignmentScoreCounts = clamp(0.4 * alignmentRatio + 0.6 * clusterBoost);
    
    // Volume-based alignment (unchanged logic)
    const dominantTopTraderVol = Math.max(topTraderBuyVol, topTraderSellVol);
    const topTraderVolDominance = topTraderTotalVol > 0 ? dominantTopTraderVol / topTraderTotalVol : 0;
    const topTraderMarketShare = totalVolume > 0 ? topTraderTotalVol / totalVolume : 0;
    const volumeAlignmentScore = clamp(
        0.65 * topTraderVolDominance +
        0.35 * clamp(topTraderMarketShare * 1.5)
    );
    
    // Final alignment: balance between count quality and volume dominance
    const alignmentScore = clamp(0.5 * alignmentScoreCounts + 0.5 * volumeAlignmentScore);

    // Calculate factor contributions
    // Engagement is now integrated via log scaling, no separate additive bonus needed
    const signalFactors: SignalFactors = {
        volumeContribution: volumeScore * FACTOR_WEIGHTS.volume,
        rankContribution: rankNormalized * FACTOR_WEIGHTS.rank,
        concentrationContribution: concentrationScore * FACTOR_WEIGHTS.concentration,
        recencyContribution: recencyScore * FACTOR_WEIGHTS.recency,
        directionContribution: dirStrength * FACTOR_WEIGHTS.direction,
        alignmentContribution: alignmentScore * FACTOR_WEIGHTS.alignment,
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
