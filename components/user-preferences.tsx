"use client";

import React from "react";
import { usePreferencesStore } from "@/lib/store";
import { CONFIG } from "@/lib/config";

// Exponential scale mapping for more intuitive control
const VALUE_LEVELS = [
  { value: 1000, label: "$1K", tier: "MIN" },
  { value: 2000, label: "$2K", tier: "MIN" },
  { value: 5000, label: "$5K", tier: "MIN" },
  { value: 8000, label: "$8K", tier: "WHALE" },
  { value: 10000, label: "$10K", tier: "WHALE" },
  { value: 15000, label: "$15K", tier: "MEGA" },
  { value: 20000, label: "$20K", tier: "MEGA" },
  { value: 50000, label: "$50K", tier: "SUPER" },
  { value: 75000, label: "$75K", tier: "SUPER" },
  { value: 100000, label: "$100K", tier: "GOD" },
  { value: 250000, label: "$250K", tier: "GOD" },
  { value: 500000, label: "$500K", tier: "GOD" },
  { value: 1000000, label: "$1M", tier: "GOD" },
];

const getTierColor = (tier: string) => {
  switch (tier) {
    case "WHALE": return "border-blue-500/50 bg-blue-500/10";
    case "MEGA": return "border-purple-500/50 bg-purple-500/10";
    case "SUPER": return "border-red-500/50 bg-red-500/10";
    case "GOD": return "border-yellow-500/50 bg-yellow-500/10";
    default: return "border-zinc-600/50 bg-zinc-600/10";
  }
};

const getTierActiveColor = (tier: string) => {
  switch (tier) {
    case "WHALE": return "bg-blue-500 shadow-[2px_2px_0px_0px_rgba(59,130,246,0.8)]";
    case "MEGA": return "bg-purple-500 shadow-[2px_2px_0px_0px_rgba(147,51,234,0.8)]";
    case "SUPER": return "bg-red-500 shadow-[2px_2px_0px_0px_rgba(239,68,68,0.8)]";
    case "GOD": return "bg-yellow-500 shadow-[2px_2px_0px_0px_rgba(251,191,36,0.8)]";
    default: return "bg-zinc-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]";
  }
};

