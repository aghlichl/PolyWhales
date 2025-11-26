"use client";

import { useEffect, useState } from "react";
import { Anomaly } from "@/lib/types";
import { cn } from "@/lib/utils";


interface QuickSearchFiltersProps {
  onFilterSelect: (query: string) => void;
  activeFilter?: string;
  anomalies?: Anomaly[];
}

type CategoryType = 'sports' | 'politics' | 'crypto' | 'markets' | 'companies' | null;

// Keyword definitions - extracted for reuse
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: ['trump', 'biden', 'obama', 'clinton', 'harris', 'pence', 'pelosi', 'mcconnell', 'aoc', 'cruz', 'sanders', 'warren', 'buttigieg', 'klobuchar', 'macron', 'johnson', 'zelenskyy', 'putin', 'netanyahu', 'erdogan', 'jinping', 'sunak', 'modi', 'bachelet', 'marcos', 'boris', 'emmanuel', 'angela', 'olaf', 'luis', 'jair', 'andres', 'gabriel', 'alberto', 'boric'],
  crypto: ['bitcoin', 'ethereum', 'solana', 'cardano', 'polygon', 'chainlink', 'uniswap', 'compound', 'aave', 'maker', 'sushi', 'avalanche', 'polkadot', 'cosmos', 'algorand', 'stellar', 'vechain', 'iota', 'neo', 'qtum', 'zilliqa', 'icon', 'ontology', 'thorchain', 'pancakeswap', '1inch', 'sushiswap', 'curve', 'yearn', 'synthetix'],
  markets: ['spy', 'qqq', 'iwm', 'vti', 'vxus', 'bnd', 'vtip', 'tlt', 'ief', 'shy', 'lqd', 'emb', 'hyg', 'iglb'],
  companies: ['tesla', 'apple', 'microsoft', 'google', 'amazon', 'meta', 'netflix', 'spotify', 'nvidia', 'amd', 'intel', 'oracle', 'ibm', 'salesforce', 'adobe', 'paypal', 'shopify', 'square', 'block', 'coinbase', 'roku', 'zoom', 'slack', 'discord', 'twilio', 'atlassian', 'mongodb', 'datadog', 'crowdstrike', 'palantir']
};

// Sports leagues
const SPORTS_LEAGUES = ['NBA', 'NFL', 'MLB', 'NCAA', 'UFC', 'Soccer', 'Tennis', 'Golf', 'Formula 1', 'NHL'];

// League team mappings
const LEAGUE_TEAMS: Record<string, string[]> = {
  'NBA': ['knicks', 'nets', 'celtics', 'sixers', 'raptors', 'bulls', 'cavaliers', 'pistons', 'pacers', 'bucks', 'hawks', 'heat', 'magic', 'wizards', 'hornets', 'grizzlies', 'pelicans', 'thunder', 'timberwolves', 'blazers', 'kings', 'warriors', 'clippers', 'lakers', 'suns', 'jazz', 'mavericks', 'rockets', 'spurs', 'nuggets'],
  'NFL': ['chiefs', 'eagles', 'patriots', 'packers', 'seahawks', 'bears', 'bengals', 'bills', 'broncos', 'browns', 'buccaneers', 'cardinals', 'chargers', 'colts', 'commanders', 'cowboys', 'dolphins', 'falcons', 'giants', 'jaguars', 'jets', 'niners', 'panthers', 'raiders', 'rams', 'raven', 'redskins', 'saints', 'steelers', 'texans', 'titans', 'viking', 'washington'],
  'MLB': ['yankees', 'red sox', 'rays', 'blue jays', 'orioles', 'white sox', 'guardians', 'tigers', 'twins', 'royals', 'angels', 'astros', 'athletics', 'rangers', 'mariners', 'dodgers', 'diamondbacks', 'giants', 'padres', 'rockies', 'phillies', 'pirates', 'marlins', 'mets', 'nationals', 'braves', 'brewers', 'cubs', 'cardinals', 'reds'],
  'NHL': ['oilers', 'flames', 'canucks', 'golden knights', 'kings', 'ducks', 'sharks', 'blackhawks', 'blue jackets', 'stars', 'wild', 'predators', 'blues', 'jets', 'senators', 'maple leafs', 'canadiens', 'bruins', 'rangers', 'islanders', 'devils', 'flyers', 'penguins', 'capitals', 'hurricanes', 'panthers', 'lightning', 'avalanche', 'kraken']
};

// Sports leagues mapping for pattern matching
const leaguePatterns = {
  'NBA': /\b(nba|nba)\b/g,
  'NFL': /\b(nfl|nfl)\b/g,
  'MLB': /\b(mlb|mlb)\b/g,
  'NCAA': /\b(ncaa|ncaa)\b/g,
  'UFC': /\b(ufc|ufc)\b/g,
  'Soccer': /\b(premier|league|epl|bundesliga|serie.?a|laliga|soccer|football)\b/g,
  'Tennis': /\b(tennis|atp|wta)\b/g,
  'Golf': /\b(golf|pga)\b/g,
  'Formula 1': /\b(f1|formula.?1)\b/g,
  'NHL': /\b(nhl|nhl)\b/g
};

