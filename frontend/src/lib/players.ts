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
/** Result pop-up title: "You win! 🎉" / "You lose 😢" / "It's a draw!" for players, "{name} wins!" for spectators. */
export function resultTitle(gs: WithSymbols, winner: string | null | undefined, isDraw: boolean, mySymbol: string | null): string {
  const outcome = outcomeFor(winner, isDraw, mySymbol);
  if (outcome === "draw") return "It's a draw!";
  if (outcome === "win") return "You win! 🎉";
  if (outcome === "lose") return "You lose 😢";
  return `${nameForSymbol(gs, winner) ?? "Player " + winner} wins!`;
}
/** Lives left in a first-to-`lives` match: ❤️ per life, 🤍 per round the opponent has won. */
export function hearts(lost: number, lives = 3): string {
  const gone = Math.min(lives, Math.max(0, lost));
  return "❤️".repeat(lives - gone) + "🤍".repeat(gone);
}
