"use client";
import { useState, useCallback } from "react";
import { Loader2, Shuffle, CheckCircle } from "lucide-react";
import type { GameProps } from "@/lib/types";

const ROWS = 8, COLS = 8;

// Piece display config: rank -> { name, short, color }
const RANK_DISPLAY: Record<number, { name: string; short: string; bg: string; text: string }> = {
  "-1": { name: "?",          short: "?",   bg: "bg-slate-700",   text: "text-slate-400" },
   0:  { name: "Flag",        short: "🚩",  bg: "bg-yellow-600",  text: "text-yellow-100" },
  11:  { name: "Bomb",        short: "💣",  bg: "bg-zinc-700",    text: "text-zinc-200" },
   1:  { name: "Spy",         short: "Spy", bg: "bg-purple-700",  text: "text-purple-100" },
   2:  { name: "Scout",       short: "Sct", bg: "bg-sky-700",     text: "text-sky-100" },
   3:  { name: "Miner",       short: "Min", bg: "bg-teal-700",    text: "text-teal-100" },
   4:  { name: "Sergeant",    short: "Sgt", bg: "bg-blue-700",    text: "text-blue-100" },
   5:  { name: "Lieutenant",  short: "Lt",  bg: "bg-blue-600",    text: "text-blue-100" },
   6:  { name: "Captain",     short: "Cap", bg: "bg-indigo-600",  text: "text-indigo-100" },
   7:  { name: "Major",       short: "Maj", bg: "bg-indigo-700",  text: "text-indigo-100" },
   8:  { name: "Colonel",     short: "Col", bg: "bg-violet-700",  text: "text-violet-100" },
   9:  { name: "General",     short: "Gen", bg: "bg-fuchsia-700", text: "text-fuchsia-100" },
  10:  { name: "Marshal",     short: "Mar", bg: "bg-amber-600",   text: "text-amber-100" },
} as any;

const PIECE_ORDER = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 0];

function rankDisplay(rank: number, owner: string, mySymbol: string) {
  if (owner !== mySymbol && rank === -1) return RANK_DISPLAY[-1];
  return RANK_DISPLAY[rank] ?? { name: String(rank), short: String(rank), bg: "bg-slate-500", text: "text-white" };
}

function isLake(r: number, c: number, lakes: number[][]): boolean {
  return lakes.some(([lr, lc]) => lr === r && lc === c);
}

function getValidMoves(board: any[][], r: number, c: number, mySymbol: string, lakes: number[][]): { moves: number[][], attacks: number[][] } {
  const cell = board[r]?.[c];
  if (!cell || cell.owner !== mySymbol) return { moves: [], attacks: [] };
  const isScout = cell.rank === 2;
  const movable = cell.rank !== 0 && cell.rank !== 11;
  if (!movable) return { moves: [], attacks: [] };
  const moves: number[][] = [], attacks: number[][] = [];
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let nr = r+dr, nc = c+dc;
    while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      if (isLake(nr, nc, lakes)) break;
      const target = board[nr]?.[nc];
      if (!target) { moves.push([nr, nc]); if (!isScout) break; nr += dr; nc += dc; }
      else if (target.owner === mySymbol) break;
      else { attacks.push([nr, nc]); break; }
    }
  }
  return { moves, attacks };
}

const RESULT_MSG: Record<string, string> = {
  attacker: "Attacker wins!",
  defender: "Defender wins!",
  both: "Both eliminated!",
};

