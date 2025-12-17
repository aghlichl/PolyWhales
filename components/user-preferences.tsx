"use client";

import React, { useRef, useEffect, useState } from "react";
import { usePreferencesStore } from "@/lib/store";
import { usePrivy } from "@privy-io/react-auth";
import { CONFIG } from "@/lib/config";
import { NumericDisplay } from "@/components/ui/numeric-display";
import { DiscordPromoModal } from "@/components/discord-promo-modal";
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, Info, ChevronRight, Sliders, Shield, Wallet, Trophy, Activity, Filter, DollarSign, Zap } from "lucide-react";

// Types & Helpers
const VALUE_LEVELS = [
  { value: 1000, label: "$1K", tier: "MIN" },
  { value: 5000, label: "$5K", tier: "MIN" },
  { value: 10000, label: "$10K", tier: "WHALE" },
  { value: 25000, label: "$25K", tier: "MEGA" },
  { value: 50000, label: "$50K", tier: "SUPER" },
  { value: 100000, label: "$100K", tier: "GOD" },
  { value: 500000, label: "$500K", tier: "GOD" },
  { value: 1000000, label: "$1M", tier: "GOD" },
];

export function UserPreferences() {
  const { preferences, setPreferences } = usePreferencesStore();

  return (
    <div className="space-y-12">
      {/* Top Section: Discord & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DiscordJoinContext />
        <StatusCard />
      </div>

      {/* Minimum Value Slider */}
      <div className="space-y-6">
        <SectionHeader
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          title="Minimum Value"
          subtitle="FILTER THRESHOLD"
        />
        <CyberValueSlider
          value={preferences.minValueThreshold}
          onChange={(val) => setPreferences({ minValueThreshold: val })}
        />
      </div>

      {/* Toggles Grid */}
      <div className="space-y-6">
        <SectionHeader
          icon={<Filter className="w-4 h-4 text-purple-400" />}
          title="Anomaly Tiers"
          subtitle="CONFIGURE CARD RARITY"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PowerUpCard
            label="Standard"
            sublabel="$0 - $8K"
            active={preferences.showStandard}
            onClick={() => setPreferences({ showStandard: !preferences.showStandard })}
            colorTheme="zinc"
            tierLevel={1}
          />
          <PowerUpCard
            label="Whale"
            sublabel="$8K - $15K"
            active={preferences.showWhale}
            onClick={() => setPreferences({ showWhale: !preferences.showWhale })}
            colorTheme="blue"
            tierLevel={2}
          />
          <PowerUpCard
            label="Mega Whale"
            sublabel="$15K - $50K"
            active={preferences.showMegaWhale}
            onClick={() => setPreferences({ showMegaWhale: !preferences.showMegaWhale })}
            colorTheme="purple"
            tierLevel={3}
          />
          <PowerUpCard
            label="Super Whale"
            sublabel="$50K - $100K"
            active={preferences.showSuperWhale}
            onClick={() => setPreferences({ showSuperWhale: !preferences.showSuperWhale })}
            colorTheme="red"
            tierLevel={4}
          />
          <PowerUpCard
            label="God Whale"
            sublabel="$100K+"
            active={preferences.showGodWhale}
            onClick={() => setPreferences({ showGodWhale: !preferences.showGodWhale })}
            colorTheme="yellow"
            isWide
            tierLevel={5}
          />
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Content Filters */}
      <div className="space-y-6">
        <SectionHeader
          icon={<Sliders className="w-4 h-4 text-cyan-400" />}
          title="Content Filters"
          subtitle="REFINE FEED DATA"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PowerUpCard
            label="Sports Only"
            sublabel="Show only sports events"
            active={preferences.showSports}
            onClick={() => setPreferences({ showSports: !preferences.showSports })}
            colorTheme="green"
            icon={<Trophy className="w-4 h-4" />}
          />
          <PowerUpCard
            label="Top Players"
            sublabel="Only top 20 wallets"
            active={preferences.filterTopPlayersOnly}
            onClick={() => setPreferences({ filterTopPlayersOnly: !preferences.filterTopPlayersOnly })}
            colorTheme="cyan"
            icon={<Activity className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Odds Slider */}
      <div className="space-y-6">
        <SectionHeader
          icon={<Activity className="w-4 h-4 text-orange-400" />}
          title="Odds Range"
          subtitle="PROBABILITY FILTER"
        />
        <CyberOddsSlider
          min={preferences.minOdds}
          max={preferences.maxOdds}
          onChange={(min, max) => setPreferences({ minOdds: min, maxOdds: max })}
        />
      </div>
    </div>
  );
}

