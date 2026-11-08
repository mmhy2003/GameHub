"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import StrategoToken, { RANK_LABELS } from "./StrategoToken";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const ROWS = 8, COLS = 8;

type Sym = "A" | "B";
interface Piece { owner: Sym; rank: number; revealed: boolean }
type Board = (Piece | null)[][];
type RankInfo = Record<string, { count: number }>;
interface Combat { attacker_sym: Sym; attacker_rank: number; defender_rank: number; result: string }

const PIECE_ORDER = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 0];
const CLASH_MS = 2500;

const opp = (s: string): Sym => (s === "A" ? "B" : "A");

function isLake(r: number, c: number, lakes: number[][]): boolean {
  return lakes.some(([lr, lc]) => lr === r && lc === c);
}

function getValidMoves(board: Board, r: number, c: number, mySymbol: string, lakes: number[][]): { moves: number[][], attacks: number[][] } {
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

/**
 * Captured/lost trays from the board alone. My lost pieces are exact. An enemy rank counts as captured only when
 * more of it are missing than hidden enemy pieces could account for; the rest stay unknown (never guessed).
 */
export function deriveTrays(board: Board, rankInfo: RankInfo, viewer: string) {
  const mine: Record<number, number> = {}, enemyKnown: Record<number, number> = {};
  let enemyHidden = 0, enemyOnBoard = 0, total = 0;
  for (const row of board) for (const cell of row) {
    if (!cell) continue;
    if (cell.owner === viewer) mine[cell.rank] = (mine[cell.rank] ?? 0) + 1;
    else {
      enemyOnBoard++;
      if (cell.rank === -1) enemyHidden++;
      else enemyKnown[cell.rank] = (enemyKnown[cell.rank] ?? 0) + 1;
    }
  }
  const lost: number[] = [], captured: number[] = [];
  for (const rank of PIECE_ORDER) {
    const count = rankInfo[String(rank)]?.count ?? 0;
    total += count;
    for (let i = 0; i < count - (mine[rank] ?? 0); i++) lost.push(rank);
    for (let i = 0; i < count - (enemyKnown[rank] ?? 0) - enemyHidden; i++) captured.push(rank);
  }
  return { lost, captured, unknownCaptured: Math.max(0, total - enemyOnBoard - captured.length) };
}

const RESULT_MSG: Record<string, string> = {
  attacker: "Attacker wins!",
  defender: "Defender wins!",
  both: "Both eliminated!",
};

export default function Stratego({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [selectedInventoryRank, setSelectedInventoryRank] = useState<number | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves]   = useState<number[][]>([]);
  const [validAttacks, setValidAttacks] = useState<number[][]>([]);
  const [dismissedCombat, setDismissedCombat] = useState<string | null>(null);

  const phase: string      = gameState?.phase      ?? "setup";
  const board: Board       = gameState?.board       ?? [];
  const turn: string       = gameState?.turn        ?? "A";
  const winner: string|null  = gameState?.winner    ?? null;
  const setupDone: Record<string, boolean> = gameState?.setup_done ?? {};
  const remaining: Record<string, number>  = gameState?.remaining  ?? {};
  const lastCombat: Combat | null = gameState?.last_combat ?? null;
  const lakes: number[][]  = gameState?.lakes       ?? [];
  const rankInfo: RankInfo = gameState?.rank_info   ?? {};
  const totalPieces: number  = gameState?.total_pieces ?? 20;
  const placedCount: number  = gameState?.placed_count ?? 0;

  // Spectators get player A's view from the server, so colour the board from A's side
  const viewer: string = mySymbol ?? gameState?.my_symbol ?? "A";
  const over = phase === "finished";
  const isMyTurn  = !!mySymbol && turn === mySymbol && phase === "playing";
  const mySetupDone = setupDone[mySymbol ?? ""] ?? false;
  const canSetUp = !!mySymbol && phase === "setup" && !mySetupDone;

  const myRows    = mySymbol === "A" ? [5,6,7] : [0,1,2];

  const combatKey = lastCombat ? JSON.stringify(lastCombat) : null;
  const showCombat = !!lastCombat && combatKey !== dismissedCombat;

  const clearSelection = () => { setSelectedPiece(null); setValidMoves([]); setValidAttacks([]); };

  useOnChange(isMyTurn, now => { clearSelection(); if (now) play("turn"); });
  useOnChange(placedCount, (n, p) => { if (n > p) play("place"); });
  useOnChange(combatKey, k => { if (k) play("hit"); });
  useOnChange(phase, () => { clearSelection(); setSelectedInventoryRank(null); });

  // The clash card hides itself after a moment
  useEffect(() => {
    if (!combatKey) return;
    const t = setTimeout(() => setDismissedCombat(combatKey), CLASH_MS);
    return () => clearTimeout(t);
  }, [combatKey]);

  if (!gameState) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="animate-spin text-candy-red" size={48}/>
    </div>
  );

  const send = (msg: Record<string, unknown>) => ws.send(JSON.stringify({ action: "move", ...msg }));

  const handleBoardClick = (r: number, c: number) => {
    if (canSetUp) {
      const cell = board[r]?.[c];
      if (cell && cell.owner === mySymbol) {
        send({ action_type: "remove", row: r, col: c });
        if (selectedInventoryRank !== null) send({ action_type: "place", rank: selectedInventoryRank, row: r, col: c });
      } else if (selectedInventoryRank !== null && !isLake(r, c, lakes) && myRows.includes(r)) {
        send({ action_type: "place", rank: selectedInventoryRank, row: r, col: c });
        const rem = (remaining[String(selectedInventoryRank)] ?? 0) - 1;
        if (rem <= 0) setSelectedInventoryRank(null);
      }
    } else if (isMyTurn) {
      const cell = board[r]?.[c];
      const isMove = validMoves.some(([mr, mc]) => mr === r && mc === c);
      const isAtk  = validAttacks.some(([ar, ac]) => ar === r && ac === c);
      if (selectedPiece && (isMove || isAtk)) {
        const [sr, sc] = selectedPiece;
        send({ action_type: "move", from_row: sr, from_col: sc, to_row: r, to_col: c });
        clearSelection();
      } else if (cell && cell.owner === mySymbol) {
        const { moves, attacks } = getValidMoves(board, r, c, mySymbol, lakes);
        setSelectedPiece([r, c]); setValidMoves(moves); setValidAttacks(attacks);
      } else {
        clearSelection();
      }
    }
  };

  const nameOf = (sym: string) => nameForSymbol(gameState, sym) ?? `Player ${sym}`;
  const outcome = outcomeFor(winner, false, mySymbol);
  const title = resultTitle(gameState, winner, false, mySymbol);
  const piecesOf = (sym: string) => board.reduce((n, row) => n + row.filter(p => p?.owner === sym).length, 0);
  const subtitle = (sym: string) => phase === "setup"
    ? (setupDone[sym] ? "Ready ✅" : "Setting up…")
    : `${piecesOf(sym)} pieces left`;

  const renderBoard = () => (
    <div className="chunk overflow-hidden grid grid-cols-8 grid-rows-8 w-[min(94vw,28rem)] aspect-square bg-candy-green">
      {Array.from({length: ROWS}, (_, r) =>
        Array.from({length: COLS}, (_, c) => {
          const cell = board[r]?.[c];
          const lake = isLake(r, c, lakes);
          const isSelected = selectedPiece?.[0] === r && selectedPiece?.[1] === c;
          const isValidMove = validMoves.some(([mr,mc]) => mr === r && mc === c);
          const isValidAtk  = validAttacks.some(([ar,ac]) => ar === r && ac === c);
          const light = (r + c) % 2 === 0;
          const setupRow = canSetUp && myRows.includes(r);
          const bg = lake ? "bg-candy-blue/70"
            : setupRow ? (light ? "bg-candy-yellow/50" : "bg-candy-yellow/70")
            : (light ? "bg-candy-green/50" : "bg-candy-green/70");
          const clickable = !lake && (canSetUp || isMyTurn);

          return (
            <div key={`${r}-${c}`}
              onClick={() => clickable && handleBoardClick(r, c)}
              className={`relative flex items-center justify-center select-none bg-cream ${clickable ? "cursor-pointer" : "cursor-default"}`}>
              <div className={`absolute inset-0 ${bg}`}/>
              {lake && <span className="relative text-lg sm:text-2xl">🌊</span>}
              {isValidMove && !cell && <span className="relative w-[22%] aspect-square rounded-full bg-ink/70"/>}
              {cell && (
                <StrategoToken owner={cell.owner} rank={cell.rank} mine={cell.owner === viewer}
                  revealed={cell.revealed} selected={isSelected}/>
              )}
              {isValidAtk && (
                <span className="absolute inset-0.5 rounded-lg ring-4 ring-candy-red pointer-events-none">
                  <span className="absolute -top-1 -right-1 text-xs sm:text-sm leading-none">⚔️</span>
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderInventory = () => (
    <div className="chunk bg-white p-3 flex flex-col gap-3 w-[min(94vw,28rem)] md:w-44 md:shrink-0">
      <div className="flex items-center justify-between font-bold text-ink text-sm">
        <span>🎒 Your pieces</span>
        <span className="chunk-sm rounded-lg! bg-candy-yellow px-2 text-xs">{placedCount}/{totalPieces}</span>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
        {PIECE_ORDER.map(rank => {
          const count = remaining[String(rank)] ?? 0;
          const isSelected = selectedInventoryRank === rank;
          return (
            <button key={rank} type="button" disabled={count <= 0}
              onClick={() => { play("click"); setSelectedInventoryRank(isSelected ? null : rank); }}
              title={RANK_LABELS[rank]?.name}
              className="relative flex flex-col items-center gap-0.5 disabled:opacity-35 disabled:cursor-not-allowed">
              <StrategoToken owner={(mySymbol ?? "A") as Sym} rank={rank} mine revealed={false} small selected={isSelected}/>
              <span className="text-[10px] font-bold text-ink leading-none">×{count}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink/70">Pick a piece, then tap a yellow square. Tap a placed piece to pick it up.</p>
      <div className="flex flex-wrap gap-2">
        <ToyButton color="blue" size="sm" disabled={placedCount >= totalPieces} onClick={() => send({ action_type: "auto_fill" })}>
          🎲 Auto-fill
        </ToyButton>
        <ToyButton color="green" size="sm" disabled={placedCount < totalPieces} onClick={() => send({ action_type: "ready" })}>
          Ready ✅
        </ToyButton>
      </div>
    </div>
  );

  const renderTrays = () => {
    const { lost, captured, unknownCaptured } = deriveTrays(board, rankInfo, viewer);
    const enemy = opp(viewer);
    const row = (label: string, ranks: number[], owner: Sym, mine: boolean, unknown = 0) => (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-ink">{label}</span>
        <div className="flex flex-wrap gap-1 min-h-7">
          {ranks.length === 0 && unknown === 0 && <span className="text-xs text-ink/50">None yet</span>}
          {ranks.map((rank, i) => <StrategoToken key={`${rank}-${i}`} owner={owner} rank={rank} mine={mine} revealed small/>)}
          {Array.from({ length: unknown }, (_, i) => <StrategoToken key={`u${i}`} owner={owner} rank={-1} mine={mine} revealed={false} small/>)}
        </div>
      </div>
    );
    return (
      <div className="chunk bg-white p-3 flex flex-col gap-3 w-[min(94vw,28rem)] md:w-44 md:shrink-0">
        {row("🏆 Captured", captured, enemy, false, unknownCaptured)}
        {row("💔 Lost", lost, viewer as Sym, true)}
        <div className="border-t-2 border-ink/10 pt-2 text-[11px] text-ink/70 flex flex-col gap-0.5">
          <span>🕵️ Spy beats 👑 Marshal</span>
          <span>⛏️ Miner defuses 💣 Bomb</span>
          <span>🏃 Scout runs far</span>
        </div>
      </div>
    );
  };

  const renderClash = () => {
    if (!showCombat || !lastCombat) return null;
    const attacker = lastCombat.attacker_sym;
    const defender = opp(attacker);
    const side = (owner: Sym, rank: number) => (
      <div className="flex flex-col items-center gap-1 w-16">
        <div className="w-14 h-14 flex items-center justify-center">
          <StrategoToken owner={owner} rank={rank} mine={owner === viewer} revealed/>
        </div>
        <span className="text-[11px] font-bold text-ink truncate max-w-full">{RANK_LABELS[rank]?.name}</span>
      </div>
    );
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none p-4">
        <button type="button" onClick={() => setDismissedCombat(combatKey)}
          className="pointer-events-auto chunk bg-white animate-pop px-5 py-4 flex flex-col items-center gap-2"
          aria-label="Dismiss battle result">
          <span className="text-xs font-bold text-ink/60 uppercase tracking-widest">Clash!</span>
          <div className="flex items-center gap-3">
            {side(attacker, lastCombat.attacker_rank)}
            <span className="text-3xl">⚔️</span>
            {side(defender, lastCombat.defender_rank)}
          </div>
          <span className="font-black text-ink">{RESULT_MSG[lastCombat.result] ?? ""}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-2 sm:p-4 relative z-10 w-full overflow-y-auto overflow-x-hidden">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[{ symbol: "A", subtitle: subtitle("A") }, { symbol: "B", subtitle: subtitle("B") }]}
        activeSymbol={phase === "playing" ? turn : null}
        matchScore={matchScore}
      />

      {over ? (
        <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>
      ) : phase === "setup" ? (
        !mySymbol ? <TurnBanner tone="info">Armies are lining up…</TurnBanner>
          : mySetupDone ? <TurnBanner tone="wait">Waiting for {nameOf(opp(mySymbol))} to get ready…</TurnBanner>
            : <TurnBanner tone="mine">🪖 Set up your army! {totalPieces - placedCount} to place</TurnBanner>
      ) : isMyTurn ? (
        <TurnBanner tone="mine">⚔️ Your turn: pick a piece</TurnBanner>
      ) : mySymbol ? (
        <TurnBanner tone="wait">Waiting for {nameOf(turn)}…</TurnBanner>
      ) : (
        <TurnBanner tone="info">{nameOf(turn)}&apos;s turn</TurnBanner>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center md:items-start justify-center">
        {renderBoard()}
        {canSetUp ? renderInventory() : phase !== "setup" && renderTrays()}
      </div>

      {renderClash()}

      <ResultOverlay
        open={over}
        outcome={outcome}
        title={title}
        subtitle={scoreLine(matchScore, "A", "B")}
        onPlayAgain={handleRestart}
      />
    </div>
  );
}
