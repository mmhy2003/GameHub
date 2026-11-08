"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { avatarColor } from "@/components/ui/Avatar";
import SnakesBoardArt from "./SnakesBoardArt";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

type Side = "A" | "B";
type Card = { id: string; name: string; emoji: string; desc: string };
type Hop = { cell: number; jump: boolean };

const SNAKES:  Record<number, number> = { 99:78, 95:75, 87:36, 62:19, 54:34, 17:7 };
const LADDERS: Record<number, number> = { 4:14, 9:31, 20:38, 28:84, 40:59, 51:67, 63:81, 71:91 };

function cellToGrid(n: number): [number, number] {
  if (n <= 0) return [-1, -1];
  const row0 = Math.floor((n - 1) / 10);
  const colInRow = (n - 1) % 10;
  const col = row0 % 2 === 0 ? colInRow : 9 - colInRow;
  return [col, 9 - row0];
}

/** Centre of a square in percent (0–100) of the board. */
function cellCenter(n: number): { x: number; y: number } {
  const [col, row] = cellToGrid(n);
  return { x: col * 10 + 5, y: row * 10 + 5 };
}

/**
 * Squares a pawn visits on its way from `from` to `to`. Short forward moves hop square by square;
 * when the roll landed on the snake or ladder (`jumps`: start square → end square) that leads to `to`,
 * hop there first and then jump; anything else (a swap, a bounce, a restart) is a single jump.
 */
function hopPath(from: number, to: number, roll: number | null, jumps: Record<string, number>): Hop[] {
  const diff = to - from;
  if (diff === 0) return [];
  const hops = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => ({ cell: a + i + 1, jump: false }));
  if (diff > 0 && diff <= 12) return hops(from, to);
  const landed = from + (roll ?? 0);
  const viaRoll = roll != null && roll > 0 && jumps[landed] === to;
  return [...(viaRoll ? hops(from, landed) : []), { cell: to, jump: true }];
}

const EVENT_MESSAGES: Record<string, string> = {
  snake:            "🐍 Hit a snake! Slid down…",
  ladder:           "🪜 Climbed a ladder!",
  shield_blocked:   "🛡️ Shield blocked the snake!",
  sabotaged:        "💣 Sabotaged! Turn lost — your Double Roll is safe.",
  normal:           "",
  none:             "",
  win:              "🏆 Reached 100!",
  card_shield:      "🛡️ Shield activated! Next snake blocked.",
  card_swap:        "🔄 Positions swapped!",
  card_sabotage:    "💣 Opponent sabotaged! They lose their next turn.",
  card_double_roll: "🎲 Double Roll ready! Next roll counts twice.",
  card_extra_turn:  "⏩ Extra turn granted!",
};
const BAD_EVENTS = new Set(["snake", "sabotaged", "card_sabotage", "card_leap_snake"]);

const CARD_COLORS: Record<string, string> = {
  double_roll: "bg-candy-purple",
  shield:      "bg-candy-blue",
  swap:        "bg-candy-pink",
  sabotage:    "bg-candy-red",
  lucky_leap:  "bg-candy-yellow",
  extra_turn:  "bg-candy-green",
};

/** Pastel row tints for the board, two strengths for the checker pattern. */
const ROW_TINTS = [
  ["bg-candy-yellow/25", "bg-candy-yellow/40"],
  ["bg-candy-green/25", "bg-candy-green/40"],
  ["bg-candy-blue/25", "bg-candy-blue/40"],
  ["bg-candy-pink/25", "bg-candy-pink/40"],
  ["bg-candy-purple/25", "bg-candy-purple/40"],
] as const;

/** Pip positions (cells of a 3×3 grid) for each die face. */
const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

const EFFECT_BADGES = [
  { flag: "shield", emoji: "🛡️", label: "Shield" },
  { flag: "sabotaged", emoji: "💣", label: "Sabotaged" },
  { flag: "double_roll", emoji: "🎲", label: "Double Roll" },
  { flag: "extra_turn", emoji: "⏩", label: "Extra Turn" },
] as const;

