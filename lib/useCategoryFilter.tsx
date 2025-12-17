"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { isSportsAnomaly } from "@/lib/utils";
import { isLeagueCategory, categoryToLeague, type Category, type LeagueCategory, type SubPage, type DesktopPage } from "@/components/sidebar-navigation";
import { anomalyMatchesLeague } from "@/lib/leagueFilter";
import type { League } from "@/lib/teamMeta";

// Re-export types for convenience
export type { Category, LeagueCategory, SubPage, DesktopPage };
export { isLeagueCategory, categoryToLeague };

interface CategoryContextType {
    activeCategory: Category;
    activePage: DesktopPage;
    setActivePage: (page: DesktopPage) => void;
    isSportsMode: boolean;
    isLeagueMode: boolean;
    activeLeague: League | null;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
    const [activePage, setActivePage] = useState<DesktopPage>("sports-live");

    const activeCategory = activePage.split("-")[0] as Category;
    const isSportsMode = activeCategory === "sports";
    const isLeagueMode = isLeagueCategory(activeCategory);
    const activeLeague = isLeagueMode ? categoryToLeague(activeCategory as LeagueCategory) : null;

    return (
        <CategoryContext.Provider value={{
            activeCategory,
            activePage,
            setActivePage,
            isSportsMode,
            isLeagueMode,
            activeLeague
        }}>
            {children}
        </CategoryContext.Provider>
    );
}

// Anomaly type shape for filtering
type FilterableItem = {
    event: string;
    sport?: string | null;
    league?: string | null;
    outcome?: string;
    analysis?: {
        market_context?: {
            sport?: string | null;
            league?: string | null;
        };
        event?: {
            title?: string;
        };
    } | null;
};

export function useCategoryFilter() {
    const context = useContext(CategoryContext);
    if (!context) {
        // Default to markets if used outside provider
        return {
            activeCategory: "markets" as Category,
            activePage: "markets-live" as DesktopPage,
            setActivePage: () => { },
            isSportsMode: false,
            isLeagueMode: false,
            activeLeague: null as League | null,
            filterByCategory: <T extends FilterableItem>(items: T[]): T[] => items
        };
    }

    // Generic filter function that can be used by any component
    const filterByCategory = useCallback(<T extends FilterableItem>(items: T[]): T[] => {
        // If a specific league is selected, filter by that league
        if (context.isLeagueMode && context.activeLeague) {
            return items.filter(item => anomalyMatchesLeague(item, context.activeLeague!));
        }

        // Otherwise use the existing sports/markets filter
        return items.filter(item => {
            const itemIsSports = isSportsAnomaly(item);
            return context.isSportsMode ? itemIsSports : !itemIsSports;
        });
    }, [context.isLeagueMode, context.activeLeague, context.isSportsMode]);

    return {
        ...context,
        filterByCategory
    };
}

// Re-export isSportsAnomaly for convenience
export { isSportsAnomaly };
