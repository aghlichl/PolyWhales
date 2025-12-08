"use client";

import { AnimatePresence } from "framer-motion";

export function SlotReel({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3 relative">
            {/* Use sync mode to avoid aggressive popLayout animations on rapid inserts */}
            <AnimatePresence mode="sync" initial={false}>
                {children}
            </AnimatePresence>
        </div>
    );
}

export const reelItemVariants = {
    initial: { y: -100, opacity: 0, scale: 0.9 },
    animate: {
        y: 0,
        opacity: 1,
        scale: 1,
        transition: {
            type: "spring" as const,
            stiffness: 300,
            damping: 20,
            mass: 1.2
        }
    },
    exit: { scale: 0.9, opacity: 0 }
};
