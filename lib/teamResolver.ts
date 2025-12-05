import { TEAMS, TeamMeta, League } from './teamMeta';
import { PolymarketMarket, MarketMeta } from './types';

export interface ResolvedTeam {
    league: League;
    slug: string;
    name: string;
    logoPath: string;
}

// Helper to normalize text for comparison
function normalize(text: string): string {
    return text.toLowerCase().trim();
}

// Helper to strip common soccer suffixes
function stripSoccerSuffixes(text: string): string {
    return text.replace(/\s+(fc|cf|c\.f\.|sc)$/i, '').trim();
}

// Helper to escape regex special characters
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to check if text contains the target word as a whole word
function matchesToken(text: string, token: string): boolean {
    // Normalize both to handle case
    const normalizedText = normalize(text);
    const normalizedToken = normalize(token);

    // Create regex with word boundaries
    // We use the normalized strings so we don't need 'i' flag if we already lowercased, 
    // but the regex itself needs to handle the characters. 
    // Actually, let's build the regex from the token and test against the text.
    // Use word boundaries \b. Note: \b only works correctly if the token starts/ends with word chars.
    // If the token is e.g. "A's", \b works.
    // If the token is "St. Louis", \b works.

    try {
        const pattern = new RegExp(`\\b${escapeRegExp(normalizedToken)}\\b`, 'i');
        return pattern.test(normalizedText);
    } catch (e) {
        // Fallback to simple includes if regex fails (unlikely)
        return normalizedText.includes(normalizedToken);
    }
}

export function resolveTeamFromMarket(params: {
    leagueHint?: League;
    marketTitle?: string;
    question?: string;
    outcomeLabel?: string;
}): ResolvedTeam | null {
    const { leagueHint, marketTitle, question, outcomeLabel } = params;

    // 1. Filter teams by league hint if provided
    const candidateTeams = leagueHint
        ? TEAMS.filter((t) => t.league === leagueHint)
        : TEAMS;

    // 2. Try to match outcomeLabel
    if (outcomeLabel) {
        const normalizedOutcome = normalize(outcomeLabel);

        // Strategy A: Exact match on name or aliases
        const exactMatch = candidateTeams.find((team) => {
            if (normalize(team.name) === normalizedOutcome) return true;
            return team.aliases.some((alias) => normalize(alias) === normalizedOutcome);
        });
        if (exactMatch) return toResolvedTeam(exactMatch);

        // Strategy B: Strip suffixes (for soccer) and try exact match
        const strippedOutcome = stripSoccerSuffixes(normalizedOutcome);
        if (strippedOutcome !== normalizedOutcome) {
            const suffixMatch = candidateTeams.find((team) => {
                if (normalize(team.name) === strippedOutcome) return true;
                return team.aliases.some((alias) => normalize(alias) === strippedOutcome);
            });
            if (suffixMatch) return toResolvedTeam(suffixMatch);
        }

        // Strategy C: Token match (contains alias as whole word)
        // e.g. outcomeLabel: "Texas Rangers" (matches alias "Rangers")
        // outcomeLabel: "North Texas" (does NOT match alias "Texas" if we strictly check word boundaries and "Texas" is removed from aliases).
        // BUT if "Texas" was an alias, "North Texas" contains "Texas". 
        // We want to avoid matching if it's part of another word, but "North Texas" has "Texas" as a separate word.
        // The issue was "Texas" matching "Texas Rangers". 
        // If we remove "Texas" alias, then "North Texas" won't match "Rangers" (alias "Rangers").
        // "North Texas" vs "Rangers" -> No match.
        // So simply removing the alias fixes the main issue.
        // But adding word boundaries is good practice: prevents "NotRangers" matching "Rangers" (unlikely) or "Rangersteam" matching "Rangers".

        const partialMatch = candidateTeams.find((team) => {
            // Check name
            if (matchesToken(normalizedOutcome, team.name)) return true;
            // Check aliases
            return team.aliases.some((alias) => matchesToken(normalizedOutcome, alias));
        });
        if (partialMatch) return toResolvedTeam(partialMatch);
    }

    // 3. Parse marketTitle / question if no match yet
    const textToSearch = (marketTitle || '') + ' ' + (question || '');
    if (textToSearch.trim()) {
        const normalizedText = normalize(textToSearch);

        const match = candidateTeams.find((team) => {
            if (matchesToken(normalizedText, team.name)) return true;
            return team.aliases.some((alias) => matchesToken(normalizedText, alias));
        });

        if (match) return toResolvedTeam(match);
    }

    return null;
}

function toResolvedTeam(meta: TeamMeta): ResolvedTeam {
    return {
        league: meta.league,
        slug: meta.slug,
        name: meta.name,
        logoPath: meta.logoPath,
    };
}

export function getLogoPathForTeam(team: ResolvedTeam | null, leagueFallback?: League): string {
    if (team) {
        return team.logoPath;
    }

    if (leagueFallback) {
        return `/logos/generic/${leagueFallback.toLowerCase()}.svg`;
    }

    return '/logos/generic/default.svg';
}

export function inferLeagueFromMarket(market: PolymarketMarket | MarketMeta): League | undefined {
    // 1. Check explicit tags or categories if available (MarketMeta doesn't have tags typed explicitly as string[], but Anomaly does in analysis.tags)
    // But here we accept PolymarketMarket or MarketMeta.

    // Let's look at the question or event title
    const text = ((market as any).question || (market as any).eventTitle || (market as any).title || '').toLowerCase();

    if (text.includes('nba') || text.includes('basketball')) return 'NBA';
    if (text.includes('nfl') || text.includes('football')) return 'NFL'; // 'football' is ambiguous (soccer), but in US context often NFL. 
    if (text.includes('mlb') || text.includes('baseball')) return 'MLB';
    if (text.includes('mls') || text.includes('soccer')) return 'MLS'; // 'soccer' could be UEFA too
    if (text.includes('uefa') || text.includes('champions league') || text.includes('premier league') || text.includes('la liga') || text.includes('bundesliga') || text.includes('serie a')) return 'UEFA';

    // 2. Check against known teams
    // If we find a team name in the text, assume that league
    for (const team of TEAMS) {
        if (text.includes(normalize(team.name))) return team.league;
        for (const alias of team.aliases) {
            if (text.includes(normalize(alias))) return team.league;
        }
    }

    return undefined;
}