// --- High-Fidelity Components ---

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode, title: string, subtitle: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-white/5 border border-white/10 shadow-[inner_0_1px_0_rgba(255,255,255,0.05)]">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-100 tracking-tight">{title}</h3>
          <p className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">{subtitle}</p>
        </div>
      </div>
      {/* Decorative Tech Elements */}
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-zinc-800 rounded-full" />
        <div className="w-1 h-1 bg-zinc-800 rounded-full" />
        <div className="w-1 h-1 bg-zinc-800 rounded-full" />
      </div>
    </div>
  );
}

function PowerUpCard({ label, sublabel, active, onClick, colorTheme, isWide, icon, tierLevel }: any) {
  const getThemeStyles = () => {
    switch (colorTheme) {
      case "blue": return {
        border: "border-blue-500/50",
        bg: "bg-blue-500/10",
        glow: "shadow-[0_0_30px_-5px_rgba(59,130,246,0.4),inset_0_0_20px_rgba(59,130,246,0.2)]",
        text: "text-blue-200",
        indicator: "bg-blue-500",
        subtext: "text-blue-400/60"
      };
      case "purple": return {
        border: "border-purple-500/50",
        bg: "bg-purple-500/10",
        glow: "shadow-[0_0_30px_-5px_rgba(168,85,247,0.4),inset_0_0_20px_rgba(168,85,247,0.2)]",
        text: "text-purple-200",
        indicator: "bg-purple-500",
        subtext: "text-purple-400/60"
      };
      case "red": return {
        border: "border-red-500/50",
        bg: "bg-red-500/10",
        glow: "shadow-[0_0_30px_-5px_rgba(239,68,68,0.4),inset_0_0_20px_rgba(239,68,68,0.2)]",
        text: "text-red-200",
        indicator: "bg-red-500",
        subtext: "text-red-400/60"
      };
      case "yellow": return {
        border: "border-yellow-500/50",
        bg: "bg-yellow-500/10",
        glow: "shadow-[0_0_30px_-5px_rgba(234,179,8,0.4),inset_0_0_20px_rgba(234,179,8,0.2)]",
        text: "text-yellow-200",
        indicator: "bg-yellow-500",
        subtext: "text-yellow-400/60"
      };
      case "green": return {
        border: "border-emerald-500/50",
        bg: "bg-emerald-500/10",
        glow: "shadow-[0_0_30px_-5px_rgba(16,185,129,0.4),inset_0_0_20px_rgba(16,185,129,0.2)]",
        text: "text-emerald-200",
        indicator: "bg-emerald-500",
        subtext: "text-emerald-400/60"
      };
      case "cyan": return {
        border: "border-cyan-500/50",
        bg: "bg-cyan-500/10",
        glow: "shadow-[0_0_30px_-5px_rgba(6,182,212,0.4),inset_0_0_20px_rgba(6,182,212,0.2)]",
        text: "text-cyan-200",
        indicator: "bg-cyan-500",
        subtext: "text-cyan-400/60"
      };
      default: return { // Zinc
        border: "border-zinc-500/50",
        bg: "bg-zinc-500/10",
        glow: "shadow-[0_0_30px_-5px_rgba(113,113,122,0.4),inset_0_0_20px_rgba(113,113,122,0.2)]",
        text: "text-zinc-200",
        indicator: "bg-zinc-500",
        subtext: "text-zinc-400/60"
      };
    }
  };

  const styles = getThemeStyles();

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative group overflow-hidden rounded-xl border transition-all duration-300 isolate",
        active ? `${styles.border} ${styles.bg} ${styles.glow}` : "border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60",
        isWide ? "sm:col-span-2" : ""
      )}
    >
      {/* Background Tech Pattern (Scratches/Grid) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
      />
      {active && <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-20" />}

      <div className="relative p-5 flex items-center justify-between">
        <div className="text-left">
          <div className="flex items-center gap-2 mb-1.5">
            {/* Tier Level Dots */}
            {tierLevel && (
              <div className="flex gap-0.5 mr-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={cn(
                    "w-0.5 h-1.5 rounded-full transition-colors",
                    i < tierLevel
                      ? active ? styles.indicator : "bg-zinc-700"
                      : "bg-zinc-800"
                  )} />
                ))}
              </div>
            )}
            <span className={cn(
              "text-sm font-bold uppercase tracking-wide transition-colors",
              active ? styles.text : "text-zinc-400 group-hover:text-zinc-300"
            )}>
              {icon && <span className="inline-block mr-2 align-bottom">{icon}</span>}
              {label}
            </span>
          </div>
          <div className={cn(
            "text-[10px] font-mono transition-colors",
            active ? styles.subtext : "text-zinc-600"
          )}>
            {sublabel}
          </div>
        </div>

        {/* Power Switch Visual */}
        <div className={cn(
          "w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-300 relative",
          active ? `${styles.border} ${styles.indicator} text-surface-2 shadow-[0_0_10px_currentColor]` : "border-zinc-700 bg-surface-1/50"
        )}>
          {active && <Zap className="w-3.5 h-3.5 fill-current" />}
          {/* Glow Ring */}
          {active && <div className={cn("absolute inset-0 rounded-md animate-ping opacity-20", styles.indicator)} />}
        </div>
      </div>

      {/* Bottom Accent Bar */}
      {active && (
        <div className={cn("absolute bottom-0 left-0 right-0 h-0.5", styles.indicator, "shadow-[0_0_10px_currentColor]")} />
      )}
    </motion.button>
  );
}

