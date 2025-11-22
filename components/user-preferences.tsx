"use client";

import { usePreferencesStore } from "@/lib/store";

export function UserPreferences() {
  const { preferences, setPreferences } = usePreferencesStore();

  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="max-w-md mx-auto w-full p-4 space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-mono font-bold text-zinc-300 mb-2">
          USER PREFERENCES
        </h1>
        <p className="text-sm text-zinc-500 font-mono">
          Customize your anomaly detection experience
        </p>
      </div>

      {/* Anomaly Type Filters */}
      <div className="space-y-4">
        <h2 className="text-lg font-mono font-semibold text-zinc-400 mb-3">
          ANOMALY TYPES
        </h2>

        {/* STANDARD Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer ${
          preferences.showStandard
            ? 'border-zinc-500 bg-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]'
            : 'border-zinc-700 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
        }`} onClick={() => setPreferences({ showStandard: !preferences.showStandard })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-zinc-400">STANDARD</div>
              <div className="text-xs text-zinc-600 font-mono">$0 - $8,000</div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${
              preferences.showStandard
                ? 'border-zinc-400 bg-zinc-400'
                : 'border-zinc-600'
            }`} />
          </div>
        </div>

        {/* WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer ${
          preferences.showWhale
            ? 'border-blue-500 bg-blue-950/20 shadow-[3px_3px_0px_0px_rgba(59,130,246,0.8)]'
            : 'border-blue-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
        }`} onClick={() => setPreferences({ showWhale: !preferences.showWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-blue-400">WHALE</div>
              <div className="text-xs text-zinc-600 font-mono">$8,000 - $15,000</div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${
              preferences.showWhale
                ? 'border-blue-400 bg-blue-400'
                : 'border-blue-600/50'
            }`} />
          </div>
        </div>

        {/* MEGA_WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer ${
          preferences.showMegaWhale
            ? 'border-purple-500 bg-purple-950/20 shadow-[3px_3px_0px_0px_rgba(147,51,234,0.8)]'
            : 'border-purple-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
        }`} onClick={() => setPreferences({ showMegaWhale: !preferences.showMegaWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-purple-400">MEGA WHALE</div>
              <div className="text-xs text-zinc-600 font-mono">$15,000+</div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${
              preferences.showMegaWhale
                ? 'border-purple-400 bg-purple-400'
                : 'border-purple-600/50'
            }`} />
          </div>
        </div>
      </div>

      {/* Minimum Value Filter */}
      <div className="space-y-3">
        <h2 className="text-lg font-mono font-semibold text-zinc-400">
          MINIMUM VALUE FILTER
        </h2>

        <div className="px-2">
          <input
            type="range"
            min="0"
            max="1000000"
            step="1000"
            value={preferences.minValueThreshold}
            onChange={(e) => setPreferences({ minValueThreshold: parseInt(e.target.value) })}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-zinc-600 font-mono mt-2">
            <span>$0</span>
            <span className="font-bold text-primary">
              {formatValue(preferences.minValueThreshold)}
            </span>
            <span>$1M</span>
          </div>
        </div>
      </div>

      {/* Save Indicator */}
      <div className="text-center">
        <p className="text-xs text-zinc-700 font-mono">
          Preferences saved automatically
        </p>
      </div>
    </div>
  );
}
