"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface ConnectFourProps {
  ws: WebSocket;
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
}

const DISC_COLORS: Record<string, string> = {
  R: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]",
  Y: "bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]",
};
const DISC_HOVER: Record<string, string> = {
  R: "hover:bg-rose-500/40",
  Y: "hover:bg-yellow-400/40",
};

export default function ConnectFour({ ws, gameState, mySymbol, handleRestart }: ConnectFourProps) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const board = gameState?.board ?? [];
  const currentTurn = gameState?.current_turn ?? "R";
  const winner = gameState?.winner ?? null;
  const isDraw = gameState?.is_draw ?? false;
  const isMyTurn = mySymbol === currentTurn && !winner && !isDraw;
  const enemySymbol = mySymbol === "R" ? "Y" : "R";

  const dropDisc = (col: number) => {
    if (!isMyTurn) return;
    ws.send(JSON.stringify({ action: "move", col }));
  };

  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  const COLS = 7;
  const ROWS = 6;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4 relative z-10">

      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm font-semibold">
        {winner ? (
          <span className={`px-4 py-1.5 rounded-full text-white ${winner === mySymbol ? "bg-green-600" : "bg-rose-700"}`}>
            {winner === mySymbol ? "🏆 You Won!" : "💀 You Lost"}
          </span>
        ) : isDraw ? (
          <span className="px-4 py-1.5 rounded-full bg-slate-700 text-slate-200">It's a Draw!</span>
        ) : (
          <span className={`px-4 py-1.5 rounded-full text-white flex items-center gap-2 ${isMyTurn ? "bg-indigo-600 animate-pulse" : "bg-slate-700"}`}>
            <span className={`w-3 h-3 rounded-full ${DISC_COLORS[currentTurn]}`} />
            {isMyTurn ? "Your turn" : "Opponent's turn…"}
          </span>
        )}
      </div>

      {/* Board */}
      <div className="relative bg-indigo-950 border-2 border-indigo-800 rounded-2xl p-3 shadow-2xl shadow-indigo-950/60">
        {/* Column hover indicators */}
        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}>
          {Array.from({ length: COLS }, (_, c) => (
            <div key={c} className={`h-2 rounded-full transition-colors ${hoverCol === c && isMyTurn && mySymbol ? (mySymbol === "R" ? "bg-rose-500" : "bg-yellow-400") : "bg-transparent"}`} />
          ))}
        </div>

        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}>
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => {
              const cell = board[r]?.[c];
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => dropDisc(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  onMouseLeave={() => setHoverCol(null)}
                  disabled={!isMyTurn}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-900 transition-all duration-150 
                    ${cell === "R" ? DISC_COLORS.R
                      : cell === "Y" ? DISC_COLORS.Y
                      : hoverCol === c && isMyTurn && mySymbol
                        ? DISC_HOVER[mySymbol] + " bg-indigo-900/60"
                        : "bg-indigo-900/80"}`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> {mySymbol === "R" ? "You (Red)" : "Opponent (Red)"}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> {mySymbol === "Y" ? "You (Yellow)" : "Opponent (Yellow)"}</span>
      </div>

      {(winner || isDraw) && (
        <button onClick={handleRestart} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all shadow-lg">
          Play Again
        </button>
      )}
    </div>
  );
}
