"use client";

import { TEAMS, League, TeamMeta } from './teamMeta';

/**
 * League-specific keywords for additional detection
 */
export const LEAGUE_KEYWORDS: Record<League, string[]> = {
    NFL: ['nfl', 'super bowl', 'nfc', 'afc', 'touchdown', 'quarterback'],
    NBA: ['nba', 'basketball', 'three-pointer', 'dunk'],
    MLB: ['mlb', 'baseball', 'world series', 'home run', 'innings'],
    NHL: ['nhl', 'hockey', 'stanley cup', 'puck', 'goalie'],
    MLS: ['mls', 'mls cup', 'major league soccer'],
    UEFA: ['uefa', 'champions league', 'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1'],
};

/**
 * Get all teams for a specific league
 */
export function getTeamsForLeague(league: League): TeamMeta[] {
    return TEAMS.filter(team => team.league === league);
}

/**
 * Build a set of all searchable terms (names + aliases) for a league
 */
function buildLeagueTerms(league: League): Set<string> {
    const terms = new Set<string>();
    const teams = getTeamsForLeague(league);

    for (const team of teams) {
        terms.add(team.name.toLowerCase());
        for (const alias of team.aliases) {
            terms.add(alias.toLowerCase());
        }
    }

    // Add league keywords
    for (const keyword of LEAGUE_KEYWORDS[league]) {
        terms.add(keyword.toLowerCase());
    }

    return terms;
}

// Pre-build term sets for performance
const LEAGUE_TERM_CACHE: Partial<Record<League, Set<string>>> = {};

function getLeagueTerms(league: League): Set<string> {
    if (!LEAGUE_TERM_CACHE[league]) {
        LEAGUE_TERM_CACHE[league] = buildLeagueTerms(league);
    }
    return LEAGUE_TERM_CACHE[league]!;
}

const LEAGUE_EXCLUSIONS: Partial<Record<League, string[]>> = {
    NFL: [
        'louisville cardinals', 'stanford cardinals', // NCAA
        'st. louis cardinals', 'saint louis cardinals', // MLB
        'san francisco giants', 'yomiuri giants', // MLB / NPB
        'florida panthers', // NHL
        'winnipeg jets', // NHL
    ],
    MLB: [
        'arizona cardinals', // NFL
        'louisville cardinals', // NCAA
        'new york giants', // NFL
        'new york jets', // NFL
        'winnipeg jets', // NHL
        'carolina panthers', // NFL
        'florida panthers', // NHL
    ],
    NBA: [
        'los angeles kings', // NHL
    ],
    NHL: [
        'sacramento kings', // NBA
        'new york giants', // NFL
        'san francisco giants', // MLB
        'carolina panthers', // NFL
        'new york jets', // NFL
    ]
};

/**
 * Calculate a match score for a league against text
 * Higher score = better match
 * Scoring:
 * - Team match: 10 points
 * - Keyword match: 2 points
 */
function calculateLeagueMatchScore(text: string, league: League): number {
    let score = 0;
    let normalizedText = text.toLowerCase();

    // 1. Remove exclusions
    const exclusions = LEAGUE_EXCLUSIONS[league] || [];
    for (const exclusion of exclusions) {
        if (normalizedText.includes(exclusion)) {
            normalizedText = normalizedText.replace(new RegExp(escapeRegExp(exclusion), 'g'), '');
        }
    }

    // 2. Count unique team matches
    const teams = getTeamsForLeague(league);
    for (const team of teams) {
        const identifiers = [team.name, ...team.aliases];
        // Check if any identifier matches (word boundary)
        const found = identifiers.some(id => {
            return new RegExp(`\\b${escapeRegExp(id.toLowerCase())}\\b`, 'i').test(normalizedText);
        });

        if (found) {
            score += 10;
        }
    }

    // 3. Count keyword matches
    const keywords = LEAGUE_KEYWORDS[league] || [];
    for (const keyword of keywords) {
        if (new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`, 'i').test(normalizedText)) {
            score += 2;
        }
    }

    return score;
}

/**
 * Check if text contains any team from a specific league
 */
export function textMatchesLeague(text: string, league: League): boolean {
    return calculateLeagueMatchScore(text, league) > 0;
}

/**
 * Detect which league a text belongs to based on team names/aliases
 * Returns the league with the highest match score
 */
export function detectLeagueFromText(text: string): League | undefined {
    if (!text) return undefined;

    const leagues: League[] = ['NFL', 'NBA', 'MLB', 'NHL', 'MLS', 'UEFA'];
    let bestLeague: League | undefined;
    let bestScore = 0;

    for (const league of leagues) {
        const score = calculateLeagueMatchScore(text, league);
        if (score > bestScore) {
            bestScore = score;
            bestLeague = league;
        }
    }

    return bestLeague;
}

/**
 * Check if an anomaly matches a specific league
 */
export function anomalyMatchesLeague(
    anomaly: {
        event: string;
        sport?: string | null;
        league?: string | null;
        outcome?: string;
        analysis?: {
            market_context?: {
                sport?: string | null;
                league?: string | null;
            };
            event?: {
                title?: string;
            };
        } | null;
    },
    league: League
): boolean {
    // Check explicit league field first
    const explicitLeague = anomaly.league || anomaly.analysis?.market_context?.league;
    if (explicitLeague) {
        return explicitLeague.toUpperCase() === league;
    }

    // Check sport field for league hints
    const sport = anomaly.sport || anomaly.analysis?.market_context?.sport;
    if (sport) {
        const normalizedSport = sport.toLowerCase();
        const leagueKeywords = LEAGUE_KEYWORDS[league];
        if (leagueKeywords.some(kw => normalizedSport.includes(kw))) {
            return true;
        }
    }

    // Fall back to text matching with competitive scoring
    const searchableText = [
        anomaly.event,
        anomaly.outcome,
        anomaly.analysis?.event?.title,
    ].filter(Boolean).join(' ');

    const score = calculateLeagueMatchScore(searchableText, league);
    if (score === 0) return false;

    // Check if this league is competitive with other leagues
    const leagues: League[] = ['NFL', 'NBA', 'MLB', 'NHL', 'MLS', 'UEFA'];
    let maxScore = 0;

    for (const l of leagues) {
        const s = calculateLeagueMatchScore(searchableText, l);
        if (s > maxScore) maxScore = s;
    }

    // If current league score is less than the max score found across all leagues,
    // it's likely a misclassification
    if (score < maxScore) {
        return false;
    }

    return true;
}

/**
 * Filter anomalies by league
 */
export function filterByLeague<T extends {
    event: string;
    sport?: string | null;
    league?: string | null;
    outcome?: string;
    analysis?: {
        market_context?: {
            sport?: string | null;
            league?: string | null;
        };
        event?: {
            title?: string;
        };
    } | null;
}>(items: T[], league: League): T[] {
    return items.filter(item => anomalyMatchesLeague(item, league));
}

// Helper to escape regex special chars
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