export function QuickSearchFilters({ onFilterSelect, activeFilter, anomalies = [] }: QuickSearchFiltersProps) {
  const [expandedCategory, setExpandedCategory] = useState<CategoryType>(null);
  const [drillDownLevel, setDrillDownLevel] = useState(0); // 0: categories, 1: leagues/items, 2: teams (sports only)
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Show loading for a brief moment, then show filters
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Parent categories
  const parentCategories = ['sports', 'politics', 'crypto', 'markets', 'companies'];

  // Query generation helpers
  const getKeywordsForCategory = (category: CategoryType): string => {
    if (!category) return '';
    
    if (category === 'sports') {
      // For sports, combine all league names
      return SPORTS_LEAGUES.join(' ');
    }
    
    // For other categories, use their keyword lists
    const keywords = CATEGORY_KEYWORDS[category] || [];
    return keywords.join(' ');
  };

  const getKeywordsForLeague = (league: string): string => {
    const teams = LEAGUE_TEAMS[league] || [];
    // Return league name + all team names
    return [league.toLowerCase(), ...teams].join(' ');
  };

  // Get sports leagues sorted by volume
  const getSportsLeagues = (): string[] => {
    const leagueCounts = new Map<string, number>();
    const recentAnomalies = anomalies.slice(0, 100);

    recentAnomalies.forEach(anomaly => {
      const eventText = (anomaly.event + ' ' + anomaly.outcome).toLowerCase();

      Object.entries(leaguePatterns).forEach(([league, pattern]) => {
        if (pattern.test(eventText)) {
          leagueCounts.set(league, (leagueCounts.get(league) || 0) + 1);
        }
      });
    });

    // Return leagues sorted by frequency, with some defaults if none found
    const sortedLeagues = Array.from(leagueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([league]) => league);

    // Add some popular leagues if they're not in the data
    const popularLeagues = ['NBA', 'NFL', 'MLB', 'NCAA', 'Soccer'];
    popularLeagues.forEach(league => {
      if (!sortedLeagues.includes(league)) {
        sortedLeagues.push(league);
      }
    });

    return sortedLeagues.slice(0, 8);
  };

  // Get teams for a specific league
  const getTeamsForLeague = (league: string): string[] => {
    const teamCounts = new Map<string, number>();
    const recentAnomalies = anomalies.slice(0, 100);
    
    // Get teams from LEAGUE_TEAMS constant
    const knownTeams = LEAGUE_TEAMS[league] || [];

    recentAnomalies.forEach(anomaly => {
      const eventText = (anomaly.event + ' ' + anomaly.outcome).toLowerCase();

      // Create pattern from known teams
      if (knownTeams.length > 0) {
        // Escape special regex characters and create pattern
        const escapedTeams = knownTeams.map(team => 
          team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s.]+')
        );
        const teamPattern = new RegExp(`\\b(${escapedTeams.join('|')})\\b`, 'gi');
        const matches = eventText.match(teamPattern);
        if (matches) {
          matches.forEach(match => {
            const cleanMatch = match.trim();
            if (cleanMatch.length > 2 && cleanMatch !== league.toLowerCase()) {
              teamCounts.set(cleanMatch, (teamCounts.get(cleanMatch) || 0) + 1);
            }
          });
        }
      } else {
        // Fallback for unknown leagues
        const fallbackPattern = /\b([a-z]+(?:\s+[a-z]+)*)\b/g;
        const matches = eventText.match(fallbackPattern);
        if (matches) {
          matches.forEach(match => {
            const cleanMatch = match.trim();
            if (cleanMatch.length > 2 && cleanMatch !== league.toLowerCase()) {
              teamCounts.set(cleanMatch, (teamCounts.get(cleanMatch) || 0) + 1);
            }
          });
        }
      }
    });

    // Return teams sorted by frequency, but prioritize known teams
    const sortedByFrequency = Array.from(teamCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([team]) => team);
    
    // Merge with known teams, prioritizing those found in data
    const result = [...new Set([...sortedByFrequency, ...knownTeams])];
    return result.slice(0, 8);
  };

  // Get sub-items for a specific category and level
  const getCategorySubItems = (category: CategoryType, level: number = 1, league?: string): string[] => {
    if (!category || !anomalies.length) return [];

    // Special handling for sports multi-level navigation
    if (category === 'sports') {
      if (level === 1) {
        // Return leagues
        return getSportsLeagues();
      } else if (level === 2 && league) {
        // Return teams for specific league
        return getTeamsForLeague(league);
      }
    }

    // For other categories, use CATEGORY_KEYWORDS constant
    const knownKeywords = CATEGORY_KEYWORDS[category] || [];
    const termCounts = new Map<string, number>();
    const recentAnomalies = anomalies.slice(0, 50);

    recentAnomalies.forEach(anomaly => {
      const eventText = (anomaly.event + ' ' + anomaly.outcome).toLowerCase();

      // Create pattern from known keywords
      if (knownKeywords.length > 0) {
        const escapedKeywords = knownKeywords.map(keyword => 
          keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        const keywordPattern = new RegExp(`\\b(${escapedKeywords.join('|')})\\b`, 'gi');
        const matches = eventText.match(keywordPattern);
        if (matches) {
          matches.forEach(match => {
            const cleanMatch = match.trim();
            if (cleanMatch.length > 2) {
              termCounts.set(cleanMatch, (termCounts.get(cleanMatch) || 0) + 1);
            }
          });
        }
      }
    });

    // Return top items for this category, sorted by frequency, but include all known keywords
    const sortedByFrequency = Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term);
    
    // Merge with known keywords, prioritizing those found in data
    const result = [...new Set([...sortedByFrequency, ...knownKeywords])];
    return result.slice(0, 80);
  };

  const handleCategoryClick = (category: string) => {
    if (drillDownLevel === 0) {
      // Clicking from main categories - apply category filter
      const categoryType = category as CategoryType;
      setExpandedCategory(categoryType);
      setDrillDownLevel(1);
      if (category === 'sports') {
        setSelectedLeague(null); // Reset league selection
      }
      // Generate and apply filter query for this category
      const query = getKeywordsForCategory(categoryType);
      onFilterSelect(query);
    } else if (drillDownLevel === 1 && expandedCategory === 'sports') {
      // Clicking a league within sports - apply league filter
      setSelectedLeague(category);
      setDrillDownLevel(2);
      // Generate and apply filter query for this league (league + all teams)
      const query = getKeywordsForLeague(category);
      onFilterSelect(query);
    }
  };

  const handleBackToCategories = () => {
    if (drillDownLevel === 2) {
      // Back from teams to leagues - restore category filter
      setDrillDownLevel(1);
      setSelectedLeague(null);
      // Re-apply the category-level filter
      if (expandedCategory) {
        const query = getKeywordsForCategory(expandedCategory);
        onFilterSelect(query);
      }
    } else if (drillDownLevel === 1) {
      // Back from leagues/items to main categories - clear filter
      setDrillDownLevel(0);
      setExpandedCategory(null);
      setSelectedLeague(null);
      onFilterSelect('');
    }
  };

  // Get current items to display based on drill-down level
  const getCurrentItems = (): { items: string[], title: string } => {
    if (drillDownLevel === 0) {
      // Main categories
      return {
        items: parentCategories,
        title: ""
      };
    } else if (drillDownLevel === 1) {
      // Leagues for sports, or final items for other categories
      if (expandedCategory === 'sports') {
        return {
          items: getSportsLeagues(),
          title: "" // No title for sports leagues
        };
      } else {
        const subItems = getCategorySubItems(expandedCategory, 1);
        return {
          items: subItems.length > 0 ? subItems : [expandedCategory || 'unknown'],
          title: "" // No title for other categories
        };
      }
    } else if (drillDownLevel === 2 && selectedLeague) {
      // Teams within a league
      return {
        items: getTeamsForLeague(selectedLeague),
        title: selectedLeague
      };
    }

    // Fallback
    return {
      items: parentCategories,
      title: "Hot Topics"
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-xs font-mono text-zinc-500">LOADING...</div>
      </div>
    );
  }

  const { items: displayItems, title: displayTitle } = getCurrentItems();

  // Limit display items to prevent overflow and maintain scrollability
  const maxDisplayItems = 5;
  const limitedDisplayItems = displayItems.slice(0, maxDisplayItems);

  return (
    <div className="flex items-center w-full">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pr-2">
      {drillDownLevel > 0 && (
        <button
          onClick={handleBackToCategories}
          className="px-2 py-1.5 border-2 font-mono text-xs font-bold uppercase transition-all duration-200 shrink-0 border-zinc-600 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
        >
          ← BACK
        </button>
      )}

      {/* Show league name only for level 2 (teams within league) */}
      {drillDownLevel === 2 && displayTitle && (
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider whitespace-nowrap mr-2 shrink-0">
          {displayTitle}:
        </span>
      )}

        {limitedDisplayItems.map((item) => (
          <button
            key={item}
            onClick={() => {
              if (drillDownLevel === 2 || (drillDownLevel === 1 && expandedCategory !== 'sports')) {
                // Final level - filter the results
                onFilterSelect(item);
              } else {
                // Navigate to next level
                handleCategoryClick(item);
              }
            }}
            className={cn(
              "px-2 py-1.5 border-2 font-mono text-xs font-bold uppercase transition-all duration-200 shrink-0",
              activeFilter === item
                ? "border-[#b8a889] bg-[#b8a889]/10 text-[#e9e2d3] shadow-[3px_3px_0px_0px_rgba(184,168,137,0.7)]"
                : "border-zinc-600 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
            )}
          >
            {item}
          </button>
        ))}

        {/* Show indicator if there are more items */}
        {displayItems.length > maxDisplayItems && (
          <span className="text-xs font-mono text-zinc-500 uppercase shrink-0 ml-2">
            +{displayItems.length - maxDisplayItems} MORE
          </span>
        )}
      </div>
    </div>
  );
}
