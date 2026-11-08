"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { avatarColor } from "@/components/ui/Avatar";
import { nameForSymbol } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

// Classic Minesweeper number colours, bold enough to read on sand
const NUM_COLORS: Record<string, string> = {
  "1": "text-blue-700",
  "2": "text-green-700",
  "3": "text-red-600",
  "4": "text-ink",
  "5": "text-red-900",
  "6": "text-teal-700",
  "7": "text-candy-purple",
  "8": "text-ink/60",
};

const BEVEL = "shadow-[inset_2px_2px_0_rgba(255,255,255,0.45),inset_-2px_-2px_0_rgba(43,34,64,0.25)]";

export default function Minesweeper({ ws, gameState, mySymbol, handleRestart }: GameProps) {
  const [flagMode, setFlagMode] = useState(false);

  const board: string[][] = gameState?.board ?? [];
  const rows: number = gameState?.rows ?? 14;
  const cols: number = gameState?.cols ?? 14;
  const mines: number = gameState?.mines ?? 30;
  const revealedCount: number = gameState?.revealed_count ?? 0;
  const cellsToReveal: number = gameState?.cells_to_reveal ?? (rows * cols - mines);
  const minesRemaining: number = gameState?.mines_remaining ?? mines;
  const phase: string = gameState?.phase ?? "waiting";
  const revealedBy: (string | null)[][] | undefined = gameState?.revealed_by;

  const progress = cellsToReveal > 0 ? Math.round((revealedCount / cellsToReveal) * 100) : 0;
  const dug = (sym: string) => revealedBy?.reduce((n, row) => n + row.filter(v => v === sym).length, 0) ?? 0;
  const over = phase === "won" || phase === "lost";

  useOnChange(revealedCount, (n, p) => { if (n > p) play("place"); });
  useOnChange(phase, p => { if (p === "lost") play("hit"); });

  const handleCellClick = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!mySymbol || phase === "won" || phase === "lost") return;

    const isRightClick = e.type === "contextmenu";
    if (isRightClick || flagMode) {
      if (phase !== "playing") return;
      play("click");
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
    const even = (r + c) % 2 === 0;
    const owner = revealedBy?.[r]?.[c];

    let bg: string;
    if (isExploded) bg = "bg-candy-red";
    else if (isHidden || isFlag) bg = `${even ? "bg-candy-green" : "bg-candy-green/80"} ${BEVEL} ${over ? "" : "cursor-pointer hover:brightness-110 active:brightness-95"}`;
    else bg = even ? "bg-cream-2" : "bg-[#f5deb3]";

    return (
      <button
        key={`${r}-${c}`}
        onClick={(e) => handleCellClick(r, c, e)}
        onContextMenu={(e) => handleCellClick(r, c, e)}
        className={`relative w-[min(6.4vw,1.9rem)] aspect-square flex items-center justify-center font-black select-none text-[min(4vw,1.1rem)] leading-none ${bg}`}
        disabled={!mySymbol || (!isHidden && !isFlag) || over}
        aria-label={`Row ${r + 1}, column ${c + 1}`}
      >
        {isFlag && <span className="animate-pop">🚩</span>}
        {isExploded && <span>💥</span>}
        {isMine && <span>💣</span>}
        {isNumber && !isEmpty && <span className={NUM_COLORS[cell] ?? "text-ink"}>{cell}</span>}
        {owner && (
          <span
            aria-hidden="true"
            className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-ink/60 ${avatarColor(nameForSymbol(gameState, owner) ?? owner)}`}
          />
        )}
      </button>
    );
  };

  if (!gameState) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="animate-spin text-candy-green" size={48} />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center gap-3 sm:gap-4 p-2 sm:p-4 relative z-10 w-full overflow-y-auto overflow-x-hidden">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[{ symbol: "A", subtitle: `dug ${dug("A")}` }, { symbol: "B", subtitle: `dug ${dug("B")}` }]}
        showScore={false}
        centerLabel="🤝"
      />

      {/* Team progress and mines left */}
      <div className="w-full max-w-md flex items-center gap-2">
        <div className="flex-1 chunk-sm bg-white h-6 rounded-full overflow-hidden relative">
          <div className="h-full bg-candy-green transition-all duration-300" style={{ width: `${progress}%` }} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-ink">
            {progress}% cleared
          </span>
        </div>
        <div className="chunk-sm bg-candy-yellow rounded-full px-3 h-6 flex items-center gap-1 text-sm font-bold text-ink tabular-nums">
          🚩 {minesRemaining}
        </div>
      </div>

      {/* Dig / flag toggle */}
      <div className="flex items-center gap-3">
        <ToyButton
          color={flagMode ? "orange" : "yellow"}
          className="max-sm:px-6 max-sm:py-3 max-sm:text-lg"
          aria-pressed={flagMode}
          onClick={() => setFlagMode(f => !f)}
        >
          {flagMode ? "🚩 Flag" : "⛏️ Dig"}
        </ToyButton>
        <span className="hidden sm:inline text-ink/60 text-xs font-bold">or right-click to flag</span>
      </div>

      {/* Board */}
      <div
        className="chunk bg-ink/80 p-1 grid overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}
      >
        {board.map((row, r) => row.map((cell, c) => renderCell(cell, r, c)))}
      </div>

      {phase === "waiting" && (
        <p className="text-ink/70 text-sm font-bold text-center">Dig any tile to start: your first dig is always safe!</p>
      )}

      <ResultOverlay
        open={over}
        outcome={phase === "won" ? "win" : "lose"}
        title={phase === "won" ? "Team win! 🎉" : "Boom! 💥"}
        subtitle={`Cleared ${revealedCount} of ${cellsToReveal}`}
        onPlayAgain={handleRestart}
      />
    </div>
  );
}
