"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { nameForSymbol, outcomeFor, resultTitle } from "@/lib/players";
import { SEATS, SEAT_INFO, matchWinsLine, ranking, seatedSeats, type Seat, type SnakeView } from "@/lib/snakeArena";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";
import SnakeArenaCanvas from "./SnakeArenaCanvas";

const COUNTDOWN = ["3", "2", "1", "Go!"];
const COUNTDOWN_MS = 1500;
const MEDALS = ["🥇", "🥈", "🥉"];
const STEER_MS = 1000 / 15;   // at most 15 steer messages a second
const KEY_TURN = 0.15;        // radians a frame from the current heading with ←/→ or A/D
const MAX_SIZE = 720;         // largest arena in CSS px
// Game-area width (px) from which the player cards sit beside the arena (matches @min-[760px] below)
const WIDE = 760;
const LEFT: Seat[] = ["B", "U", "G"];
const RIGHT: Seat[] = ["P", "O", "Y"];
const TURN_KEYS: Record<string, "left" | "right"> = {
  ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
};

function SeatCard({ seat, name, status, dim, isMe }: { seat: Seat; name?: string; status: string; dim: boolean; isMe: boolean }) {
  return (
    <div className={`chunk bg-white text-ink flex items-center gap-2 px-2 py-2 min-w-0 ${dim ? "opacity-50 grayscale" : ""} ${isMe ? "ring-4 ring-candy-yellow" : ""}`}>
      <Avatar name={name ?? ""} size={32} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{name ?? "Empty"}{isMe && " (you)"}</div>
        <div className="flex items-center gap-1.5 text-xs text-ink/60 font-bold">
          <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
          {SEAT_INFO[seat].label}
        </div>
        <div className="text-sm font-bold whitespace-nowrap">{status}</div>
      </div>
    </div>
  );
}