function Die({ face, rolling }: { face: number; rolling: boolean }) {
  return (
    <div
      className={`chunk bg-white w-16 h-16 sm:w-20 sm:h-20 p-2 grid grid-cols-3 grid-rows-3 shadow-[inset_-4px_-4px_0_0_rgba(0,0,0,0.08),var(--shadow-chunk)] ${rolling ? "animate-wiggle" : ""}`}
      aria-label={`Die showing ${face}`}
      role="img"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIPS[face]?.includes(i) && <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-ink" />}
        </span>
      ))}
    </div>
  );
}

function FaceDownCards({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-ink">
      <div className="flex">
        {Array.from({ length: Math.max(1, count) }, (_, i) => (
          <span
            key={i}
            className={`chunk-sm bg-toy-stripes w-6 h-9 rounded-md! -ml-2 first:ml-0 ${count === 0 ? "opacity-30" : ""}`}
            style={{ rotate: `${(i - (count - 1) / 2) * 5}deg` }}
          />
        ))}
      </div>
      <span>{label}: {count} card{count === 1 ? "" : "s"}</span>
    </div>
  );
}

export default function SnakesLadders({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState(1);
  const [infoCard, setInfoCard] = useState<number | null>(null);
  const shuffleIv = useRef<ReturnType<typeof setInterval> | null>(null);

  const phase: string  = gameState?.phase      ?? "waiting";
  const posA: number   = gameState?.pos_A      ?? 0;
  const posB: number   = gameState?.pos_B      ?? 0;
  const turn: Side     = gameState?.turn       ?? "A";
  const lastRoll: number | null = gameState?.last_roll ?? null;
  const lastEvent: string = gameState?.last_event ?? "none";
  const winner: string | null = gameState?.winner ?? null;
  const readyCount: number = gameState?.ready_count ?? 0;
  const cardsPlayedThisTurn: number = gameState?.cards_played_this_turn ?? 0;
  const allCards: Card[] = gameState?.all_cards ?? [];
  const snakes: Record<string, number> = gameState?.snakes ?? SNAKES;
  const ladders: Record<string, number> = gameState?.ladders ?? LADDERS;
  const myHand: string[] = mySymbol === "A" ? (gameState?.hand_A ?? []) : mySymbol === "B" ? (gameState?.hand_B ?? []) : [];
  const handCount = (s: Side): number => gameState?.[`hand_${s}_count`] ?? 0;
  const flag = (name: string, s: Side) => !!gameState?.[`${name}_${s}`];

  const over = phase === "finished";
  const isMyTurn = turn === mySymbol && phase === "playing";
  const cardById = (id: string) => allCards.find(c => c.id === id);

  // Pawns step toward the server positions; snakes, ladders and swaps finish with a jump
  const [pawns, setPawns] = useState<Record<Side, Hop>>({ A: { cell: posA, jump: false }, B: { cell: posB, jump: false } });
  const shown = useRef({ A: posA, B: posB });
  const lastMove = useRef({ roll: lastRoll, jumps: { ...snakes, ...ladders } });
  useEffect(() => { lastMove.current = { roll: lastRoll, jumps: { ...snakes, ...ladders } }; });
  useEffect(() => {
    const { roll, jumps } = lastMove.current;
    const queue: Record<Side, Hop[]> = {
      A: hopPath(shown.current.A, posA, roll, jumps),
      B: hopPath(shown.current.B, posB, roll, jumps),
    };
    if (!queue.A.length && !queue.B.length) return;
    const iv = setInterval(() => {
      const a = queue.A.shift(), b = queue.B.shift();
      if (!a && !b) { clearInterval(iv); return; }
      if (a) shown.current.A = a.cell;
      if (b) shown.current.B = b.cell;
      setPawns(p => ({ A: a ?? { ...p.A, jump: false }, B: b ?? { ...p.B, jump: false } }));
    }, 140);
    return () => clearInterval(iv);
  }, [posA, posB]);

  // Any new server move ends the dice shuffle and shows the event
  const moveKey = `${posA}|${posB}|${turn}|${lastRoll}|${lastEvent}|${phase}`;
  useOnChange(moveKey, () => {
    if (shuffleIv.current) clearInterval(shuffleIv.current);
    setRolling(false);
    if (lastRoll !== null) setDisplayDice(lastRoll > 6 ? lastRoll % 6 || 6 : lastRoll);
    if (lastEvent === "ladder" || lastEvent === "card_leap_ladder") play("pop");
    else if (lastEvent === "snake" || lastEvent === "card_leap_snake") play("miss");
  });
  useOnChange(isMyTurn, now => { if (now) play("turn"); });
  useEffect(() => () => { if (shuffleIv.current) clearInterval(shuffleIv.current); }, []);

  useEffect(() => {
    if (phase === "waiting" && mySymbol) {
      ws.send(JSON.stringify({ action: "move", action_type: "ready" }));
    }
  }, [phase, mySymbol]);

  const handleRoll = () => {
    if (!isMyTurn || rolling) return;
    setRolling(true);
    play("dice");
    const iv = setInterval(() => setDisplayDice(Math.ceil(Math.random() * 6)), 80);
    shuffleIv.current = iv;
    setTimeout(() => {
      clearInterval(iv);
      ws.send(JSON.stringify({ action: "move", action_type: "roll" }));
    }, 500);
  };

  const handlePlayCard = (cardId: string) => {
    if (!isMyTurn) return;
    play("click");
    setInfoCard(null);
    ws.send(JSON.stringify({ action: "move", action_type: "play_card", card_id: cardId }));
  };

  if (!gameState || phase === "waiting") return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ink">
      <Loader2 className="animate-spin text-candy-green" size={48}/>
      <p className="font-bold">
        {readyCount === 1 ? "Waiting for your opponent to join…" : "Waiting for both players…"}
      </p>
    </div>
  );

  const nameOf = (s: string) => nameForSymbol(gameState, s) ?? `Player ${s}`;
  const outcome = outcomeFor(winner, false, mySymbol);
  const title = resultTitle(gameState, winner, false, mySymbol);
  const badges = (s: Side) => EFFECT_BADGES.filter(b => flag(b.flag, s));
  const subtitle = (s: Side) => {
    const pos = s === "A" ? posA : posB;
    return (
      <>
        {pos ? `Square ${pos}` : "At start"}
        {badges(s).map(b => <span key={b.flag} title={b.label} className="ml-1">{b.emoji}</span>)}
      </>
    );
  };
  const eventText = lastEvent.startsWith("card_leap") ? "✨ Lucky Leap! Bounded forward!" : EVENT_MESSAGES[lastEvent] ?? lastEvent;
  const cardUsed = cardsPlayedThisTurn >= 1;
  const opp: Side = mySymbol === "B" ? "A" : "B";
  const fan = (i: number, n: number) => (n > 1 ? -6 + (12 * i) / (n - 1) : 0);

  const renderBoard = () => {
    const cells = [];
    for (let n = 100; n >= 1; n--) {
      const [col, row] = cellToGrid(n);
      const tint = ROW_TINTS[(9 - row) % ROW_TINTS.length][(col + row) % 2];
      cells.push(
        <div key={n} className={`relative ${tint}`} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
          <span className="absolute top-0.5 left-1 text-[min(2vw,0.6rem)] font-bold text-ink/50 leading-none">{n}</span>
          {n === 100 && <span className="absolute inset-0 flex items-center justify-center text-[min(5vw,1.4rem)]">🏁</span>}
        </div>
      );
    }
    const both = pawns.A.cell > 0 && pawns.A.cell === pawns.B.cell;
    return (
      <div className="relative w-[min(92vw,30rem)] aspect-square chunk bg-cream overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-10 grid-rows-10">{cells}</div>
        <SnakesBoardArt snakes={snakes} ladders={ladders} cellCenter={cellCenter} />
        {(["A", "B"] as const).map(s => {
          const { cell, jump } = pawns[s];
          if (cell <= 0) return null;
          const { x, y } = cellCenter(cell);
          const name = nameOf(s);
          return (
            <div
              key={s}
              title={name}
              className={`absolute z-20 w-[7%] aspect-square -translate-x-1/2 -translate-y-1/2 motion-reduce:transition-none! chunk-sm rounded-full! flex items-center justify-center font-black text-ink text-[min(2.8vw,0.85rem)] ${avatarColor(name)}`}
              style={{
                left: `${x + (both ? (s === "A" ? -2 : 2) : 0)}%`,
                top: `${y + (both ? (s === "A" ? -1.5 : 1.5) : 0)}%`,
                transition: jump ? "left 0.6s ease-in-out, top 0.6s ease-in-out" : "left 0.12s ease-out, top 0.12s ease-out",
              }}
            >
              <span key={cell} className="animate-pop">{name.trim().charAt(0).toUpperCase() || s}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-3 p-2 sm:p-4 relative z-10 w-full overflow-y-auto overflow-x-hidden">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[{ symbol: "A", subtitle: subtitle("A") }, { symbol: "B", subtitle: subtitle("B") }]}
        activeSymbol={over ? null : turn}
        matchScore={matchScore}
      />

      {over ? (
        <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>
      ) : isMyTurn ? (
        <TurnBanner tone="mine">🎲 Your turn: roll!</TurnBanner>
      ) : mySymbol ? (
        <TurnBanner tone="wait">Waiting for {nameOf(turn)}…</TurnBanner>
      ) : (
        <TurnBanner tone="info">{nameOf(turn)}&apos;s turn</TurnBanner>
      )}

      {eventText && (
        <div key={moveKey} className="animate-pop">
          <TurnBanner tone={BAD_EVENTS.has(lastEvent) ? "bad" : "good"}>{eventText}</TurnBanner>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-start justify-center w-full">
        {renderBoard()}

        <div className="flex flex-col items-center gap-4 w-full md:w-64">
          <div className="flex items-center gap-4">
            <Die face={Math.min(Math.max(displayDice, 1), 6)} rolling={rolling} />
            {lastRoll !== null && lastRoll > 6 && !rolling && (
              <span className="font-black text-ink text-xl">= {lastRoll}</span>
            )}
            {mySymbol && (
              <ToyButton color="yellow" size="lg" onClick={handleRoll} disabled={!isMyTurn || rolling}>
                {rolling ? "Rolling…" : "🎲 Roll"}
              </ToyButton>
            )}
          </div>

          {mySymbol ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center gap-2 font-bold text-ink text-sm">
                <span>Your hand</span>
                {badges(mySymbol as Side).map(b => (
                  <span key={b.flag} className="chunk-sm bg-white px-1.5 text-xs rounded-full!">{b.emoji} {b.label}</span>
                ))}
              </div>
              <div className="flex justify-center pt-2 pb-1 min-h-[7.5rem]">
                {myHand.map((cid, i) => {
                  const card = cardById(cid);
                  if (!card) return null;
                  const showInfo = infoCard === i;
                  return (
                    <div
                      key={`${cid}-${i}`}
                      className="group relative -ml-3 first:ml-0 transition-transform hover:-translate-y-2 hover:z-10"
                      style={{ rotate: `${fan(i, myHand.length)}deg` }}
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayCard(cid)}
                        disabled={!isMyTurn || cardUsed}
                        title={cardUsed ? "Only 1 card per turn" : card.desc}
                        className={`chunk-sm w-[4.75rem] h-28 rounded-xl! flex flex-col items-center justify-center gap-1 px-1 text-center text-ink disabled:opacity-60 disabled:cursor-not-allowed ${CARD_COLORS[cid] ?? "bg-white"}`}
                      >
                        <span className="text-2xl">{card.emoji}</span>
                        <span className="font-bold text-[0.7rem] leading-tight">{card.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`About ${card.name}`}
                        aria-expanded={showInfo}
                        onClick={() => setInfoCard(showInfo ? null : i)}
                        className="absolute -top-2 -right-2 w-5 h-5 chunk-sm rounded-full! bg-white text-ink text-[0.65rem] font-black leading-none"
                      >
                        i
                      </button>
                      <div
                        role="tooltip"
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 chunk-sm bg-white text-ink text-xs p-2 z-30 ${showInfo ? "block" : "hidden group-hover:block"}`}
                      >
                        {card.desc}
                      </div>
                    </div>
                  );
                })}
                {myHand.length === 0 && <span className="text-sm text-ink/60 self-center">No cards yet</span>}
              </div>
              {cardUsed && isMyTurn && <p className="text-xs text-ink/60 italic">1 card per turn used</p>}
              <FaceDownCards label={nameOf(opp)} count={handCount(opp)} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FaceDownCards label={nameOf("A")} count={handCount("A")} />
              <FaceDownCards label={nameOf("B")} count={handCount("B")} />
            </div>
          )}
        </div>
      </div>

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
