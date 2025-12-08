"use client";

import { useState } from "react";
import { LoginButton } from "@/components/auth/login-button";
import { UserPreferencesModal } from "@/components/user-preferences-modal";


export function Header() {
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

    return (
        <>
            <header className="fixed top-[calc(2rem+env(safe-area-inset-top,0px))] left-0 right-0 h-12 bg-background/80 backdrop-blur-md border-b border-border z-40 flex items-center px-3">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative h-7 w-7 overflow-hidden rounded-full border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        <img
                            src="/polywhalelogo.png"
                            alt="PolyWhale Logo"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <h1 className="text-lg font-black tracking-tighter italic bg-linear-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">POLYWHALES</h1>
                </div>

                <div className="flex-1">
                    {/* Space for centered filters */}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <LoginButton
                        showPreferencesTrigger
                        onOpenPreferences={() => setIsPreferencesOpen(true)}
                    />
                </div>
            </header>

            <UserPreferencesModal
                isOpen={isPreferencesOpen}
                onClose={() => setIsPreferencesOpen(false)}
            />
        </>
    );
}
