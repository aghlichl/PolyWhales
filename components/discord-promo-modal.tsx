"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Check } from "lucide-react";

interface DiscordPromoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DiscordPromoModal({ isOpen, onClose }: DiscordPromoModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} className="bg-zinc-950 border-2 border-[#5865F2] shadow-[0px_0px_50px_-12px_rgba(88,101,242,0.5)] max-w-md">
            <div className="p-6 space-y-6">
                {/* Header with Logo */}
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-[#5865F2]/10 rounded-2xl flex items-center justify-center border-2 border-[#5865F2] shadow-[4px_4px_0px_0px_rgba(88,101,242,1)]">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#5865F2]">
                            <path d="M18.942 5.556a16.299 16.299 0 0 0-4.126-1.297c-.178.321-.385.754-.529 1.097a15.175 15.175 0 0 0-4.573 0 11.583 11.583 0 0 0-.535-1.097 16.274 16.274 0 0 0-4.129 1.3 11.85 11.85 0 0 0-4.792 9.574c.008.016.015.032.024.048a16.49 16.49 0 0 0 5.064 2.595 12.038 12.038 0 0 0 1.084-1.785 10.638 10.638 0 0 1-1.707-.815l.311-.235a8.831 8.831 0 0 0 8.89 0l.311.235a10.64 10.64 0 0 1-1.71.815c.307.651.669 1.25 1.084 1.785a16.497 16.497 0 0 0 5.064-2.595c.009-.016.016-.032.024-.048a11.862 11.862 0 0 0-4.76-9.574ZM8.552 13.16c-1.006 0-1.832-.922-1.832-2.047s.814-2.047 1.832-2.047c1.029 0 1.844.933 1.832 2.047 0 1.125-.803 2.047-1.832 2.047Zm6.896 0c-1.006 0-1.832-.922-1.832-2.047s.814-2.047 1.832-2.047c1.029 0 1.844.933 1.832 2.047 0 1.125-.803 2.047-1.832 2.047Z" fill="currentColor" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">UNLOCK THE EDGE</h2>
                        <p className="text-zinc-400 text-sm mt-1">Join the private circle of elite traders.</p>
                    </div>
                </div>

                {/* Features List */}
                <div className="space-y-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <FeatureItem text="Real-time Whale Movement Alerts" />
                    <FeatureItem text="Smart Money Entry Tracking" />
                    <FeatureItem text="AI-Powered Market Analytics" />
                    <FeatureItem text="Exclusive Community Alpha" />
                </div>

                {/* CTA Button */}
                <a
                    href="https://discord.gg/tgksWsjTfq" // Placeholder URL, user can update
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full group relative"
                >
                    <div className="absolute inset-0 bg-[#5865F2] rounded-xl blur opacity-25 group-hover:opacity-50 transition-opacity duration-500" />
                    <div className="relative flex items-center justify-center gap-2 w-full py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl transition-all duration-200 border-2 border-[#5865F2] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] active:translate-y-[4px] active:shadow-none">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.942 5.556a16.299 16.299 0 0 0-4.126-1.297c-.178.321-.385.754-.529 1.097a15.175 15.175 0 0 0-4.573 0 11.583 11.583 0 0 0-.535-1.097 16.274 16.274 0 0 0-4.129 1.3 11.85 11.85 0 0 0-4.792 9.574c.008.016.015.032.024.048a16.49 16.49 0 0 0 5.064 2.595 12.038 12.038 0 0 0 1.084-1.785 10.638 10.638 0 0 1-1.707-.815l.311-.235a8.831 8.831 0 0 0 8.89 0l.311.235a10.64 10.64 0 0 1-1.71.815c.307.651.669 1.25 1.084 1.785a16.497 16.497 0 0 0 5.064-2.595c.009-.016.016-.032.024-.048a11.862 11.862 0 0 0-4.76-9.574ZM8.552 13.16c-1.006 0-1.832-.922-1.832-2.047s.814-2.047 1.832-2.047c1.029 0 1.844.933 1.832 2.047 0 1.125-.803 2.047-1.832 2.047Zm6.896 0c-1.006 0-1.832-.922-1.832-2.047s.814-2.047 1.832-2.047c1.029 0 1.844.933 1.832 2.047 0 1.125-.803 2.047-1.832 2.047Z" fill="currentColor" />
                        </svg>
                        JOIN PRIVATE SERVER
                    </div>
                </a>
            </div>
        </Modal>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/50 flex items-center justify-center">
                <Check className="w-3 h-3 text-[#5865F2]" strokeWidth={3} />
            </div>
            <span className="text-zinc-300 font-medium text-sm">{text}</span>
        </div>
    );
}
