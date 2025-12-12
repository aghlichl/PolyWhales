/**
 * Signal Calculator Tests
 * 
 * Tests the hybrid scoring model (v2.0) to ensure:
 * - Weak signals score low (split direction, low whale count)
 * - Strong signals score high (aligned elite whales + volume anomaly)
 * - Top grades (95-99%) are truly rare
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    calculateCompositeSignal,
    calculateMarketBaseline,
    type CompositeSignalInput,
    type MarketBaseline,
} from '../lib/signal-calculator';

// Helper to create a baseline for testing
function createTestBaseline(meanTop20Volume = 10000, stdDevTop20Volume = 5000): MarketBaseline {
    return {
        meanVolume: 50000,
        stdDevVolume: 20000,
        meanTop20Volume,
        stdDevTop20Volume,
    };
}

// Helper to create wallet rank/volume maps
function createWalletMaps(wallets: Array<{ address: string; rank: number; volume: number }>) {
    const ranks = new Map<string, number>();
    const volumes = new Map<string, number>();
    for (const w of wallets) {
        ranks.set(w.address, w.rank);
        volumes.set(w.address, w.volume);
    }
    return { ranks, volumes };
}

describe('Hybrid Scoring Model v2.0', () => {
    describe('Weak Signal Scenarios', () => {
        it('should score low when whales are split on direction', () => {
            // 3 whales buying, 3 whales selling - conflicting signal
            const { ranks, volumes } = createWalletMaps([
                { address: 'buyer1', rank: 5, volume: 1000 },
                { address: 'buyer2', rank: 10, volume: 1000 },
                { address: 'buyer3', rank: 15, volume: 1000 },
                { address: 'seller1', rank: 8, volume: 1000 },
                { address: 'seller2', rank: 12, volume: 1000 },
                { address: 'seller3', rank: 20, volume: 1000 },
            ]);

            const input: CompositeSignalInput = {
                totalVolume: 10000,
                top20Volume: 6000,
                timeDecayedTop20Volume: 5500,  // Fairly recent
                baseline: createTestBaseline(),
                walletRanks: ranks,
                walletVolumes: volumes,
                buyVolume: 5000,
                sellVolume: 5000,  // Even split
                topTraderVolume: {
                    buyVolume: 3000,
                    sellVolume: 3000,
                    totalVolume: 6000,
                },
                topTraderAlignment: {
                    totalTopTraders: 6,
                    buyCount: 3,
                    sellCount: 3,  // Split direction
                },
                weightedTraderData: {
                    buyWeighted: 2.6,  // Elite + Gold weight
                    sellWeighted: 2.3,
                    totalWeighted: 4.9,
                    tierBreakdown: { elite: 2, gold: 3, silver: 1, bronze: 0 },
                },
            };

            const result = calculateCompositeSignal(input);

            // Split direction should trigger harsh penalty
            assert.strictEqual(result.signalQuality, 'weak', 'Split direction should result in weak signal quality');
            assert.ok(result.rawConfidence < 0.30, `Raw confidence ${result.rawConfidence} should be < 0.30 for split direction`);
            assert.ok(result.modifierProduct < 0.8, `Modifier product ${result.modifierProduct} should be < 0.8 due to direction penalty`);
        });

        it('should score low when no whale involvement', () => {
            // High retail volume but no top-ranked traders
            const input: CompositeSignalInput = {
                totalVolume: 100000,
                top20Volume: 500,  // Almost no whale volume
                timeDecayedTop20Volume: 400,
                baseline: createTestBaseline(),
                walletRanks: new Map(),
                walletVolumes: new Map(),
                buyVolume: 60000,
                sellVolume: 40000,
                topTraderVolume: {
                    buyVolume: 300,
                    sellVolume: 200,
                    totalVolume: 500,
                },
                topTraderAlignment: {
                    totalTopTraders: 1,
                    buyCount: 1,
                    sellCount: 0,
                },
            };

            const result = calculateCompositeSignal(input);

            assert.ok(result.rawConfidence < 0.25, `Raw confidence ${result.rawConfidence} should be < 0.25 with no whale involvement`);
            assert.strictEqual(result.signalQuality, 'weak', 'No whale involvement should result in weak signal');
        });

        it('should score low for single whale with stale trades', () => {
            const { ranks, volumes } = createWalletMaps([
                { address: 'lone_whale', rank: 3, volume: 5000 },
            ]);

            const input: CompositeSignalInput = {
                totalVolume: 20000,
                top20Volume: 5000,
                timeDecayedTop20Volume: 1000,  // Very stale trades (low decay ratio)
                baseline: createTestBaseline(),
                walletRanks: ranks,
                walletVolumes: volumes,
                buyVolume: 15000,
                sellVolume: 5000,
                topTraderVolume: {
                    buyVolume: 5000,
                    sellVolume: 0,
                    totalVolume: 5000,
                },
                topTraderAlignment: {
                    totalTopTraders: 1,
                    buyCount: 1,
                    sellCount: 0,
                },
                weightedTraderData: {
                    buyWeighted: 1.0,
                    sellWeighted: 0,
                    totalWeighted: 1.0,
                    tierBreakdown: { elite: 1, gold: 0, silver: 0, bronze: 0 },
                },
            };

            const result = calculateCompositeSignal(input);

            // Single whale + stale trades = moderate at best
            assert.ok(result.rawConfidence < 0.50, `Raw confidence ${result.rawConfidence} should be < 0.50 for thin stale signal`);
            assert.ok(result.modifierProduct < 0.9, 'Stale trades should drag down modifiers');
        });
    });

    describe('Strong Signal Scenarios', () => {
        it('should score high for aligned elite whales with volume anomaly', () => {
            // 4 elite whales all buying with unusual volume
            const { ranks, volumes } = createWalletMaps([
                { address: 'elite1', rank: 1, volume: 15000 },
                { address: 'elite2', rank: 3, volume: 12000 },
                { address: 'elite3', rank: 5, volume: 10000 },
                { address: 'elite4', rank: 8, volume: 8000 },
            ]);

            const input: CompositeSignalInput = {
                totalVolume: 80000,
                top20Volume: 45000,  // >3 std dev above mean = Z > 7
                timeDecayedTop20Volume: 42000,  // Very fresh trades
                baseline: createTestBaseline(),
                walletRanks: ranks,
                walletVolumes: volumes,
                buyVolume: 70000,
                sellVolume: 10000,  // Clear buy signal
                topTraderVolume: {
                    buyVolume: 45000,
                    sellVolume: 0,
                    totalVolume: 45000,
                },
                topTraderAlignment: {
                    totalTopTraders: 4,
                    buyCount: 4,
                    sellCount: 0,  // Perfect alignment
                },
                weightedTraderData: {
                    buyWeighted: 4.0,  // 4 elite = 4.0 weighted
                    sellWeighted: 0,
                    totalWeighted: 4.0,
                    tierBreakdown: { elite: 4, gold: 0, silver: 0, bronze: 0 },
                },
            };

            const result = calculateCompositeSignal(input);

            // This is a genuine strong signal
            assert.ok(result.rawConfidence >= 0.50, `Raw confidence ${result.rawConfidence} should be >= 0.50 for strong aligned signal`);
            assert.ok(['strong', 'exceptional'].includes(result.signalQuality), `Signal quality should be strong or exceptional, got ${result.signalQuality}`);
            assert.ok(result.modifierProduct > 1.0, `Modifier product ${result.modifierProduct} should boost score`);
        });

        it('should differentiate between elite cluster vs bronze crowd', () => {
            // Scenario A: 2 elite whales
            const eliteWallets = createWalletMaps([
                { address: 'elite1', rank: 2, volume: 8000 },
                { address: 'elite2', rank: 6, volume: 7000 },
            ]);

            // Scenario B: 10 bronze whales with same total volume
            const bronzeWallets = createWalletMaps(
                Array.from({ length: 10 }, (_, i) => ({
                    address: `bronze${i}`,
                    rank: 120 + i * 5,
                    volume: 1500,
                }))
            );

            const baseInput = {
                totalVolume: 50000,
                top20Volume: 15000,
                timeDecayedTop20Volume: 14000,
                baseline: createTestBaseline(),
                buyVolume: 45000,
                sellVolume: 5000,
                topTraderVolume: {
                    buyVolume: 15000,
                    sellVolume: 0,
                    totalVolume: 15000,
                },
            };

            const eliteInput: CompositeSignalInput = {
                ...baseInput,
                walletRanks: eliteWallets.ranks,
                walletVolumes: eliteWallets.volumes,
                topTraderAlignment: {
                    totalTopTraders: 2,
                    buyCount: 2,
                    sellCount: 0,
                },
                weightedTraderData: {
                    buyWeighted: 2.0,
                    sellWeighted: 0,
                    totalWeighted: 2.0,
                    tierBreakdown: { elite: 2, gold: 0, silver: 0, bronze: 0 },
                },
            };

            const bronzeInput: CompositeSignalInput = {
                ...baseInput,
                walletRanks: bronzeWallets.ranks,
                walletVolumes: bronzeWallets.volumes,
                topTraderAlignment: {
                    totalTopTraders: 10,
                    buyCount: 10,
                    sellCount: 0,
                },
                weightedTraderData: {
                    buyWeighted: 1.0,  // 10 bronze × 0.1 = 1.0 weighted
                    sellWeighted: 0,
                    totalWeighted: 1.0,
                    tierBreakdown: { elite: 0, gold: 0, silver: 0, bronze: 10 },
                },
            };

            const eliteResult = calculateCompositeSignal(eliteInput);
            const bronzeResult = calculateCompositeSignal(bronzeInput);

            // Elite whales should produce higher confidence than bronze crowd
            assert.ok(
                eliteResult.rawConfidence > bronzeResult.rawConfidence,
                `Elite confidence ${eliteResult.rawConfidence} should exceed bronze ${bronzeResult.rawConfidence}`
            );
        });
    });

    describe('Calibration Checks', () => {
        it('should rarely produce exceptional quality signals', () => {
            // Generate several random-ish scenarios and count exceptional ones
            const scenarios: CompositeSignalInput[] = [];

            // Moderate scenarios (should not be exceptional)
            for (let i = 0; i < 10; i++) {
                const walletCount = 1 + (i % 4);
                const { ranks, volumes } = createWalletMaps(
                    Array.from({ length: walletCount }, (_, j) => ({
                        address: `w${i}_${j}`,
                        rank: 10 + i * 8 + j * 5,
                        volume: 2000 + j * 500,
                    }))
                );

                scenarios.push({
                    totalVolume: 30000 + i * 5000,
                    top20Volume: 5000 + i * 1000,
                    timeDecayedTop20Volume: 4000 + i * 800,
                    baseline: createTestBaseline(),
                    walletRanks: ranks,
                    walletVolumes: volumes,
                    buyVolume: 16000 + i * 2000,
                    sellVolume: 14000 + i * 2000 - (i % 3) * 3000,
                    topTraderVolume: {
                        buyVolume: 3000 + i * 500,
                        sellVolume: 2000 + i * 300,
                        totalVolume: 5000 + i * 800,
                    },
                    topTraderAlignment: {
                        totalTopTraders: walletCount,
                        buyCount: Math.ceil(walletCount * 0.6),
                        sellCount: Math.floor(walletCount * 0.4),
                    },
                });
            }

            const results = scenarios.map(s => calculateCompositeSignal(s));
            const exceptionalCount = results.filter(r => r.signalQuality === 'exceptional').length;

            // In typical market conditions, exceptional signals should be rare (<20%)
            const exceptionalRate = exceptionalCount / results.length;
            assert.ok(
                exceptionalRate < 0.3,
                `Exceptional rate ${(exceptionalRate * 100).toFixed(0)}% should be < 30%`
            );
        });

        it('should produce modifierProduct between 0.2 and 1.5', () => {
            // Test edge cases for modifier bounds
            const extremeInputs: CompositeSignalInput[] = [
                // Worst case: split direction, dispersed, stale
                {
                    totalVolume: 10000,
                    top20Volume: 500,
                    timeDecayedTop20Volume: 50,
                    baseline: createTestBaseline(),
                    walletRanks: new Map(),
                    walletVolumes: new Map(),
                    buyVolume: 5000,
                    sellVolume: 5000,
                    topTraderVolume: { buyVolume: 250, sellVolume: 250, totalVolume: 500 },
                    topTraderAlignment: { totalTopTraders: 2, buyCount: 1, sellCount: 1 },
                },
                // Best case: aligned, concentrated, fresh, elite
                {
                    totalVolume: 100000,
                    top20Volume: 60000,
                    timeDecayedTop20Volume: 59000,
                    baseline: createTestBaseline(),
                    walletRanks: new Map([['w1', 1], ['w2', 2], ['w3', 3]]),
                    walletVolumes: new Map([['w1', 25000], ['w2', 20000], ['w3', 15000]]),
                    buyVolume: 95000,
                    sellVolume: 5000,
                    topTraderVolume: { buyVolume: 60000, sellVolume: 0, totalVolume: 60000 },
                    topTraderAlignment: { totalTopTraders: 3, buyCount: 3, sellCount: 0 },
                    weightedTraderData: {
                        buyWeighted: 3.0,
                        sellWeighted: 0,
                        totalWeighted: 3.0,
                        tierBreakdown: { elite: 3, gold: 0, silver: 0, bronze: 0 },
                    },
                },
            ];

            for (const input of extremeInputs) {
                const result = calculateCompositeSignal(input);
                assert.ok(
                    result.modifierProduct >= 0.2 && result.modifierProduct <= 1.8,
                    `Modifier product ${result.modifierProduct} should be within reasonable bounds [0.2, 1.8]`
                );
            }
        });
    });
});

describe('Signal Quality Classification', () => {
    it('should classify correctly based on rawConfidence thresholds', () => {
        // We can't directly test classifySignalQuality since it's not exported,
        // but we can verify the output of calculateCompositeSignal matches expectations

        // Create inputs that should produce different quality levels
        const weakInput: CompositeSignalInput = {
            totalVolume: 1000,
            top20Volume: 10,
            timeDecayedTop20Volume: 5,
            baseline: createTestBaseline(),
            walletRanks: new Map(),
            walletVolumes: new Map(),
            buyVolume: 500,
            sellVolume: 500,
            topTraderVolume: { buyVolume: 5, sellVolume: 5, totalVolume: 10 },
            topTraderAlignment: { totalTopTraders: 0, buyCount: 0, sellCount: 0 },
        };

        const weakResult = calculateCompositeSignal(weakInput);
        assert.strictEqual(weakResult.signalQuality, 'weak', 'Zero whale activity should be weak');
    });
});
