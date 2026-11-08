"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { hearts, nameForSymbol, outcomeFor, resultTitle } from "@/lib/players";
import { SEATS, SEAT_INFO, matchWinsLine, ranking, seatedSeats, type Seat } from "@/lib/pongFour";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";
import PongFourCard, { type PongFourCardState } from "./PongFourCard";
import PongFourCourt, { TRAIL_LEN } from "./PongFourCourt";

const SQUISH_MS = 120;
const COUNTDOWN = ["3", "2", "1", "Go!"];
const COUNTDOWN_MS = 1500;
// A jump this far in one frame is a serve reset, not a bounce (ball moves 6 units/tick)
const TELEPORT_DIST = 60;
// Extra slack, in court units, when deciding that a bounce happened at a paddle
const HIT_SLACK = 8;
const KNOCKOUT_MS = 1500;
const MEDALS = ["🥇", "🥈", "🥉"];
// Game-area width (px) from which the cards sit around the court; Tailwind's @3xl container size (48rem)
const WIDE = 768;

type Point = { x: number; y: number };

const KEYS = {
  x: { neg: ["ArrowLeft", "a", "A"], pos: ["ArrowRight", "d", "D"] },
  y: { neg: ["ArrowUp", "w", "W"], pos: ["ArrowDown", "s", "S"] },
} as const;

