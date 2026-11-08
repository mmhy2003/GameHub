"use client";
import type React from "react";
import Avatar from "./Avatar";
import { nameForSymbol, winsFor } from "@/lib/players";
import type { MatchScore } from "@/lib/types";

export interface PlayerSlot { symbol: string; subtitle?: React.ReactNode; token?: React.ReactNode }

interface PlayerCardsProps {
  gameState: { symbols?: Record<string, string> } | null;
  mySymbol: string | null;
  players: [PlayerSlot, PlayerSlot];
  activeSymbol?: string | null;
  matchScore?: MatchScore;
  showScore?: boolean;
  centerLabel?: React.ReactNode;
}

export default function PlayerCards({
  gameState, mySymbol, players, activeSymbol, matchScore, showScore = true, centerLabel = "VS",
}: PlayerCardsProps) {
  const card = (slot: PlayerSlot) => {
    const name = nameForSymbol(gameState, slot.symbol);
    const active = activeSymbol != null && slot.symbol === activeSymbol;
    return (
      <div
        className={`flex-1 max-w-[220px] min-w-0 chunk flex items-center gap-2 sm:gap-3 px-2 py-2 sm:px-3 ${active ? "bg-candy-green animate-wiggle" : "bg-white"}`}
      >
        {/* !important widths beat Avatar's inline size so phones get 32px avatars */}
        <Avatar name={name ?? ""} size={40} className="max-sm:w-8! max-sm:h-8! max-sm:text-sm!" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ink text-sm sm:text-base truncate">
            {name ?? "Waiting…"}{slot.symbol === mySymbol && " (you)"}
          </div>
          {slot.subtitle != null && (
            <div className="hidden sm:block text-xs text-ink/70 truncate">{slot.subtitle}</div>
          )}
        </div>
        {slot.token != null && <div className="shrink-0">{slot.token}</div>}
        {showScore && (
          <div className="shrink-0 chunk-sm bg-candy-yellow text-ink font-bold text-sm sm:text-lg px-2 rounded-lg">
            {winsFor(matchScore, slot.symbol)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex items-center justify-center gap-2 sm:gap-3">
      {card(players[0])}
      <div className="shrink-0 font-black text-ink text-sm sm:text-lg">{centerLabel}</div>
      {card(players[1])}
    </div>
  );
}
