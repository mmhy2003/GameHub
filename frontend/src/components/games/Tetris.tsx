"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import Avatar from "@/components/ui/Avatar";
import TetrisWell, { type TetrisPiece } from "./TetrisWell";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const ROWS = 20;
const COLS = 10;
const TICK_RATE = 500;
const GARBAGE_CAP = 10;

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

const randomType = () => Math.floor(Math.random() * 7) + 1;

type Matrix = number[][];
const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export default function Tetris({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [board, setBoard] = useState<Matrix>(createEmptyBoard());
  const [piece, setPiece] = useState<TetrisPiece | null>(null);
  const [nextType, setNextType] = useState(0);
  const [gameOverLocal, setGameOverLocal] = useState(false);

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  // Pre-generated next piece (0 = not drawn yet); same uniform draw as before
  const nextPieceRef = useRef(0);
  const isPlayingLocal = useRef(false);

  // Derived values — safe to access before gameState is ready via optional chaining
  const scores = gameState?.scores ?? {};
  const garbage_queue = gameState?.garbage_queue ?? {};
  const winner = gameState?.winner ?? null;
  const phase = gameState?.phase ?? "lobby";
  const ready = gameState?.ready ?? {};
  const isDraw = gameState?.is_draw ?? false;
  const me = mySymbol ?? "P1";
  const enemySymbol = me === "P1" ? "P2" : "P1";
  const isPlaying = phase === "playing";
  const myScore: number = scores[me] ?? 0;
  const myGarbage: number = garbage_queue[me] ?? 0;

  useOnChange(myScore, (n, p) => { if (n > p) play("pop"); });
  useOnChange(myGarbage, (n, p) => { if (n > p) play("hit"); });

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { pieceRef.current = piece; }, [piece]);

  const checkCollision = useCallback((p: TetrisPiece, b: Matrix) => {
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
    const typeId = nextPieceRef.current || randomType();
    nextPieceRef.current = randomType();
    setNextType(nextPieceRef.current);
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
    play("place");
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
        const hardDropP = { ...pieceRef.current };
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
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;
  }

  const nameOf = (sym: string) => nameForSymbol(gameState, sym) ?? `Player ${sym.slice(1)}`;
  const linesOf = (sym: string) => Math.floor((scores[sym] ?? 0) / 100);
  const readySticker = (sym: string) => ready[sym] ? "✅ Ready" : "⏳ Not ready";
  const isLobby = phase === "lobby";
  const cards = (
    <PlayerCards
      gameState={gameState}
      mySymbol={mySymbol}
      players={[
        { symbol: "P1", subtitle: isLobby ? readySticker("P1") : `${linesOf("P1")} lines` },
        { symbol: "P2", subtitle: isLobby ? readySticker("P2") : `${linesOf("P2")} lines` },
      ]}
      matchScore={matchScore}
    />
  );

  // Lobby screen — waiting for both players to ready up
  if (isLobby) {
    const handleReady = () => {
      ws.send(JSON.stringify({ action: "move", action_type: "set_ready" }));
    };
    const iAmReady = !!mySymbol && !!ready[mySymbol];
    return (
      <div className="flex-1 flex flex-col items-center gap-6 p-2 sm:p-4 w-full overflow-y-auto">
        {cards}
        <div className="chunk bg-white p-6 sm:p-8 flex flex-col items-center gap-4 max-w-sm w-full text-ink animate-pop">
          <div className="text-6xl" aria-hidden="true">{iAmReady ? "✅" : "🟦"}</div>
          <h2 className="text-2xl font-black">Block party!</h2>
          <p className="text-ink/70 text-sm font-bold text-center">Both players must be ready before Tetris begins.</p>
          <div className="w-full grid grid-cols-2 gap-2">
            {["P1", "P2"].map(sym => (
              <div key={sym} className={`chunk-sm rounded-xl px-2 py-2 text-center text-sm font-bold truncate ${ready[sym] ? "bg-candy-green" : "bg-cream-2"}`}>
                <div className="text-2xl" aria-hidden="true">{ready[sym] ? "✅" : "⏳"}</div>
                {nameOf(sym)}
              </div>
            ))}
          </div>
          {mySymbol && !iAmReady ? (
            <ToyButton color="green" size="lg" className="w-full" onClick={handleReady}>Ready?</ToyButton>
          ) : (
            <div className="text-ink/70 font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Waiting for opponent…</div>
          )}
        </div>
      </div>
    );
  }

  const blocked = () => !pieceRef.current || gameOverLocal || !!winner;
  const tryMove = (p: TetrisPiece) => { if (!checkCollision(p, boardRef.current)) setPiece(p); };
  const touch = {
    left: () => { if (blocked()) return; tryMove({ ...pieceRef.current!, x: pieceRef.current!.x - 1 }); },
    right: () => { if (blocked()) return; tryMove({ ...pieceRef.current!, x: pieceRef.current!.x + 1 }); },
    rotate: () => {
      if (blocked()) return;
      const p = { ...pieceRef.current! };
      p.shape = p.shape[0].map((_, idx) => p.shape.map(row => row[idx]).reverse());
      tryMove(p);
    },
    down: () => dropDown(),
    hardDrop: () => {
      if (blocked()) return;
      const hp = { ...pieceRef.current! };
      while (!checkCollision({ ...hp, y: hp.y + 1 }, boardRef.current)) hp.y += 1;
      setPiece(hp);
      setTimeout(() => mergePiece(), 0);
    },
  };
  const controls = [
    ["◀", "Move left", "left"],
    ["⟳", "Rotate", "rotate"],
    ["▶", "Move right", "right"],
    ["▼", "Soft drop", "down"],
    ["⤓", "Hard drop", "hardDrop"],
  ] as const;

  const lines = linesOf(me);
  const level = Math.floor(lines / 10) + 1;
  const garbageShown = Math.min(myGarbage, GARBAGE_CAP);
  const enemyGarbage = Math.min(garbage_queue[enemySymbol] ?? 0, GARBAGE_CAP);
  const sticker = "chunk-sm bg-white rounded-xl px-2 py-1 text-ink text-center";
  const label = "text-[0.65rem] sm:text-xs font-bold uppercase tracking-wide text-ink/60";

  const resetLocal = () => { setGameOverLocal(false); isPlayingLocal.current = false; setBoard(createEmptyBoard()); setPiece(null); };

  return (
    <div className="flex-1 flex flex-col items-center p-2 sm:p-4 gap-3 sm:gap-4 relative z-10 w-full overflow-y-auto overflow-x-hidden outline-none" tabIndex={0}>
      {cards}

      <div className="flex items-stretch justify-center gap-1.5 sm:gap-4 [--cell:min(7vw,1.35rem)] md:[--cell:min(4.2vh,1.6rem)]">
        {/* Garbage meter: rows waiting to land on my well */}
        <div className="chunk-sm w-2.5 sm:w-4 rounded-full! bg-white overflow-hidden flex flex-col justify-end" title={`${myGarbage} garbage rows incoming`}>
          <div className="bg-candy-red transition-all duration-300" style={{ height: `${(garbageShown / ROWS) * 100}%` }} />
        </div>

        <TetrisWell board={board} piece={piece} cellSize="var(--cell)" dim={gameOverLocal} />

        <div className="flex flex-col gap-2 w-20 sm:w-28">
          <div className={sticker}>
            <div className={label}>Next</div>
            <div className="flex justify-center py-1 min-h-10">
              {nextType > 0 && <TetrisWell board={SHAPES[nextType]} cellSize="min(3.4vw,0.9rem)" />}
            </div>
          </div>
          <div className={sticker}><div className={label}>Lines</div><div className="text-lg sm:text-2xl font-black tabular-nums">{lines}</div></div>
          <div className={sticker}><div className={label}>Level</div><div className="text-lg sm:text-2xl font-black tabular-nums">{level}</div></div>
          <div className={sticker}><div className={label}>Score</div><div className="text-lg sm:text-2xl font-black tabular-nums">{myScore}</div></div>

          {/* Opponent: the backend does not share their board, so show their stats */}
          <div className="chunk-sm bg-cream-2 rounded-xl p-2 text-ink opacity-80 flex flex-col items-center gap-1 mt-auto">
            <Avatar name={nameForSymbol(gameState, enemySymbol) ?? ""} size={28} />
            <div className="text-xs font-bold truncate max-w-full">{nameOf(enemySymbol)}</div>
            <div className="text-xs font-bold tabular-nums">{linesOf(enemySymbol)} lines · {scores[enemySymbol] ?? 0}</div>
            <div className="w-full h-2 rounded-full bg-white ring-1 ring-ink/40 overflow-hidden" title={`${enemyGarbage} garbage rows incoming`}>
              <div className="h-full bg-candy-red transition-all duration-300" style={{ width: `${(enemyGarbage / GARBAGE_CAP) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:flex justify-center gap-4 text-ink/60 text-xs font-bold">
        <span>←/→ Move</span><span>↑ Rotate</span><span>↓ Drop</span><span>Space Hard drop</span>
      </div>

      {/* Touch controls — visible only on small screens */}
      <div className="md:hidden flex flex-wrap justify-center gap-2 w-full">
        {controls.map(([icon, name, id]) => (
          <button
            key={name}
            aria-label={name}
            onPointerDown={(e) => { e.preventDefault(); touch[id](); }}
            className="game-btn btn-toy w-16 h-16 rounded-2xl bg-candy-yellow text-ink text-2xl font-black flex items-center justify-center select-none"
          >{icon}</button>
        ))}
      </div>

      <ResultOverlay
        open={!!winner || isDraw}
        outcome={outcomeFor(winner, isDraw, mySymbol)}
        title={resultTitle(gameState, winner, isDraw, mySymbol)}
        subtitle={scoreLine(matchScore, "P1", "P2")}
        onPlayAgain={() => { resetLocal(); handleRestart(); }}
      />
    </div>
  );
}