function CyberValueSlider({ value, onChange }: { value: number, onChange: (val: number) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const minVal = CONFIG.THRESHOLDS.MIN_VALUE;
  const maxVal = 1000000;

  // Log scale helpers
  const valueToPercent = (val: number) => {
    const logMin = Math.log(minVal);
    const logMax = Math.log(maxVal);
    const logVal = Math.log(Math.max(val, minVal));
    return Math.max(0, Math.min(100, ((logVal - logMin) / (logMax - logMin)) * 100));
  };

  const percentToValue = (pct: number) => {
    const logMin = Math.log(minVal);
    const logMax = Math.log(maxVal);
    const logVal = logMin + (pct / 100) * (logMax - logMin);
    return Math.round(Math.exp(logVal));
  };

  const handleInteraction = (e: any) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    onChange(percentToValue(pct));
  };

  const percent = valueToPercent(value);

  // Dynamic Color shifting based on value
  let activeColor = "bg-zinc-400 shadow-[0_0_15px_rgba(161,161,170,0.5)]";
  let activeBorder = "border-zinc-400";
  let activeText = "text-zinc-400";

  if (value >= 100000) { activeColor = "bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]"; activeBorder = "border-yellow-400"; activeText = "text-yellow-400"; }
  else if (value >= 50000) { activeColor = "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]"; activeBorder = "border-red-500"; activeText = "text-red-500"; }
  else if (value >= 15000) { activeColor = "bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.6)]"; activeBorder = "border-purple-500"; activeText = "text-purple-500"; }
  else if (value >= 8000) { activeColor = "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]"; activeBorder = "border-blue-500"; activeText = "text-blue-500"; }

  const formatDisplay = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  }

  return (
    <div className="pt-8 pb-4 px-1">
      <div className="relative mb-8 text-center">
        <div className={cn(
          "text-4xl font-black tracking-tighter tabular-nums transition-colors duration-300",
          activeText
        )}>
          {formatDisplay(value)}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
          Minimum Threshold
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-10 w-full cursor-pointer group select-none touch-none"
        onMouseDown={(e) => { setIsDragging(true); handleInteraction(e); }}
        onMouseMove={(e) => { if (isDragging) handleInteraction(e); }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={(e) => { setIsDragging(true); handleInteraction(e); }}
        onTouchMove={(e) => { if (isDragging) handleInteraction(e); }}
        onTouchEnd={() => setIsDragging(false)}
      >
        {/* Track Background (Ruler) */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
          {/* Tick marks pattern */}
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '4% 100%' }}
          />
        </div>

        {/* Active Fill (Neon Tube) */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 left-0 h-1.5 rounded-l-full transition-all duration-75",
            activeColor
          )}
          style={{ width: `${percent}%` }}
        />

        {/* Thumb (Tactical Slider) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 group-active:scale-110 transition-transform duration-200"
          style={{ left: `${percent}%` }}
        >
          <div className={cn(
            "w-5 h-8 rounded-[4px] bg-zinc-950 border-2 shadow-xl flex items-center justify-center",
            activeBorder
          )}>
            <div className={cn("w-1 h-3 rounded-full", activeColor)} />
          </div>
          {/* Glow flare under thumb */}
          <div className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full blur-md opacity-50 -z-10",
            activeColor.split(' ')[0]
          )} />
        </div>
      </div>
      <div className="flex justify-between -mt-2 text-[10px] font-mono text-zinc-600 font-bold">
        <span>$0</span>
        <span>$1M+</span>
      </div>
    </div>
  );
}

