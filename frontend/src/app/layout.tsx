import type { Metadata } from "next";
import { Fredoka, Geist_Mono } from "next/font/google";
import SwetrixAnalytics from "@/components/SwetrixAnalytics";
import GameBtnGuard from "@/components/GameBtnGuard";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl();
  return {
    metadataBase: new URL(siteUrl),

    title: {
      default: "GameHub — Play Classic Multiplayer Games Instantly",
      template: "%s | GameHub",
    },
    description:
      "GameHub lets you jump into classic peer-to-peer multiplayer games in seconds — Tic-Tac-Toe, Ping-Pong, Tetris, Battleships, Stratego and more. No sign-up required.",
    keywords: [
      "multiplayer games", "online games", "browser games", "tic tac toe",
      "ping pong", "tetris", "battleships", "stratego", "hangman", "snake",
      "peer to peer", "real-time", "WebSocket", "no signup", "free games",
    ],
    authors: [{ name: "GameHub" }],
    creator: "GameHub",

    openGraph: {
      type: "website",
      url: siteUrl,
      siteName: "GameHub",
      title: "GameHub — Play Classic Multiplayer Games Instantly",
      description:
        "Jump into classic peer-to-peer multiplayer games in seconds. No sign-up required.",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "GameHub — Classic Multiplayer Games",
        },
      ],
      locale: "en_US",
    },

    twitter: {
      card: "summary_large_image",
      title: "GameHub — Play Classic Multiplayer Games Instantly",
      description:
        "Jump into classic peer-to-peer multiplayer games in seconds. No sign-up required.",
      images: ["/og-image.png"],
    },

    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink font-sans">
        <SwetrixAnalytics />
        <GameBtnGuard />
        {children}
        <noscript>
          <img
            src="https://swetrixapi.megoo.dev/log/noscript?pid=vXH8q8DIzoMV"
            alt=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </noscript>
      </body>
    </html>
  );
}