export default function PongFour({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [scale, setScale] = useState(1);

  const phase = gameState?.phase ?? "lobby";
  const ready: Record<string, boolean> = gameState?.ready ?? {};
  const active: Record<string, boolean> = gameState?.active ?? {};
  const lives: Record<string, number> = gameState?.lives ?? {};
  const paddlesRaw: Record<string, number> = gameState?.paddles ?? {};
  const ballX: number = gameState?.ball_x ?? 300;
  const ballY: number = gameState?.ball_y ?? 300;
  const FIELD: number = gameState?.field ?? 600;
  const CORNER: number = gameState?.corner ?? 50;
  const PADDLE_LEN: number = gameState?.paddle_len ?? 100;
  const PADDLE_W: number = gameState?.paddle_w ?? 12;
  const INSET: number = gameState?.paddle_inset ?? 20;
  const BALL_R: number = gameState?.ball_r ?? 9;
  const LIVES_MAX: number = gameState?.lives_max ?? 3;
  const knockoutOrder: Seat[] = gameState?.knockout_order ?? [];
  const lastOut: Seat | null = gameState?.last_out ?? null;
  const winner: Seat | null = gameState?.winner ?? null;

  const isAlive = (s: Seat) => !!active[s] && (lives[s] ?? 0) > 0;
  const mySeat = SEATS.find(s => s === mySymbol) ?? null;
  const myAxis = mySeat ? SEAT_INFO[mySeat].axis : null;
  const iCanMove = phase === "playing" && !!mySeat && isAlive(mySeat);

  // Ball trail and squish: the last positions live in a ref, the rendered copy in state
  const trailRef = useRef<Point[]>([]);
  const lastDir = useRef<Point>({ x: 0, y: 0 });
  const [trail, setTrail] = useState<Point[]>([]);
  const [squish, setSquish] = useState(false);
  const squishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBall = useRef<Point>({ x: ballX, y: ballY });

  useOnChange(`${ballX},${ballY}`, () => {
    const prev = prevBall.current;
    prevBall.current = { x: ballX, y: ballY };
    const dx = ballX - prev.x;
    const dy = ballY - prev.y;
    if (Math.hypot(dx, dy) > TELEPORT_DIST) {
      // Serve reset: start a fresh trail, no bounce
      trailRef.current = [];
      lastDir.current = { x: 0, y: 0 };
      setTrail([]);
      return;
    }
    trailRef.current = [...trailRef.current, prev].slice(-TRAIL_LEN);
    setTrail(trailRef.current);
    const flipped = (d: number, last: number) => d !== 0 && last !== 0 && Math.sign(d) !== Math.sign(last);
    if (flipped(dx, lastDir.current.x) || flipped(dy, lastDir.current.y)) {
      // Only a bounce next to a live player's edge is a paddle hit; walls and corners are silent
      const reach = INSET + PADDLE_W + BALL_R + HIT_SLACK;
      const edgeDist: Record<Seat, number> = { B: FIELD - ballY, T: ballY, L: ballX, R: FIELD - ballX };
      if (SEATS.some(s => isAlive(s) && edgeDist[s] <= reach)) play("hit");
      setSquish(true);
      if (squishTimer.current) clearTimeout(squishTimer.current);
      squishTimer.current = setTimeout(() => setSquish(false), SQUISH_MS);
    }
    lastDir.current = { x: dx !== 0 ? dx : lastDir.current.x, y: dy !== 0 ? dy : lastDir.current.y };
  });

  // 3-2-1-Go! overlay when the match starts (client-side only; the server is already running)
  const [countIdx, setCountIdx] = useState<number | null>(null);
  const countTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // null until the first state arrives, so a refresh mid-match does not count down
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

  // Losing a heart pops (null until the first state arrives, so joining mid-match is silent).
  // Only active seats count: lobby seats are inactive, so the total rises at the start instead of dropping.
  const livesLeft = SEATS.reduce((sum, s) => sum + (active[s] ? lives[s] ?? 0 : 0), 0);
  useOnChange<number | null>(gameState ? livesLeft : null, (next, prev) => {
    if (phase === "playing" && next !== null && prev !== null && next < prev) play("pop");
  });

  // "💥 Name is out!" pop-up; the result overlay takes over once there is a winner
  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useOnChange<number | null>(gameState ? knockoutOrder.length : null, (next, prev) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    if (next === null || prev === null || next <= prev || winner || !lastOut) { setBanner(null); return; }
    setBanner(`💥 ${nameForSymbol(gameState, lastOut) ?? SEAT_INFO[lastOut].side} is out!`);
    bannerTimer.current = setTimeout(() => setBanner(null), KNOCKOUT_MS);
  });

  useEffect(() => () => {
    countTimers.current.forEach(clearTimeout);
    if (squishTimer.current) clearTimeout(squishTimer.current);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  // Scale the court to fit the game area (not the window: the chat panel takes part of it),
  // leaving room for the cards and controls. WIDE matches the @3xl container query below.
  const areaRef = useRef<HTMLDivElement>(null);
  const inLobby = phase === "lobby" || !gameState;
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => {
      const wide = el.clientWidth >= WIDE;
      const w = el.clientWidth - (wide ? 32 + 2 * 180 + 2 * 12 + 6 : 32 + 6);
      const h = el.clientHeight - (wide ? 2 * 80 + 2 * 12 + 32 + 40 : 2 * 80 + 8 + 2 * 12 + 32 + 80 + 6);
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

  const sendPaddle = useCallback((state: "neg" | "pos" | "stop") => {
    ws.send(JSON.stringify({ action: "move", action_type: "paddle", state }));
  }, [ws]);

  // Keyboard controls for your side's axis
  useEffect(() => {
    if (!iCanMove || !myAxis) return;
    const { neg, pos } = KEYS[myAxis];
    const isNeg = (k: string) => (neg as readonly string[]).includes(k);
    const isPos = (k: string) => (pos as readonly string[]).includes(k);
    const held = new Set<"neg" | "pos">();
    const onDown = (e: KeyboardEvent) => {
      if (!isNeg(e.key) && !isPos(e.key)) return;
      e.preventDefault(); // Stop page scrolling for all paddle keys
      if (e.repeat) return;
      if (isNeg(e.key) && !held.has("neg")) {
        held.add("neg"); held.delete("pos"); sendPaddle("neg");
      } else if (isPos(e.key) && !held.has("pos")) {
        held.add("pos"); held.delete("neg"); sendPaddle("pos");
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (isNeg(e.key)) held.delete("neg");
      if (isPos(e.key)) held.delete("pos");
      if (held.size === 0) sendPaddle("stop");
      else if (held.has("neg")) sendPaddle("neg");
      else sendPaddle("pos");
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      sendPaddle("stop");
    };
  }, [iCanMove, myAxis, sendPaddle]);

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
          <div className="text-6xl" aria-hidden="true">{iAmReady ? "✅" : "🏓"}</div>
          <h2 className="text-2xl font-black">4-Player Pong</h2>
          <div className="w-full grid grid-cols-2 gap-2">
            {SEATS.map(seat => {
              const held = seated.includes(seat);
              return (
                <div key={seat} className={`chunk-sm rounded-xl px-2 py-2 text-center text-sm font-bold truncate ${held && ready[seat] ? "bg-candy-green" : "bg-cream-2"} ${seat === mySymbol ? "ring-4 ring-candy-yellow" : ""}`}>
                  <div className="text-2xl" aria-hidden="true">{held ? (ready[seat] ? "✅" : "⏳") : "🪑"}</div>
                  {held ? nameForSymbol(gameState, seat) : "Empty seat"}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-ink/60">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
                    {SEAT_INFO[seat].side} side
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-ink/70 text-sm font-bold text-center">Needs at least 2 ready players. Empty seats are walls.</p>
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
  const cardState = (s: Seat): PongFourCardState =>
    !seated.includes(s) ? "empty" : !active[s] ? "wall" : (lives[s] ?? 0) === 0 ? "out" : "playing";
  const card = (s: Seat) => (
    <PongFourCard seat={s} name={nameForSymbol(gameState, s)} lives={lives[s] ?? 0} livesMax={LIVES_MAX}
      state={cardState(s)} isMe={s === mySymbol} />
  );
  const paddles = Object.fromEntries(SEATS.map(s => [s, paddlesRaw[s] ?? FIELD / 2])) as Record<Seat, number>;
  const alive = Object.fromEntries(SEATS.map(s => [s, isAlive(s)])) as Record<Seat, boolean>;
  const padBtn = (state: "neg" | "pos", label: string, glyph: string) => (
    <button aria-label={label} className="game-btn btn-toy w-20 h-20 rounded-2xl bg-candy-yellow text-ink text-3xl font-black flex items-center justify-center"
      onPointerDown={(e) => { e.preventDefault(); sendPaddle(state); }}
      onPointerUp={() => sendPaddle("stop")}
      onPointerCancel={() => sendPaddle("stop")}>{glyph}</button>
  );

  return (
    <div ref={areaRef} className="@container flex-1 flex flex-col items-center justify-center gap-3 p-4 relative select-none overflow-hidden">

      {/* Narrow game area: 2×2 cards above the court */}
      <div className="@3xl:hidden grid grid-cols-2 gap-2 w-full max-w-sm">
        {SEATS.map(s => <div key={s} className="min-w-0">{card(s)}</div>)}
      </div>

      {/* Wide game area: cards around the court; narrow: just the court */}
      <div className="flex justify-center @3xl:grid @3xl:grid-cols-[auto_auto_auto] @3xl:items-center @3xl:justify-items-center @3xl:gap-3">
        <div className="hidden @3xl:block @3xl:col-start-2 @3xl:row-start-1 w-[220px]">{card("T")}</div>
        <div className="hidden @3xl:block @3xl:col-start-1 @3xl:row-start-2 w-[180px]">{card("L")}</div>
        <div className="@3xl:col-start-2 @3xl:row-start-2">
          <PongFourCourt
            size={{ field: FIELD, corner: CORNER, paddleLen: PADDLE_LEN, paddleW: PADDLE_W, inset: INSET, ballR: BALL_R }}
            scale={scale}
            paddles={paddles}
            alive={alive}
            showWalls
            ball={{ x: ballX, y: ballY }}
            trail={trail}
            squish={squish}
            countdown={countIdx !== null ? COUNTDOWN[countIdx] : null}
            banner={winner ? null : banner}
          />
        </div>
        <div className="hidden @3xl:block @3xl:col-start-3 @3xl:row-start-2 w-[180px]">{card("R")}</div>
        <div className="hidden @3xl:block @3xl:col-start-2 @3xl:row-start-3 w-[220px]">{card("B")}</div>
      </div>

      {/* Controls hint / mobile buttons — live players only */}
      {iCanMove && myAxis && <div className="flex flex-col items-center gap-3 w-full max-w-sm z-10">
        {/* Keyboard hint — desktop only */}
        <div className="hidden md:flex gap-6 text-ink/60 text-xs font-bold">
          {myAxis === "x"
            ? <><span>A / ← move left</span><span>D / → move right</span></>
            : <><span>W / ↑ move up</span><span>S / ↓ move down</span></>}
        </div>

        {/* Mobile D-pad — touch only */}
        <div className="md:hidden flex gap-6">
          {myAxis === "x"
            ? <>{padBtn("neg", "Move left", "◀")}{padBtn("pos", "Move right", "▶")}</>
            : <>{padBtn("neg", "Move up", "▲")}{padBtn("pos", "Move down", "▼")}</>}
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
              <span className="truncate">{nameForSymbol(gameState, s) ?? SEAT_INFO[s].side}</span>
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
