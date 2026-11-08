import { nameForSymbol, winsFor } from "./players";
import type { MatchScore } from "./types";

export type Seat = "B" | "T" | "L" | "R";
export const SEATS: Seat[] = ["B", "T", "L", "R"];

export const SEAT_INFO: Record<Seat, { side: string; color: string; axis: "x" | "y" }> = {
  B: { side: "Bottom", color: "bg-candy-blue", axis: "x" },
  T: { side: "Top", color: "bg-candy-pink", axis: "x" },
  L: { side: "Left", color: "bg-candy-purple", axis: "y" },
  R: { side: "Right", color: "bg-candy-orange", axis: "y" },
};

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
  const parts = seatedSeats(gs).map(s => `${nameForSymbol(gs, s) ?? SEAT_INFO[s].side} ${winsFor(ms, s)}`);
  return `Match wins — ${parts.join(" · ")}`;
}
