
import { parseMarketData } from '../lib/polymarket'; // Unused but consistent import style
import { normalizeEspnEvent, NormalizedGame } from '../lib/espn-normalizer';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('normalizeEspnEvent', () => {
    it('handles PRE game (scheduled)', () => {
        const mockPre = {
            id: "401547417",
            name: "Falcons @ Bucs",
            competitions: [{
                id: "401547417",
                date: "2025-10-22T17:00:00Z",
                status: { type: { state: "pre", completed: false } },
                competitors: [
                    { homeAway: "home", team: { abbreviation: "TB" }, score: "0" },
                    { homeAway: "away", team: { abbreviation: "ATL" }, score: "0" }
                ]
            }]
        };

        const norm = normalizeEspnEvent(mockPre);
        assert.ok(norm);
        assert.strictEqual(norm?.timing.state, "pre");
        assert.strictEqual(norm?.teams.home?.abbreviation, "TB");
        assert.strictEqual(norm?.score?.home, 0);
        assert.strictEqual(norm?.derived?.momentumText, undefined);
    });

    it('handles IN game (momentum + clock)', () => {
        const mockIn = {
            id: "in-prog",
            competitions: [{
                id: "c1",
                status: {
                    type: { state: "in" },
                    period: 4,
                    displayClock: "3:45"
                },
                competitors: [
                    {
                        homeAway: "home",
                        score: "100",
                        team: { abbreviation: "LAL" },
                        linescores: [
                            { period: 1, value: 25 }, { period: 2, value: 25 }, { period: 3, value: 25 }, { period: 4, value: 25 }
                        ]
                    },
                    {
                        homeAway: "away",
                        score: "110",
                        team: { abbreviation: "BOS" },
                        linescores: [
                            { period: 1, value: 30 }, { period: 2, value: 30 }, { period: 3, value: 20 }, { period: 4, value: 30 }
                        ]
                    }
                ]
            }]
        };

        const norm = normalizeEspnEvent(mockIn);
        assert.ok(norm);
        assert.strictEqual(norm?.timing.state, "in");
        assert.strictEqual(norm?.timing.displayClock, "3:45");
        assert.strictEqual(norm?.derived?.spreadAwayMinusHome, 10); // 110 - 100
        // Period 4: Away 30, Home 25 => +5 Away
        assert.strictEqual(norm?.derived?.lastPeriodDelta, 5);
        assert.ok(norm?.derived?.momentumText?.includes("BOS +5 in P4"));
    });

    it('handles POST game (final + comeback)', () => {
        const mockFinal = {
            id: "final-1",
            competitions: [{
                status: { type: { state: "post", completed: true } },
                competitors: [
                    {
                        homeAway: "home",
                        score: "105",
                        team: { abbreviation: "MIA" },
                        linescores: [{ value: 25 }, { value: 25 }, { value: 25 }, { value: 30 }] // 105 total
                    },
                    {
                        homeAway: "away",
                        score: "95",
                        team: { abbreviation: "NYK" },
                        linescores: [{ value: 30 }, { value: 30 }, { value: 20 }, { value: 15 }] // 95 total
                    }
                ]
            }]
        } as any;

        // Force comeback scenario:
        // Adjust P3 so Away is leading big entering P4
        // Home entering P4 (P1+P2+P3) = 25+25+25 = 75
        // We want Away to be leading by >= 10.
        // Away entering P4 needs to be >= 85.
        // Currently Away P1=30, P2=30. P3=20 -> Total 80. Diff is 5.
        // Increase Away P3 to 30 -> Total 90. Diff 15.
        mockFinal.competitions[0].competitors[1].linescores[2].value = 30; // index 2 is P3

        // Now final score validation
        // Home: 105 (no change)
        // Away: 30+30+30+15 = 105. That's a tie. Home needs to win.
        // Let's bump Home P4 to make them win cleanly.
        mockFinal.competitions[0].competitors[0].linescores[3].value = 40; // P4=40
        // Home Total: 25+25+25+40 = 115.
        // Away Total: 30+30+30+15 = 105.
        // Home Wins.

        // Re-set the cached strings in mock? No, code re-reads values.
        mockFinal.competitions[0].competitors[0].score = "115";
        mockFinal.competitions[0].competitors[1].score = "105";

        const norm = normalizeEspnEvent(mockFinal);

        assert.ok(norm);
        assert.strictEqual(norm?.derived?.comeback?.occurred, true);
        assert.strictEqual(norm?.derived?.comeback?.threshold, 10);
    });

    it('handles missing data gracefully', () => {
        const empty = { id: "empty" };
        assert.strictEqual(normalizeEspnEvent(empty), null);

        const partial = {
            id: "p1",
            competitions: [{ id: "c1" }] // No competitors
        };
        const norm = normalizeEspnEvent(partial);
        assert.strictEqual(norm?.ids.eventId, "p1");
        assert.strictEqual(norm?.score?.home, undefined);
        assert.deepStrictEqual(norm?.competitors, []);
    });
});
