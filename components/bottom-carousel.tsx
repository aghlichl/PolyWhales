"use client";

import { Zap, Activity, BarChart3, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface BottomCarouselProps {
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function BottomCarousel({ currentPage, onPageChange }: BottomCarouselProps) {
  const pages = [
    { icon: Zap, label: "AI Insights", id: "ai" },
    { icon: Activity, label: "Live Feed", id: "feed" },
    { icon: TrendingUp, label: "Top Traders", id: "traders" },
    { icon: BarChart3, label: "Top Whales", id: "whales" }
  ];

  return (
    <div className="w-full">
      {/* Glass Container */}
      <div className="relative w-full border-t border-white/5 bg-black/80 backdrop-blur-xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
        {/* Top Shine Line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="grid grid-cols-4 w-full relative z-10">
          {pages.map((page, index) => {
            const Icon = page.icon;
            const isActive = index === currentPage;

            return (
              <button
                key={page.id}
                onClick={() => onPageChange(index)}
                className="relative group flex flex-col items-center justify-center pt-3 pb-3 min-h-[72px] cursor-pointer"
              >
                {/* Active Background Pill (Animated) */}
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-x-2 inset-y-2 bg-white/5 rounded-2xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30
                    }}
                  />
                )}

                {/* Active Glow/Lamp Effect */}
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-glow"
                    className="absolute top-0 w-12 h-[1px] bg-primary/50 blur-[2px]"
                    transition={{ duration: 0.2 }}
                  />
                )}

                {/* Icon Wrapper */}
                <div className="relative z-10 flex flex-col items-center gap-1.5">
                  <div className={cn(
                    "relative transition-all duration-300",
                    isActive ? "scale-110" : "group-active:scale-95"
                  )}>
                    <Icon
                      className={cn(
                        "w-6 h-6 transition-colors duration-300",
                        isActive
                          ? "text-zinc-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                          : "text-zinc-500 group-hover:text-zinc-300",
                        // Special pulse for Live Feed
                        page.id === "feed" && !isActive && "text-emerald-500/70",
                        page.id === "feed" && isActive && "animate-pulse text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </div>

                  <span className={cn(
                    "text-[10px] font-medium tracking-wide transition-colors duration-300",
                    isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-400"
                  )}>
                    {page.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
