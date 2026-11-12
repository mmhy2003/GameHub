import { nameForSymbol, winsFor } from "./players";
import type { MatchScore } from "./types";

export type Seat = "B" | "P" | "U" | "O" | "G" | "Y";
export const SEATS: Seat[] = ["B", "P", "U", "O", "G", "Y"];

/** label: snake colour name; color: Tailwind class; hex: canvas fill. */
export const SEAT_INFO: Record<Seat, { label: string; color: string; hex: string }> = {
  B: { label: "Blue", color: "bg-candy-blue", hex: "#4d96ff" },
  P: { label: "Pink", color: "bg-candy-pink", hex: "#ff6fa8" },
  U: { label: "Purple", color: "bg-candy-purple", hex: "#8b5cf6" },
  O: { label: "Orange", color: "bg-candy-orange", hex: "#ff8c42" },
  G: { label: "Green", color: "bg-candy-green", hex: "#3ddc84" },
  Y: { label: "Yellow", color: "bg-candy-yellow", hex: "#ffd23f" },
};

/** One snake as sent by the server. pts is flat [x0, y0, x1, y1, ...], head first; a crashed snake keeps only its head. */
export interface SnakeView { pts: number[]; angle: number; len: number; alive: boolean; boost: boolean; respawn_in: number }

type WithSymbols = { symbols?: Record<string, string> } | null | undefined;

/** Seats that someone holds, in seat order. */
export function seatedSeats(gs: WithSymbols): Seat[] {
  const taken = Object.values(gs?.symbols ?? {});
  return SEATS.filter(s => taken.includes(s));
}

/** The server's ranking (longest first), kept to known seats. */
export function ranking(order: string[] | undefined): Seat[] {
  return (order ?? []).filter((s): s is Seat => (SEATS as string[]).includes(s));
}

/** "Match wins — Mo 2 · Sara 1 · Ali 0" */
export function matchWinsLine(gs: WithSymbols, ms: MatchScore | undefined): string {
  const parts = seatedSeats(gs).map(s => `${nameForSymbol(gs, s) ?? SEAT_INFO[s].label} ${winsFor(ms, s)}`);
  return `Match wins — ${parts.join(" · ")}`;
}

/** 125 → "2:05" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Where the camera looks: your head (it stays where you crashed until you respawn), else the leader's, else the centre. */
export function cameraFor(
  snakes: Partial<Record<Seat, SnakeView>>, mySeat: Seat | null, leaders: Seat[], world: number,
): { x: number; y: number } {
  const mine = mySeat ? snakes[mySeat] : undefined;
  if (mine && mine.pts.length >= 2) return { x: mine.pts[0], y: mine.pts[1] };
  const lead = leaders.map(s => snakes[s]).find(v => v?.alive && v.pts.length >= 2);
  return lead ? { x: lead.pts[0], y: lead.pts[1] } : { x: world / 2, y: world / 2 };
}
