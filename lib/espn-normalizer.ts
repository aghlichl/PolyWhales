export interface NormalizedGame {
    ids: {
        eventId: string;
        competitionId?: string;
        uid?: string;
        leagueUid?: string;
    };

    meta: {
        name?: string;                // "Atlanta Falcons at Tampa Bay Buccaneers"
        shortName?: string;           // "ATL @ TB"
        seasonYear?: number;
        seasonType?: number | string;
        seasonSlug?: string;
        week?: number;                // if present
        tournamentRound?: string | number; // if present for other sports
    };

    timing: {
        startTimeISO?: string;        // kickoff/tipoff/etc
        state?: "pre" | "in" | "post";
        completed?: boolean;
        statusText?: string;          // "Final", "Halftime", "Q3 08:21", etc
        period?: number;              // quarter/inning/period
        displayClock?: string;        // "0:00", "8:21"
        timeValid?: boolean;
        recent?: boolean;
        isHalftimeLike?: boolean;     // best-effort if statusText contains "Half"
    };

    venue?: {
        name?: string;
        city?: string;
        state?: string;
        country?: string;
        indoor?: boolean;
        attendance?: number;
    };

    broadcast?: {
        primary?: string;             // "Prime Video", "ESPN", etc
        markets?: Array<{ market?: string; names?: string[] }>;
    };

    competitors?: TeamSide[];       // raw list normalized (for safety/neutral sites)

    teams: {
        home?: TeamSide;
        away?: TeamSide;
    };

    score?: {
        home?: number;
        away?: number;
    };

    linescore?: {
        home?: Array<{ period: number; value?: number; displayValue?: string }>;
        away?: Array<{ period: number; value?: number; displayValue?: string }>;
        label?: string;
    };

    leaders?: Record<string, {
        displayName?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        top?: {
            displayValue?: string;
            value?: number;
            athlete?: {
                id?: string;
                fullName?: string;
                shortName?: string;
                headshot?: string;
                jersey?: string;
                position?: string;
                teamId?: string;
            };
            teamId?: string;
        };
    }>;

    narrative?: {
        highlight?: {
            headline?: string;
            description?: string;
            thumbnail?: string;
            video?: { mp4?: string; hls?: string; web?: string };
            publishedISO?: string;
        };
        recap?: {
            shortLinkText?: string;
            description?: string;
        };
    };

    links?: {
        summary?: string;
        gamecast?: string;
        boxscore?: string;
        pbp?: string;
        recap?: string;
        highlights?: string;
    };

    derived?: {
        spreadAwayMinusHome?: number;
        total?: number;
        lastPeriodDelta?: number;
        lastSegmentWinner?: "home" | "away" | "tie";
        lastSegmentMargin?: number;
        biggestSwing?: { period: number; delta: number };
        comeback?: { occurred: boolean; threshold: number; periodIndex: number };
        momentumText?: string;          // "{TEAM_ABBR} +{margin} in P{i+1}"
    };

    raw?: {
        source?: "espn";
    };
}

export interface TeamSide {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
    location?: string;
    name?: string;
    logo?: string;
    color?: string;
    alternateColor?: string;
    winner?: boolean;
    record?: {
        overall?: string;
        home?: string;
        road?: string;
    };
}

// --- Helpers ---

function first<T>(...args: (T | undefined | null)[]): T | undefined {
    for (const arg of args) {
        if (arg !== undefined && arg !== null) return arg;
    }
    return undefined;
}

function toInt(val: any): number | undefined {
    if (val === undefined || val === null) return undefined;
    const parsed = parseInt(String(val), 10);
    return isNaN(parsed) ? undefined : parsed;
}

function pickLink(links: any[], relContains: string): string | undefined {
    if (!Array.isArray(links)) return undefined;
    const link = links.find(l => l.rel && Array.isArray(l.rel) && l.rel.some((r: string) => r.includes(relContains)));
    return link?.href;
}

function pickCompetition(event: any): any {
    // Defensive: try [0], but maybe in future scan for 'primary'
    if (Array.isArray(event.competitions) && event.competitions.length > 0) {
        return event.competitions[0];
    }
    return null;
}

// --- Main Normalizer ---

