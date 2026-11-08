"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

type Shots = Record<string, "hit" | "miss">;
type View = "mine" | "enemy";

const FLEET = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
];
const TOTAL_CELLS = 17;
const CELL = "w-[min(8.4vw,2.2rem)] aspect-square";

const fleetKey = (roomId: string) => `gamehub_bs_fleet_${roomId}`;

/** Random non-overlapping placement of the five ships, one index group per ship (FLEET order). */
function randomFleet(): number[][] {
  const taken = new Set<number>();
  return FLEET.map(({ size }) => {
    for (;;) {
      const horiz = Math.random() > 0.5;
      const x = Math.floor(Math.random() * (horiz ? 11 - size : 10));
      const y = Math.floor(Math.random() * (horiz ? 10 : 11 - size));
      const cells = Array.from({ length: size }, (_, k) => (horiz ? y * 10 + x + k : (y + k) * 10 + x));
      if (cells.every(c => !taken.has(c))) {
        cells.forEach(c => taken.add(c));
        return cells;
      }
    }
  });
}

function loadFleet(roomId: string): number[][] | null {
  if (typeof window === "undefined" || !roomId) return null;
  try {
    const raw = sessionStorage.getItem(fleetKey(roomId));
    const groups: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(groups) && groups.length === FLEET.length ? (groups as number[][]) : null;
  } catch { return null; }
}

const countHits = (shots: Shots | undefined) => Object.values(shots ?? {}).filter(v => v === "hit").length;

/** Position and rounding of a ship segment, so a whole ship reads as one capsule (joined across the gap-1). */
function capsuleShape(i: number, shipOf: Map<number, number>): string {
  const g = shipOf.get(i);
  const same = (j: number) => shipOf.get(j) === g;
  const left = i % 10 > 0 && same(i - 1);
  const right = i % 10 < 9 && same(i + 1);
  const up = same(i - 10);
  const down = same(i + 10);
  if (left || right) {
    return `inset-y-1 ${left ? "-left-0.5 border-l-0" : "left-0.5 rounded-l-full"} ${right ? "-right-0.5 border-r-0" : "right-0.5 rounded-r-full"}`;
  }
  if (up || down) {
    return `inset-x-1 ${up ? "-top-0.5 border-t-0" : "top-0.5 rounded-t-full"} ${down ? "-bottom-0.5 border-b-0" : "bottom-0.5 rounded-b-full"}`;
  }
  return "inset-1 rounded-full";
}