export default function Stratego({ ws, gameState, mySymbol, handleRestart }: GameProps) {
  const [selectedInventoryRank, setSelectedInventoryRank] = useState<number | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves]   = useState<number[][]>([]);
  const [validAttacks, setValidAttacks] = useState<number[][]>([]);
  const [dismissedCombat, setDismissedCombat] = useState<string | null>(null);

  const phase: string      = gameState?.phase      ?? "setup";
  const board: any[][]     = gameState?.board       ?? [];
  const turn: string       = gameState?.turn        ?? "A";
  const winner: string|null  = gameState?.winner    ?? null;
  const setupDone: any     = gameState?.setup_done  ?? {};
  const remaining: any     = gameState?.remaining   ?? {};
  const lastCombat: any    = gameState?.last_combat ?? null;
  const lakes: number[][]  = gameState?.lakes       ?? [];
  const totalPieces: number  = gameState?.total_pieces ?? 20;
  const placedCount: number  = gameState?.placed_count ?? 0;

  const isMyTurn  = turn === mySymbol && phase === "playing";
  const mySetupDone = setupDone[mySymbol ?? ""] ?? false;

  const myRows    = mySymbol === "A" ? [5,6,7] : [0,1,2];
  const oppRows   = mySymbol === "A" ? [0,1,2] : [5,6,7];

  const combatKey = lastCombat ? JSON.stringify(lastCombat) : null;
  const showCombat = lastCombat && combatKey !== dismissedCombat;

  // ── setup handlers ────────────────────────────────────────────────────────
  const handleBoardClick = useCallback((r: number, c: number) => {
    if (phase === "setup" && !mySetupDone) {
      const cell = board[r]?.[c];
      if (cell && cell.owner === mySymbol) {
        if (selectedInventoryRank !== null) {
          ws.send(JSON.stringify({ action: "move", action_type: "remove", row: r, col: c }));
          ws.send(JSON.stringify({ action: "move", action_type: "place", rank: selectedInventoryRank, row: r, col: c }));
        } else {
          ws.send(JSON.stringify({ action: "move", action_type: "remove", row: r, col: c }));
        }
      } else if (selectedInventoryRank !== null && !isLake(r, c, lakes) && myRows.includes(r)) {
        ws.send(JSON.stringify({ action: "move", action_type: "place", rank: selectedInventoryRank, row: r, col: c }));
        const rem = parseInt(remaining[String(selectedInventoryRank)] ?? "0") - 1;
        if (rem <= 0) setSelectedInventoryRank(null);
      }
    } else if (phase === "playing" && isMyTurn) {
      const cell = board[r]?.[c];
      if (selectedPiece) {
        const [sr, sc] = selectedPiece;
        const isMove = validMoves.some(([mr, mc]) => mr === r && mc === c);
        const isAtk  = validAttacks.some(([ar, ac]) => ar === r && ac === c);
        if (isMove || isAtk) {
          ws.send(JSON.stringify({ action: "move", action_type: "move", from_row: sr, from_col: sc, to_row: r, to_col: c }));
          setSelectedPiece(null); setValidMoves([]); setValidAttacks([]);
        } else if (cell && cell.owner === mySymbol) {
          const { moves, attacks } = getValidMoves(board, r, c, mySymbol!, lakes);
          setSelectedPiece([r, c]); setValidMoves(moves); setValidAttacks(attacks);
        } else {
          setSelectedPiece(null); setValidMoves([]); setValidAttacks([]);
        }
      } else {
        if (cell && cell.owner === mySymbol) {
          const { moves, attacks } = getValidMoves(board, r, c, mySymbol!, lakes);
          setSelectedPiece([r, c]); setValidMoves(moves); setValidAttacks(attacks);
        }
      }
    }
  }, [phase, mySetupDone, board, mySymbol, selectedInventoryRank, selectedPiece, validMoves, validAttacks, lakes, myRows, remaining, isMyTurn, ws]);

  if (!gameState) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="animate-spin text-red-400" size={40}/>
    </div>
  );

  const CELL = 46;

  const renderBoard = () => (
    <div className="relative border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl"
      style={{ width: COLS*CELL, height: ROWS*CELL }}>
      {Array.from({length: ROWS}, (_, r) =>
        Array.from({length: COLS}, (_, c) => {
          const cell = board[r]?.[c];
          const lake = isLake(r, c, lakes);
          const isSelected = selectedPiece?.[0] === r && selectedPiece?.[1] === c;
          const isValidMove = validMoves.some(([mr,mc]) => mr === r && mc === c);
          const isValidAtk  = validAttacks.some(([ar,ac]) => ar === r && ac === c);
          const isMySetupRow = phase === "setup" && myRows.includes(r);
          const isOppSetupRow = phase === "setup" && oppRows.includes(r);
          const checkerDark  = (r + c) % 2 === 1;

          let bg = checkerDark ? "bg-slate-800" : "bg-slate-900";
          if (lake) bg = "bg-blue-950";
          if (isMySetupRow && phase === "setup") bg = checkerDark ? "bg-slate-700" : "bg-slate-750";
          if (isValidMove) bg = "bg-green-900/70";
          if (isValidAtk)  bg = "bg-rose-900/70";
          if (isSelected)  bg = "bg-amber-800/80";

          const rd = cell ? rankDisplay(cell.rank, cell.owner, mySymbol ?? "") : null;

          return (
            <div key={`${r}-${c}`}
              onClick={() => !lake && handleBoardClick(r, c)}
              className={`absolute border border-slate-700/40 flex items-center justify-center select-none transition-colors
                ${lake ? "cursor-default" : "cursor-pointer hover:brightness-125"}
                ${bg}`}
              style={{ left: c*CELL, top: r*CELL, width: CELL, height: CELL }}>
              {/* Cell number (top-left corner)*/}
              {!cell && !lake && <span className="absolute top-0.5 left-1 text-[7px] text-slate-600 leading-none">{(ROWS-r)*10+c}</span>}
              {lake && <span className="text-blue-800 text-lg">〰</span>}
              {isValidMove && !cell && <div className="w-3 h-3 rounded-full bg-green-400/60 border border-green-300/40"/>}
              {isValidAtk  && !cell && <div className="w-3 h-3 rounded-full bg-rose-400/60 border border-rose-300/40"/>}
              {cell && rd && (
                <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center shadow-md
                  ${cell.owner === mySymbol ? rd.bg : (cell.rank === -1 ? "bg-rose-900" : "bg-rose-800")}
                  ${isSelected ? "ring-2 ring-amber-300" : ""}
                  ${isValidAtk ? "ring-2 ring-rose-400" : ""}`}>
                  <span className="text-[11px] font-black text-white leading-none">{cell.owner === mySymbol ? rd.short : (cell.rank === -1 ? "?" : rd.short)}</span>
                  {cell.revealed && cell.owner !== mySymbol && cell.rank !== -1 && (
                    <span className="text-[7px] text-red-200 leading-none">revealed</span>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderInventory = () => (
    <div className="flex flex-col gap-2 w-full md:w-36 md:shrink-0">
      <div className="flex items-center justify-between md:block">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Pieces to place</p>
        <p className="text-[10px] text-slate-600">{placedCount}/{totalPieces} placed</p>
      </div>
      {/* Horizontal scroll on mobile, vertical list on desktop */}
      <div className="flex flex-row flex-wrap gap-1.5 md:flex-col md:gap-1.5">
        {PIECE_ORDER.map(rank => {
          const count = parseInt(remaining[String(rank)] ?? "0");
          if (count <= 0) return null;
          const rd = RANK_DISPLAY[rank];
          const isSelected = selectedInventoryRank === rank;
          return (
            <button key={rank} onClick={() => setSelectedInventoryRank(isSelected ? null : rank)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all
                ${isSelected ? "border-amber-400 bg-amber-900/40" : "border-slate-700 bg-slate-800/60 hover:border-slate-500"}`}>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${rd.bg}`}>
                <span className="text-[9px] font-black text-white">{rd.short}</span>
              </div>
              {/* Hide name on mobile to keep button compact */}
              <div className="hidden md:flex flex-1 min-w-0">
                <p className="text-[9px] font-semibold text-slate-200 truncate">{rd.name}</p>
              </div>
              <span className="text-[10px] text-slate-400 font-bold shrink-0">×{count}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-row flex-wrap gap-1.5 md:flex-col mt-1">
        <button onClick={() => ws.send(JSON.stringify({ action: "move", action_type: "auto_fill" }))}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all">
          <Shuffle size={12}/> Auto-fill
        </button>
        {placedCount >= totalPieces && (
          <button onClick={() => ws.send(JSON.stringify({ action: "move", action_type: "ready" }))}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-green-500/60 bg-green-900/40 hover:bg-green-800/60 text-green-300 text-xs font-bold transition-all">
            <CheckCircle size={12}/> I'm Ready!
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center gap-3 p-3 overflow-auto">

      {/* Header */}
      <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-700 rounded-2xl px-4 py-2 text-sm flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-blue-500 border border-blue-300"/>
          <span className={`font-bold ${mySymbol==="A"?"text-blue-300":"text-slate-300"}`}>
            Player A {mySymbol==="A"?"(You)":""}
          </span>
          {setupDone.A && <span className="text-[10px] border border-green-500/40 text-green-400 px-1 py-0.5 rounded">Ready</span>}
        </div>
        <div className={`text-xs font-bold px-3 py-1 rounded-xl border
          ${phase==="playing" ? (isMyTurn ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-slate-800 border-slate-600 text-slate-500")
                              : "bg-slate-800 border-slate-600 text-slate-500"}`}>
          {phase==="setup" ? (mySetupDone ? "Waiting for opponent…" : `Setup — ${totalPieces - placedCount} pieces left`) :
           phase==="playing" ? (isMyTurn ? "⚔️ Your turn!" : `${turn}'s turn`) : "Game over"}
        </div>
        <div className="flex items-center gap-2">
          {setupDone.B && <span className="text-[10px] border border-green-500/40 text-green-400 px-1 py-0.5 rounded">Ready</span>}
          <span className={`font-bold ${mySymbol==="B"?"text-rose-300":"text-slate-300"}`}>
            Player B {mySymbol==="B"?"(You)":""}
          </span>
          <div className="w-4 h-4 rounded-sm bg-rose-600 border border-rose-300"/>
        </div>
      </div>

      {/* Setup instructions */}
      {phase === "setup" && !mySetupDone && (
        <p className="text-xs text-slate-500 text-center">
          Select a piece from the left, then click your highlighted zone to place it. Click a placed piece to pick it back up.
        </p>
      )}
      {phase === "setup" && mySetupDone && (
        <p className="text-xs text-green-400 text-center">✅ You're ready! Waiting for your opponent to finish setup…</p>
      )}

      {/* Combat result banner */}
      {showCombat && (
        <div className="bg-slate-900 border border-amber-500/50 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-xl ${(RANK_DISPLAY[lastCombat.attacker_rank] as any)?.bg ?? "bg-slate-600"} flex items-center justify-center`}>
              <span className="text-xs font-black text-white">{(RANK_DISPLAY[lastCombat.attacker_rank] as any)?.short}</span>
            </div>
            <span className="text-[9px] text-slate-400 mt-0.5">{lastCombat.attacker_sym}</span>
          </div>
          <div className="text-center">
            <p className="text-amber-300 font-black text-sm">⚔️ {RESULT_MSG[lastCombat.result]}</p>
            <p className="text-[10px] text-slate-500">
              {(RANK_DISPLAY[lastCombat.attacker_rank] as any)?.name} vs {(RANK_DISPLAY[lastCombat.defender_rank] as any)?.name}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-xl ${(RANK_DISPLAY[lastCombat.defender_rank] as any)?.bg ?? "bg-slate-600"} flex items-center justify-center`}>
              <span className="text-xs font-black text-white">{(RANK_DISPLAY[lastCombat.defender_rank] as any)?.short}</span>
            </div>
            <span className="text-[9px] text-slate-400 mt-0.5">{lastCombat.attacker_sym === "A" ? "B" : "A"}</span>
          </div>
          <button onClick={() => setDismissedCombat(combatKey)} className="ml-2 text-slate-500 hover:text-slate-300 text-xs underline">dismiss</button>
        </div>
      )}

      {/* Main layout — column on mobile (board first, inventory below), row on desktop */}
      <div className="flex flex-col-reverse md:flex-row gap-4 items-start flex-wrap justify-center">

        {/* Left: inventory (setup only) / legend (playing) */}
        {phase === "setup" && !mySetupDone ? renderInventory() : (
          <div className="flex flex-col gap-2 w-full md:w-36 md:shrink-0 text-[9px] text-slate-500">
            <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-widest">Piece Ranks</p>
            {/* Horizontal wrap on mobile (icon only), vertical list on desktop */}
            <div className="flex flex-row flex-wrap gap-1.5 md:flex-col md:gap-1.5">
              {[10,9,8,7,6,5,4,3,2,1,11,0].map(rank => {
                const rd = RANK_DISPLAY[rank] as any;
                return (
                  <div key={rank} className="flex items-center gap-1.5" title={rd.name}>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${rd.bg}`}>
                      <span className="text-[8px] font-black text-white">{rd.short}</span>
                    </div>
                    {/* Show name only on desktop */}
                    <span className="hidden md:inline text-slate-400">{rd.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-row flex-wrap gap-x-3 gap-y-0.5 md:flex-col md:gap-0.5 border-t border-slate-800 pt-1 mt-1">
              <p className="text-slate-600">💡 Spy beats Marshal</p>
              <p className="text-slate-600">💡 Miner defuses Bomb</p>
              <p className="text-slate-600">💡 Scout moves far</p>
            </div>
          </div>
        )}

        {/* Board */}
        <div className="flex flex-col items-center gap-2">
          <div className="overflow-auto max-w-full">{renderBoard()}</div>
          <div className="flex gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-800 inline-block"/>Move</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-800 inline-block"/>Attack</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-950 inline-block"/>Lake</span>
          </div>
        </div>

      </div>

      {/* Win overlay */}
      {phase === "finished" && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50">
          <div className={`bg-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl border
            ${winner===mySymbol ? "border-amber-500/50 shadow-amber-500/10" : "border-slate-600"}`}>
            <p className="text-5xl">{winner===mySymbol ? "🏆" : "😔"}</p>
            <h2 className={`text-3xl font-black ${winner===mySymbol ? "text-amber-400" : "text-slate-400"}`}>
              {winner===mySymbol ? "Victory!" : `Player ${winner} Wins!`}
            </h2>
            <p className="text-slate-400 text-sm">
              {winner===mySymbol ? "You captured the enemy flag!" : "Your flag was captured!"}
            </p>
            <button onClick={handleRestart} className="px-6 py-2.5 bg-red-700 hover:bg-red-600 rounded-xl text-white font-bold transition-all">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
