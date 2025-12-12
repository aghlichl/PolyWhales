import { create } from 'zustand';

export interface LiveScore {
  gameId: string;
  league: 'NBA' | 'MLB' | 'NFL' | 'NHL';
  status: 'scheduled' | 'in_progress' | 'final';
  period: number;
  clock: string; // e.g., "10:45", "Final"
  homeTeam: string;
  homeTeamShort: string;
  awayTeam: string;
  awayTeamShort: string;
  homeScore: number;
  awayScore: number;
  // Trends
  homeTeamAbbr: string;
  homeTeamName: string; // Nickname e.g. "Lakers"
  awayTeamAbbr: string;
  awayTeamName: string; // Nickname e.g. "Celtics"
  homeScoreTrend: 'UP' | 'SAME';
  awayScoreTrend: 'UP' | 'SAME';
  lastUpdated: number;
  rawEspnEvent?: any;
}

interface ScoreStore {
  scores: Record<string, LiveScore>; // Keyed by gameId
  isLoading: boolean;
  lastFetchTime: number;

  // Actions
  fetchScores: () => Promise<void>;
  startPolling: (intervalMs?: number) => () => void; // Returns cleanup function

  // Selectors
  getGameForTeam: (teamName: string, league?: string) => LiveScore | undefined;
}

const LEAGUE_URLS = {
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
};

// Helper to resolve logo path based on league conventions
export function getLiveScoreLogo(league: string, abbr: string, name: string): string | null {
  if (!league || !abbr) return null;
  const cleanAbbr = abbr.toUpperCase();
  const cleanName = name.trim();

  switch (league) {
    case 'NFL':
      // NFL: Uppercase Abbr (e.g. ARI.png)
      // Exception: WSH might differ if file is WAS? checked: WSH.png exists
      return `/logos/NFL/${cleanAbbr}.png`;

    case 'NHL':
      // NHL: Lowercase Abbr (e.g. ana.png)
      return `/logos/NHL/${cleanAbbr.toLowerCase()}.png`;

    case 'NBA':
      // NBA: Uppercase Abbr, often with H suffix? Or maybe just abbr for some?
      // Based on file list: ILAL.png exists? No, LAL.png. 
      // But also PHIH.png, GSH.png. 
      // Let's try to map common ones or default to Abbr if not found? 
      // Since we can't check file existence, let's map known weird ones.
      const nbaMap: Record<string, string> = {
        'GS': 'GSH', 'GSW': 'GSH',
        'CHA': 'CHAH',
        'CHI': 'CHIH',
        'CLE': 'CLEH',
        'DAL': 'DALH',
        'DEN': 'DENH',
        'DET': 'DETH',
        'MEM': 'MEMH',
        'MIA': 'MIAH',
        'MIL': 'MILH',
        'MIN': 'MINH',
        'NOP': 'NO', 'NO': 'NO',
        'OKC': 'OKCH',
        'PHI': 'PHIH', // Sixers
        'PHX': 'PHX', // Suns
        'POR': 'PORH',
        'SAC': 'SACH',
        'SAS': 'SAH', 'SA': 'SAH',
        'TOR': 'TORH',
        'UTA': 'UTAHH', 'UTAH': 'UTAHH',
        'WAS': 'WSH', 'WSH': 'WSH', // Wizards
      };
      const nbaFilename = nbaMap[cleanAbbr] || cleanAbbr;
      return `/logos/NBA/${nbaFilename}.png`;

    case 'MLB':
      // MLB: Nicknames in camelCase? e.g. "redSox", "angels", "blueJays"
      // Need a converter from "Red Sox" to "redSox"
      const camelName = cleanName
        .split(' ')
        .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      return `/logos/MLB/${camelName}.png`;

    default:
      return null;
  }
}