function SeaGrid({ title, tint, ships, shots, onFire }: {
  title: string;
  tint: string;
  ships: Map<number, number>;
  shots: Shots;
  onFire?: (i: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="font-bold text-ink text-lg">{title}</h3>
      <div className={`chunk ${tint} p-1.5 sm:p-2 grid grid-cols-10 gap-1`}>
        {Array.from({ length: 100 }, (_, i) => {
          const status = shots[String(i)];
          const aim = !!onFire && !status;
          const mark = status === "hit"
            ? <span className="relative animate-pop">💥</span>
            : status === "miss"
              ? <span className="relative animate-pop opacity-80">💧</span>
              : aim
                ? <span aria-hidden="true" className="hidden group-hover:block font-black text-ink">⊕</span>
                : null;
          return (
            <button
              key={i}
              type="button"
              onClick={aim ? () => onFire(i) : undefined}
              disabled={!aim}
              aria-label={`Row ${Math.floor(i / 10) + 1}, column ${(i % 10) + 1}${status ? `: ${status}` : ""}`}
              className={`group ${CELL} relative flex items-center justify-center rounded-md bg-white/30 text-[min(4.4vw,1.15rem)] leading-none
                ${aim ? "cursor-crosshair hover:bg-white/70" : "cursor-default"}`}
            >
              {ships.has(i) && (
                <span aria-hidden="true" className={`absolute bg-slate-400 border-2 border-ink ${capsuleShape(i, ships)}`} />
              )}
              {mark}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HitsBar({ label, n }: { label: string; n: number }) {
  return (
    <div className="w-full max-w-[16rem] text-sm font-bold text-ink">
      <div className="flex justify-between mb-1"><span>{label}</span><span>{n} / {TOTAL_CELLS}</span></div>
      <div className="chunk-sm bg-white h-3 rounded-full! overflow-hidden">
        <div className="h-full bg-candy-red transition-[width] duration-300" style={{ width: `${(n / TOTAL_CELLS) * 100}%` }} />
      </div>
    </div>
  );
}

export default function Battleships({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const params = useParams<{ id: string }>();
  const roomId = params?.id ?? "";
  const [localPlacements, setLocalPlacements] = useState<number[]>([]);
  const [fleetGroups, setFleetGroups] = useState<number[][] | null>(() => loadFleet(roomId));

  const phase: string = gameState?.phase ?? "setup";
  const currentTurn: string = gameState?.current_turn ?? "A";
  const winner: string | null = gameState?.winner ?? null;
  const isDraw = !!gameState?.is_draw;
  const ready: Record<string, boolean> = gameState?.ready ?? {};
  const myShips: number[] = gameState?.my_ships ?? [];
  const shots: Record<string, Shots> = gameState?.shots ?? {};
  const isSetup = phase === "setup";
  const over = !!winner || isDraw;
  // Spectators watch from A's side
  const me = mySymbol ?? "A";
  const enemy = me === "A" ? "B" : "A";
  const shotCount = Object.keys(shots.A ?? {}).length + Object.keys(shots.B ?? {}).length;
  const prevShots = useRef<Record<string, Shots>>(shots);
  const isMyTurn = !!mySymbol && !isSetup && currentTurn === mySymbol && !over;

  const [view, setView] = useState<View>(isMyTurn ? "enemy" : "mine");
  useOnChange(isMyTurn, now => {
    setView(now ? "enemy" : "mine");
    if (now) play("turn");
  });
  // One new shot since the last state: play its sound (a bigger jump is a refresh/first load, stay quiet)
  useOnChange(shotCount, (n, p) => {
    if (n !== p + 1) return;
    for (const s of ["A", "B"]) {
      const fresh = Object.keys(shots[s] ?? {}).find(k => !prevShots.current[s]?.[k]);
      if (fresh) { play(shots[s][fresh] === "hit" ? "hit" : "miss"); break; }
    }
  });
  useEffect(() => { prevShots.current = shots; });

  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-blue" size={48} /></div>;
  }

  const shuffle = () => {
    const groups = randomFleet();
    setFleetGroups(groups);
    setLocalPlacements(groups.flat());
    try { sessionStorage.setItem(fleetKey(roomId), JSON.stringify(groups)); } catch { /* storage blocked */ }
  };

  const confirmPlacement = () => {
    ws.send(JSON.stringify({ action: "move", action_type: "place_ships", ships: localPlacements }));
  };

  const fire = (index: number) => {
    if (!isMyTurn || shots[me]?.[String(index)]) return;
    ws.send(JSON.stringify({ action: "move", index }));
  };

  // Remembered groups only count when they describe the fleet the server has for me
  const placed = myShips.length ? myShips : localPlacements;
  const placedSet = new Set(placed);
  const groups = fleetGroups && fleetGroups.flat().length === placed.length && fleetGroups.flat().every(c => placedSet.has(c))
    ? fleetGroups
    : null;
  const myShipMap = new Map<number, number>();
  placed.forEach(c => myShipMap.set(c, -1));
  groups?.forEach((g, gi) => g.forEach(c => myShipMap.set(c, gi)));

  const hitsOn = (sym: string) => countHits(shots[sym === "A" ? "B" : "A"]);
  const nameOf = (sym: string) => nameForSymbol(gameState, sym) ?? `Player ${sym}`;
  const turnName = nameOf(currentTurn);
  const outcome = outcomeFor(winner, isDraw, mySymbol);
  const title = resultTitle(gameState, winner, isDraw, mySymbol);
  const iAmReady = !!mySymbol && !!ready[mySymbol];
  const subtitle = (sym: string) => isSetup
    ? (ready[sym] ? "Ready ✅" : "Placing ships…")
    : `Ships hit ${hitsOn(sym)} / ${TOTAL_CELLS}`;

  const myTitle = mySymbol ? "🛟 Your fleet" : `🛟 ${nameOf(me)}'s fleet`;
  const enemyTitle = mySymbol ? "🎯 Enemy waters" : `🎯 ${nameOf(enemy)}'s waters`;
  const myHitsTaken = countHits(shots[enemy]);

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-4 relative z-10 w-full overflow-y-auto">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[{ symbol: "A", subtitle: subtitle("A") }, { symbol: "B", subtitle: subtitle("B") }]}
        activeSymbol={isSetup || over ? null : currentTurn}
        matchScore={matchScore}
      />

      {over ? (
        <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>
      ) : isSetup ? (
        !mySymbol ? <TurnBanner tone="info">Captains are placing their ships…</TurnBanner>
          : iAmReady ? <TurnBanner tone="wait">Waiting for {nameOf(enemy)} to get ready…</TurnBanner>
            : <TurnBanner tone="mine">⚓ Place your fleet!</TurnBanner>
      ) : isMyTurn ? (
        <TurnBanner tone="mine">🎯 Your turn: fire!</TurnBanner>
      ) : mySymbol ? (
        <TurnBanner tone="wait">Waiting for {turnName}…</TurnBanner>
      ) : (
        <TurnBanner tone="info">{turnName}&apos;s turn</TurnBanner>
      )}

      {isSetup ? (
        <div className="flex flex-col items-center gap-4">
          <SeaGrid title={myTitle} tint="bg-candy-blue/30" ships={myShipMap} shots={{}} />
          {mySymbol && !iAmReady && (
            <div className="flex flex-wrap justify-center gap-3">
              <ToyButton color="blue" onClick={shuffle}>Shuffle ships 🎲</ToyButton>
              <ToyButton color="green" onClick={confirmPlacement} disabled={localPlacements.length !== TOTAL_CELLS}>Ready ✅</ToyButton>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Phones: one board at a time */}
          <div role="tablist" className="md:hidden flex gap-2">
            {(["mine", "enemy"] as const).map(v => (
              <ToyButton
                key={v}
                role="tab"
                aria-selected={view === v}
                size="sm"
                color={view === v ? "yellow" : "white"}
                onClick={() => setView(v)}
              >
                {v === "mine" ? (mySymbol ? "Your fleet" : nameOf(me)) : (mySymbol ? "Enemy waters" : nameOf(enemy))}
              </ToyButton>
            ))}
          </div>

          <div className="flex flex-wrap items-start justify-center gap-6">
            <div className={`flex flex-col items-center gap-3 ${view === "mine" ? "" : "max-md:hidden"}`}>
              <SeaGrid title={myTitle} tint="bg-candy-blue/30" ships={myShipMap} shots={shots[enemy] ?? {}} />
              {groups ? (
                <div className="flex flex-wrap justify-center gap-2 max-w-[22rem]">
                  {FLEET.map((ship, gi) => {
                    const sunk = groups[gi].every(c => shots[enemy]?.[String(c)] === "hit");
                    return (
                      <span key={ship.name} className={`chunk-sm bg-white px-2 py-0.5 text-sm font-bold text-ink ${sunk ? "line-through opacity-50" : ""}`}>
                        {ship.name} {ship.size}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <HitsBar label="Hits taken" n={myHitsTaken} />
              )}
            </div>

            <div className={`flex flex-col items-center gap-3 ${view === "enemy" ? "" : "max-md:hidden"}`}>
              <SeaGrid
                title={enemyTitle}
                tint="bg-candy-blue/60"
                ships={new Map()}
                shots={shots[me] ?? {}}
                onFire={isMyTurn ? fire : undefined}
              />
              <HitsBar label="Hits" n={countHits(shots[me])} />
            </div>
          </div>
        </>
      )}

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
