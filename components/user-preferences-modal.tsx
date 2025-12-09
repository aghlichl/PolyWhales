"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { UserPreferences } from "@/components/user-preferences";

type UserPreferencesModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
    const [mounted, setMounted] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

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

    useEffect(() => {
        if (!isOpen) return;

        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
            "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );
        const first = focusable?.[0];
        const last = focusable && focusable.length > 0 ? focusable[focusable.length - 1] : null;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
            if (event.key === "Tab" && focusable && focusable.length > 0) {
                if (event.shiftKey) {
                    if (document.activeElement === first) {
                        event.preventDefault();
                        (last || first)?.focus();
                    }
                } else if (document.activeElement === last) {
                    event.preventDefault();
                    (first || last)?.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        closeButtonRef.current?.focus();

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-120 flex justify-end">
            <div
                className="absolute inset-0 bg-linear-to-br from-black/85 via-black/70 to-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                className="relative h-full w-full max-w-[430px] flex flex-col bg-zinc-950/95 border border-zinc-800/70 shadow-[0_20px_80px_-40px_rgba(0,0,0,1),0_0_40px_-20px_rgba(52,211,153,0.35)] animate-in slide-in-from-right duration-300"
            >
                <div className="absolute inset-y-0 -left-16 w-16 bg-emerald-500/10 blur-3xl pointer-events-none" />
                <div className="absolute inset-y-0 left-0 w-px bg-linear-to-b from-transparent via-emerald-400/60 to-transparent" />

                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60 bg-linear-to-r from-zinc-950/95 via-zinc-950/80 to-zinc-900/80 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
                        <div className="leading-tight">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Control Center</p>
                            <p className="text-sm font-semibold text-zinc-100">User Preferences</p>
                        </div>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        aria-label="Close preferences"
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 transition-all duration-200"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4 space-y-4">
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        Preferences are saved automatically and apply instantly.
                    </div>
                    <UserPreferences />
                </div>
            </div>
        </div>,
        document.body
    );
}