export default function SnakeArena({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const phase = gameState?.phase ?? "lobby";
  const ready: Record<string, boolean> = gameState?.ready ?? {};
  const active: Record<string, boolean> = gameState?.active ?? {};
  const snakes: Partial<Record<Seat, SnakeView>> = gameState?.snakes ?? {};
  const food: number[] = gameState?.food ?? [];
  const WORLD: number = gameState?.world ?? 1800;
  const HEAD_R: number = gameState?.head_r ?? 10;
  const timeLeft: number = gameState?.time_left ?? 180;
  const order = ranking(gameState?.ranking);
  const winner: Seat | null = gameState?.winner ?? null;
  const isDraw = !!gameState?.is_draw;

  const mySeat = SEATS.find(s => s === mySymbol) ?? null;
  const mine = mySeat ? snakes[mySeat] : undefined;
  const iCanMove = phase === "playing" && !!mine?.alive;

  // 3-2-1-Go! when the round starts; null until the first state, so a refresh mid-round does not count down
  const [countIdx, setCountIdx] = useState<number | null>(null);
  const countTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useOnChange<string | null>(gameState ? phase : null, (next, prev) => {
    countTimers.current.forEach(clearTimeout);
    countTimers.current = [];
    if (next !== "playing" || prev !== "lobby") { setCountIdx(null); return; }
    const step = COUNTDOWN_MS / COUNTDOWN.length;
    COUNTDOWN.forEach((_, i) => {
      countTimers.current.push(setTimeout(() => {
        setCountIdx(i);
        play(i === COUNTDOWN.length - 1 ? "turn" : "click");
      }, i * step));
    });
    countTimers.current.push(setTimeout(() => setCountIdx(null), COUNTDOWN_MS));
  });
  useEffect(() => () => countTimers.current.forEach(clearTimeout), []);

  // Sounds: "pop" when you grow (at most every 150 ms), "hit" on any crash, "turn" when you respawn,
  // "click" each second of the last 10
  const lastPop = useRef(0);
  useOnChange<number | null>(gameState && mine ? mine.len : null, (next, prev) => {
    if (phase !== "playing" || next === null || prev === null || next <= prev) return;
    const now = Date.now();
    if (now - lastPop.current > 150) { lastPop.current = now; play("pop"); }
  });
  // Per seat: "-" no snake, "0" crashed, "1" alive
  const aliveKey = SEATS.map(s => (snakes[s] ? (snakes[s]!.alive ? "1" : "0") : "-")).join("");
  useOnChange<string | null>(gameState ? aliveKey : null, (next, prev) => {
    if (phase !== "playing" || next === null || prev === null) return;
    if ([...next].some((c, i) => c === "0" && prev[i] === "1")) play("hit");
    const i = mySeat ? SEATS.indexOf(mySeat) : -1;
    if (i >= 0 && prev[i] === "0" && next[i] === "1") play("turn");
  });
  useOnChange<number | null>(gameState ? timeLeft : null, (next, prev) => {
    if (phase === "playing" && next !== null && prev !== null && next < prev && next > 0 && next <= 10) play("click");
  });

  // Arena size from the game area (not the window: the chat panel takes part of it)
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(480);
  const inLobby = phase === "lobby" || !gameState;
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => {
      const wide = el.clientWidth >= WIDE;
      // Wide: p-4, a 150px card column and a 12px gap each side, the hint line. Narrow: p-2, the 64px ⚡ button and its gap.
      const w = el.clientWidth - (wide ? 32 + 2 * (150 + 12) + 6 : 16 + 6);
      const h = el.clientHeight - (wide ? 32 + 24 + 6 : 16 + 64 + 8 + 6);
      setSize(Math.max(160, Math.floor(Math.min(w, h, MAX_SIZE))));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [inLobby]);

  const send = useCallback((msg: Record<string, unknown>) => {
    ws.send(JSON.stringify({ action: "move", ...msg }));
  }, [ws]);
  const sendMove = (action_type: "set_ready" | "start") => send({ action_type });

  // Boost is sent on press and release only
  const boosting = useRef(false);
  const setBoost = useCallback((on: boolean) => {
    if (boosting.current === on) return;
    boosting.current = on;
    send({ action_type: "boost", on });
  }, [send]);

  // Steering: pointer and keys set the wanted angle; it is sent at most 15 times a second, only when it changed
  const wanted = useRef<number | null>(null);
  const sent = useRef<number | null>(null);
  const heading = useRef(0);
  useEffect(() => { heading.current = mine?.angle ?? 0; });
  useEffect(() => {
    if (!iCanMove) return;
    const held = new Set<"left" | "right">();
    const typing = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    const onDown = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === " ") { e.preventDefault(); setBoost(true); return; }
      const dir = TURN_KEYS[e.key];
      if (!dir) return;
      e.preventDefault();
      held.add(dir);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") { setBoost(false); return; }
      const dir = TURN_KEYS[e.key];
      if (dir) held.delete(dir);
    };
    let raf = 0;
    const frame = () => {
      const turn = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      if (turn) wanted.current = heading.current + turn * KEY_TURN;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const timer = setInterval(() => {
      const a = wanted.current;
      if (a === null || a === sent.current) return;
      sent.current = a;
      send({ action_type: "steer", angle: Math.round(a * 1000) / 1000 });
    }, STEER_MS);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      // The server drops boost on a crash; start clean after a respawn
      boosting.current = false;
      wanted.current = null;
      sent.current = null;
    };
  }, [iCanMove, send, setBoost]);

  // The camera is centred on your head, so the angle from the arena's centre to the pointer is the heading to aim for
  const aimAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (dx * dx + dy * dy > 16) wanted.current = Math.atan2(dy, dx);
  };

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
          <div className="text-6xl" aria-hidden="true">{iAmReady ? "✅" : "🐍"}</div>
          <h2 className="text-2xl font-black">Snake Arena</h2>
          <div className="w-full grid grid-cols-2 gap-2">
            {SEATS.map(seat => {
              const held = seated.includes(seat);
              return (
                <div key={seat} className={`chunk-sm rounded-xl px-2 py-2 text-center text-sm font-bold truncate ${held && ready[seat] ? "bg-candy-green" : "bg-cream-2"} ${seat === mySymbol ? "ring-4 ring-candy-yellow" : ""}`}>
                  <div className="text-2xl" aria-hidden="true">{held ? (ready[seat] ? "✅" : "⏳") : "🪑"}</div>
                  {held ? nameForSymbol(gameState, seat) : "Empty seat"}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-ink/60">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
                    {SEAT_INFO[seat].label}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-ink/70 text-sm font-bold text-center">3-minute round. Needs at least 2 ready players. Players who are not ready sit the round out.</p>
          {!isSeated ? (
            <div className="text-ink/70 font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Watching — waiting for players…</div>
          ) : !iAmReady ? (
            <ToyButton color="green" size="lg" className="w-full" onClick={() => sendMove("set_ready")}>Ready?</ToyButton>
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
  const names = Object.fromEntries(SEATS.map(s => [s, nameForSymbol(gameState, s) ?? SEAT_INFO[s].label])) as Record<Seat, string>;
  const statusOf = (s: Seat) => {
    const sn = snakes[s];
    if (!seated.includes(s)) return "—";
    if (!active[s] || !sn) return "🪑 Sits out";
    return sn.alive ? `📏 ${sn.len}` : `💥 ${sn.len}`;
  };
  const card = (s: Seat) => (
    <SeatCard key={s} seat={s} name={seated.includes(s) ? names[s] : undefined} status={statusOf(s)}
      dim={!seated.includes(s) || (!!snakes[s] && !snakes[s]!.alive)} isMe={s === mySymbol} />
  );
  const crashed = phase === "playing" && !!mine && !mine.alive;
  const banner = crashed ? `💥 You crashed! Back in ${mine!.respawn_in}…` : null;
  const finished = phase === "finished" && (!!winner || isDraw);

  return (
    <div ref={areaRef} className="@container flex-1 flex flex-col relative select-none overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 @min-[760px]:p-4">
        <div className="flex items-center gap-3">
          <div className="hidden @min-[760px]:flex flex-col gap-3 w-[150px]">{LEFT.map(card)}</div>
          <div className="touch-none"
            onPointerDown={(e) => {
              if (!iCanMove) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              aimAt(e);
              if (e.pointerType === "mouse" && e.button === 0) setBoost(true);
            }}
            onPointerMove={(e) => { if (iCanMove && (e.pointerType === "mouse" || e.buttons)) aimAt(e); }}
            onPointerUp={(e) => { if (e.pointerType === "mouse") setBoost(false); }}
            onPointerCancel={() => setBoost(false)}
            onContextMenu={(e) => e.preventDefault()}>
            <SnakeArenaCanvas size={size} world={WORLD} headR={HEAD_R} snakes={snakes} food={food} names={names}
              mySeat={mySeat} timeLeft={timeLeft} leaders={order}
              countdown={countIdx !== null ? COUNTDOWN[countIdx] : null}
              banner={finished ? null : banner} />
          </div>
          <div className="hidden @min-[760px]:flex flex-col gap-3 w-[150px]">{RIGHT.map(card)}</div>
        </div>

        {/* Wide: keyboard hint. Narrow: the ⚡ boost button under the arena. */}
        <div className="hidden @min-[760px]:flex gap-6 text-ink/60 text-xs font-bold">
          <span>Point to steer</span><span>A D / ← → turn</span><span>Hold click or Space to boost</span>
        </div>
        <button aria-label="Boost" disabled={!iCanMove}
          className="@min-[760px]:hidden game-btn btn-toy touch-none w-16 h-16 rounded-full bg-candy-yellow text-ink text-3xl font-black disabled:opacity-40"
          onPointerDown={(e) => { e.preventDefault(); setBoost(true); }}
          onPointerUp={() => setBoost(false)}
          onPointerCancel={() => setBoost(false)}
          onPointerLeave={() => setBoost(false)}
          onContextMenu={(e) => e.preventDefault()}>⚡</button>
      </div>

      <ResultOverlay
        open={finished}
        outcome={outcomeFor(winner, isDraw, mySymbol)}
        title={resultTitle(gameState, winner, isDraw, mySymbol)}
        subtitle={matchWinsLine(gameState, matchScore)}
        onPlayAgain={handleRestart}
      >
        <ol className="flex flex-col gap-1.5 text-left font-bold">
          {order.map((s, i) => (
            <li key={s} className="chunk-sm bg-white rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="w-7 text-center shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
              <span className={`inline-block w-3 h-3 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[s].color}`} aria-hidden="true" />
              <span className="truncate">{names[s]}</span>
              <span className="ml-auto shrink-0 text-sm">📏 {snakes[s]?.len ?? 0}</span>
            </li>
          ))}
        </ol>
      </ResultOverlay>
    </div>
  );
}
