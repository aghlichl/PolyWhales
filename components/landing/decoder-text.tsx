"use client";

import React, { useEffect, useState } from "react";

interface DecoderTextProps {
    text: string;
    className?: string;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";

export function DecoderText({ text, className }: DecoderTextProps) {
    const [displayText, setDisplayText] = useState("");

    useEffect(() => {
        let iteration = 0;
        let interval: NodeJS.Timeout;

        const startDecoding = () => {
            clearInterval(interval);
            interval = setInterval(() => {
                setDisplayText((_prev) =>
                    text
                        .split("")
                        .map((char, index) => {
                            if (index < iteration) {
                                return text[index];
                            }
                            return CHARS[Math.floor(Math.random() * CHARS.length)];
                        })
                        .join("")
                );

                if (iteration >= text.length) {
                    clearInterval(interval);
                }

                iteration += 1 / 3; // Slow down the reveal
            }, 30);
        };

        // Small delay before starting
        const timeout = setTimeout(startDecoding, 500);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [text]);

    return <span className={className}>{displayText}</span>;
}
