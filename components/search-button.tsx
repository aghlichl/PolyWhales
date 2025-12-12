import { Search, X, ListFilter, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { AnomalyType } from "@/lib/types";

export interface FilterState {
  tiers: AnomalyType[];
  sides: ('BUY' | 'SELL')[];
  leagues: string[];
}

interface SearchButtonProps {
  onSearch: (query: string) => void;
  className?: string;
  value?: string;
  filters?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
}

const TIER_OPTIONS: { label: string; value: AnomalyType; color: string }[] = [
  { label: "Standard", value: "STANDARD", color: "bg-zinc-600" },
  { label: "Whale", value: "WHALE", color: "bg-sky-500" },
  { label: "Mega", value: "MEGA_WHALE", color: "bg-purple-500" },
  { label: "Super", value: "SUPER_WHALE", color: "bg-[#8e2a2a]" },
  { label: "God", value: "GOD_WHALE", color: "bg-yellow-500" },
];

const LEAGUE_OPTIONS = ["NBA", "NFL", "NHL", "MLB", "UFC", "TENNIS", "SOCCER", "POLITICS", "CRYPTO"]; // Common leagues

export function SearchButton({ onSearch, className, filters, onFilterChange }: SearchButtonProps) {
  const [query, setQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Local filter state if not controlled (fallback)
  const [localFilters, setLocalFilters] = useState<FilterState>({
    tiers: [],
    sides: [],
    leagues: []
  });

  const activeFilters = filters || localFilters;
  const handleFilterChange = onFilterChange || setLocalFilters;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setQuery(newVal);
    onSearch(newVal);
  };

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  const toggleTier = (tier: AnomalyType) => {
    const newTiers = activeFilters.tiers.includes(tier)
      ? activeFilters.tiers.filter(t => t !== tier)
      : [...activeFilters.tiers, tier];
    handleFilterChange({ ...activeFilters, tiers: newTiers });
  };

  const toggleSide = (side: 'BUY' | 'SELL') => {
    const newSides = activeFilters.sides.includes(side)
      ? activeFilters.sides.filter(s => s !== side)
      : [...activeFilters.sides, side];
    handleFilterChange({ ...activeFilters, sides: newSides });
  };

  const toggleLeague = (league: string) => {
    const newLeagues = activeFilters.leagues.includes(league)
      ? activeFilters.leagues.filter(l => l !== league)
      : [...activeFilters.leagues, league];
    handleFilterChange({ ...activeFilters, leagues: newLeagues });
  };

  const clearFilters = () => {
    handleFilterChange({ tiers: [], sides: [], leagues: [] });
  };

  const hasActiveFilters = activeFilters.tiers.length > 0 || activeFilters.sides.length > 0 || activeFilters.leagues.length > 0;

  return (
    <div className={cn("w-full px-4 pb-4", className)}>
      <div className="relative group flex flex-col gap-2">
        {/* Search Bar Container */}
        <div className="
          relative flex items-center 
          bg-black/40 backdrop-blur-md
          border border-white/5 
          rounded-xl 
          transition-colors duration-200
          focus-within:bg-black/60 focus-within:border-white/10
          shadow-lg
        ">

          {/* Search Icon */}
          <div className="pl-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors">
            <Search size={16} />
          </div>

          {/* Input */}
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search events, teams..."
            className="
              flex-1 bg-transparent border-none outline-none 
              text-xs font-medium tracking-wide text-zinc-300 placeholder-zinc-600
              py-3 px-3 uppercase
            "
            spellCheck={false}
          />

          {/* Right Actions */}
          <div className="flex items-center gap-1 pr-2">
            {/* Clear Button */}
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={handleClear}
                  className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X size={14} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Filter Toggle */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                isFilterOpen || hasActiveFilters
                  ? "text-sky-400 bg-sky-500/10"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              <ListFilter size={16} />
              {hasActiveFilters && !isFilterOpen && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-black" />
              )}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 8 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="
                bg-black/40 backdrop-blur-md
                border border-white/5 
                rounded-xl p-4
                space-y-4
              ">
                {/* Header with Clear All */}
                <div className="flex items-center justify-between pointer-events-none"> {/* pointer-events-none to prevent clicks on header area, but children need events. Actually let's just use regular div */}
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Advanced Filters</span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors pointer-events-auto"
                    >
                      RESET ALL
                    </button>
                  )}
                </div>

                {/* Tiers Filter */}
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-500 font-medium ml-1">TIER</div>
                  <div className="flex flex-wrap gap-2">
                    {TIER_OPTIONS.map((tier) => (
                      <button
                        key={tier.value}
                        onClick={() => toggleTier(tier.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200 border",
                          activeFilters.tiers.includes(tier.value)
                            ? `border-${tier.color.replace('bg-', '')}/50 ${tier.color} text-white shadow-[0_0_10px_-2px_rgba(255,255,255,0.3)]`
                            : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                        )}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Side Filter */}
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-500 font-medium ml-1">SIDE</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleSide('BUY')}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200 border",
                        activeFilters.sides.includes('BUY')
                          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]"
                          : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                      )}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => toggleSide('SELL')}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200 border",
                        activeFilters.sides.includes('SELL')
                          ? "border-red-500/50 bg-red-500/20 text-red-400 shadow-[0_0_10px_-2px_rgba(239,68,68,0.3)]"
                          : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                      )}
                    >
                      Sell
                    </button>
                  </div>
                </div>

                {/* Leagues Filter */}
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-500 font-medium ml-1">LEAGUE</div>
                  <div className="grid grid-cols-4 gap-2">
                    {LEAGUE_OPTIONS.map((league) => (
                      <button
                        key={league}
                        onClick={() => toggleLeague(league)}
                        className={cn(
                          "px-2 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide text-center uppercase transition-all duration-200 border truncate",
                          activeFilters.leagues.includes(league)
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                            : "border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10 hover:text-zinc-400"
                        )}
                      >
                        {league}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

