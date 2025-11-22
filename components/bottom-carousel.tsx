"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface BottomCarouselProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function BottomCarousel({ currentPage, totalPages, onPageChange }: BottomCarouselProps) {
  const goToPrevious = () => {
    const newPage = currentPage === 0 ? totalPages - 1 : currentPage - 1;
    onPageChange(newPage);
  };

  const goToNext = () => {
    const newPage = currentPage === totalPages - 1 ? 0 : currentPage + 1;
    onPageChange(newPage);
  };

  const goToPage = (pageIndex: number) => {
    onPageChange(pageIndex);
  };

  return (
    <div className="flex items-center justify-center gap-5">
      {/* Left Arrow */}
      <button
        onClick={goToPrevious}
        className="group relative p-1.5 border-2 border-zinc-600 bg-zinc-900 hover:border-primary hover:bg-zinc-800 transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.8)] hover:translate-x-0.5 hover:translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors duration-200" />
      </button>

      {/* Page Indicators */}
      <div className="flex gap-2.5">
        {Array.from({ length: totalPages }, (_, index) => (
          <button
            key={index}
            onClick={() => goToPage(index)}
            className={`relative transition-all duration-300 ${
              index === currentPage
                ? "w-3.5 h-3.5 bg-primary border-2 border-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,0.9)]"
                : "w-3 h-3 bg-zinc-700 border-2 border-zinc-600 hover:border-zinc-500 hover:bg-zinc-600 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,0.6)] hover:shadow-[0.5px_0.5px_0px_0px_rgba(0,0,0,0.6)] hover:translate-x-0.5 hover:translate-y-0.5"
            }`}
            aria-label={`Go to page ${index + 1}`}
          />
        ))}
      </div>

      {/* Right Arrow */}
      <button
        onClick={goToNext}
        className="group relative p-1.5 border-2 border-zinc-600 bg-zinc-900 hover:border-primary hover:bg-zinc-800 transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.8)] hover:translate-x-0.5 hover:translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors duration-200" />
      </button>
    </div>
  );
}
