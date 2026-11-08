"use client";
import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ToyButton from "./ToyButton";
import { AVATAR_COLORS } from "./Avatar";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { Outcome } from "@/lib/types";

interface ResultOverlayProps {
  open: boolean;
  outcome: Outcome;
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  onPlayAgain: () => void;
  playAgainLabel?: string;
}

const CONFETTI = Array.from({ length: 24 }, (_, i) => i);

export default function ResultOverlay({
  open, outcome, title, subtitle, children, onPlayAgain, playAgainLabel = "Play again",
}: ResultOverlayProps) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  useOnChange(open, o => {
    if (o) play(outcome === "lose" ? "lose" : "win");
    else setHidden(false); // reopen next time the game ends
  });

  if (!open || hidden) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-overlay-title"
      className="fixed inset-0 z-[150] bg-ink/40 flex items-center justify-center p-4 overflow-hidden"
    >
      {outcome === "win" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {CONFETTI.map(i => (
            <span
              key={i}
              className={`absolute top-0 w-2 h-3 rounded-sm animate-confetti ${AVATAR_COLORS[i % 6]}`}
              style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.08}s` }}
            />
          ))}
        </div>
      )}
      <div className="relative chunk bg-cream text-ink animate-pop w-full max-w-sm p-6 text-center">
        <h2 id="result-overlay-title" className="text-3xl font-bold mb-2">{title}</h2>
        {subtitle != null && <div className="text-lg text-ink/80 mb-3">{subtitle}</div>}
        {children}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <ToyButton color="green" size="lg" onClick={onPlayAgain}>{playAgainLabel}</ToyButton>
          <ToyButton color="white" size="lg" onClick={() => router.push("/")}>Lobby</ToyButton>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="mt-4 text-sm font-bold text-ink/70 underline underline-offset-2 hover:text-ink"
        >
          👀 See board
        </button>
      </div>
    </div>
  );
}
