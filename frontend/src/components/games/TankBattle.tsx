"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { hearts, nameForSymbol, outcomeFor, resultTitle } from "@/lib/players";
import {
  SEATS, SEAT_INFO, matchWinsLine, ranking, seatedSeats,
  type DriveState, type Seat, type ShellView, type TankView, type TurnState,
} from "@/lib/tankBattle";
import type { GameProps } from "@/lib/types";
import TankBattleArena from "./TankBattleArena";
import TankBattleCard, { type TankCardState } from "./TankBattleCard";

const MEDALS = ["🥇", "🥈", "🥉"];
// Game-area width (px) from which the cards sit around the arena; Tailwind's @3xl container size (48rem)
const WIDE = 768;

const KEYS: Record<string, { axis: "drive" | "turn"; state: "fwd" | "back" | "left" | "right" }> = {
  ArrowUp: { axis: "drive", state: "fwd" }, w: { axis: "drive", state: "fwd" }, W: { axis: "drive", state: "fwd" },
  ArrowDown: { axis: "drive", state: "back" }, s: { axis: "drive", state: "back" }, S: { axis: "drive", state: "back" },
  ArrowLeft: { axis: "turn", state: "left" }, a: { axis: "turn", state: "left" }, A: { axis: "turn", state: "left" },
  ArrowRight: { axis: "turn", state: "right" }, d: { axis: "turn", state: "right" }, D: { axis: "turn", state: "right" },
};

