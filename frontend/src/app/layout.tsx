import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GameHub - Classic Games",
  description: "Play classic multiplayer games instantly with zero sign-up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

        {/* Swetrix Analytics */}
        <Script src="https://swetrix.org/swetrix.js" strategy="afterInteractive" />
        <Script id="swetrix-init" strategy="afterInteractive">{`
          swetrix.init('vXH8q8DIzoMV', {
            apiURL: 'https://swetrixapi.megoo.dev/log',
          });
          swetrix.trackViews();
          swetrix.trackErrors();
        `}</Script>
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
