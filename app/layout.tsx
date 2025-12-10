import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import PrivyWrapper from "@/components/providers/privy-provider";

const spotifyMix = localFont({
  src: [
    {
      path: "../public/fonts/Spotify Mix.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-spotify-mix",
  display: "swap",
  fallback: [],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "ODDSGOD",
  description: "Prediction Market Aggregator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spotifyMix.variable} dark`}
      suppressHydrationWarning
    >
      <body
        className="antialiased bg-background text-foreground font-sans"
      >
        <PrivyWrapper>{children}</PrivyWrapper>
      </body>
    </html>
  );
}