function CyberOddsSlider({ min, max, onChange }: { min: number, max: number, onChange: (min: number, max: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  const handleInteraction = (e: any, type: 'min' | 'max') => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    let val = Math.round(1 + (pct / 100) * 98); // 1 to 99

    if (type === 'min') {
      val = Math.min(val, max - 1);
      onChange(val, max);
    } else {
      val = Math.max(val, min + 1);
      onChange(min, val);
    }
  };

  const minPct = ((min - 1) / 98) * 100;
  const maxPct = ((max - 1) / 98) * 100;

  return (
    <div className="pt-6 pb-2 px-1">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-2xl font-black text-orange-400 tabular-nums">{min}¢</div>
          <div className="text-[9px] font-mono text-zinc-600 uppercase">MIN PROB</div>
        </div>
        <div className="h-px bg-zinc-800 flex-1 mx-4 mb-2" />
        <div className="text-right">
          <div className="text-2xl font-black text-orange-400 tabular-nums">{max}¢</div>
          <div className="text-[9px] font-mono text-zinc-600 uppercase">MAX PROB</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-10 w-full cursor-pointer touch-none"
        onMouseMove={(e) => { if (dragging) handleInteraction(e, dragging); }}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
        onTouchMove={(e) => { if (dragging) handleInteraction(e, dragging); }}
        onTouchEnd={() => setDragging(null)}
      >
        {/* Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-zinc-900 border border-white/5 rounded-full" />

        {/* Active Range */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />

        {/* Min Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          style={{ left: `${minPct}%` }}
          onMouseDown={() => setDragging('min')}
          onTouchStart={() => setDragging('min')}
        >
          <div className="w-5 h-5 bg-zinc-950 border-2 border-orange-500 rounded-full shadow-lg flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
          </div>
        </div>

        {/* Max Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          style={{ left: `${maxPct}%` }}
          onMouseDown={() => setDragging('max')}
          onTouchStart={() => setDragging('max')}
        >
          <div className="w-5 h-5 bg-zinc-950 border-2 border-orange-500 rounded-full shadow-lg flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex justify-between -mt-2 text-[10px] font-mono text-zinc-600 font-bold">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function StatusCard() {
  return (
    <div className="p-0.5 rounded-xl bg-gradient-to-br from-white/10 to-white/5 relative group overflow-hidden">
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative h-full bg-surface-1/80 backdrop-blur-sm rounded-[10px] p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
            <Wallet className="w-3 h-3" />
            Status
          </div>
          <div className="text-zinc-200 font-bold text-lg">Free Plan</div>
        </div>
        <div className="px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-black tracking-widest border border-emerald-500/20 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]">
          ACTIVE
        </div>
      </div>
    </div>
  )
}

function DiscordJoinContext() {
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
        className="w-full h-full min-h-[80px] group relative overflow-hidden rounded-xl bg-[#5865F2] hover:bg-[#4752c4] transition-all duration-300 p-0.5 shadow-[0_0_30px_-5px_rgba(88,101,242,0.3)] hover:shadow-[0_0_40px_-5px_rgba(88,101,242,0.5)] hover:-translate-y-0.5"
      >
        <div className="relative h-full w-full bg-[#5865F2] rounded-[10px] overflow-hidden p-4 text-left">
          <div className="absolute top-0 right-0 p-2 opacity-20 transform rotate-12 scale-150 group-hover:scale-125 transition-transform duration-500">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 text-white/90 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Shield className="w-3 h-3" />
              Community
            </div>
            <div>
              <div className="text-white font-bold text-xl leading-none mb-1">Join Discord</div>
              <div className="text-white/70 text-xs">Unlock Pro Features</div>
            </div>
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
