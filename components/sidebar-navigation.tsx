"use client";

import React, { useState } from "react";
import { cn, SPORTS_KEYWORDS } from "@/lib/utils";
import { Activity, BarChart2, Settings, Trophy, TrendingUp, Goal, ChevronRight, Palette } from "lucide-react";
import { Basketball02Icon, AmericanFootballIcon, IceHockeyIcon, BaseballBatIcon, FootballIcon } from "hugeicons-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginButton } from "@/components/auth/login-button";
import { UserPreferencesModal } from "@/components/user-preferences-modal";
import { useTheme, THEMES, type Theme } from "@/lib/useTheme";
import type { League } from "@/lib/teamMeta";

// Re-export for backwards compatibility
export { SPORTS_KEYWORDS };

// Type definitions for navigation
export type LeagueCategory = "nfl" | "nba" | "mlb" | "nhl" | "mls" | "uefa";
export type BaseCategory = "sports" | "markets";
export type Category = BaseCategory | LeagueCategory;
export type SubPage = "live" | "charts";
export type DesktopPage = `${Category}-${SubPage}`;

// Helper to check if a category is a league
export function isLeagueCategory(category: Category): category is LeagueCategory {
    return ["nfl", "nba", "mlb", "nhl", "mls", "uefa"].includes(category);
}

// Convert league category to League type
export function categoryToLeague(category: LeagueCategory): League {
    return category.toUpperCase() as League;
}

// League configuration for rendering
const LEAGUE_CONFIG: Record<LeagueCategory, { label: string; colorClass: string; icon: React.ReactNode }> = {
    nfl: { label: "NFL", colorClass: "text-red-400", icon: <AmericanFootballIcon className="w-4 h-4" /> },
    nba: { label: "NBA", colorClass: "text-orange-400", icon: <Basketball02Icon className="w-4 h-4" /> },
    mlb: { label: "MLB", colorClass: "text-blue-400", icon: <BaseballBatIcon className="w-4 h-4" /> },
    nhl: { label: "NHL", colorClass: "text-sky-400", icon: <IceHockeyIcon className="w-4 h-4" /> },
    mls: { label: "MLS", colorClass: "text-green-400", icon: <FootballIcon className="w-4 h-4" /> },
    uefa: {
        label: "UEFA",
        colorClass: "text-indigo-400",
        icon: (
            <div className="flex items-end -space-x-1">
                <Trophy className="w-3 h-3" />
                <FootballIcon className="w-2.5 h-2.5" />
            </div>
        )
    },
};

interface SidebarNavigationProps {
    activePage: DesktopPage;
    onPageChange: (page: DesktopPage) => void;
}

