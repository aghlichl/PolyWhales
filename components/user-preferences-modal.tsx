"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { UserPreferences } from "@/components/user-preferences";
import { motion, AnimatePresence } from "framer-motion";

type UserPreferencesModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isOpen) {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 25,
                            duration: 0.3
                        }}
                        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0A0A0B] border border-white/10 rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Ambient Background Effects */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent_40%)] pointer-events-none" />

                        {/* Header */}
                        <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                            <div>
                                <h2 className="text-xl font-bold bg-gradient-to-br from-white via-white/90 to-white/50 bg-clip-text text-transparent">
                                    Control Center
                                </h2>
                                <p className="text-xs text-zinc-500 font-medium tracking-wide mt-0.5">
                                    CUSTOMIZE YOUR FEED
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                className="group relative w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                            <div className="p-6">
                                <UserPreferences />
                            </div>
                        </div>

                        {/* Footer Gradient Fade */}
                        <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#0A0A0B] to-transparent pointer-events-none" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}


