"use client";
import { useState } from "react";
import { Loader2, Flag, Bomb } from "lucide-react";

interface MinesweeperProps {
  ws: WebSocket;
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
}

// Classic Minesweeper number colours
const NUM_COLORS: Record<string, string> = {
  "1": "text-blue-400",
  "2": "text-green-400",
  "3": "text-red-400",
  "4": "text-indigo-400",
  "5": "text-rose-700",
  "6": "text-cyan-400",
  "7": "text-slate-200",
  "8": "text-slate-400",
};

export default function Minesweeper({ ws, gameState, mySymbol, handleRestart }: MinesweeperProps) {
  const [flagMode, setFlagMode] = useState(false);

  const board: string[][] = gameState?.board ?? [];
  const rows: number = gameState?.rows ?? 16;
  const cols: number = gameState?.cols ?? 16;
  const mines: number = gameState?.mines ?? 40;
  const revealedCount: number = gameState?.revealed_count ?? 0;
  const cellsToReveal: number = gameState?.cells_to_reveal ?? (rows * cols - mines);
  const minesRemaining: number = gameState?.mines_remaining ?? mines;
  const phase: string = gameState?.phase ?? "waiting";

  const progress = cellsToReveal > 0 ? Math.round((revealedCount / cellsToReveal) * 100) : 0;

  const handleCellClick = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (phase === "won" || phase === "lost") return;

    const isRightClick = e.type === "contextmenu";
    if (isRightClick || flagMode) {
      if (phase !== "playing") return;
      ws.send(JSON.stringify({ action: "move", action_type: "flag", row: r, col: c }));
    } else {
      ws.send(JSON.stringify({ action: "move", action_type: "reveal", row: r, col: c }));
    }
  };

  const renderCell = (cell: string, r: number, c: number) => {
    const isHidden = cell === "?";
    const isFlag = cell === "F";
    const isMine = cell === "M";
    const isExploded = cell === "X";
    const isNumber = !isNaN(Number(cell)) && cell !== "?";
    const isEmpty = cell === "0";

    let bg = "bg-slate-700 hover:bg-slate-600 active:bg-slate-500 cursor-pointer";
    if (!isHidden && !isFlag) bg = "bg-slate-900 cursor-default";
    if (isExploded) bg = "bg-red-900 cursor-default";
    if (isMine && phase === "lost") bg = "bg-slate-800 cursor-default";

    return (
      <button
        key={`${r}-${c}`}
        onClick={(e) => handleCellClick(r, c, e)}
        onContextMenu={(e) => handleCellClick(r, c, e)}
        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm font-bold font-mono border border-slate-800/60 transition-colors select-none rounded-sm ${bg}`}
        disabled={(!isHidden && !isFlag) || phase === "won" || phase === "lost"}
      >
        {isFlag && <span className="text-yellow-400 text-xs">🚩</span>}
        {isExploded && <span className="text-xs">💥</span>}
        {isMine && <span className="text-xs">💣</span>}
        {isNumber && !isEmpty && (
          <span className={NUM_COLORS[cell] ?? "text-slate-300"}>{cell}</span>
        )}
      </button>
    );
  };

  if (!gameState) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-3 overflow-auto">

      {/* Header stats */}
      <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-3 text-sm">
        <div className="flex items-center gap-1.5 text-yellow-400">
          <span>🚩</span>
          <span className="font-bold tabular-nums">{minesRemaining}</span>
          <span className="text-slate-500 text-xs">left</span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="text-slate-500 text-xs">cleared</span>
          <span className="font-bold tabular-nums text-green-400">{revealedCount}</span>
          <span className="text-slate-500 text-xs">/ {cellsToReveal}</span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest
          ${mySymbol === "A" ? "text-cyan-400" : "text-rose-400"}`}>
          {mySymbol === "A" ? "🔵" : "🔴"} Player {mySymbol}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-[480px] bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-green-400 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flag mode toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFlagMode(f => !f)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold border transition-all
            ${flagMode
              ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
              : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}
        >
          <Flag size={14} /> {flagMode ? "Flag Mode ON" : "Flag Mode"}
        </button>
        <span className="text-slate-600 text-xs">or right-click any cell</span>
      </div>

      {/* Board */}
      <div
        className="grid gap-0.5 p-3 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {board.map((row, r) =>
          row.map((cell, c) => renderCell(cell, r, c))
        )}
      </div>

      {/* Overlays */}
      {phase === "won" && (
        <div className="fixed inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-green-500/50 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl shadow-green-500/10">
            <p className="text-5xl">🎉</p>
            <h2 className="text-3xl font-black text-green-400">Field Cleared!</h2>
            <p className="text-slate-400 text-sm">Both players worked together to survive!</p>
            <button onClick={handleRestart} className="px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl text-white font-semibold transition-all">
              Play Again
            </button>
          </div>
        </div>
      )}

      {phase === "lost" && (
        <div className="fixed inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/50 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl shadow-red-500/10">
            <p className="text-5xl">💥</p>
            <h2 className="text-3xl font-black text-red-400">Boom!</h2>
            <p className="text-slate-400 text-sm">A mine was triggered. Better luck next time!</p>
            <button onClick={handleRestart} className="px-6 py-2.5 bg-red-700 hover:bg-red-600 rounded-xl text-white font-semibold transition-all">
              Try Again
            </button>
          </div>
        </div>
      )}

      {phase === "waiting" && (
        <p className="text-slate-500 text-sm italic">Click any cell to start — your first click is always safe!</p>
      )}
    </div>
  );
}
