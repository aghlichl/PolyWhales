"use client";

import { useState, useEffect, useCallback, RefObject } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  /** Ref to the scrollable container. If not provided, looks for .scroll-container class */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** Scroll threshold in pixels before button appears (default: 400) */
  threshold?: number;
  /** Additional CSS classes */
  className?: string;
}

export function ScrollToTopButton({
  scrollContainerRef,
  threshold = 400,
  className,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);

  // Find scroll container on mount
  useEffect(() => {
    if (scrollContainerRef?.current) {
      setScrollContainer(scrollContainerRef.current);
    } else {
      // Fallback: find by class
      const container = document.querySelector('.scroll-container') as HTMLElement;
      setScrollContainer(container);
    }
  }, [scrollContainerRef]);

  // Handle scroll visibility
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsVisible(scrollContainer.scrollTop > threshold);
    };

    // Check initial state
    handleScroll();

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [scrollContainer, threshold]);

  const scrollToTop = useCallback(() => {
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
  }, [scrollContainer]);

  return (
    <div
      className={cn(
        "fixed left-1/2 transform -translate-x-1/2 z-60",
        "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]",
        "transition-all duration-300 ease-out",
        isVisible
          ? "opacity-100 animate-majestic-float"
          : "opacity-0 translate-y-4 pointer-events-none",
        className
      )}
    >
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={cn(
          "flex items-center justify-center w-10 h-10",
          // Neo-brutalist dark base
          "bg-zinc-950/95 backdrop-blur-xl rounded-xl",
          // Thin neon accent border
          "border border-primary/40",
          // Chunky shadow
          "shadow-[3px_3px_0px_0px_rgba(0,255,148,0.15)]",
          // Hover states - lift and intensify
          "hover:shadow-[4px_4px_0px_0px_rgba(0,255,148,0.25)]",
          "hover:-translate-y-0.5 hover:border-primary/60",
          // Active state - press down
          "active:shadow-[2px_2px_0px_0px_rgba(0,255,148,0.2)]",
          "active:translate-y-0",
          // Text/icon color
          "text-zinc-400 hover:text-primary/90",
          // Smooth transitions
          "transition-all duration-200"
        )}
      >
        <ChevronUp size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}

