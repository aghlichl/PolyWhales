"use client";

import React from "react";
import { usePreferencesStore } from "@/lib/store";
import { usePrivy } from "@privy-io/react-auth";
import { CONFIG } from "@/lib/config";
import { NumericDisplay } from "@/components/ui/numeric-display";
import { DiscordPromoModal } from "@/components/discord-promo-modal";

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
    <div className="w-full space-y-6">

      {/* Discord Join Button */}
      <div className="space-y-4">
        <DiscordJoinButton />
      </div>

      {/* Anomaly Type Filters */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-400">
          CARD FILTERS
        </h2>
        {/* STANDARD Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer rounded-xl ${preferences.showStandard
          ? 'border-zinc-500 bg-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]'
          : 'border-zinc-700 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
          }`} onClick={() => setPreferences({ showStandard: !preferences.showStandard })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-zinc-400">COMMON</div>
              <div className="text-xs text-zinc-600">
                <NumericDisplay value="$0 - $8,000" size="xs" />
              </div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${preferences.showStandard
              ? 'border-zinc-400 bg-zinc-400'
              : 'border-zinc-600'
              }`} />
          </div>
        </div>

        {/* WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer rounded-xl ${preferences.showWhale
          ? 'border-blue-500 bg-blue-950/20 shadow-[3px_3px_0px_0px_rgba(59,130,246,0.8)]'
          : 'border-blue-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
          }`} onClick={() => setPreferences({ showWhale: !preferences.showWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-blue-400">UNCOMMON</div>
              <div className="text-xs text-zinc-600">
                <NumericDisplay value="$8,000 - $15,000" size="xs" />
              </div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${preferences.showWhale
              ? 'border-blue-400 bg-blue-400'
              : 'border-blue-600/50'
              }`} />
          </div>
        </div>

        {/* MEGA_WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer rounded-xl ${preferences.showMegaWhale
          ? 'border-purple-500 bg-purple-950/20 shadow-[3px_3px_0px_0px_rgba(147,51,234,0.8)]'
          : 'border-purple-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
          }`} onClick={() => setPreferences({ showMegaWhale: !preferences.showMegaWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-purple-400">RARE</div>
              <div className="text-xs text-zinc-600">
                <NumericDisplay value="$15,000 - $50,000" size="xs" />
              </div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${preferences.showMegaWhale
              ? 'border-purple-400 bg-purple-400'
              : 'border-purple-600/50'
              }`} />
          </div>
        </div>

        {/* SUPER_WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer rounded-xl ${preferences.showSuperWhale
          ? 'border-red-500 bg-red-950/20 shadow-[3px_3px_0px_0px_rgba(239,68,68,0.8)]'
          : 'border-red-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
          }`} onClick={() => setPreferences({ showSuperWhale: !preferences.showSuperWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-red-400">SUPER RARE</div>
              <div className="text-xs text-zinc-600">
                <NumericDisplay value="$50,000 - $100,000" size="xs" />
              </div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${preferences.showSuperWhale
              ? 'border-red-400 bg-red-400'
              : 'border-red-600/50'
              }`} />
          </div>
        </div>

        {/* GOD_WHALE Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer rounded-xl ${preferences.showGodWhale
          ? 'border-yellow-500 bg-yellow-950/20 shadow-[3px_3px_0px_0px_rgba(251,191,36,0.8)]'
          : 'border-yellow-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
          }`} onClick={() => setPreferences({ showGodWhale: !preferences.showGodWhale })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-yellow-400">LEGENDARY</div>
              <div className="text-xs text-zinc-600">
                <NumericDisplay value="$100,000+" size="xs" />
              </div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${preferences.showGodWhale
              ? 'border-yellow-400 bg-yellow-400'
              : 'border-yellow-600/50'
              }`} />
          </div>
        </div>
      </div>

      {/* Content Filter */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-400">
          CONTENT FILTERS
        </h2>

        {/* SPORTS Card */}
        <div className={`relative p-4 border-2 transition-all duration-200 cursor-pointer rounded-xl ${preferences.showSports
          ? 'border-green-500 bg-green-950/20 shadow-[3px_3px_0px_0px_rgba(34,197,94,0.8)]'
          : 'border-green-700/50 bg-zinc-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] opacity-60'
          }`} onClick={() => setPreferences({ showSports: !preferences.showSports })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-green-400">SPORTS</div>
              <div className="text-xs text-zinc-600">Events with &quot;vs.&quot; in title</div>
            </div>
            <div className={`w-4 h-4 border-2 transition-all duration-200 ${preferences.showSports
              ? 'border-green-400 bg-green-400'
              : 'border-green-600/50'
              }`} />
          </div>
        </div>
      </div>

      {/* Enhanced Minimum Value Filter */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-400">
          MINIMUM VALUE FILTER
        </h2>

        {/* Current Value Display */}
        <div className="text-center">
          <div className="text-3xl font-bold text-primary mb-1">
            <NumericDisplay
              value={formatValue(preferences.minValueThreshold)}
              size="3xl"
              variant="bold"
            />
          </div>
          <div className="text-xs text-zinc-600">
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
          <div className="flex justify-between text-xs text-zinc-600">
            {VALUE_LEVELS.filter((_, index) => index % 2 === 0).map((level) => (
              <span key={level.value} className="text-center">
                <NumericDisplay value={level.label} size="xs" />
              </span>
            ))}
          </div>
        </div>

        {/* Tier indicator */}
        <div className="text-center">
          <div className="inline-flex items-center px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-full">
            <div className={`w-2 h-2 rounded-full mr-2 ${preferences.minValueThreshold >= CONFIG.THRESHOLDS.GOD_WHALE ? 'bg-yellow-400' :
              preferences.minValueThreshold >= CONFIG.THRESHOLDS.SUPER_WHALE ? 'bg-red-400' :
                preferences.minValueThreshold >= CONFIG.THRESHOLDS.MEGA_WHALE ? 'bg-purple-400' :
                  preferences.minValueThreshold >= CONFIG.THRESHOLDS.WHALE ? 'bg-blue-400' :
                    'bg-zinc-400'
              }`} />
            <span className="text-xs text-zinc-400">
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
        <p className="text-xs text-zinc-700">
          Preferences saved automatically
        </p>
      </div>
    </div>
  );
}

function DiscordJoinButton() {
  const { user, login } = usePrivy();
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleClick = () => {
    if (!user) {
      login();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full group relative"
      >
        <div className="absolute inset-0 bg-[#5865F2] rounded-xl blur opacity-10 group-hover:opacity-25 transition-opacity duration-500" />
        <div className="relative flex items-center justify-between p-4 border-2 border-[#5865F2] bg-[#5865F2]/10 rounded-xl shadow-[3px_3px_0px_0px_rgba(88,101,242,0.8)] hover:translate-y-px hover:shadow-[2px_2px_0px_0px_rgba(88,101,242,0.8)] active:translate-y-[3px] active:shadow-none transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#5865F2] flex items-center justify-center text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="font-bold text-[#5865F2] text-lg">JOIN DISCORD</div>
              <div className="text-xs text-zinc-400">Get live alerts & AI analytics</div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-[#5865F2]/50 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#5865F2]">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>

      <DiscordPromoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
