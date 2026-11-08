import { nameForSymbol, winsFor } from "./players";
import type { MatchScore } from "./types";

export type Seat = "TL" | "TR" | "BL" | "BR";
export const SEATS: Seat[] = ["TL", "TR", "BL", "BR"];

/** label: tank colour name; corner: spawn corner; color: Tailwind class; hex: SVG fill. */
export const SEAT_INFO: Record<Seat, { label: string; corner: string; color: string; hex: string }> = {
  TL: { label: "Blue", corner: "Top-left", color: "bg-candy-blue", hex: "#4d96ff" },
  TR: { label: "Pink", corner: "Top-right", color: "bg-candy-pink", hex: "#ff6fa8" },
  BL: { label: "Purple", corner: "Bottom-left", color: "bg-candy-purple", hex: "#8b5cf6" },
  BR: { label: "Orange", corner: "Bottom-right", color: "bg-candy-orange", hex: "#ff8c42" },
};

export type DriveState = "fwd" | "back" | "stop";
export type TurnState = "left" | "right" | "stop";
export interface TankView { x: number; y: number; angle: number; alive: boolean; blink: boolean }
export interface ShellView { x: number; y: number; owner: Seat }
export interface Burst { id: number; x: number; y: number }

type WithSymbols = { symbols?: Record<string, string> } | null | undefined;

/** Seats that someone holds, in seat order. */
export function seatedSeats(gs: WithSymbols): Seat[] {
  const taken = Object.values(gs?.symbols ?? {});
  return SEATS.filter(s => taken.includes(s));
}

/** Winner first, then the others from last knocked out to first. */
export function ranking(winner: Seat | null, knockoutOrder: Seat[]): Seat[] {
  const rest = [...knockoutOrder].reverse();
  return winner ? [winner, ...rest] : rest;
}

/** "Match wins — Mo 2 · Sara 1 · Ali 0" */
export function matchWinsLine(gs: WithSymbols, ms: MatchScore | undefined): string {
  const parts = seatedSeats(gs).map(s => `${nameForSymbol(gs, s) ?? SEAT_INFO[s].label} ${winsFor(ms, s)}`);
  return `Match wins — ${parts.join(" · ")}`;
}
