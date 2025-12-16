"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { StarfieldCanvas } from "@/components/landing/starfield-canvas";
import { DecoderText } from "@/components/landing/decoder-text";

export default function LandingPage() {
    const [showStarfield, setShowStarfield] = useState(false);
    const [videoEnded, setVideoEnded] = useState(false);

    // Effect to trigger fade
    useEffect(() => {
        // Start fading in starfield shortly before video ends for smoothness?
        // Or just on video end. User said "quickly in the intro and then fade into [starfield]".
        // Let's assume the video is short or we cut it short?
        // "polywhale_landing.mp4" - length unknown.
        // Let's listen to onEnded.
        // Also set a fallback timeout in case video fails to autoplay?

        const timer = setTimeout(() => {
            // Fallback or explicit duration if desired.
            // But better to rely on video duration if "intro".
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <main className="relative w-screen h-screen overflow-hidden bg-[#050505] text-white font-mono flex flex-col items-center justify-center selection:bg-[#00FF94] selection:text-black">

            <AnimatePresence>
                {!videoEnded && (
                    <motion.div
                        className="absolute inset-0 z-0"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                    >
                        <video
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover opacity-80"
                            onEnded={() => {
                                setShowStarfield(true);
                                // Delay removing video slightly to allow fade overlap
                                setTimeout(() => setVideoEnded(true), 1000);
                            }}
                            onTimeUpdate={(e) => {
                                // Optional: trigger fade out earlier than end?
                                const video = e.currentTarget;
                                if (video.duration - video.currentTime < 1.5) {
                                    setShowStarfield(true);
                                }
                            }}
                        >
                            <source src="/landing/polywhale_landing.mp4" type="video/mp4" />
                        </video>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 1. Background: Canvas Starfield */}
            {/* We keep it mounted or mount it when needed? */}
            {/* To allow fade overlap, it should be present. */}

            <motion.div
                className="absolute inset-0 z-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: showStarfield ? 1 : 0 }}
                transition={{ duration: 2, ease: "easeInOut" }}
            >
                <StarfieldCanvas />
            </motion.div>

            {/* 2. Grid Overlay - Always present or fades in? */}
            <motion.div
                className="absolute inset-0 z-10 pointer-events-none opacity-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: showStarfield ? 0.2 : 0 }}
                transition={{ duration: 2, delay: 0.5 }}
                style={{
                    backgroundImage: `
            linear-gradient(rgba(0, 255, 148, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 148, 0.1) 1px, transparent 1px)
          `,
                    backgroundSize: "40px 40px",
                }}
            />

            {/* Vignette for depth */}
            <div className="absolute inset-0 z-10 pointer-events-none bg-radial-gradient from-transparent to-black opacity-80" />

            {/* 3. Content */}
            <div className="relative z-20 flex flex-col items-center text-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: showStarfield ? 1 : 0, y: showStarfield ? 0 : 20 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                    className="mb-8"
                >
                    <div className="text-[#00FF94] text-xs tracking-[0.2em] mb-4 uppercas opacity-80">
                        System Status: Online
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold tracking-widest uppercase mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
                        POLYWHALES
                    </h1>

                    <div className="text-sm md:text-lg text-[#00FF94] tracking-widest h-6">
                        {showStarfield && <DecoderText text="PREDICTION MARKET INTELLIGENCE // INITIALIZED" />}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: showStarfield ? 1 : 0 }}
                    transition={{ delay: 2, duration: 1 }}
                >
                    <Link
                        href="/terminal"
                        className="group relative inline-flex items-center justify-center px-8 py-3 overflow-hidden font-bold text-white transition-all duration-300 bg-transparent border border-[#00FF94]/50 rounded-none hover:bg-[#00FF94]/10 focus:outline-none ring-offset-2 focus:ring-2 ring-[#00FF94]"
                    >
                        <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-[#00FF94] rounded-full group-hover:w-56 group-hover:h-56 opacity-10"></span>

                        <span className="relative flex items-center gap-2">
                            <span className="tracking-[0.2em] text-[#00FF94] group-hover:text-white transition-colors duration-300">
                                [ OPEN_TERMINAL ]
                            </span>
                        </span>
                    </Link>
                </motion.div>
            </div>

            {/* Footer / Metas */}
            <motion.div
                className="absolute bottom-8 left-0 right-0 z-20 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: showStarfield ? 1 : 0 }}
                transition={{ delay: 2.5, duration: 1 }}
            >
                <p className="text-[10px] text-white/30 tracking-widest uppercase">
                    Secure Connection Established...
                </p>
            </motion.div>
        </main>
    );
}
