"use client";

import { Zap, Activity, BarChart3, TrendingUp } from "lucide-react";

interface BottomCarouselProps {
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function BottomCarousel({ currentPage, onPageChange }: BottomCarouselProps) {
  const goToPage = (pageIndex: number) => {
    onPageChange(pageIndex);
  };

  const pages = [
    { icon: Zap, label: "AI Insights" },
    { icon: Activity, label: "Live Feed" },
    { icon: TrendingUp, label: "Top Traders" },
    { icon: BarChart3, label: "Top Whales" }
  ];

  return (
    <div className="grid grid-cols-4 w-full border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      {pages.map((page, index) => {
        const Icon = page.icon;
        const isActive = index === currentPage;
        const isLast = index === pages.length - 1;

        return (
          <button
            key={index}
            onClick={() => goToPage(index)}
            className={`
              group relative flex items-center justify-center h-12 border-r border-zinc-800 transition-all duration-300
              ${isActive
                ? "bg-primary/30 border-primary/40"
                : "bg-transparent hover:bg-zinc-800/50"
              }
              ${isLast ? "border-r-0" : ""}
            `}
            aria-label={`Go to ${page.label}`}
          >
            {/* Active glow effect */}
            {isActive && (
              <div className="absolute inset-0 bg-primary/10" />
            )}

            {/* Icon with conditional pulsing */}
            <Icon
              className={`w-5 h-5 relative z-10 transition-all duration-300 ${isActive ? "text-primary" : "text-zinc-400 group-hover:text-zinc-200"
                } ${index === 1 && isActive ? "animate-pulse" : ""}`}
            />
          </button>
        );
      })}
    </div>
  );
}