export function SidebarNavigation({ activePage, onPageChange }: SidebarNavigationProps) {
    const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const { theme, changeTheme } = useTheme();

    const activeCategory = activePage.split("-")[0] as Category;
    const activeSubPage = activePage.split("-")[1] as SubPage;

    // Wrap page change to close sidebar on mobile
    const handlePageChange = (page: DesktopPage) => {
        onPageChange(page);
        setIsMobileOpen(false);
    };

    return (
        <>
            {/* Mobile Toggle Button */}
            <div className={cn(
                "fixed left-0 top-[4.5rem] z-50 min-[700px]:hidden transition-transform duration-300",
                isMobileOpen ? "-translate-x-full" : "translate-x-0"
            )}>
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="flex items-center justify-center w-6 h-12 bg-surface-1 border border-white/10 border-l-0 rounded-r-lg shadow-lg text-zinc-400 hover:text-white hover:w-8 transition-all active:scale-95"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 min-[700px]:hidden"
                        onClick={() => setIsMobileOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <div className={cn(
                "fixed left-0 top-[3.5rem] bottom-0 z-50 flex items-center transition-transform duration-300 min-[700px]:translate-x-0",
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Sidebar Content */}
                <motion.div
                    layout
                    className="h-[calc(100%-1rem)] py-1 px-0 ml-2 rounded-full border border-white/10 bg-surface-1/80 backdrop-blur-md shadow-lg flex flex-col justify-between items-center z-50 w-12"
                >
                    <div className="flex flex-col gap-4 w-full items-center">
                        {/* Sports Section */}
                        <NavItem
                            isActive={activeCategory === "sports"}
                            icon={<Trophy className="w-4 h-4" />}
                            label="SPORTS"
                            colorClass="text-amber-400"
                            onClick={() => handlePageChange("sports-live")} // Default to live
                        >
                            {({ close }) => (
                                <PopoutMenu
                                    isVisible={activeCategory === "sports"}
                                    activeSubPage={activeSubPage}
                                    colorClass="text-amber-400"
                                    onSelect={(sub) => {
                                        handlePageChange(`sports-${sub}`);
                                        close();
                                    }}
                                />
                            )}
                        </NavItem>

                        {/* Markets Section */}
                        <NavItem
                            isActive={activeCategory === "markets"}
                            icon={<TrendingUp className="w-4 h-4" />}
                            label="MARKETS"
                            colorClass="text-cyan-400"
                            onClick={() => handlePageChange("markets-live")} // Default to live
                        >
                            {({ close }) => (
                                <PopoutMenu
                                    isVisible={activeCategory === "markets"}
                                    activeSubPage={activeSubPage}
                                    colorClass="text-cyan-400"
                                    onSelect={(sub) => {
                                        handlePageChange(`markets-${sub}`);
                                        close();
                                    }}
                                />
                            )}
                        </NavItem>

                        {/* Divider */}
                        <div className="w-4 h-px bg-white/10 my-1" />

                        {/* League Sections */}
                        {(Object.keys(LEAGUE_CONFIG) as LeagueCategory[]).map((leagueKey) => {
                            const config = LEAGUE_CONFIG[leagueKey];
                            return (
                                <NavItem
                                    key={leagueKey}
                                    isActive={activeCategory === leagueKey}
                                    icon={config.icon}
                                    label={config.label}
                                    colorClass={config.colorClass}
                                    onClick={() => handlePageChange(`${leagueKey}-live`)}
                                >
                                    {({ close }) => (
                                        <PopoutMenu
                                            isVisible={activeCategory === leagueKey}
                                            activeSubPage={activeSubPage}
                                            colorClass={config.colorClass}
                                            onSelect={(sub) => {
                                                handlePageChange(`${leagueKey}-${sub}`);
                                                close();
                                            }}
                                        />
                                    )}
                                </NavItem>
                            );
                        })}
                    </div>

                    <div className="flex flex-col gap-4 w-full items-center">
                        {/* Login */}
                        <div className="flex justify-center scale-75 origin-center">
                            <LoginButton compact={true} />
                        </div>

                        {/* Theme Selection */}
                        <NavItem
                            isActive={false}
                            icon={<Palette className="w-4 h-4" />}
                            label="THEME"
                            colorClass="text-pink-400"
                            onClick={() => { }}
                        >
                            {({ close }) => (
                                <ThemePopoutMenu
                                    isVisible={true}
                                    activeTheme={theme}
                                    onSelect={(t) => {
                                        changeTheme(t);
                                    }}
                                />
                            )}
                        </NavItem>

                        {/* Preferences */}
                        <NavItem
                            isActive={false}
                            icon={<Settings className="w-4 h-4" />}
                            label="PREFS"
                            colorClass="text-purple-400"
                            onClick={() => setIsPreferencesModalOpen(true)}
                        />
                    </div>
                </motion.div>

                <UserPreferencesModal
                    isOpen={isPreferencesModalOpen}
                    onClose={() => setIsPreferencesModalOpen(false)}
                />
            </div>
        </>
    );
}

// Navigation Item Component
function NavItem({
    isActive,
    icon,
    label,
    colorClass,
    onClick,
    children
}: {
    isActive: boolean;
    icon: React.ReactNode;
    label: string;
    colorClass: string;
    onClick: () => void;
    children?: React.ReactNode | ((props: { close: () => void }) => React.ReactNode);
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative flex flex-col items-center justify-center w-full group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button
                onClick={onClick}
                className={cn(
                    "relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                    isActive
                        ? "bg-white/10"
                        : "hover:bg-white/5"
                )}
            >
                <div className={cn(
                    "transition-colors duration-300",
                    isActive ? colorClass : "text-zinc-500 group-hover:text-zinc-300"
                )}>
                    {icon}
                </div>
            </button>
            <span className={cn(
                "text-[8px] font-bold tracking-widest mt-1 transition-colors duration-300 scale-90 origin-center hidden sm:block",
                isActive ? "text-zinc-200" : "text-zinc-600 group-hover:text-zinc-500"
            )}>
                {label}
            </span>

            {/* Popout Menu */}
            <AnimatePresence>
                {isHovered && (
                    typeof children === "function"
                        ? children({ close: () => setIsHovered(false) })
                        : children
                )}
            </AnimatePresence>
        </div>
    );
}

// Popout Menu Component
function PopoutMenu({
    isVisible,
    activeSubPage,
    colorClass,
    onSelect
}: {
    isVisible: boolean;
    activeSubPage: SubPage;
    colorClass: string;
    onSelect: (sub: SubPage) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "backOut" }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-4 flex flex-col gap-1 p-1.5 rounded-xl border border-white/10 bg-surface-1/90 backdrop-blur-xl shadow-2xl z-50 min-w-[120px]"
        >
            {/* Abstract Decorative Line */}
            <div className={cn("absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full opacity-50", colorClass.replace("text-", "bg-"))} />

            {/* Invisible Bridge */}
            <div className="absolute right-full top-0 bottom-0 w-6 bg-transparent" />

            <PopoutOption
                label="LIVE"
                icon={<Activity className="w-3.5 h-3.5" />}
                isActive={activeSubPage === "live"}
                activeColor="text-green-400"
                onClick={() => onSelect("live")}
            />
            <PopoutOption
                label="LEADERBOARDS"
                icon={<BarChart2 className="w-3.5 h-3.5" />}
                isActive={activeSubPage === "charts"}
                activeColor="text-blue-400"
                onClick={() => onSelect("charts")}
            />
        </motion.div>
    );
}

function PopoutOption({
    label,
    icon,
    isActive,
    activeColor,
    onClick
}: {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    activeColor: string;
    onClick: (e: React.MouseEvent) => void;
}) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick(e);
            }}
            className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full text-left",
                isActive
                    ? "bg-white/10"
                    : "hover:bg-white/5"
            )}
        >
            <div className={cn(
                "transition-colors",
                isActive ? activeColor : "text-zinc-600"
            )}>
                {icon}
            </div>
            <span className={cn(
                "text-[10px] font-bold tracking-widest",
                isActive ? "text-white" : "text-zinc-500"
            )}>
                {label}
            </span>
        </button>
    );
}

