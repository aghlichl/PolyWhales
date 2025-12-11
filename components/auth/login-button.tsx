"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, User } from "lucide-react";
import { useState } from "react";
import { AuthModal } from "@/components/auth/auth-modal";

type LoginButtonProps = {
    onOpenPreferences?: () => void;
    showPreferencesTrigger?: boolean;
    compact?: boolean;
};

export function LoginButton({ onOpenPreferences, showPreferencesTrigger = false, compact = false }: LoginButtonProps) {
    const { login, ready, authenticated, user, logout } = usePrivy();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const pillClass =
        "inline-flex items-center gap-1 rounded-full bg-transparent px-1 py-0.5 backdrop-blur-0 shadow-none ring-0";

    const segmentClass =
        "relative inline-flex items-center justify-center h-8 w-8 rounded-full text-zinc-300 transition-colors hover:text-emerald-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-70";

    const iconClass = compact ? "h-4 w-4" : "h-4 w-4";

    const preferencesSegment =
        showPreferencesTrigger && onOpenPreferences ? (
            <button
                type="button"
                onClick={onOpenPreferences}
                aria-label="Open preferences"
                className={segmentClass}
            >
                <Settings className={iconClass} />
                <span className="sr-only">Open preferences</span>
            </button>
        ) : null;

    const userLabel =
        user?.wallet?.address
            ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
            : user?.email?.address;

    if (compact) {
        if (!ready) {
            return (
                <div className="flex items-center gap-2">
                    <div className={pillClass}>
                        <button type="button" disabled className={segmentClass} aria-label="Loading">
                            <Loader2 className={`${iconClass} animate-spin`} />
                        </button>
                        {preferencesSegment}
                    </div>
                </div>
            );
        }

        if (authenticated) {
            return (
                <div className="flex items-center gap-2">
                    <div className={pillClass}>
                        <button
                            type="button"
                            onClick={logout}
                            aria-label="Log out"
                            title={userLabel || "Account"}
                            className={`${segmentClass} text-emerald-300 hover:text-emerald-200`}
                        >
                            <User className={iconClass} />
                            <span className="sr-only">Log out</span>
                        </button>
                        {preferencesSegment}
                    </div>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2">
                <div className={pillClass}>
                    <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(true)}
                        aria-label="Log in"
                        className={segmentClass}
                    >
                        <User className={iconClass} />
                        <span className="sr-only">Log in</span>
                    </button>
                    {preferencesSegment}
                </div>
                <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
            </div>
        );
    }

    if (!ready) {
        return (
            <div className="flex items-center gap-2">
                <Button
                    disabled
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-2 sm:px-4 text-[10px] font-bold uppercase tracking-[0.15em] bg-zinc-950/60 text-zinc-500 rounded-sm cursor-not-allowed shadow-[0_1px_0_rgba(255,255,255,0.04)] ${compact ? 'h-6 text-[9px]' : ''}`}
                >
                    <Loader2 className={`mr-2 animate-spin ${compact ? 'h-2 w-2' : 'h-3 w-3'}`} />
                    <span className="hidden sm:inline">Loading</span>
                </Button>
                {preferencesSegment}
            </div>
        );
    }

    if (authenticated) {
        return (
            <div className="flex items-center gap-2">
                <Button
                    onClick={logout}
                    size="sm"
                    variant="ghost"
                    className={`group relative h-8 px-2 sm:px-4 text-[10px] font-bold uppercase tracking-[0.15em] bg-zinc-950/60 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-900/70 hover:shadow-[0_0_12px_-4px_rgba(52,211,153,0.2)] rounded-sm transition-all duration-300 backdrop-blur-sm ${compact ? 'h-6 min-w-0 px-2' : ''}`}
                >
                    <User className={`sm:hidden text-emerald-400 group-hover:text-emerald-300 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
                    <span className="hidden sm:inline truncate max-w-[100px]">
                        {user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...` : user?.email?.address}
                    </span>
                </Button>
                {preferencesSegment}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                onClick={() => setIsAuthModalOpen(true)}
                size="sm"
                variant="ghost"
                className={`group relative h-8 px-2 sm:px-4 text-[10px] font-bold uppercase tracking-[0.15em] bg-zinc-950/60 text-zinc-500 hover:text-emerald-400 hover:bg-zinc-900/70 hover:shadow-[0_0_12px_-4px_rgba(52,211,153,0.2)] rounded-sm transition-all duration-300 backdrop-blur-sm ${compact ? 'h-6 text-[9px] px-2' : ''}`}
            >
                <User className={`sm:hidden text-zinc-500 group-hover:text-emerald-400 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
                <span className="hidden sm:inline">Log In {compact ? '' : '/ Sign Up'}</span>
            </Button>
            {preferencesSegment}
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </div>
    );
}

