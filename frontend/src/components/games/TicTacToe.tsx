"use client";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const MARK_COLORS: Record<string, string> = {
  X: "text-candy-blue",
  O: "text-candy-pink",
};

// Heavy ink outline + offset shadow so marks look like stickers
const MARK_STYLE = "[-webkit-text-stroke:3px_var(--color-ink)] [paint-order:stroke_fill] [text-shadow:3px_3px_0_var(--color-ink)]";

function winningLine(board: (string | null)[], winner: string | null): number[] {
  if (!winner) return [];
  return LINES.find(line => line.every(i => board[i] === winner)) ?? [];
}

export default function TicTacToe({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const board: (string | null)[] = gameState?.board ?? [];
  const currentTurn: string | null = gameState?.current_turn ?? null;
  const winner: string | null = gameState?.winner ?? null;
  const isDraw: boolean = !!gameState?.is_draw;
  const over = !!winner || isDraw;
  const isMyTurn = !!mySymbol && currentTurn === mySymbol && !over;
  const filled = board.filter(Boolean).length;

  useOnChange(isMyTurn, now => { if (now) play("turn"); });
  useOnChange(filled, (n, p) => { if (n > p) play("place"); });

  if (!gameState) {
     return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;
  }

  const winLine = winningLine(board, winner);
  const turnName = nameForSymbol(gameState, currentTurn) ?? `Player ${currentTurn}`;
  const outcome = outcomeFor(winner, isDraw, mySymbol);
  const title = resultTitle(gameState, winner, isDraw, mySymbol);

  const handleCellClick = (index: number) => {
    if (!isMyTurn || board[index] !== null) return;
    ws.send(JSON.stringify({ action: "move", index }));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-4 relative z-10 w-full h-full">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[{ symbol: "X", subtitle: "Plays X" }, { symbol: "O", subtitle: "Plays O" }]}
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

      <div className="grid grid-cols-3 gap-3 p-3 bg-candy-purple chunk">
        {board.map((cell, idx) => {
          const canPlay = isMyTurn && cell === null;
          return (
            <button
              key={idx}
              onClick={() => handleCellClick(idx)}
              disabled={!canPlay}
              aria-label={cell ? `Square ${idx + 1}: ${cell}` : `Square ${idx + 1}: empty`}
              className={`group w-[min(26vw,7.5rem)] aspect-square rounded-2xl border-[3px] border-ink flex items-center justify-center font-black text-[min(17vw,5rem)] leading-none transition-colors
                ${winLine.includes(idx) ? "bg-candy-yellow" : "bg-white"}
                ${canPlay ? "cursor-pointer hover:bg-cream-2" : "cursor-default"}`}
            >
              {cell ? (
                <span className={`animate-pop ${MARK_COLORS[cell] ?? ""} ${MARK_STYLE}`}>{cell}</span>
              ) : canPlay && mySymbol ? (
                <span aria-hidden="true" className={`opacity-0 group-hover:opacity-25 ${MARK_COLORS[mySymbol] ?? ""} ${MARK_STYLE}`}>{mySymbol}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ResultOverlay
        open={over}
        outcome={outcome}
        title={title}
        subtitle={scoreLine(matchScore, "X", "O")}
        onPlayAgain={handleRestart}
      />
    </div>
  );
}