// Theme Popout Menu Component
function ThemePopoutMenu({
    isVisible,
    activeTheme,
    onSelect
}: {
    isVisible: boolean;
    activeTheme: Theme;
    onSelect: (theme: Theme) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "backOut" }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-4 flex flex-col gap-1 p-1.5 rounded-xl border border-white/10 bg-surface-1/90 backdrop-blur-xl shadow-2xl z-50 min-w-[120px]"
        >
            {/* Invisible Bridge */}
            <div className="absolute right-full top-0 bottom-0 w-6 bg-transparent" />

            {THEMES.map((themeItem) => (
                <button
                    key={themeItem.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(themeItem.id);
                    }}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full text-left",
                        activeTheme === themeItem.id
                            ? "bg-white/10"
                            : "hover:bg-white/5"
                    )}
                >
                    <div
                        className={cn(
                            "w-3.5 h-3.5 rounded-full shadow-sm",
                            themeItem.id === 'black' ? "border border-white/60" : "border border-white/20"
                        )}
                        style={{ backgroundColor: themeItem.color }}
                    />
                    <span className={cn(
                        "text-[10px] font-bold tracking-widest uppercase",
                        activeTheme === themeItem.id ? "text-white" : "text-zinc-500"
                    )}>
                        {themeItem.label}
                    </span>
                </button>
            ))}
        </motion.div>
    );
}
