"use client";

import React, { useState } from "react";
import { cn, SPORTS_KEYWORDS } from "@/lib/utils";
import { Activity, BarChart2, Settings, Trophy, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginButton } from "@/components/auth/login-button";
import { UserPreferencesModal } from "@/components/user-preferences-modal";

// Re-export for backwards compatibility
export { SPORTS_KEYWORDS };

// Type definitions for navigation
export type Category = "sports" | "markets";
export type SubPage = "live" | "charts";
export type DesktopPage = `${Category}-${SubPage}`;

interface SidebarNavigationProps {
    activePage: DesktopPage;
    onPageChange: (page: DesktopPage) => void;
}

export function SidebarNavigation({ activePage, onPageChange }: SidebarNavigationProps) {
    const [isHovering, setIsHovering] = useState(false);
    const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);

    const activeCategory = activePage.split("-")[0] as Category;
    const activeSubPage = activePage.split("-")[1] as SubPage;

    return (
        <div
            className="fixed left-0 top-0 bottom-0 z-50 flex items-center"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Trigger Zone */}
            <div className="absolute left-0 top-0 bottom-0 w-4 z-40" />

            {/* Sidebar Content */}
            <AnimatePresence>
                {isHovering && (
                    <motion.div
                        initial={{ x: -80, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -80, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "circOut" }}
                        className="h-auto py-6 px-2 ml-2 rounded-full border border-white/10 bg-surface-1 shadow-2xl flex flex-col gap-4 items-center z-50 min-w-[60px]"
                    >
                        {/* Sports Section */}
                        <NavItem
                            isActive={activeCategory === "sports"}
                            icon={<Trophy className="w-5 h-5" />}
                            label="SPORTS"
                            colorClass="text-amber-400"
                            onClick={() => onPageChange("sports-live")} // Default to live
                        >
                            {/* Popout Signal Menu */}
                            <PopoutMenu
                                isVisible={activeCategory === "sports"}
                                activeSubPage={activeSubPage}
                                colorClass="text-amber-400"
                                onSelect={(sub) => onPageChange(`sports-${sub}`)}
                            />
                        </NavItem>

                        {/* Markets Section */}
                        <NavItem
                            isActive={activeCategory === "markets"}
                            icon={<TrendingUp className="w-5 h-5" />}
                            label="MARKETS"
                            colorClass="text-cyan-400"
                            onClick={() => onPageChange("markets-live")} // Default to live
                        >
                            <PopoutMenu
                                isVisible={activeCategory === "markets"}
                                activeSubPage={activeSubPage}
                                colorClass="text-cyan-400"
                                onSelect={(sub) => onPageChange(`markets-${sub}`)}
                            />
                        </NavItem>

                        <div className="w-8 h-px bg-white/10 my-1" />

                        {/* Login */}
                        <div className="flex justify-center scale-90 origin-center">
                            <LoginButton compact={true} />
                        </div>

                        {/* Preferences */}
                        <NavItem
                            isActive={false}
                            icon={<Settings className="w-5 h-5" />}
                            label="PREFS"
                            colorClass="text-purple-400"
                            onClick={() => setIsPreferencesModalOpen(true)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            <UserPreferencesModal
                isOpen={isPreferencesModalOpen}
                onClose={() => setIsPreferencesModalOpen(false)}
            />
        </div>
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
    children?: React.ReactNode;
}) {
    // We handle hover locally to give feedback, but popout is driven by 'isActive' or could be 'hover' too.
    // User request: "when selected pop out". So we rely on isActive for persistence.

    return (
        <div className="relative flex flex-col items-center justify-center w-full group">
            <button
                onClick={onClick}
                className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300",
                    isActive
                        ? "bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        : "hover:bg-white/5"
                )}
            >
                <div className={cn(
                    "transition-colors duration-300",
                    isActive ? colorClass : "text-zinc-500 group-hover:text-zinc-300"
                )}>
                    {icon}
                </div>

                {isActive && (
                    <div className={cn(
                        "absolute inset-0 rounded-full opacity-20 bg-current blur-md",
                        // To simulate glow with current color, we can't easily use bg-current mixed with opacity in tailwind cleanly 
                        // without a defined text color scope. 
                        // But the icon color is set above.
                        // Let's rely on shadow or manually applied classes if needed.
                        // For now, simpler:
                    )} />
                )}
            </button>
            <span className={cn(
                "text-[9px] font-bold tracking-widest mt-1.5 transition-colors duration-300",
                isActive ? "text-zinc-200" : "text-zinc-600 group-hover:text-zinc-500"
            )}>
                {label}
            </span>

            {/* Popout Menu */}
            <AnimatePresence>
                {isActive && children}
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
