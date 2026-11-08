"use client";
import type React from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const COLS = 7;
const ROWS = 6;

type Board = (string | null)[][];

const DISC_COLORS: Record<string, string> = {
  R: "bg-candy-red",
  Y: "bg-candy-yellow",
};
const ARROW_COLORS: Record<string, string> = {
  R: "text-candy-red",
  Y: "text-candy-yellow",
};

/** The one cell that is filled in `next` but empty in `prev` (the disc just dropped). */
function newDisc(prev: Board, next: Board): { row: number; col: number } | null {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (next[r]?.[c] && !prev[r]?.[c]) return { row: r, col: c };
  return null;
}

/** "row-col" keys of the four-in-a-row belonging to `winner`. */
function winningCells(board: Board, winner: string | null): Set<string> {
  const cells = new Set<string>();
  if (!winner) return cells;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of dirs) {
        const line = [0, 1, 2, 3].map(k => [r + dr * k, c + dc * k]);
        if (line.every(([rr, cc]) => board[rr]?.[cc] === winner)) line.forEach(([rr, cc]) => cells.add(`${rr}-${cc}`));
      }
  return cells;
}

function lowestEmptyRow(board: Board, col: number): number | null {
  for (let r = ROWS - 1; r >= 0; r--) if (!board[r]?.[col]) return r;
  return null;
}

export default function ConnectFour({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const board: Board = gameState?.board ?? [];
  const currentTurn: string = gameState?.current_turn ?? "R";
  const winner: string | null = gameState?.winner ?? null;
  const isDraw: boolean = !!gameState?.is_draw;
  const over = !!winner || isDraw;
  const isMyTurn = !!mySymbol && mySymbol === currentTurn && !over;
  const discCount = board.flat().filter(Boolean).length;

  // Remember the previous board to find the disc that just landed (none on first render/refresh)
  const [tracked, setTracked] = useState<{ board: Board; drop: { row: number; col: number } | null }>({ board, drop: null });
  if (tracked.board !== board) setTracked({ board, drop: newDisc(tracked.board, board) });
  const drop = tracked.drop;

  useOnChange(isMyTurn, now => { if (now) play("turn"); });
  useOnChange(discCount, (n, p) => { if (n > p) play("drop"); });

  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-blue" size={48} /></div>;
  }

  const dropDisc = (col: number) => {
    if (!isMyTurn) return;
    ws.send(JSON.stringify({ action: "move", col }));
  };

  const winSet = winningCells(board, winner);
  const aimCol = isMyTurn && hoverCol !== null ? hoverCol : null;
  const previewRow = aimCol !== null ? lowestEmptyRow(board, aimCol) : null;
  const turnName = nameForSymbol(gameState, currentTurn) ?? `Player ${currentTurn}`;
  const outcome = outcomeFor(winner, isDraw, mySymbol);
  const title = resultTitle(gameState, winner, isDraw, mySymbol);
  const disc = (symbol: string) => `rounded-full border-[3px] border-ink ${DISC_COLORS[symbol] ?? ""}`;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-4 relative z-10 w-full">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[
          { symbol: "R", subtitle: "Red discs", token: <span className={`block w-5 h-5 ${disc("R")}`} /> },
          { symbol: "Y", subtitle: "Yellow discs", token: <span className={`block w-5 h-5 ${disc("Y")}`} /> },
        ]}
        activeSymbol={over ? null : currentTurn}
        matchScore={matchScore}
      />

      {over ? (
        <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>
      ) : isMyTurn ? (
        <TurnBanner tone="mine">🎉 Your turn!</TurnBanner>
      ) : mySymbol ? (
        <TurnBanner tone="wait">Waiting for {turnName}…</TurnBanner>
      ) : (
        <TurnBanner tone="info">{turnName}&apos;s turn</TurnBanner>
      )}

      <div onMouseLeave={() => setHoverCol(null)}>
        {/* Aim arrows above the columns */}
        <div className="grid gap-1 px-2 mb-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}>
          {Array.from({ length: COLS }, (_, c) => (
            <div key={c} aria-hidden="true" className="h-6 flex items-end justify-center text-xl leading-none">
              {aimCol === c && mySymbol && (
                <span className={`animate-bob ${ARROW_COLORS[mySymbol] ?? ""} [-webkit-text-stroke:2px_var(--color-ink)] [paint-order:stroke_fill]`}>▼</span>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-1 p-2 bg-candy-blue chunk" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}>
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => {
              const cell = board[r]?.[c];
              const isNew = drop?.row === r && drop?.col === c;
              const isWin = winSet.has(`${r}-${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => dropDisc(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  disabled={!isMyTurn}
                  aria-label={`Column ${c + 1}`}
                  className={`relative w-[min(11vw,3.5rem)] aspect-square rounded-full bg-cream shadow-[inset_0_4px_0_rgba(43,34,64,0.35)] ${isMyTurn ? "cursor-pointer" : "cursor-default"}`}
                >
                  {cell ? (
                    <span
                      className={`absolute inset-0 ${disc(cell)} ${isNew ? "animate-drop" : ""} ${isWin ? "animate-pulse ring-4 ring-white" : ""}`}
                      style={isNew ? ({ "--drop-from": `-${(r + 1) * 110}%` } as React.CSSProperties) : undefined}
                    />
                  ) : aimCol === c && previewRow === r && mySymbol ? (
                    <span aria-hidden="true" className={`absolute inset-0 opacity-40 ${disc(mySymbol)}`} />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      <ResultOverlay
        open={over}
        outcome={outcome}
        title={title}
        subtitle={scoreLine(matchScore, "R", "Y")}
        onPlayAgain={handleRestart}
      />
    </div>
  );
}
