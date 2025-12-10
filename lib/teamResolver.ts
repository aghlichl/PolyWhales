import { TEAMS, TeamMeta, League } from './teamMeta';
import { PolymarketMarket, MarketMeta } from './types';

export interface ResolvedTeam {
    league: League;
    slug: string;
    name: string;
    logoPath: string;
    aliases: string[];
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

// Extract potential matchup teams from a question/title like "Panthers vs Utah"
function extractMatchupTeams(text: string): string[] | null {
    if (!text) return null;
    // Normalize separators to " vs "
    const normalized = text
        .replace(/@/g, ' vs ')
        .replace(/\svs\.?\s/gi, ' vs ')
        .replace(/\sv\.?\s/gi, ' vs ')
        .replace(/\s-\s/gi, ' vs ')
        .replace(/\s•\s/gi, ' vs ');

    const parts = normalized.split(/vs/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) return parts;
    return null;
}

function resolveTeamByText(raw: string, leagueHint?: League): ResolvedTeam | null {
    const normalizedOutcome = normalize(raw);
    const candidateTeams = leagueHint
        ? TEAMS.filter((t) => t.league === leagueHint)
        : TEAMS;

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
    const partialMatch = candidateTeams.find((team) => {
        if (matchesToken(normalizedOutcome, team.name)) return true;
        return team.aliases.some((alias) => matchesToken(normalizedOutcome, alias));
    });
    if (partialMatch) return toResolvedTeam(partialMatch);

    return null;
}

function pickTeamByOutcome(
    outcomeLabel: string | undefined,
    candidates: ResolvedTeam[],
    leagueHint?: League
): ResolvedTeam | null {
    if (!candidates.length) return null;

    if (leagueHint) {
        const leagueFiltered = candidates.filter((c) => c.league === leagueHint);
        if (leagueFiltered.length === 1) return leagueFiltered[0];
        if (leagueFiltered.length > 1) {
            candidates = leagueFiltered;
        }
    }

    if (outcomeLabel) {
        const normalizedOutcome = normalize(outcomeLabel);
        const exact = candidates.find((team) =>
            normalize(team.name) === normalizedOutcome ||
            team.aliases.some((alias) => normalize(alias) === normalizedOutcome)
        );
        if (exact) return exact;

        const token = candidates.find((team) =>
            matchesToken(normalizedOutcome, team.name) ||
            team.aliases.some((alias) => matchesToken(normalizedOutcome, alias))
        );
        if (token) return token;
    }

    // If all candidates share a league, return the first; otherwise we bail to avoid cross-league mistakes.
    const uniqueLeagues = new Set(candidates.map((c) => c.league));
    if (uniqueLeagues.size === 1) {
        return candidates[0];
    }

    return null;
}

export function resolveTeamFromMarket(params: {
    leagueHint?: League;
    marketTitle?: string;
    question?: string;
    outcomeLabel?: string;
}): ResolvedTeam | null {
    const { leagueHint, marketTitle, question, outcomeLabel } = params;

    const combinedText = (() => {
        if (marketTitle && question && marketTitle !== question) return `${marketTitle} ${question}`.trim();
        return (marketTitle || question || '').trim();
    })();
    const matchupParts = extractMatchupTeams(combinedText);
    const inferredLeague = leagueHint || inferLeagueFromMarket({ question: combinedText } as MarketMeta);
    let matchupAmbiguous = false;

    // If we can parse a matchup, require both sides to land in the same league.
    if (matchupParts && matchupParts.length === 2) {
        const [home, away] = matchupParts;
        const homeTeam = resolveTeamByText(home, inferredLeague);
        const awayTeam = resolveTeamByText(away, inferredLeague);

        if (homeTeam && awayTeam) {
            if (homeTeam.league === awayTeam.league) {
                const candidate = pickTeamByOutcome(outcomeLabel, [homeTeam, awayTeam], inferredLeague);
                if (candidate) return candidate;
                // Fall back to home if same league and still ambiguous
                return homeTeam;
            }
            // Cross-league matchup detected; avoid returning the wrong logo.
            return null;
        }

        // If we couldn't cleanly resolve both sides of a matchup, treat it as ambiguous to avoid picking the wrong league.
        matchupAmbiguous = true;
    }

    if (matchupAmbiguous) return null;

    // Fall back to outcome-first resolution (legacy path) but with league filtering and safer ambiguity handling.
    const candidate = outcomeLabel ? resolveTeamByText(outcomeLabel, inferredLeague) : null;
    if (candidate) return candidate;

    // As a last resort, search the text of the market/question.
    if (combinedText) {
        const tokens = TEAMS
            .filter((t) => !inferredLeague || t.league === inferredLeague)
            .filter((team) => {
                const normalizedText = normalize(combinedText);
                if (matchesToken(normalizedText, team.name)) return true;
                return team.aliases.some((alias) => matchesToken(normalizedText, alias));
            })
            .map(toResolvedTeam);

        const chosen = pickTeamByOutcome(outcomeLabel, tokens, inferredLeague);
        if (chosen) return chosen;
    }

    return null;
}

function toResolvedTeam(meta: TeamMeta): ResolvedTeam {
    return {
        league: meta.league,
        slug: meta.slug,
        name: meta.name,
        logoPath: meta.logoPath,
        aliases: meta.aliases,
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
    // Prefer explicit league metadata when available
    const metaLeague = (market as any).league || (market as any).sport || (market as any).category;
    if (typeof metaLeague === 'string') {
        const normalized = metaLeague.toLowerCase();
        if (normalized.includes('nba')) return 'NBA';
        if (normalized.includes('nfl')) return 'NFL';
        if (normalized.includes('mlb')) return 'MLB';
        if (normalized.includes('mls')) return 'MLS';
        if (normalized.includes('nhl') || normalized.includes('hockey')) return 'NHL';
        if (normalized.includes('uefa') || normalized.includes('soccer') || normalized.includes('football')) return 'UEFA';
    }

    // Look at question or title text
    const text = ((market as any).question || (market as any).eventTitle || (market as any).title || '').toLowerCase();

    if (text.includes('nhl') || text.includes('hockey') || text.includes('stanley cup')) return 'NHL';
    if (text.includes('nba') || text.includes('basketball')) return 'NBA';
    if (text.includes('nfl') || text.includes('american football')) return 'NFL';
    if (text.includes('mlb') || text.includes('baseball')) return 'MLB';
    if (text.includes('mls') || text.includes('mls cup')) return 'MLS';
    if (text.includes('uefa') || text.includes('champions league') || text.includes('premier league') || text.includes('la liga') || text.includes('bundesliga') || text.includes('serie a')) return 'UEFA';

    // Check against known teams for hints
    for (const team of TEAMS) {
        if (matchesToken(text, team.name)) return team.league;
        for (const alias of team.aliases) {
            if (matchesToken(text, alias)) return team.league;
        }
    }

    return undefined;
}
