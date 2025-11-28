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
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" fill="currentColor"/>
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
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" fill="currentColor"/>
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
            <div className="shrink-0 w-5 h-5 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/50 flex items-center justify-center">
                <Check className="w-3 h-3 text-[#5865F2]" strokeWidth={3} />
            </div>
            <span className="text-zinc-300 font-medium text-sm">{text}</span>
        </div>
    );
}
