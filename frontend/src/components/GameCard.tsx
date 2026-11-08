"use client";
import ToyButton from "@/components/ui/ToyButton";
import type { Accent, GameInfo } from "@/data/games";

interface GameCardProps { game: GameInfo; actionLabel: string; onPlay: () => void }

// Static class names so Tailwind picks them up at build time
const ACCENT_BG: Record<Accent, string> = {
  blue: "bg-candy-blue",
  pink: "bg-candy-pink",
  yellow: "bg-candy-yellow",
  green: "bg-candy-green",
  purple: "bg-candy-purple",
  orange: "bg-candy-orange",
};

export default function GameCard({ game, actionLabel, onPlay }: GameCardProps) {
  return (
    <div className="chunk bg-white p-3 flex flex-col gap-3 transition-transform hover:-translate-y-1">
      <div className={`relative h-36 rounded-xl border-2 border-ink overflow-hidden ${ACCENT_BG[game.accent]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static covers, no optimisation needed */}
        <img src={game.cover} alt="" className="w-full h-full object-cover" />
        <span
          aria-hidden
          className="absolute top-2 right-2 w-10 h-10 chunk-sm bg-white flex items-center justify-center text-xl rotate-6"
        >
          {game.emoji}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 px-1">
        <h3 className="text-xl font-bold text-ink">{game.title}</h3>
        <p className="text-sm text-ink/70 line-clamp-2">{game.description}</p>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-ink">
          <span className="chunk-sm bg-cream-2 px-2 py-0.5">{game.category}</span>
          <span className="chunk-sm bg-cream px-2 py-0.5">⏱ {game.playTime}</span>
        </div>
      </div>
      <ToyButton color={game.accent} className="w-full" onClick={onPlay}>
        {actionLabel}
      </ToyButton>
    </div>
  );
}
