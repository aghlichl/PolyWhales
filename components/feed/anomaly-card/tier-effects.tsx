type TierFlags = {
    isGod: boolean;
    isSuper: boolean;
    isMega: boolean;
    isWhale: boolean;
};

export function TierAura({ isGod }: Pick<TierFlags, "isGod">) {
    if (!isGod) return null;

    return (
        <div className="absolute inset-0 pointer-events-none isolate">
            <div className="absolute -inset-1 z-0 overflow-hidden rounded-inherit">
                <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(251,191,36,0.8)_45deg,rgba(239,68,68,0.9)_90deg,rgba(251,191,36,0.7)_135deg,transparent_180deg,rgba(168,85,247,0.6)_225deg,rgba(239,68,68,0.8)_270deg,rgba(251,191,36,0.7)_315deg,transparent_360deg)] animate-[spin_8s_linear_infinite] opacity-70 blur-sm rounded-xl" />
                <div className="absolute inset-1 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(239,68,68,1.0)_30deg,rgba(251,191,36,1.0)_60deg,rgba(239,68,68,0.9)_90deg,transparent_120deg,rgba(251,191,36,0.8)_150deg,rgba(239,68,68,1.0)_180deg,rgba(251,191,36,0.9)_210deg,transparent_240deg,rgba(168,85,247,0.7)_270deg,rgba(239,68,68,0.8)_300deg,rgba(251,191,36,1.0)_330deg,transparent_360deg)] animate-spin-reverse opacity-60 blur-sm rounded-xl" />
            </div>
            <div className="absolute -inset-0.5 z-0">
                <div className="absolute -top-0.5 left-1/4 w-0.5 h-3 bg-linear-to-t from-transparent via-yellow-400 to-transparent animate-energy-wisp" style={{ animationDelay: '0s' }} />
                <div className="absolute -top-0.5 right-1/3 w-0.5 h-2 bg-linear-to-t from-transparent via-red-400 to-transparent animate-energy-wisp" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 -left-0.5 w-2 h-0.5 bg-linear-to-r from-transparent via-orange-400 to-transparent animate-energy-wisp" style={{ animationDelay: '0.5s' }} />
                <div className="absolute top-1/3 -right-0.5 w-1.5 h-0.5 bg-linear-to-l from-transparent via-yellow-300 to-transparent animate-energy-wisp" style={{ animationDelay: '1.5s' }} />
                <div className="absolute -bottom-0.5 left-1/3 w-0.5 h-2.5 bg-linear-to-t from-yellow-500 via-orange-400 to-transparent animate-energy-wisp" style={{ animationDelay: '2s' }} />
                <div className="absolute -bottom-0.5 right-1/4 w-0.5 h-1.5 bg-linear-to-t from-red-500 via-yellow-400 to-transparent animate-energy-wisp" style={{ animationDelay: '0.8s' }} />
            </div>
        </div>
    );
}

