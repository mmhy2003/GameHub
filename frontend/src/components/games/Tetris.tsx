"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameProps } from "@/lib/types";

const ROWS = 20;
const COLS = 10;
const TICK_RATE = 500;

const SHAPES = [
  [],
  [[1, 1, 1, 1]],
  [[2, 0, 0], [2, 2, 2]],
  [[0, 0, 3], [3, 3, 3]],
  [[4, 4], [4, 4]],
  [[0, 5, 5], [5, 5, 0]],
  [[0, 6, 0], [6, 6, 6]],
  [[7, 7, 0], [0, 7, 7]]
];

const COLORS = [
  "bg-slate-900 border-slate-900",
  "bg-cyan-400 border-cyan-300",
  "bg-blue-500 border-blue-400",
  "bg-orange-500 border-orange-400",
  "bg-yellow-400 border-yellow-300",
  "bg-green-500 border-green-400",
  "bg-purple-500 border-purple-400",
  "bg-rose-500 border-rose-400",
  "bg-slate-600 border-slate-500"
];

type Matrix = number[][];
const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export default function Tetris({ ws, gameState, mySymbol, handleRestart }: GameProps) {
  const [board, setBoard] = useState<Matrix>(createEmptyBoard());
  const [piece, setPiece] = useState<{ shape: Matrix; x: number; y: number; color: number } | null>(null);
  const [gameOverLocal, setGameOverLocal] = useState(false);

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const isPlayingLocal = useRef(false);

  // Derived values — safe to access before gameState is ready via optional chaining
  const scores = gameState?.scores ?? {};
  const garbage_queue = gameState?.garbage_queue ?? {};
  const winner = gameState?.winner ?? null;
  const phase = gameState?.phase ?? "lobby";
  const ready = gameState?.ready ?? {};
  const enemySymbol = mySymbol === "P1" ? "P2" : "P1";
  const isPlaying = phase === "playing";


  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { pieceRef.current = piece; }, [piece]);

  const checkCollision = useCallback((p: any, b: Matrix) => {
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c] !== 0) {
          const newY = p.y + r;
          const newX = p.x + c;
          if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && b[newY][newX] !== 0)) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const spawnPiece = useCallback(() => {
    const typeId = Math.floor(Math.random() * 7) + 1;
    const newPiece = { shape: SHAPES[typeId], x: Math.floor(COLS / 2) - 1, y: 0, color: typeId };
    if (checkCollision(newPiece, boardRef.current)) {
      setGameOverLocal(true);
      ws.send(JSON.stringify({ action: "move", action_type: "game_over" }));
    } else {
      setPiece(newPiece);
    }
  }, [ws, checkCollision]);

  const mergePiece = useCallback(() => {
    if (!pieceRef.current) return;
    const newBoard = boardRef.current.map(row => [...row]);
    const p = pieceRef.current;
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c] !== 0 && p.y + r >= 0 && p.y + r < ROWS) {
          newBoard[p.y + r][p.x + c] = p.color;
        }
      }
    }
    let linesCleared = 0;
    const finalBoard = newBoard.filter(row => {
      const isFull = row.every(cell => cell !== 0 && cell !== 8);
      if (isFull) linesCleared++;
      return !isFull;
    });
    while (finalBoard.length < ROWS) finalBoard.unshift(Array(COLS).fill(0));
    if (linesCleared > 0) ws.send(JSON.stringify({ action: "move", action_type: "lines_cleared", count: linesCleared }));
    setBoard(finalBoard);
    spawnPiece();
  }, [ws, spawnPiece]);

  const dropDown = useCallback(() => {
    if (!pieceRef.current || gameOverLocal || winner) return;
    const nextP = { ...pieceRef.current, y: pieceRef.current.y + 1 };
    if (!checkCollision(nextP, boardRef.current)) {
      setPiece(nextP);
    } else {
      mergePiece();
    }
  }, [mergePiece, checkCollision, gameOverLocal, winner]);

  // Garbage row injection — only while playing
  useEffect(() => {
    if (!isPlaying) return;
    if (mySymbol && garbage_queue[mySymbol] > 0 && !gameOverLocal && pieceRef.current) {
      const count = garbage_queue[mySymbol];
      ws.send(JSON.stringify({ action: "move", action_type: "consume_garbage", count }));
      setBoard(prev => {
        const b = prev.slice(count);
        for (let i = 0; i < count; i++) {
          const garbageRow = Array(COLS).fill(8);
          garbageRow[Math.floor(Math.random() * COLS)] = 0;
          b.push(garbageRow);
        }
        return b;
      });
      setPiece(p => p ? { ...p, y: Math.max(0, p.y - count) } : null);
    }
  }, [garbage_queue, mySymbol, ws, gameOverLocal]);

  // Keyboard controls — only while playing
  useEffect(() => {
    if (!isPlaying) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) return;
      e.preventDefault(); // Stop page scrolling for all game keys
      if (!pieceRef.current || gameOverLocal || winner) return;
      const p = { ...pieceRef.current };
      if (e.key === "ArrowLeft") p.x -= 1;
      else if (e.key === "ArrowRight") p.x += 1;
      else if (e.key === "ArrowDown") { dropDown(); return; }
      else if (e.key === "ArrowUp") {
        p.shape = p.shape[0].map((_, idx) => p.shape.map(row => row[idx]).reverse());
      } else if (e.key === " ") {
        let hardDropP = { ...pieceRef.current };
        while (!checkCollision({ ...hardDropP, y: hardDropP.y + 1 }, boardRef.current)) hardDropP.y += 1;
        setPiece(hardDropP);
        setTimeout(() => mergePiece(), 0);
        return;
      }
      if (!checkCollision(p, boardRef.current)) setPiece(p);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dropDown, checkCollision, mergePiece, gameOverLocal, winner]);

  // Game loop — only starts when both players are ready
  useEffect(() => {
    if (!gameState || !isPlaying || gameOverLocal || winner) return;
    if (!isPlayingLocal.current) {
      spawnPiece();
      isPlayingLocal.current = true;
    }
    const int = setInterval(dropDown, TICK_RATE);
    return () => clearInterval(int);
  }, [gameState, dropDown, spawnPiece, gameOverLocal, winner]);

  // All hooks done — safe to do early loading return now
  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  // Lobby screen — waiting for both players to ready up
  if (phase === "lobby") {
    const handleReady = () => {
      ws.send(JSON.stringify({ action: "move", action_type: "set_ready" }));
    };
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl backdrop-blur-md max-w-sm w-full">
          <h2 className="text-2xl font-bold text-slate-100">Waiting Room</h2>
          <p className="text-slate-400 text-sm text-center">Both players must be ready before Tetris begins.</p>
          <div className="w-full flex flex-col gap-2 my-2">
            <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${ready["P1"] ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
              <span className="font-mono text-sm">Player 1 (P1)</span>
              <span className="text-xs">{ready["P1"] ? "✓ Ready" : "Waiting..."}</span>
            </div>
            <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${ready["P2"] ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
              <span className="font-mono text-sm">Player 2 (P2)</span>
              <span className="text-xs">{ready["P2"] ? "✓ Ready" : "Waiting..."}</span>
            </div>
          </div>
          {mySymbol && !ready[mySymbol] ? (
            <button onClick={handleReady} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all shadow-lg shadow-indigo-500/20">
              Ready!
            </button>
          ) : (
            <div className="text-indigo-400 flex items-center gap-2 animate-pulse text-sm"><Loader2 className="animate-spin" size={16} /> Waiting for opponent...</div>
          )}
        </div>
      </div>
    );
  }

  const renderBoard = board.map(row => [...row]);
  if (piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] !== 0 && piece.y + r >= 0 && piece.y + r < ROWS && piece.x + c >= 0 && piece.x + c < COLS) {
          renderBoard[piece.y + r][piece.x + c] = piece.color;
        }
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 gap-12 relative z-10 w-full overflow-y-auto outline-none" tabIndex={0}>

      {winner && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
          <div className="bg-slate-900/95 backdrop-blur-lg border border-slate-700 px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center w-64 pointer-events-auto">
            <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent text-center">
              {winner === mySymbol ? `Victory!` : `Defeat! Player ${winner} Won.`}
            </h2>
            <button
              onClick={() => { setGameOverLocal(false); isPlayingLocal.current = false; setBoard(createEmptyBoard()); setPiece(null); handleRestart(); }}
              className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-all shadow-lg"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      <div className={`flex flex-col items-center p-4 bg-slate-900/80 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md transition-all ${gameOverLocal ? "grayscale opacity-50 blur-[2px]" : ""}`}>
        <div className="flex justify-between w-full mb-3 text-slate-200 font-bold px-4">
          <span className="text-indigo-400 flex flex-col items-center text-xs uppercase tracking-widest">
            <span className="text-xl mb-1">{scores[mySymbol ?? "P1"] ?? 0}</span> Your Score
          </span>
          <span className="text-rose-400 flex flex-col items-center text-xs uppercase tracking-widest">
            <span className="text-xl mb-1">{scores[enemySymbol] ?? 0}</span> Enemy Score
          </span>
        </div>
        <div
          className="grid bg-slate-950 p-2 rounded-lg border-2 border-slate-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
          style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {renderBoard.map((row, r) =>
            row.map((cell, c) => (
              <div key={`${r}-${c}`} className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 border m-[1px] rounded-[3px] transition-colors ${cell !== 0 ? "shadow-inner" : "border-slate-900/40 border-r-transparent border-b-transparent"} ${COLORS[cell]}`} />
            ))
          )}
        </div>
        <div className="w-full hidden md:flex justify-center gap-6 mt-4 opacity-50 text-slate-400 text-xs text-center border-t border-slate-800 pt-3 font-mono">
          <p>[←] [→] Move</p>
          <p>[↑] Rotate</p>
          <p>[↓] Drop</p>
          <p>[SPC] Hard Drop</p>
        </div>
      </div>

      {/* Mobile Touch Controls — visible only on small screens */}
      <div className="md:hidden flex flex-col items-center gap-3 mt-4 w-full max-w-xs">
        {/* Rotate button at top center */}
        <button
          onPointerDown={(e) => { e.preventDefault(); if (!pieceRef.current || gameOverLocal || winner) return; const p = { ...pieceRef.current }; p.shape = p.shape[0].map((_, idx) => p.shape.map(row => row[idx]).reverse()); if (!checkCollision(p, boardRef.current)) setPiece(p); }}
          className="game-btn w-16 h-16 bg-slate-800 hover:bg-slate-700 active:bg-indigo-700 border border-slate-600 rounded-2xl text-2xl flex items-center justify-center shadow-lg transition-colors"
        >↑</button>

        {/* Middle row: Left | Drop | Right */}
        <div className="flex gap-4 items-center">
          <button
            onPointerDown={(e) => { e.preventDefault(); if (!pieceRef.current || gameOverLocal || winner) return; const p = { ...pieceRef.current, x: pieceRef.current.x - 1 }; if (!checkCollision(p, boardRef.current)) setPiece(p); }}
            className="game-btn w-16 h-16 bg-slate-800 hover:bg-slate-700 active:bg-indigo-700 border border-slate-600 rounded-2xl text-2xl flex items-center justify-center shadow-lg transition-colors"
          >←</button>
          <button
            onPointerDown={(e) => { e.preventDefault(); dropDown(); }}
            className="game-btn w-16 h-16 bg-slate-800 hover:bg-slate-700 active:bg-indigo-700 border border-slate-600 rounded-2xl text-2xl flex items-center justify-center shadow-lg transition-colors"
          >↓</button>
          <button
            onPointerDown={(e) => { e.preventDefault(); if (!pieceRef.current || gameOverLocal || winner) return; const p = { ...pieceRef.current, x: pieceRef.current.x + 1 }; if (!checkCollision(p, boardRef.current)) setPiece(p); }}
            className="game-btn w-16 h-16 bg-slate-800 hover:bg-slate-700 active:bg-indigo-700 border border-slate-600 rounded-2xl text-2xl flex items-center justify-center shadow-lg transition-colors"
          >→</button>
        </div>

        {/* Hard drop */}
        <button
          onPointerDown={(e) => { e.preventDefault(); if (!pieceRef.current || gameOverLocal || winner) return; let hp = { ...pieceRef.current }; while (!checkCollision({ ...hp, y: hp.y + 1 }, boardRef.current)) hp.y += 1; setPiece(hp); setTimeout(() => mergePiece(), 0); }}
          className="game-btn w-full py-3 bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-500 border border-indigo-500/50 rounded-2xl text-white font-bold text-sm shadow-lg transition-colors"
        >⚡ Hard Drop</button>
      </div>

    </div>
  );
}
