"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type DesktopPage = "live" | "charts";

interface SidebarNavigationProps {
    activePage: DesktopPage;
    onPageChange: (page: DesktopPage) => void;
}

export function SidebarNavigation({ activePage, onPageChange }: SidebarNavigationProps) {
    const [isHovering, setIsHovering] = useState(false);

    return (
        <div
            className="fixed left-0 top-0 bottom-0 z-50 flex items-center"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Trigger Zone - Invisible but catches mouse */}
            <div className="absolute left-0 top-0 bottom-0 w-4 z-40" />

            {/* Sidebar Content */}
            <AnimatePresence>
                {isHovering && (
                    <motion.div
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -100, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "circOut" }}
                        className="h-auto py-6 pl-3 pr-4 ml-2 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl flex flex-col gap-4 z-50"
                    >
                        <NavButton
                            isActive={activePage === "live"}
                            onClick={() => onPageChange("live")}
                            icon={<Activity className="w-5 h-5" />}
                            label="LIVE"
                            colorClass="text-green-400"
                        />
                        <div className="w-full h-px bg-white/10" />
                        <NavButton
                            isActive={activePage === "charts"}
                            onClick={() => onPageChange("charts")}
                            icon={<BarChart2 className="w-5 h-5" />}
                            label="CHARTS"
                            colorClass="text-blue-400"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function NavButton({
    isActive,
    onClick,
    icon,
    label,
    colorClass
}: {
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    colorClass: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative group flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300",
                isActive
                    ? "bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    : "hover:bg-white/5"
            )}
        >
            <div className={cn(
                "transition-colors duration-300 mb-1",
                isActive ? colorClass : "text-zinc-500 group-hover:text-zinc-300"
            )}>
                {icon}
            </div>
            <span className={cn(
                "text-[9px] font-bold tracking-widest",
                isActive ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
            )}>
                {label}
            </span>
            {isActive && (
                <div className={cn(
                    "absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-l-full blur-[2px]",
                    colorClass.replace("text-", "bg-")
                )} />
            )}
        </button>
    );
}
