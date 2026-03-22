"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface SnakesLaddersProps {
  ws: WebSocket;
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
}

// Snakes: head -> tail  |  Ladders: bottom -> top  (mirrors backend)
const SNAKES:  Record<number, number> = { 99:78, 95:75, 87:36, 62:19, 54:34, 17:7 };
const LADDERS: Record<number, number> = { 4:14, 9:31, 20:38, 28:84, 40:59, 51:67, 63:81, 71:91 };

// Convert cell number (1-100) to grid [col, row] (0-indexed, row 0 = top)
function cellToGrid(n: number): [number, number] {
  if (n <= 0) return [-1, -1]; // Off board
  const row0 = Math.floor((n - 1) / 10); // 0 = bottom row
  const colInRow = (n - 1) % 10;
  const col = row0 % 2 === 0 ? colInRow : 9 - colInRow;
  const row = 9 - row0; // flip so row 0 is at top visually
  return [col, row];
}

// Cell centre as fraction of board size (for SVG overlays)
function cellCenter(n: number, cellSize: number): [number, number] {
  const [col, row] = cellToGrid(n);
  return [col * cellSize + cellSize / 2, row * cellSize + cellSize / 2];
}

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export default function SnakesLadders({ ws, gameState, mySymbol, handleRestart }: SnakesLaddersProps) {
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<number>(1);
  const [animInterval, setAnimInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const phase:      string       = gameState?.phase      ?? "waiting";
  const posA:       number       = gameState?.pos_A      ?? 0;
  const posB:       number       = gameState?.pos_B      ?? 0;
  const turn:       string       = gameState?.turn       ?? "A";
  const lastRoll:   number|null  = gameState?.last_roll  ?? null;
  const lastEvent:  string       = gameState?.last_event ?? "none";
  const winner:     string|null  = gameState?.winner     ?? null;

  const isMyTurn = turn === mySymbol && phase === "playing";

  // Animate dice when roll arrives
  useEffect(() => {
    if (lastRoll !== null && rolling) {
      setRolling(false);
      if (animInterval) clearInterval(animInterval);
      setDisplayDice(lastRoll);
    }
  }, [lastRoll]);

  useEffect(() => {
    if (phase === "waiting" && mySymbol) {
      ws.send(JSON.stringify({ action: "move", action_type: "ready" }));
    }
  }, [phase, mySymbol]);

  const handleRoll = () => {
    if (!isMyTurn || rolling) return;
    setRolling(true);
    // Animate dice face rapidly
    const iv = setInterval(() => setDisplayDice(Math.ceil(Math.random() * 6)), 80);
    setAnimInterval(iv);
    setTimeout(() => {
      clearInterval(iv);
      ws.send(JSON.stringify({ action: "move", action_type: "roll" }));
    }, 500);
  };

  const CELL = 44; // px per cell
  const BOARD = CELL * 10;

  const renderBoard = () => {
    const cells = [];
    for (let n = 100; n >= 1; n--) {
      const [col, row] = cellToGrid(n);
      const isSnakeHead   = n in SNAKES;
      const isSnakeTail   = Object.values(SNAKES).includes(n);
      const isLadderBot   = n in LADDERS;
      const isLadderTop   = Object.values(LADDERS).includes(n);
      const hasA = posA === n;
      const hasB = posB === n;
      const isCheckerDark = (Math.floor((n - 1) / 10) + (n - 1) % 10) % 2 === 1;

      let bg = isCheckerDark ? "bg-slate-800" : "bg-slate-850";
      if (isSnakeHead) bg = "bg-rose-900/70";
      if (isSnakeTail) bg = "bg-rose-950/60";
      if (isLadderBot) bg = "bg-emerald-900/70";
      if (isLadderTop) bg = "bg-emerald-950/60";

      cells.push(
        <div
          key={n}
          className={`relative flex flex-col items-center justify-center border border-slate-700/40 ${bg}`}
          style={{ gridColumn: col + 1, gridRow: row + 1, width: CELL, height: CELL }}
        >
          {/* Cell number */}
          <span className="text-[8px] text-slate-500 absolute top-0.5 left-1 leading-none">{n}</span>

          {/* Icons */}
          <span className="text-base leading-none select-none">
            {isSnakeHead ? "🐍" : isLadderBot ? "🪜" : isSnakeTail ? "🔴" : isLadderTop ? "⭐" : ""}
          </span>

          {/* Player tokens */}
          <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
            {hasA && (
              <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-cyan-200 flex items-center justify-center shadow-lg shadow-cyan-500/50">
                <span className="text-[7px] font-black text-slate-900">A</span>
              </div>
            )}
            {hasB && (
              <div className="w-4 h-4 rounded-full bg-rose-400 border-2 border-rose-200 flex items-center justify-center shadow-lg shadow-rose-500/50">
                <span className="text-[7px] font-black text-slate-900">B</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // SVG overlay for snake/ladder lines
    const svgLines = (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={BOARD} height={BOARD}
        style={{ zIndex: 5 }}
      >
        {/* Ladders — green lines */}
        {Object.entries(LADDERS).map(([bot, top]) => {
          const [x1, y1] = cellCenter(Number(bot), CELL);
          const [x2, y2] = cellCenter(Number(top), CELL);
          return (
            <g key={`ladder-${bot}`}>
              <line x1={x1-3} y1={y1} x2={x2-3} y2={y2} stroke="#4ade80" strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />
              <line x1={x1+3} y1={y1} x2={x2+3} y2={y2} stroke="#4ade80" strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />
              {/* Rungs */}
              {[0.25, 0.5, 0.75].map(t => (
                <line key={t}
                  x1={(x1-3)*(1-t)+(x2-3)*t} y1={y1*(1-t)+y2*t}
                  x2={(x1+3)*(1-t)+(x2+3)*t} y2={y1*(1-t)+y2*t}
                  stroke="#4ade80" strokeWidth={2} opacity={0.6}
                />
              ))}
            </g>
          );
        })}
        {/* Snakes — red curves */}
        {Object.entries(SNAKES).map(([head, tail]) => {
          const [x1, y1] = cellCenter(Number(head), CELL);
          const [x2, y2] = cellCenter(Number(tail), CELL);
          const mx = (x1 + x2) / 2 + 20;
          const my = (y1 + y2) / 2;
          return (
            <path key={`snake-${head}`}
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              stroke="#f87171" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.75}
            />
          );
        })}
      </svg>
    );

    return (
      <div
        className="relative border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl"
        style={{ width: BOARD, height: BOARD }}
      >
        <div
          className="grid absolute inset-0"
          style={{ gridTemplateColumns: `repeat(10, ${CELL}px)`, gridTemplateRows: `repeat(10, ${CELL}px)` }}
        >
          {cells}
        </div>
        {svgLines}
      </div>
    );
  };

  if (!gameState || phase === "waiting") return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="animate-spin text-amber-400" size={40} />
      <p className="text-sm">Waiting for both players…</p>
    </div>
  );

  const eventMsg: Record<string, string> = {
    snake:  "🐍 Oh no! Slid down a snake!",
    ladder: "🪜 Climbed a ladder!",
    win:    "🎉 Reached 100!",
    normal: "",
    none:   "",
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-3 p-3 overflow-auto">

      {/* Scoreboard */}
      <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-3 text-sm w-full max-w-lg justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-cyan-400 border-2 border-cyan-200 flex items-center justify-center">
            <span className="text-[8px] font-black text-slate-900">A</span>
          </div>
          <span className={`font-bold tabular-nums ${mySymbol === "A" ? "text-cyan-300" : "text-slate-300"}`}>
            Square {posA || "Start"}
          </span>
          {mySymbol === "A" && <span className="text-[10px] text-slate-500">(you)</span>}
        </div>
        <div className={`text-xs font-bold px-3 py-1 rounded-xl border
          ${isMyTurn ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-slate-800 border-slate-600 text-slate-500"}`}>
          {phase === "playing" ? (isMyTurn ? "Your turn!" : `${turn}'s turn`) : "Game over"}
        </div>
        <div className="flex items-center gap-2">
          {mySymbol === "B" && <span className="text-[10px] text-slate-500">(you)</span>}
          <span className={`font-bold tabular-nums ${mySymbol === "B" ? "text-rose-300" : "text-slate-300"}`}>
            Square {posB || "Start"}
          </span>
          <div className="w-5 h-5 rounded-full bg-rose-400 border-2 border-rose-200 flex items-center justify-center">
            <span className="text-[8px] font-black text-slate-900">B</span>
          </div>
        </div>
      </div>

      {/* Last event message */}
      {lastEvent && lastEvent !== "none" && lastEvent !== "normal" && (
        <div className="text-sm font-semibold text-amber-300 bg-amber-900/20 border border-amber-500/30 px-4 py-2 rounded-xl">
          {eventMsg[lastEvent]}
        </div>
      )}

      {/* Board */}
      <div className="overflow-auto max-w-full">
        {renderBoard()}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 flex-wrap justify-center">
        <span>🐍 Snake head (slide down)</span>
        <span>🔴 Snake tail</span>
        <span>🪜 Ladder bottom (climb up)</span>
        <span>⭐ Ladder top</span>
      </div>

      {/* Dice + Roll button */}
      <div className="flex items-center gap-4">
        <span className={`text-6xl transition-all ${rolling ? "animate-bounce" : ""}`}>
          {lastRoll ? DICE_FACES[displayDice] : "🎲"}
        </span>
        <button
          onClick={handleRoll}
          disabled={!isMyTurn || rolling}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-black text-lg rounded-2xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
        >
          {rolling ? "Rolling…" : isMyTurn ? "Roll Dice!" : `Waiting for ${turn}…`}
        </button>
      </div>

      {/* Win overlay */}
      {phase === "finished" && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50">
          <div className={`bg-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl border
            ${winner === mySymbol ? "border-amber-500/50 shadow-amber-500/10" : "border-slate-600 shadow-slate-600/10"}`}>
            <p className="text-5xl">{winner === mySymbol ? "🏆" : "😔"}</p>
            <h2 className={`text-3xl font-black ${winner === mySymbol ? "text-amber-400" : "text-slate-400"}`}>
              {winner === mySymbol ? "You Won!" : `Player ${winner} Won!`}
            </h2>
            <p className="text-slate-400 text-sm">
              {winner === mySymbol ? "You reached square 100 first!" : "Better luck next time!"}
            </p>
            <button onClick={handleRestart} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 rounded-xl text-slate-900 font-bold transition-all">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
