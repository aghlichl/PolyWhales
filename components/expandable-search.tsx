"use client";

import { Search, X, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export interface ExpandableSearchProps {
    query: string;
    onQueryChange: (query: string) => void;
    onClear: () => void;
    placeholder?: string;
    renderFilters?: () => React.ReactNode;
    hasActiveFilters?: boolean;
    className?: string;
}

export function ExpandableSearch({
    query,
    onQueryChange,
    onClear,
    placeholder = "Search...",
    renderFilters,
    hasActiveFilters = false,
    className,
}: ExpandableSearchProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    // Handle escape key to collapse
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isExpanded) {
                setIsExpanded(false);
                setIsFilterOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isExpanded]);

    // Handle click outside to collapse (optional)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                isExpanded &&
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsExpanded(false);
                setIsFilterOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isExpanded]);

    const handleExpand = () => {
        setIsExpanded(true);
    };

    const handleClear = () => {
        onClear();
        setIsFilterOpen(false);
    };

    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onQueryChange(e.target.value);
    };

    // Prevent form submission on Enter
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
        }
    };

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <AnimatePresence mode="wait">
                {!isExpanded ? (
                    // Collapsed state: just the search icon
                    <motion.button
                        key="collapsed"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        onClick={handleExpand}
                        className={cn(
                            "relative p-2 rounded-lg transition-all duration-200",
                            "bg-surface-1/20 backdrop-blur-sm border border-white/5",
                            "hover:bg-surface-1/40 hover:border-white/10",
                            "text-zinc-500 hover:text-zinc-300"
                        )}
                        aria-label="Search"
                    >
                        <Search size={16} />
                        {(query || hasActiveFilters) && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-black" />
                        )}
                    </motion.button>
                ) : (
                    // Expanded state: full search bar
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex flex-col gap-2"
                    >
                        {/* Search input bar */}
                        <div
                            className={cn(
                                "relative flex items-center min-w-[240px]",
                                "bg-surface-1/40 backdrop-blur-md",
                                "border border-white/5",
                                "rounded-xl",
                                "transition-colors duration-200",
                                "focus-within:bg-surface-1/60 focus-within:border-white/10",
                                "shadow-lg"
                            )}
                        >
                            {/* Search Icon */}
                            <div className="pl-3 text-zinc-500 group-focus-within:text-zinc-300 transition-colors">
                                <Search size={14} />
                            </div>

                            {/* Input */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={handleQueryChange}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                className={cn(
                                    "flex-1 bg-transparent border-none outline-none",
                                    "text-xs font-medium tracking-wide text-zinc-300 placeholder-zinc-600",
                                    "py-2 px-2 uppercase"
                                )}
                                spellCheck={false}
                            />

                            {/* Right Actions */}
                            <div className="flex items-center gap-1 pr-2">
                                {/* Clear Button */}
                                <AnimatePresence>
                                    {(query || hasActiveFilters) && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            onClick={handleClear}
                                            className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded"
                                            aria-label="Clear search"
                                        >
                                            <X size={12} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>

                                {/* Filter Toggle (only if renderFilters provided) */}
                                {renderFilters && (
                                    <button
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-all duration-200",
                                            isFilterOpen || hasActiveFilters
                                                ? "text-sky-400 bg-sky-500/10"
                                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                        )}
                                        aria-label="Filters"
                                    >
                                        <ListFilter size={14} />
                                        {hasActiveFilters && !isFilterOpen && (
                                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-sky-500" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Panel */}
                        {renderFilters && (
                            <AnimatePresence>
                                {isFilterOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div
                                            className={cn(
                                                "bg-surface-1/40 backdrop-blur-md",
                                                "border border-white/5",
                                                "rounded-xl p-3"
                                            )}
                                        >
                                            {renderFilters()}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
