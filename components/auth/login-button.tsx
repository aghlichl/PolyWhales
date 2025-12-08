"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, User } from "lucide-react";

type LoginButtonProps = {
    onOpenPreferences?: () => void;
    showPreferencesTrigger?: boolean;
};

export function LoginButton({ onOpenPreferences, showPreferencesTrigger = false }: LoginButtonProps) {
    const { login, ready, authenticated, user, logout } = usePrivy();

    const preferencesTrigger = showPreferencesTrigger && onOpenPreferences ? (
        <button
            type="button"
            onClick={onOpenPreferences}
            aria-label="Open preferences"
            className="h-8 w-8 flex items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:text-emerald-400 hover:border-emerald-400/30 hover:bg-zinc-900/80 hover:shadow-[0_0_10px_-2px_rgba(52,211,153,0.2)] transition-all duration-300 backdrop-blur-sm"
        >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Open preferences</span>
        </button>
    ) : null;

    if (!ready) {
        return (
            <div className="flex items-center gap-2">
                <Button
                    disabled
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 sm:px-4 text-[10px] font-bold uppercase tracking-[0.15em] border border-zinc-800 bg-zinc-950/50 text-zinc-600 rounded-sm cursor-not-allowed"
                >
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    <span className="hidden sm:inline">Loading</span>
                </Button>
                {preferencesTrigger}
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
                    className="group relative h-8 px-2 sm:px-4 text-[10px] font-bold uppercase tracking-[0.15em] border border-emerald-400/30 bg-zinc-950/50 text-emerald-400 hover:text-emerald-300 hover:border-emerald-400/50 hover:bg-zinc-900/80 hover:shadow-[0_0_10px_-2px_rgba(52,211,153,0.15)] rounded-sm transition-all duration-300 backdrop-blur-sm"
                >
                    <User className="h-4 w-4 sm:hidden text-emerald-400 group-hover:text-emerald-300" />
                    <span className="hidden sm:inline truncate max-w-[100px]">
                        {user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...` : user?.email?.address}
                    </span>
                </Button>
                {preferencesTrigger}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                onClick={login}
                size="sm"
                variant="ghost"
                className="group relative h-8 px-2 sm:px-4 text-[10px] font-bold uppercase tracking-[0.15em] border border-zinc-700 bg-zinc-950/50 text-zinc-500 hover:text-emerald-400 hover:border-emerald-400/20 hover:bg-zinc-900/80 hover:shadow-[0_0_10px_-2px_rgba(52,211,153,0.15)] rounded-sm transition-all duration-300 backdrop-blur-sm"
            >
                <User className="h-4 w-4 sm:hidden text-zinc-500 group-hover:text-emerald-400" />
                <span className="hidden sm:inline">Log In / Sign Up</span>
            </Button>
            {preferencesTrigger}
        </div>
    );
}
