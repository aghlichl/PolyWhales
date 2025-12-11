"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Wallet, ArrowRight, Sparkles } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AuthModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const { login } = usePrivy();
    const [mounted, setMounted] = useState(false);
    const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

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

    // Handle Escape
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isOpen) onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const handleLogin = (provider: 'google' | 'twitter' | 'discord' | 'wallet' | 'email') => {
        try {
            if (provider === 'wallet') {
                login({ loginMethods: ['wallet'] });
            } else if (provider === 'email') {
                login({ loginMethods: ['email'] });
            } else {
                login({ loginMethods: [provider] });
            }
            onClose();
        } catch (err) {
            console.error("Login trigger error:", err);
            login();
        }
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                            duration: 0.4
                        }}
                        className="relative w-full max-w-[900px] h-[550px] bg-[#050505] border border-white/10 rounded-3xl shadow-[0_0_100px_-20px_rgba(0,255,148,0.1)] flex overflow-hidden isolate"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-5 right-5 z-50 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/5"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* LEFT COLUMN: AURORA BRANDING */}
                        <div className="hidden md:flex flex-col justify-between w-[42%] p-8 relative border-r border-white/5 bg-black overflow-hidden">
                            {/* Animated Aurora Background */}
                            <div className="absolute inset-0 opacity-40">
                                <motion.div
                                    animate={{
                                        rotate: [0, 360],
                                        scale: [1, 1.2, 1]
                                    }}
                                    transition={{
                                        duration: 20,
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,#10b981_60deg,transparent_120deg,#3b82f6_180deg,transparent_240deg,#10b981_300deg,transparent_360deg)] blur-[80px]"
                                />
                            </div>
                            {/* Noise Texture Overlay */}
                            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03]" />

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <img src="/polywhalelogo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                                    <span className="text-xl font-black italic tracking-tighter text-white">POLYWHALES</span>
                                </div>
                                <h2 className="text-[32px] font-bold text-white mb-3 leading-[1.1] tracking-tight">
                                    Unlock the <br />
                                    <span className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">Flow State.</span>
                                </h2>
                                <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-[90%]">
                                    Join the elite circle of traders using probability, physics, and patience to dominate the markets.
                                </p>
                            </div>

                            {/* Floating Stats Card */}
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="relative z-10"
                            >
                                <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900/90 to-black/90 border border-white/10 backdrop-blur-xl shadow-2xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Live Signal</div>
                                        </div>
                                        <Sparkles className="w-3 h-3 text-yellow-400 opacity-70" />
                                    </div>
                                    <div className="text-2xl font-mono font-bold text-white mb-1 tracking-tight">+$428,932</div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-[9px] font-bold text-blue-300">WHALE</div>
                                        <div className="text-zinc-500 text-[10px]">Just now</div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* RIGHT COLUMN: LOGIN METHODS */}
                        <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center relative bg-[#0A0A0B]">
                            <div className="max-w-[360px] mx-auto w-full">
                                <div className="mb-6 text-center sm:text-left">
                                    <h3 className="text-2xl font-bold text-white mb-1">Welcome Back</h3>
                                    <p className="text-zinc-400 text-sm">Choose your preferred connection method</p>
                                </div>

                                <motion.div
                                    className="space-y-2.5"
                                    initial="hidden"
                                    animate="visible"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        visible: {
                                            opacity: 1,
                                            transition: {
                                                staggerChildren: 0.08
                                            }
                                        }
                                    }}
                                >
                                    {[
                                        { id: 'google', label: 'Continue with Google', icon: <GoogleIcon />, color: 'white' },
                                        { id: 'twitter', label: 'Continue with X', icon: <TwitterIcon />, color: 'blue' },
                                        { id: 'discord', label: 'Continue with Discord', icon: <DiscordIcon />, color: 'indigo' },
                                        { id: 'div', type: 'divider' },
                                        { id: 'wallet', label: 'Connect Wallet', icon: <Wallet className="w-4 h-4" />, color: 'emerald' },
                                        { id: 'email', label: 'Continue with Email', icon: <Mail className="w-4 h-4" />, color: 'zinc' }
                                    ].map((item, idx) => (
                                        item.type === 'divider' ? (
                                            <motion.div
                                                key="divider"
                                                variants={{ hidden: { opacity: 0, scaleX: 0 }, visible: { opacity: 1, scaleX: 1 } }}
                                                className="h-px bg-white/5 my-4 mx-2"
                                            />
                                        ) : (
                                            <LoginOption
                                                key={item.id}
                                                variants={{
                                                    hidden: { opacity: 0, x: 20 },
                                                    visible: { opacity: 1, x: 0 }
                                                }}
                                                icon={item.icon}
                                                label={item.label}
                                                onClick={() => handleLogin(item.id as any)}
                                                color={item.color}
                                                onHover={() => setHoveredProvider(item.id)}
                                                isHovered={hoveredProvider === item.id}
                                            />
                                        )
                                    ))}
                                </motion.div>

                                <p className="mt-6 text-center text-[11px] text-zinc-600 leading-relaxed max-w-[280px] mx-auto">
                                    By connecting, you agree to our <a href="#" className="underline decoration-white/10 hover:decoration-white/40 hover:text-zinc-400 transition-colors">Terms</a> & <a href="#" className="underline decoration-white/10 hover:decoration-white/40 hover:text-zinc-400 transition-colors">Privacy Policy</a>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}

// --- Subcomponents ---

function LoginOption({ icon, label, onClick, color, onHover, isHovered, variants }: any) {
    const getColorStyles = () => {
        switch (color) {
            case 'white': return "hover:border-white/40 hover:bg-white/5";
            case 'blue': return "hover:border-blue-500/50 hover:bg-blue-500/10 hover:shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]";
            case 'indigo': return "hover:border-[#5865F2]/50 hover:bg-[#5865F2]/10 hover:shadow-[0_0_20px_-5px_rgba(88,101,242,0.3)]";
            case 'emerald': return "hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]";
            default: return "hover:border-zinc-500/50 hover:bg-zinc-500/10";
        }
    };

    return (
        <motion.button
            variants={variants}
            type="button"
            onMouseEnter={onHover}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 group relative overflow-hidden",
                getColorStyles()
            )}
        >
            {/* Shimmer Effect on Hover */}
            {isHovered && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1s_infinite] pointer-events-none" />
            )}

            <div className="flex items-center gap-3.5">
                <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors border border-white/5 bg-white/5",
                    isHovered ? "bg-white/10 border-white/20" : "text-zinc-400"
                )}>
                    {icon}
                </div>
                <div className="flex flex-col items-start">
                    <span className={cn("text-[13px] font-bold transition-colors", isHovered ? "text-white" : "text-zinc-300")}>
                        {label}
                    </span>
                </div>
            </div>

            <div className={cn("opacity-0 transform -translate-x-2 transition-all duration-300", isHovered && "opacity-100 translate-x-0")}>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
            </div>
        </motion.button>
    )
}

// Icons
const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const TwitterIcon = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const DiscordIcon = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#5865F2]" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
);