export function normalizeEspnEvent(event: any): NormalizedGame | null {
    if (!event || !event.id) return null;

    const comp = pickCompetition(event);
    if (!comp) return null; // No competition logic, can't parse

    const status = comp.status || {};
    const venue = comp.venue || {};

    // 1. Basic IDs & Meta
    const normalized: NormalizedGame = {
        ids: {
            eventId: event.id,
            uid: event.uid,
            competitionId: comp.id,
        },
        meta: {
            name: event.name,
            shortName: event.shortName,
            seasonYear: event.season?.year,
            seasonType: first(event.season?.type?.type, event.season?.type?.id, event.season?.type),
            seasonSlug: event.season?.slug,
            week: event.week?.number,
        },
        timing: {}, // filled below
        teams: {},  // filled below
        raw: { source: "espn" }
    };

    // 2. Timing
    normalized.timing = {
        startTimeISO: first(comp.startDate, comp.date, event.date),
        state: status.type?.state, // "pre", "in", "post"
        completed: status.type?.completed === true,
        statusText: first(status.type?.shortDetail, status.type?.detail, status.type?.description),
        period: status.period,
        displayClock: status.displayClock,
        timeValid: comp.timeValid,
        recent: comp.recent,
        isHalftimeLike: status.type?.shortDetail?.includes("Half") || status.type?.detail?.includes("Half"),
    };

    // 3. Venue
    if (venue) {
        normalized.venue = {
            name: venue.fullName,
            city: venue.address?.city,
            state: venue.address?.state,
            country: venue.address?.country,
            indoor: venue.indoor,
            attendance: comp.attendance,
        };
    }

    // 4. Broadcast
    const broadcasts = comp.broadcasts || [];
    const geoBroadcasts = comp.geoBroadcasts || [];
    const primaryBroadcastName =
        first(comp.broadcast, broadcasts[0]?.names?.[0], geoBroadcasts[0]?.media?.shortName);

    if (primaryBroadcastName || broadcasts.length > 0) {
        normalized.broadcast = {
            primary: primaryBroadcastName,
            markets: broadcasts.map((b: any) => ({
                market: b.market,
                names: b.names
            })),
        };
    }

    // 5. Teams & Competitors
    normalized.competitors = [];
    const homeComp = (comp.competitors || []).find((c: any) => c.homeAway === "home");
    const awayComp = (comp.competitors || []).find((c: any) => c.homeAway === "away");

    // Helper to map a raw competitor to TeamSide
    const mapCompetitor = (c: any): TeamSide => ({
        id: c.team?.id,
        abbreviation: c.team?.abbreviation,
        displayName: c.team?.displayName,
        shortDisplayName: c.team?.shortDisplayName,
        location: c.team?.location,
        name: c.team?.name,
        logo: c.team?.logo,
        color: c.team?.color,
        alternateColor: c.team?.alternateColor,
        winner: c.winner,
        record: {
            overall: c.records?.find((r: any) => r.name === "overall" || r.type === "total")?.summary,
            home: c.records?.find((r: any) => r.type === "home")?.summary,
            road: c.records?.find((r: any) => r.type === "road")?.summary,
        },
    });

    if (comp.competitors && Array.isArray(comp.competitors)) {
        normalized.competitors = comp.competitors.map(mapCompetitor);
    }

    if (homeComp) normalized.teams.home = mapCompetitor(homeComp);
    if (awayComp) normalized.teams.away = mapCompetitor(awayComp);

    // Scores
    normalized.score = {
        home: toInt(homeComp?.score),
        away: toInt(awayComp?.score),
    };

    // Linescores
    if (homeComp?.linescores) {
        normalized.linescore = normalized.linescore || {};
        normalized.linescore.home = homeComp.linescores.map((ls: any) => ({
            period: ls.period,
            value: toInt(ls.value),
            displayValue: ls.displayValue
        }));
    }
    if (awayComp?.linescores) {
        normalized.linescore = normalized.linescore || {};
        normalized.linescore.away = awayComp.linescores.map((ls: any) => ({
            period: ls.period,
            value: toInt(ls.value),
            displayValue: ls.displayValue
        }));
    }

    // 6. Leaders
    if (comp.leaders && Array.isArray(comp.leaders)) {
        normalized.leaders = {};
        comp.leaders.forEach((cat: any) => {
            const top = cat.leaders?.[0];
            if (top && normalized.leaders) {
                normalized.leaders[cat.name] = {
                    displayName: cat.displayName,
                    shortDisplayName: cat.shortDisplayName,
                    abbreviation: cat.abbreviation,
                    top: {
                        displayValue: top.displayValue,
                        value: top.value,
                        teamId: top.team?.id || top.athlete?.team?.id,
                        athlete: top.athlete ? {
                            id: top.athlete.id,
                            fullName: top.athlete.fullName,
                            shortName: top.athlete.shortName,
                            headshot: top.athlete.headshot?.href || top.athlete.headshot,
                            jersey: top.athlete.jersey,
                            position: top.athlete.position?.abbreviation,
                            teamId: top.athlete.team?.id
                        } : undefined
                    }
                };
            }
        });
    }

    // 7. Narrative (Highlights & Recap)
    const highlight = comp.highlights?.[0]; // take first
    const recapTitle = (comp.headlines || []).find((h: any) => h.type === "Recap" || h.shortLinkText);

    if (highlight || recapTitle) {
        normalized.narrative = {};
        if (highlight) {
            // Best effort video links
            const mp4 = highlight.links?.source?.href;
            const hls = highlight.links?.source?.HLS?.href; // typical ESPN structure vary, safe chain
            const web = highlight.links?.web?.href;

            normalized.narrative.highlight = {
                headline: highlight.headline,
                description: highlight.description,
                thumbnail: highlight.thumbnail, // sometimes it's direct str
                publishedISO: first(highlight.originalPublishDate, highlight.lastModified),
                video: (mp4 || hls || web) ? { mp4, hls, web } : undefined
            };
        }
        if (recapTitle) {
            normalized.narrative.recap = {
                shortLinkText: recapTitle.shortLinkText,
                description: recapTitle.description
            };
        }
    }

    // 8. Links
    if (event.links) {
        normalized.links = {
            summary: pickLink(event.links, "summary"),
            gamecast: pickLink(event.links, "summary") || pickLink(event.links, "gamecast"), // fallback
            boxscore: pickLink(event.links, "boxscore"),
            pbp: pickLink(event.links, "pbp"),
            recap: pickLink(event.links, "recap"),
            highlights: pickLink(event.links, "highlights"),
        };
    }

    // 9. Derived Signals
    normalized.derived = computeDerived(normalized);

    return normalized;
}