// Normalize team name for matching (e.g. "Los Angeles Lakers" -> "lakers", "Lakers" -> "lakers")
function normalizeTeam(name: string): string {
  return name.toLowerCase().trim();
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  scores: {},
  isLoading: false,
  lastFetchTime: 0,

  fetchScores: async () => {
    set({ isLoading: true });
    try {
      const responses = await Promise.allSettled(
        Object.entries(LEAGUE_URLS).map(async ([league, url]) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch ${league}`);
          const data = await res.json();
          return { league, events: data.events || [] };
        })
      );

      set((state) => {
        const newScores = { ...state.scores };
        const now = Date.now();

        responses.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { league, events } = result.value;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            events.forEach((event: any) => {
              const comp = event.competitions?.[0];
              if (!comp) return;

              const gameId = event.id;
              const statusType = event.status?.type?.name; // e.g. STATUS_IN_PROGRESS, STATUS_FINAL

              let status: LiveScore['status'] = 'scheduled';
              if (statusType?.includes('IN_PROGRESS')) status = 'in_progress';
              else if (statusType?.includes('FINAL')) status = 'final';

              const competitors = comp.competitors || [];
              const home = competitors.find((c: any) => c.homeAway === 'home');
              const away = competitors.find((c: any) => c.homeAway === 'away');

              if (!home || !away) return;

              const homeScore = parseInt(home.score || '0');
              const awayScore = parseInt(away.score || '0');

              // Check trends if we already have this game
              const existing = state.scores[gameId];
              const homeScoreTrend = existing && homeScore > existing.homeScore ? 'UP' : 'SAME';
              const awayScoreTrend = existing && awayScore > existing.awayScore ? 'UP' : 'SAME';

              newScores[gameId] = {
                gameId,
                league: league as any,
                status,
                period: event.status?.period || 0,
                clock: event.status?.displayClock || event.status?.type?.detail || '',
                homeTeam: home.team?.displayName || '',
                homeTeamShort: home.team?.shortDisplayName || home.team?.name || '',
                homeTeamAbbr: home.team?.abbreviation || '',
                homeTeamName: home.team?.name || '', // Nickname
                awayTeam: away.team?.displayName || '',
                awayTeamShort: away.team?.shortDisplayName || away.team?.name || '',
                awayTeamAbbr: away.team?.abbreviation || '',
                awayTeamName: away.team?.name || '', // Nickname
                homeScore,
                awayScore,
                homeScoreTrend,
                awayScoreTrend,
                lastUpdated: now,
                rawEspnEvent: event,
              };
            });
          }
        });

        return { scores: newScores, isLoading: false, lastFetchTime: now };
      });
    } catch (error) {
      console.error("Error fetching live scores:", error);
      set({ isLoading: false });
    }
  },

  startPolling: (intervalMs = 60000) => {
    const { fetchScores } = get();
    // Fetch immediately
    fetchScores();
    const interval = setInterval(fetchScores, intervalMs);
    return () => clearInterval(interval);
  },

  getGameForTeam: (teamName: string, league?: string) => {
    if (!teamName) return undefined;
    const normalized = normalizeTeam(teamName);
    const { scores } = get();

    const matchesTeam = (score: LiveScore) => {
      // Enforce league when provided to avoid cross-sport collisions.
      if (league && score.league !== league) return false;

      // Check full names
      if (normalizeTeam(score.homeTeam).includes(normalized)) return true;
      if (normalizeTeam(score.awayTeam).includes(normalized)) return true;

      // Check short names (e.g. "Lakers" matches "Los Angeles Lakers")
      if (normalizeTeam(score.homeTeamShort) === normalized) return true;
      if (normalizeTeam(score.awayTeamShort) === normalized) return true;

      // Reverse check: does the normalized search term contain the short name?
      if (normalized.includes(normalizeTeam(score.homeTeamShort))) return true;
      if (normalized.includes(normalizeTeam(score.awayTeamShort))) return true;

      return false;
    };

    // Prefer exact league matches first, then fall back without league only if nothing found.
    const candidates = Object.values(scores).filter(matchesTeam);
    if (candidates.length > 0) return candidates[0];

    // If no league was provided, allow a fallback search across all leagues.
    if (!league) {
      const anyLeagueMatch = Object.values(scores).find((score) => {
        // Re-run without league filter
        if (normalizeTeam(score.homeTeam).includes(normalized)) return true;
        if (normalizeTeam(score.awayTeam).includes(normalized)) return true;
        if (normalizeTeam(score.homeTeamShort) === normalized) return true;
        if (normalizeTeam(score.awayTeamShort) === normalized) return true;
        if (normalized.includes(normalizeTeam(score.homeTeamShort))) return true;
        if (normalized.includes(normalizeTeam(score.awayTeamShort))) return true;
        return false;
      });
      if (anyLeagueMatch) return anyLeagueMatch;
    }

    return undefined;
  }
}));
