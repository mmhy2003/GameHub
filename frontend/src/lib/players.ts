import type { MatchScore, Outcome } from "./types";
type WithSymbols = { symbols?: Record<string, string> } | null | undefined;
export function nameForSymbol(gs: WithSymbols, symbol: string | null | undefined): string | undefined {
  if (!gs?.symbols || !symbol) return undefined;
  return Object.keys(gs.symbols).find(n => gs.symbols![n] === symbol);
}
export const winsFor = (ms: MatchScore | undefined, symbol: string) => ms?.wins?.[symbol] ?? 0;
export const scoreLine = (ms: MatchScore | undefined, a: string, b: string) => `${winsFor(ms, a)} – ${winsFor(ms, b)}`;
export function outcomeFor(winner: string | null | undefined, isDraw: boolean, mySymbol: string | null): Outcome {
  if (isDraw) return "draw";
  if (!mySymbol) return "spectator";
  return winner === mySymbol ? "win" : "lose";
}
