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

        // Strategy C: Partial match (outcomeLabel contains alias)
        // We sort aliases by length descending to match longest aliases first (e.g. "Los Angeles Lakers" before "Lakers")
        const partialMatch = candidateTeams.find((team) => {
            // Check name
            if (normalizedOutcome.includes(normalize(team.name))) return true;
            // Check aliases
            return team.aliases.some((alias) => normalizedOutcome.includes(normalize(alias)));
        });
        if (partialMatch) return toResolvedTeam(partialMatch);
    }

    // 3. Parse marketTitle / question if no match yet
    const textToSearch = (marketTitle || '') + ' ' + (question || '');
    if (textToSearch.trim()) {
        const normalizedText = normalize(textToSearch);

        // Simple tokenization by common separators
        // We don't strictly need to split if we just search for aliases in the string, 
        // but splitting helps avoid matching parts of words. 
        // For now, let's search for the aliases within the text.

        // Sort candidates by name length to prioritize specific matches? 
        // Or just iterate.

        const match = candidateTeams.find((team) => {
            if (normalizedText.includes(normalize(team.name))) return true;
            return team.aliases.some((alias) => normalizedText.includes(normalize(alias)));
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
