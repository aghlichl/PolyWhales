import assert from 'node:assert';
import { describe, it } from 'node:test';

import { resolveTeamFromMarket } from '../lib/teamResolver';
import { League } from '../lib/teamMeta';
import { useScoreStore } from '../lib/useScoreStore';

describe('Team Resolver - league safety', () => {
    it('returns null for ambiguous cross-league matchup (Panthers vs Utah)', () => {
        const result = resolveTeamFromMarket({
            marketTitle: 'Panthers vs Utah',
            question: 'Panthers vs Utah',
            outcomeLabel: 'Panthers',
        });

        assert.strictEqual(result, null);
    });

    it('picks same-league team when both sides resolve (Panthers vs Rangers, NHL)', () => {
        const result = resolveTeamFromMarket({
            leagueHint: 'NHL',
            marketTitle: 'Panthers vs Rangers',
            question: 'Panthers vs Rangers',
            outcomeLabel: 'Panthers',
        });

        assert.ok(result, 'Expected a resolved team');
        assert.strictEqual(result?.league, 'NHL');
        assert.match(result?.name || '', /Panthers/i);
    });

    it('prefers same-league pairing when both teams are NBA', () => {
        const result = resolveTeamFromMarket({
            marketTitle: 'Lakers vs Warriors',
            question: 'Lakers vs Warriors',
            outcomeLabel: 'Lakers',
        });

        assert.ok(result, 'Expected a resolved team');
        assert.strictEqual(result?.league, 'NBA');
        assert.strictEqual(result?.slug, 'lal');
    });
});

describe('Live score lookup respects league filters', () => {
    it('finds correct game for team within requested league only', () => {
        // Seed store with two games sharing a nickname
        useScoreStore.setState({
            scores: {
                nhl1: {
                    gameId: 'nhl1',
                    league: 'NHL',
                    status: 'in_progress',
                    period: 1,
                    clock: '10:00',
                    homeTeam: 'Florida Panthers',
                    homeTeamShort: 'Panthers',
                    homeTeamAbbr: 'FLA',
                    homeTeamName: 'Panthers',
                    awayTeam: 'Rangers',
                    awayTeamShort: 'Rangers',
                    awayTeamAbbr: 'NYR',
                    awayTeamName: 'Rangers',
                    homeScore: 1,
                    awayScore: 0,
                    homeScoreTrend: 'SAME',
                    awayScoreTrend: 'SAME',
                    lastUpdated: Date.now(),
                },
                nfl1: {
                    gameId: 'nfl1',
                    league: 'NFL',
                    status: 'in_progress',
                    period: 1,
                    clock: 'Q1 10:00',
                    homeTeam: 'Carolina Panthers',
                    homeTeamShort: 'Panthers',
                    homeTeamAbbr: 'CAR',
                    homeTeamName: 'Panthers',
                    awayTeam: 'Saints',
                    awayTeamShort: 'Saints',
                    awayTeamAbbr: 'NO',
                    awayTeamName: 'Saints',
                    homeScore: 7,
                    awayScore: 0,
                    homeScoreTrend: 'SAME',
                    awayScoreTrend: 'SAME',
                    lastUpdated: Date.now(),
                },
            },
        });

        const nhlGame = useScoreStore.getState().getGameForTeam('Panthers', 'NHL' as League);
        const nflGame = useScoreStore.getState().getGameForTeam('Panthers', 'NFL' as League);
        const none = useScoreStore.getState().getGameForTeam('Panthers', 'MLB' as League);

        assert.strictEqual(nhlGame?.league, 'NHL');
        assert.strictEqual(nflGame?.league, 'NFL');
        assert.strictEqual(none, undefined);
    });
});