function computeDerived(game: NormalizedGame): NormalizedGame["derived"] {
    const derived: NormalizedGame["derived"] = {};

    // Spread & Total
    const { home: homeScore, away: awayScore } = game.score || {};
    if (typeof homeScore === 'number' && typeof awayScore === 'number') {
        derived.spreadAwayMinusHome = awayScore - homeScore;
        derived.total = awayScore + homeScore;
    }

    // Momentum
    const homeLines = game.linescore?.home;
    const awayLines = game.linescore?.away;

    if (homeLines && awayLines) {
        let lastIndex = -1;
        // Find last segment where both have values
        const maxLen = Math.min(homeLines.length, awayLines.length);
        for (let i = 0; i < maxLen; i++) {
            if (homeLines[i].value !== undefined && awayLines[i].value !== undefined) {
                lastIndex = i;
            }
        }

        if (lastIndex >= 0) {
            const hVal = homeLines[lastIndex].value || 0;
            const aVal = awayLines[lastIndex].value || 0;
            const delta = aVal - hVal;

            derived.lastPeriodDelta = delta;
            derived.lastSegmentMargin = Math.abs(delta);
            if (delta > 0) derived.lastSegmentWinner = "away";
            else if (delta < 0) derived.lastSegmentWinner = "home";
            else derived.lastSegmentWinner = "tie";

            // Text: "{TEAM_ABBR} +{margin} in P{i+1}"
            if (delta !== 0) {
                const winnerSide = delta > 0 ? game.teams.away : game.teams.home;
                const abbr = winnerSide?.abbreviation || (delta > 0 ? "AWAY" : "HOME");
                const periodIdx = lastIndex + 1; // 1-based display
                derived.momentumText = `${abbr} +${Math.abs(delta)} in P${periodIdx}`;
            }

            // Biggest Swing logic
            let maxAbs = 0;
            let maxPeriod = 0;
            for (let i = 0; i < maxLen; i++) {
                // Safe check again
                if (homeLines[i].value !== undefined && awayLines[i].value !== undefined) {
                    const d = (awayLines[i].value || 0) - (homeLines[i].value || 0);
                    if (Math.abs(d) > maxAbs) {
                        maxAbs = Math.abs(d);
                        maxPeriod = i + 1;
                    }
                }
            }
            if (maxPeriod > 0) {
                derived.biggestSwing = { period: maxPeriod, delta: maxAbs };
            }
        }
    }

    // Comeback
    // Config: threshold 10, entering final segment
    // If we have periods >= 4, check entering 4th (index 3).
    // Else if unknown, use floor(len * 0.75)
    if (homeLines && awayLines && game.score?.home !== undefined && game.score?.away !== undefined) {
        const len = Math.max(homeLines.length, awayLines.length);
        // Only check if game is completed or deep in
        if (len >= 2) {
            const threshold = 10;
            // "Entering" index. For NBA/NFL (4 periods), entering 4th means we sum 0,1,2.
            // So index to check IS 3 (0-based) because that's the one we're about to play? 
            // No, "entering final segment" means check score AFTER (final-1) periods.
            // If len=4, we want score after period 3 (indices 0,1,2).
            const enteringIndex = len >= 4 ? 3 : Math.floor(len * 0.75); // if len=4 -> 3. if len=9(baseball) -> 6 (7th inning stretch?)

            // Calculate score BEFORE that segment
            let hSum = 0;
            let aSum = 0;
            // Sum up indices 0 to enteringIndex-1
            for (let i = 0; i < enteringIndex; i++) {
                hSum += (homeLines[i]?.value || 0);
                aSum += (awayLines[i]?.value || 0);
            }

            const marginEntering = aSum - hSum; // + means away leading, - means home leading
            const finalMargin = game.score.away - game.score.home;

            // Did side trail by >= threshold and then win?
            let comebackOccurred = false;

            // Case 1: Trailing Home Team (marginEntering >= 10 -> Away led) won? (finalMargin < 0)
            if (marginEntering >= threshold && finalMargin < 0) {
                comebackOccurred = true;
            }
            // Case 2: Trailing Away Team (marginEntering <= -10 -> Home led) won? (finalMargin > 0)
            else if (marginEntering <= -threshold && finalMargin > 0) {
                comebackOccurred = true;
            }

            if (comebackOccurred) {
                derived.comeback = { occurred: true, threshold, periodIndex: enteringIndex + 1 };
            }
        }
    }

    return derived;
}