export function TierOverlays({ isGod, isSuper, isMega, isWhale }: TierFlags) {
    return (
        <>
            {isGod && (
                <>
                    <div className="absolute inset-[-150%] z-0 pointer-events-none bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(251,191,36,0.4)_10deg,transparent_20deg,rgba(251,191,36,0.1)_50deg,transparent_60deg,rgba(251,191,36,0.4)_90deg,transparent_100deg)] animate-super-spin mix-blend-plus-lighter opacity-70 rounded-xl" />
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,rgba(251,191,36,0.5)_20%,transparent_60%)] animate-flash mix-blend-screen" />
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(251,191,36,0.6)_40%,transparent_50%)] animate-shockwave mix-blend-plus-lighter" />
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(0deg,rgba(251,191,36,0.2)_0%,transparent_100%)] animate-pulse" />
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
                </>
            )}

            {isSuper && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none bg-red-500/10 animate-[pulse_0.5s_ease-in-out_infinite]" />
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(180deg,transparent_40%,rgba(239,68,68,0.8)_50%,transparent_60%)] bg-[length:100%_200%] animate-scanline mix-blend-plus-lighter opacity-80" />
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-15">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent animate-heat-distortion" />
                        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-red-600/8 to-transparent animate-heat-distortion" style={{ animationDelay: '0.5s' }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-red-400/12 to-transparent animate-heat-distortion" style={{ animationDelay: '1s' }} />
                    </div>
                    <div className="absolute inset-0 z-0 pointer-events-none border-2 border-red-500/60 animate-rgb-glitch-cycle" />
                    <div className="absolute inset-0 z-0 pointer-events-none border-2 border-red-500/30 animate-glitch-border" />
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
                </>
            )}

            {isMega && (
                <>
                    <div className="absolute inset-[-50%] z-0 pointer-events-none bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(168,85,247,0.1)_60deg,transparent_120deg)] animate-[spin_10s_linear_infinite]" />
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.3)_0%,transparent_70%)] animate-heartbeat mix-blend-screen" />
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
                        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(168,85,247,0.1)_30deg,rgba(168,85,247,0.3)_60deg,rgba(168,85,247,0.1)_90deg,rgba(147,51,234,0.2)_120deg,rgba(147,51,234,0.4)_150deg,rgba(147,51,234,0.2)_180deg,transparent_210deg)] animate-[nebula-swirl_12s_linear_infinite] mix-blend-screen opacity-70" />
                        <div className="absolute inset-[-20%] bg-[radial-gradient(circle_at_30%_70%,rgba(168,85,247,0.4)_0%,rgba(168,85,247,0.1)_30%,transparent_60%),radial-gradient(circle_at_70%_30%,rgba(147,51,234,0.3)_0%,rgba(147,51,234,0.1)_40%,transparent_70%)] animate-[energy-flow_8s_ease-in-out_infinite_alternate] mix-blend-plus-lighter opacity-60" />
                        <div className="absolute inset-0 opacity-50">
                            <div className="absolute top-[15%] left-[25%] w-0.5 h-0.5 bg-purple-300 rounded-full animate-[dust-twinkle_3s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
                            <div className="absolute top-[20%] right-[15%] w-1 h-1 bg-purple-400 rounded-full animate-[dust-twinkle_4s_ease-in-out_infinite]" style={{ animationDelay: '1s' }} />
                            <div className="absolute top-[10%] left-[60%] w-0.5 h-0.5 bg-purple-200 rounded-full animate-[dust-twinkle_3.5s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
                            <div className="absolute top-[25%] right-[70%] w-0.5 h-0.5 bg-white rounded-full animate-[dust-twinkle_5s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }} />
                            <div className="absolute top-[45%] left-[15%] w-0.5 h-0.5 bg-purple-500 rounded-full animate-[dust-twinkle_4.5s_ease-in-out_infinite]" style={{ animationDelay: '1.5s' }} />
                            <div className="absolute top-[55%] right-[25%] w-1 h-1 bg-purple-100 rounded-full animate-[dust-twinkle_3.2s_ease-in-out_infinite]" style={{ animationDelay: '2.5s' }} />
                            <div className="absolute top-[35%] left-[75%] w-0.5 h-0.5 bg-purple-300 rounded-full animate-[dust-twinkle_4.8s_ease-in-out_infinite]" style={{ animationDelay: '0.8s' }} />
                            <div className="absolute bottom-[20%] left-[30%] w-0.5 h-0.5 bg-purple-400 rounded-full animate-[dust-twinkle_3.8s_ease-in-out_infinite]" style={{ animationDelay: '1.2s' }} />
                            <div className="absolute bottom-[15%] right-[45%] w-0.5 h-0.5 bg-purple-200 rounded-full animate-[dust-twinkle_4.2s_ease-in-out_infinite]" style={{ animationDelay: '2.8s' }} />
                            <div className="absolute bottom-[25%] left-[70%] w-1 h-1 bg-white rounded-full animate-[dust-twinkle_3.6s_ease-in-out_infinite]" style={{ animationDelay: '0.3s' }} />
                            <div className="absolute bottom-[10%] right-[20%] w-0.5 h-0.5 bg-purple-500 rounded-full animate-[dust-twinkle_5.2s_ease-in-out_infinite]" style={{ animationDelay: '1.8s' }} />
                        </div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[radial-gradient(circle,rgba(168,85,247,0.6)_0%,rgba(168,85,247,0.2)_50%,transparent_100%)] animate-[core-pulse_4s_ease-in-out_infinite] rounded-full blur-sm" />
                    </div>
                    <div className="absolute inset-0 z-0 pointer-events-none border border-purple-500/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.2)]" />
                </>
            )}

            {isWhale && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.4)_0%,rgba(59,130,246,0.1)_40%,transparent_70%)] animate-breathe" />
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay animate-drift" />
                </>
            )}
        </>
    );
}
