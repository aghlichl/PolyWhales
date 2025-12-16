"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { isSportsAnomaly } from "@/lib/utils";

export type Category = "sports" | "markets";
export type SubPage = "live" | "charts";
export type DesktopPage = `${Category}-${SubPage}`;

interface CategoryContextType {
    activeCategory: Category;
    activePage: DesktopPage;
    setActivePage: (page: DesktopPage) => void;
    isSportsMode: boolean;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
    const [activePage, setActivePage] = useState<DesktopPage>("markets-live");

    const activeCategory = activePage.split("-")[0] as Category;
    const isSportsMode = activeCategory === "sports";

    return (
        <CategoryContext.Provider value={{
            activeCategory,
            activePage,
            setActivePage,
            isSportsMode
        }}>
            {children}
        </CategoryContext.Provider>
    );
}

export function useCategoryFilter() {
    const context = useContext(CategoryContext);
    if (!context) {
        // Default to markets if used outside provider
        return {
            activeCategory: "markets" as Category,
            activePage: "markets-live" as DesktopPage,
            setActivePage: () => { },
            isSportsMode: false,
            filterByCategory: <T extends { event: string; sport?: string | null; analysis?: { market_context?: { sport?: string | null; league?: string | null } } | null }>(items: T[]): T[] => items
        };
    }

    // Generic filter function that can be used by any component
    const filterByCategory = <T extends { event: string; sport?: string | null; analysis?: { market_context?: { sport?: string | null; league?: string | null } } | null }>(items: T[]): T[] => {
        return items.filter(item => {
            const itemIsSports = isSportsAnomaly(item);
            return context.isSportsMode ? itemIsSports : !itemIsSports;
        });
    };

    return {
        ...context,
        filterByCategory
    };
}

// Re-export isSportsAnomaly for convenience
export { isSportsAnomaly };