export function UserPreferences() {
  const { preferences, setPreferences } = usePreferencesStore();
  const [isDragging, setIsDragging] = React.useState(false);

  // Convert linear slider position (0-100) to exponential value
  const positionToValue = (position: number): number => {
    const min = CONFIG.THRESHOLDS.MIN_VALUE;
    const max = 1000000;
    return Math.round(min * Math.pow(max / min, position / 100));
  };

  // Convert value back to slider position (0-100)
  const valueToPosition = (value: number): number => {
    const min = CONFIG.THRESHOLDS.MIN_VALUE;
    const max = 1000000;
    return Math.round(100 * Math.log(value / min) / Math.log(max / min));
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const handleSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const position = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const value = positionToValue(position);
    setPreferences({ minValueThreshold: value });
  };

  const handleSliderMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const position = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const value = positionToValue(position);
    setPreferences({ minValueThreshold: value });
  };

  const handleSliderMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse up handler to handle mouse release outside the slider
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const currentPosition = valueToPosition(preferences.minValueThreshold);

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
              <div className="text-xs text-zinc-600 font-mono">$15,000 - $50,000</div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${
              preferences.showMegaWhale
                ? 'border-purple-400 bg-purple-400'
                : 'border-purple-600/50'
            }`} />
          </div>
        </div>

        {/* SUPER_WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer ${
          preferences.showSuperWhale
            ? 'border-red-500 bg-red-950/20 shadow-[3px_3px_0px_0px_rgba(239,68,68,0.8)]'
            : 'border-red-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
        }`} onClick={() => setPreferences({ showSuperWhale: !preferences.showSuperWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-red-400">SUPER WHALE</div>
              <div className="text-xs text-zinc-600 font-mono">$50,000 - $100,000</div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${
              preferences.showSuperWhale
                ? 'border-red-400 bg-red-400'
                : 'border-red-600/50'
            }`} />
          </div>
        </div>

        {/* GOD_WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer ${
          preferences.showGodWhale
            ? 'border-yellow-500 bg-yellow-950/20 shadow-[3px_3px_0px_0px_rgba(251,191,36,0.8)]'
            : 'border-yellow-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
        }`} onClick={() => setPreferences({ showGodWhale: !preferences.showGodWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-yellow-400">GOD WHALE</div>
              <div className="text-xs text-zinc-600 font-mono">$100,000+</div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${
              preferences.showGodWhale
                ? 'border-yellow-400 bg-yellow-400'
                : 'border-yellow-600/50'
            }`} />
          </div>
        </div>
      </div>

      {/* Enhanced Minimum Value Filter */}
      <div className="space-y-4">
        <h2 className="text-lg font-mono font-semibold text-zinc-400">
          MINIMUM VALUE FILTER
        </h2>

        {/* Current Value Display */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-primary mb-1">
            {formatValue(preferences.minValueThreshold)}
          </div>
          <div className="text-xs text-zinc-600 font-mono">
            Minimum trade value to display
          </div>
        </div>

        {/* Volume-style Bar */}
        <div className="relative px-2">
          {/* Background segments - outlined/washed out */}
          <div
            className="relative h-6 bg-zinc-900 border border-zinc-700 rounded-full overflow-hidden mb-4 cursor-pointer"
            onMouseDown={handleSliderMouseDown}
            onMouseMove={handleSliderMouseMove}
            onMouseUp={handleSliderMouseUp}
          >
            {VALUE_LEVELS.map((level, index) => {
              const nextLevel = VALUE_LEVELS[index + 1];
              if (!nextLevel) return null;

              const startPercent = (index / (VALUE_LEVELS.length - 1)) * 100;
              const endPercent = ((index + 1) / (VALUE_LEVELS.length - 1)) * 100;
              const width = endPercent - startPercent;

              return (
                <div
                  key={level.value}
                  className={`absolute top-0 h-full border-r border-zinc-600/50 transition-all duration-300 ${getTierColor(level.tier)}`}
                  style={{
                    left: `${startPercent}%`,
                    width: `${width}%`,
                  }}
                />
              );
            })}

            {/* Active fill - bright solid colors with shadow */}
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 overflow-hidden"
              style={{ width: `${currentPosition}%` }}
            >
              {VALUE_LEVELS.map((level, index) => {
                const nextLevel = VALUE_LEVELS[index + 1];
                if (!nextLevel) return null;

                const startPercent = (index / (VALUE_LEVELS.length - 1)) * 100;
                const endPercent = ((index + 1) / (VALUE_LEVELS.length - 1)) * 100;

                // Only show if this segment is within the active area
                const segmentStart = startPercent;
                const segmentEnd = endPercent;
                const activeStart = 0;
                const activeEnd = currentPosition;

                if (segmentEnd <= activeStart || segmentStart >= activeEnd) return null;

                // Calculate relative position within the active fill container
                const visibleStart = Math.max(segmentStart, activeStart);
                const visibleEnd = Math.min(segmentEnd, activeEnd);
                const visibleWidth = visibleEnd - visibleStart;

                // Convert to relative positioning within the active fill (0 to currentPosition)
                const relativeStart = ((visibleStart - activeStart) / (activeEnd - activeStart)) * 100;
                const relativeWidth = (visibleWidth / (activeEnd - activeStart)) * 100;

                return (
                  <div
                    key={`active-${level.value}`}
                    className={`absolute top-0 h-full transition-all duration-300 ${getTierActiveColor(level.tier)}`}
                    style={{
                      left: `${relativeStart}%`,
                      width: `${relativeWidth}%`,
                    }}
                  />
                );
              })}
            </div>

            {/* Slider handle indicator */}
            <div
              className="absolute top-1/2 transform -translate-y-1/2 w-1 h-4 bg-zinc-200 rounded-full shadow-lg transition-all duration-300 z-10"
              style={{ left: `${currentPosition}%` }}
            />
          </div>

          {/* Level markers */}
          <div className="flex justify-between text-xs text-zinc-600 font-mono">
            {VALUE_LEVELS.filter((_, index) => index % 2 === 0).map((level) => (
              <span key={level.value} className="text-center">
                {level.label}
              </span>
            ))}
          </div>
        </div>

        {/* Tier indicator */}
        <div className="text-center">
          <div className="inline-flex items-center px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-full">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              preferences.minValueThreshold >= CONFIG.THRESHOLDS.GOD_WHALE ? 'bg-yellow-400' :
              preferences.minValueThreshold >= CONFIG.THRESHOLDS.SUPER_WHALE ? 'bg-red-400' :
              preferences.minValueThreshold >= CONFIG.THRESHOLDS.MEGA_WHALE ? 'bg-purple-400' :
              preferences.minValueThreshold >= CONFIG.THRESHOLDS.WHALE ? 'bg-blue-400' :
              'bg-zinc-400'
            }`} />
            <span className="text-xs font-mono text-zinc-400">
              {preferences.minValueThreshold >= CONFIG.THRESHOLDS.GOD_WHALE ? 'GOD WHALE +' :
               preferences.minValueThreshold >= CONFIG.THRESHOLDS.SUPER_WHALE ? 'SUPER WHALE +' :
               preferences.minValueThreshold >= CONFIG.THRESHOLDS.MEGA_WHALE ? 'MEGA WHALE +' :
               preferences.minValueThreshold >= CONFIG.THRESHOLDS.WHALE ? 'WHALE +' :
               'ALL TRADES'}
            </span>
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
