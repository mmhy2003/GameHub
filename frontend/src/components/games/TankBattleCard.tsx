"use client";
import Avatar from "@/components/ui/Avatar";
import { hearts } from "@/lib/players";
import { SEAT_INFO, type Seat } from "@/lib/tankBattle";

export type TankCardState = "playing" | "out" | "sitting" | "empty";

interface TankBattleCardProps {
  seat: Seat;
  name?: string;
  lives: number;
  livesMax: number;
  state: TankCardState;
  isMe: boolean;
  // Two short lines for the narrow 2×2 grid, so the arena keeps its room on a phone
  compact?: boolean;
}

export default function TankBattleCard({ seat, name, lives, livesMax, state, isMe, compact = false }: TankBattleCardProps) {
  const shown = state === "empty" ? "Empty" : name ?? SEAT_INFO[seat].label;
  const status = state === "playing" ? hearts(livesMax - lives, livesMax) : state === "out" ? "💥 Out" : state === "sitting" ? "🪑 Sits out" : "—";
  if (compact) {
    return (
      <div className={`chunk-sm bg-white text-ink px-2 py-1 min-w-0 ${state === "out" ? "opacity-50 grayscale" : ""} ${isMe ? "ring-4 ring-candy-yellow" : ""}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar name={state === "empty" ? "" : name ?? ""} size={20} />
          <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
          <span className="font-bold text-xs truncate">{shown}{isMe && " (you)"}</span>
        </div>
        <div className="text-xs font-bold whitespace-nowrap">{status}</div>
      </div>
    );
  }
  return (
    <div className={`chunk bg-white text-ink flex items-center gap-2 px-2 py-2 min-w-0 ${state === "out" ? "opacity-50 grayscale" : ""} ${isMe ? "ring-4 ring-candy-yellow" : ""}`}>
      <Avatar name={state === "empty" ? "" : name ?? ""} size={32} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{shown}{isMe && " (you)"}</div>
        <div className="flex items-center gap-1.5 text-xs text-ink/60 font-bold">
          <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
          {SEAT_INFO[seat].label}
        </div>
        <div className="text-sm font-bold whitespace-nowrap">{status}</div>
      </div>
    </div>
  );
}
