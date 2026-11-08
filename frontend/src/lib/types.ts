export interface MatchScore { wins: Record<string, number>; draws: number; }
export type Outcome = "win" | "lose" | "draw" | "spectator";
export interface GameProps {
  ws: WebSocket;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
  matchScore?: MatchScore;
}