export default function TankBattle({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [scale, setScale] = useState(1);

  const phase = gameState?.phase ?? "lobby";
  const ready: Record<string, boolean> = gameState?.ready ?? {};
  const active: Record<string, boolean> = gameState?.active ?? {};
  const lives: Record<string, number> = gameState?.lives ?? {};
  const tanks: Partial<Record<Seat, TankView>> = gameState?.tanks ?? {};
  const shells: ShellView[] = gameState?.shells ?? [];
  const map: string[] = gameState?.map ?? [];
  const FIELD: number = gameState?.field ?? 600;
  const TILE: number = gameState?.tile ?? 40;
  const TANK_R: number = gameState?.tank_r ?? 15;
  const SHELL_R: number = gameState?.shell_r ?? 5;
  const LIVES_MAX: number = gameState?.lives_max ?? 3;
  const knockoutOrder: Seat[] = gameState?.knockout_order ?? [];
  const winner: Seat | null = gameState?.winner ?? null;

  const mySeat = SEATS.find(s => s === mySymbol) ?? null;
  const iCanMove = phase === "playing" && !!mySeat && !!tanks[mySeat]?.alive;

  // Scale the arena to fit the game area (not the window: the chat panel takes part of it),
  // leaving room for the cards and controls. WIDE matches the @3xl container query below.
  const areaRef = useRef<HTMLDivElement>(null);
  const inLobby = phase === "lobby" || !gameState;
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => {
      const wide = el.clientWidth >= WIDE;
      const w = el.clientWidth - (wide ? 32 + 2 * 180 + 2 * 12 + 6 : 32 + 6);
      const h = el.clientHeight - (wide ? 32 + 40 + 6 : 2 * 80 + 8 + 2 * 12 + 32 + 140 + 6);
      const next = Math.min(w / FIELD, Math.max(h, 100) / FIELD, 1);
      setScale(Math.max(next, 0.1));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [FIELD, inLobby]);

  const sendMove = (action_type: "set_ready" | "start") =>
    ws.send(JSON.stringify({ action: "move", action_type }));

  const sendInput = useCallback((action_type: "drive" | "turn", state: DriveState | TurnState) => {
    ws.send(JSON.stringify({ action: "move", action_type, state }));
  }, [ws]);

  const sendFire = useCallback(() => {
    ws.send(JSON.stringify({ action: "move", action_type: "fire" }));
  }, [ws]);

  // Keyboard controls: driving and turning are separate held axes; Space fires.
  // Keys typed into the chat box are left alone.
  useEffect(() => {
    if (!iCanMove) return;
    // Held states per axis, most recent last; the last one wins
    const held: Record<"drive" | "turn", string[]> = { drive: [], turn: [] };
    const typing = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    const sendAxis = (axis: "drive" | "turn") =>
      sendInput(axis, (held[axis][held[axis].length - 1] ?? "stop") as DriveState | TurnState);
    const onDown = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === " ") { e.preventDefault(); if (!e.repeat) sendFire(); return; }
      const k = KEYS[e.key];
      if (!k) return;
      e.preventDefault(); // Stop page scrolling for all tank keys
      if (e.repeat || held[k.axis].includes(k.state)) return;
      held[k.axis].push(k.state);
      sendAxis(k.axis);
    };
    const onUp = (e: KeyboardEvent) => {
      const k = KEYS[e.key];
      if (!k) return;
      held[k.axis] = held[k.axis].filter(x => x !== k.state);
      sendAxis(k.axis);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      sendInput("drive", "stop");
      sendInput("turn", "stop");
    };
  }, [iCanMove, sendInput, sendFire]);

  // ── Loading ──
  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;
  }

  // ── Lobby ──
  if (phase === "lobby") {
    const seated = seatedSeats(gameState);
    const readyCount = seated.filter(s => ready[s]).length;
    const isSeated = !!mySymbol && seated.some(s => s === mySymbol);
    const iAmReady = isSeated && !!ready[mySymbol!];
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-2 sm:p-4 w-full overflow-y-auto">
        <div className="chunk bg-white p-6 sm:p-8 flex flex-col items-center gap-4 max-w-sm w-full text-ink animate-pop">
          <div className="text-6xl" aria-hidden="true">{iAmReady ? "✅" : "🛡️"}</div>
          <h2 className="text-2xl font-black">Tank Battle</h2>
          <div className="w-full grid grid-cols-2 gap-2">
            {SEATS.map(seat => {
              const held = seated.includes(seat);
              return (
                <div key={seat} className={`chunk-sm rounded-xl px-2 py-2 text-center text-sm font-bold truncate ${held && ready[seat] ? "bg-candy-green" : "bg-cream-2"} ${seat === mySymbol ? "ring-4 ring-candy-yellow" : ""}`}>
                  <div className="text-2xl" aria-hidden="true">{held ? (ready[seat] ? "✅" : "⏳") : "🪑"}</div>
                  {held ? nameForSymbol(gameState, seat) : "Empty seat"}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-ink/60">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
                    {SEAT_INFO[seat].label} · {SEAT_INFO[seat].corner}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-ink/70 text-sm font-bold text-center">Needs at least 2 ready players. Players who are not ready sit the round out.</p>
          {!isSeated ? (
            <div className="text-ink/70 font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Watching — waiting for players…</div>
          ) : !iAmReady ? (
            <ToyButton color="green" size="lg" className="w-full" onClick={() => sendMove("set_ready")}>
              Ready?
            </ToyButton>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
              <ToyButton size="lg" className="w-full" disabled={readyCount < 2} onClick={() => sendMove("start")}>
                Start with {readyCount} players
              </ToyButton>
              <div className="text-ink/60 text-xs font-bold">Starts by itself when everyone is ready</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Game / Finished ──
  const seated = seatedSeats(gameState);
  const cardState = (s: Seat): TankCardState =>
    !seated.includes(s) ? "empty" : !active[s] ? "sitting" : (lives[s] ?? 0) === 0 ? "out" : "playing";
  const card = (s: Seat) => (
    <TankBattleCard seat={s} name={nameForSymbol(gameState, s)} lives={lives[s] ?? 0} livesMax={LIVES_MAX}
      state={cardState(s)} isMe={s === mySymbol} />
  );
  // A held button sends its state on press and "stop" on release, so driving and turning can be held together
  const holdBtn = (axis: "drive" | "turn", state: DriveState | TurnState, label: string, glyph: string) => (
    <button aria-label={label}
      className="game-btn btn-toy touch-none w-16 h-16 rounded-2xl bg-candy-yellow text-ink text-3xl font-black flex items-center justify-center"
      onPointerDown={(e) => { e.preventDefault(); sendInput(axis, state); }}
      onPointerUp={() => sendInput(axis, "stop")}
      onPointerCancel={() => sendInput(axis, "stop")}
      onContextMenu={(e) => e.preventDefault()}>{glyph}</button>
  );

  return (
    <div ref={areaRef} className="@container flex-1 flex flex-col items-center justify-center gap-3 p-4 relative select-none overflow-hidden">

      {/* Narrow game area: 2×2 cards above the arena, in seat order TL TR / BL BR */}
      <div className="@3xl:hidden grid grid-cols-2 gap-2 w-full max-w-sm">
        {SEATS.map(s => <div key={s} className="min-w-0">{card(s)}</div>)}
      </div>

      {/* Wide game area: cards at the four corners of the arena; narrow: just the arena */}
      <div className="flex justify-center @3xl:grid @3xl:grid-cols-[180px_auto_180px] @3xl:grid-rows-2 @3xl:gap-3">
        <div className="hidden @3xl:block @3xl:col-start-1 @3xl:row-start-1 self-start">{card("TL")}</div>
        <div className="hidden @3xl:block @3xl:col-start-1 @3xl:row-start-2 self-end">{card("BL")}</div>
        <div className="@3xl:col-start-2 @3xl:row-start-1 @3xl:row-span-2">
          <TankBattleArena
            size={{ field: FIELD, tile: TILE, tankR: TANK_R, shellR: SHELL_R }}
            scale={scale}
            map={map}
            tanks={tanks}
            shells={shells}
            bursts={[]}
            mySeat={mySeat}
            countdown={null}
            banner={null}
          />
        </div>
        <div className="hidden @3xl:block @3xl:col-start-3 @3xl:row-start-1 self-start">{card("TR")}</div>
        <div className="hidden @3xl:block @3xl:col-start-3 @3xl:row-start-2 self-end">{card("BR")}</div>
      </div>

      {/* Controls hint / mobile buttons — live players only */}
      {iCanMove && <div className="flex flex-col items-center gap-3 w-full max-w-sm z-10">
        {/* Keyboard hint — desktop only */}
        <div className="hidden md:flex gap-6 text-ink/60 text-xs font-bold">
          <span>W / ↑ forward</span><span>S / ↓ reverse</span><span>A D / ← → turn</span><span>Space fire</span>
        </div>

        {/* Mobile controls — touch only */}
        <div className="md:hidden flex items-center justify-between w-full max-w-sm gap-3">
          <div className="flex gap-2">{holdBtn("turn", "left", "Turn left", "⟲")}{holdBtn("turn", "right", "Turn right", "⟳")}</div>
          <div className="flex flex-col gap-2">{holdBtn("drive", "fwd", "Drive forward", "▲")}{holdBtn("drive", "back", "Reverse", "▼")}</div>
          <button aria-label="Fire"
            className="game-btn btn-toy touch-none w-24 h-24 rounded-full bg-candy-red text-white text-xl font-black"
            onPointerDown={(e) => { e.preventDefault(); sendFire(); }}
            onContextMenu={(e) => e.preventDefault()}>FIRE</button>
        </div>
      </div>}

      <ResultOverlay
        open={!!winner}
        outcome={outcomeFor(winner, false, mySymbol)}
        title={resultTitle(gameState, winner, false, mySymbol)}
        subtitle={matchWinsLine(gameState, matchScore)}
        onPlayAgain={handleRestart}
      >
        <ol className="flex flex-col gap-1.5 text-left font-bold">
          {ranking(winner, knockoutOrder).map((s, i) => (
            <li key={s} className="chunk-sm bg-white rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="w-7 text-center shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
              <span className={`inline-block w-3 h-3 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[s].color}`} aria-hidden="true" />
              <span className="truncate">{nameForSymbol(gameState, s) ?? SEAT_INFO[s].label}</span>
              {i === 0 && winner && (
                <span className="ml-auto shrink-0 text-sm">{hearts(LIVES_MAX - (lives[winner] ?? 0), LIVES_MAX)}</span>
              )}
            </li>
          ))}
        </ol>
      </ResultOverlay>
    </div>
  );
}
