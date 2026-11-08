"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const TRAIL_LEN = 5;
const SQUISH_MS = 120;
const COUNTDOWN = ["3", "2", "1", "Go!"];
const COUNTDOWN_MS = 1500;
// A jump this far in one frame is a serve reset, not a bounce (ball moves ~5 units/tick)
const TELEPORT_DIST = 60;

type Point = { x: number; y: number };

export default function PingPong({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Derived state
  const phase = gameState?.phase ?? "lobby";
  const ready = gameState?.ready ?? {};
  const scores = gameState?.scores ?? {};
  const winner = gameState?.winner ?? null;
  const ballX = gameState?.ball_x ?? 400;
  const ballY = gameState?.ball_y ?? 250;
  const leftY = gameState?.left_y ?? 250;
  const rightY = gameState?.right_y ?? 250;
  const FIELD_W = gameState?.field_w ?? 800;
  const FIELD_H = gameState?.field_h ?? 500;
  const PADDLE_H = gameState?.paddle_h ?? 80;
  const PADDLE_W = gameState?.paddle_w ?? 12;
  const BALL_R = gameState?.ball_r ?? 9;
  const PADDLE_X = 30;

  const isDraw = gameState?.is_draw ?? false;
  const scoreL: number = scores["L"] ?? 0;
  const scoreR: number = scores["R"] ?? 0;

  // Ball trail and squish: the last positions live in a ref, the rendered copy in state
  const trailRef = useRef<Point[]>([]);
  const lastDxRef = useRef(0);
  const [trail, setTrail] = useState<Point[]>([]);
  const [squish, setSquish] = useState(false);
  const squishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBall = useRef<Point>({ x: ballX, y: ballY });

  useOnChange(`${ballX},${ballY}`, () => {
    const prev = prevBall.current;
    prevBall.current = { x: ballX, y: ballY };
    const dx = ballX - prev.x;
    if (Math.hypot(dx, ballY - prev.y) > TELEPORT_DIST) {
      // Serve reset: start a fresh trail, no bounce
      trailRef.current = [];
      lastDxRef.current = 0;
      setTrail([]);
      return;
    }
    trailRef.current = [...trailRef.current, prev].slice(-TRAIL_LEN);
    setTrail(trailRef.current);
    if (dx !== 0) {
      if (lastDxRef.current !== 0 && Math.sign(dx) !== Math.sign(lastDxRef.current)) {
        play("hit");
        setSquish(true);
        if (squishTimer.current) clearTimeout(squishTimer.current);
        squishTimer.current = setTimeout(() => setSquish(false), SQUISH_MS);
      }
      lastDxRef.current = dx;
    }
  });

  useOnChange(scoreL, (n, p) => { if (n > p) play("pop"); });
  useOnChange(scoreR, (n, p) => { if (n > p) play("pop"); });

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

  useEffect(() => () => {
    countTimers.current.forEach(clearTimeout);
    if (squishTimer.current) clearTimeout(squishTimer.current);
  }, []);

  // Scale field to fit the window.
  // Using window dimensions directly avoids the clientWidth=0 issue
  // that occurs in mobile browsers before flex layout settles.
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth - 32;
      // Reserve space for: compact header (~50px) + score bubbles (~100px)
      // + controls/padding (~150px on mobile, ~60px on desktop)
      const reservedH = window.innerWidth < 768 ? 300 : 210;
      const h = window.innerHeight - reservedH;
      const next = Math.min(w / FIELD_W, Math.max(h, 100) / FIELD_H, 1);
      setScale(Math.max(next, 0.1)); // guarantee a usable minimum
    };
    window.addEventListener("resize", update);
    update(); // run immediately — window dims are always available
    return () => window.removeEventListener("resize", update);
  }, [FIELD_W, FIELD_H]);

  // Keyboard controls — send paddle state to server
  const sendPaddle = useCallback((state: "up" | "down" | "stop") => {
    ws.send(JSON.stringify({ action: "move", action_type: "paddle", state }));
  }, [ws]);

  useEffect(() => {
    if (phase !== "playing") return;
    const held = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "w", "W", "s", "S"].includes(e.key)) return;
      e.preventDefault(); // Stop page scrolling for all paddle keys
      if (e.repeat) return;
      if (["ArrowUp", "w", "W"].includes(e.key) && !held.has("up")) {
        held.add("up"); held.delete("down"); sendPaddle("up");
      } else if (["ArrowDown", "s", "S"].includes(e.key) && !held.has("down")) {
        held.add("down"); held.delete("up"); sendPaddle("down");
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (["ArrowUp", "w", "W"].includes(e.key)) { held.delete("up"); }
      if (["ArrowDown", "s", "S"].includes(e.key)) { held.delete("down"); }
      if (held.size === 0) sendPaddle("stop");
      else if (held.has("up")) sendPaddle("up");
      else sendPaddle("down");
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      sendPaddle("stop");
    };
  }, [phase, sendPaddle]);

  // ── Loading ──
  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;
  }

  const nameOf = (sym: string) => nameForSymbol(gameState, sym) ?? (sym === "L" ? "Left" : "Right");

  // ── Lobby ──
  if (phase === "lobby") {
    const iAmReady = !!mySymbol && !!ready[mySymbol];
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-2 sm:p-4 w-full overflow-y-auto">
        <div className="chunk bg-white p-6 sm:p-8 flex flex-col items-center gap-4 max-w-sm w-full text-ink animate-pop">
          <div className="text-6xl" aria-hidden="true">{iAmReady ? "✅" : "🏓"}</div>
          <h2 className="text-2xl font-black">Ping-Pong</h2>
          <p className="text-ink/70 text-sm font-bold text-center">Both players must be ready to start. First to 7 wins!</p>
          <div className="w-full grid grid-cols-2 gap-2">
            {(["L", "R"] as const).map(sym => (
              <div key={sym} className={`chunk-sm rounded-xl px-2 py-2 text-center text-sm font-bold truncate ${ready[sym] ? "bg-candy-green" : "bg-cream-2"}`}>
                <div className="text-2xl" aria-hidden="true">{ready[sym] ? "✅" : "⏳"}</div>
                {nameOf(sym)}
                <div className="text-xs text-ink/60">{sym === "L" ? "Left paddle" : "Right paddle"}</div>
              </div>
            ))}
          </div>
          {mySymbol && !iAmReady ? (
            <ToyButton color="green" size="lg" className="w-full"
              onClick={() => ws.send(JSON.stringify({ action: "move", action_type: "set_ready" }))}>
              Ready?
            </ToyButton>
          ) : (
            <div className="text-ink/70 font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Waiting for opponent…</div>
          )}
        </div>
      </div>
    );
  }

  const bubble = (sym: "L" | "R", score: number) => (
    <div className={`chunk bg-white text-ink px-4 py-1 sm:px-5 flex flex-col items-center min-w-20 ${sym === mySymbol ? "ring-4 ring-candy-yellow" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold max-w-28 sm:max-w-40">
        <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${sym === "L" ? "bg-candy-blue" : "bg-candy-pink"}`} />
        <span className="truncate">{nameOf(sym)}{sym === mySymbol && " (you)"}</span>
      </div>
      <div key={score} className="text-4xl font-black tabular-nums animate-pop">{score}</div>
    </div>
  );

  const paddleStyle = (y: number) => ({
    width: Math.max(PADDLE_W * scale, 8), height: PADDLE_H * scale, top: (y - PADDLE_H / 2) * scale,
  });
  const ballSize = BALL_R * 2 * scale;

  // ── Game / Finished ──
  return (
    <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 relative select-none overflow-hidden outline-none" tabIndex={0}>

      {/* Score bubbles */}
      <div className="flex gap-3 sm:gap-6 items-center z-10">
        {bubble("L", scoreL)}
        <div className="chunk-sm bg-candy-yellow text-ink text-xs font-black uppercase px-2 py-1 rounded-lg whitespace-nowrap">First to 7</div>
        {bubble("R", scoreR)}
      </div>

      {/* Court */}
      <div
        className="relative chunk overflow-hidden"
        style={{
          width: FIELD_W * scale, height: FIELD_H * scale, boxSizing: "content-box",
          backgroundImage: "repeating-linear-gradient(90deg, #3ddc84 0 10%, #34c975 10% 20%)",
        }}
      >
        {/* Centre line */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0px, #fff 12px, transparent 12px, transparent 24px)" }} />

        {/* Left paddle — min 8px wide so it's always visible on small screens */}
        <div className="absolute rounded-full bg-candy-blue border-2 border-ink" style={{ left: PADDLE_X * scale, ...paddleStyle(leftY) }} />

        {/* Right paddle */}
        <div className="absolute rounded-full bg-candy-pink border-2 border-ink" style={{ right: PADDLE_X * scale, ...paddleStyle(rightY) }} />

        {/* Ball trail: oldest is faintest */}
        {trail.map((p, i) => (
          <div key={i} aria-hidden="true" className="absolute rounded-full bg-candy-yellow"
            style={{
              left: (p.x - BALL_R) * scale, top: (p.y - BALL_R) * scale, width: ballSize, height: ballSize,
              opacity: 0.1 + (0.3 * (i + TRAIL_LEN - trail.length)) / (TRAIL_LEN - 1),
            }} />
        ))}

        {/* Ball */}
        <div className="absolute rounded-full bg-candy-yellow border-2 border-ink transition-transform duration-75"
          style={{
            left: (ballX - BALL_R) * scale, top: (ballY - BALL_R) * scale, width: ballSize, height: ballSize,
            transform: squish ? "scale(0.8,1.2)" : "none",
          }} />

        {/* Countdown */}
        {countIdx !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
            <div key={countIdx} className="chunk bg-white text-ink font-black text-5xl sm:text-7xl px-6 py-2 animate-pop">
              {COUNTDOWN[countIdx]}
            </div>
          </div>
        )}
      </div>

      {/* Controls hint / mobile buttons */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm z-10">
        {/* Keyboard hint — desktop only */}
        <div className="hidden md:flex gap-6 text-ink/60 text-xs font-bold">
          <span>W / ↑ — move up</span>
          <span>S / ↓ — move down</span>
        </div>

        {/* Mobile D-pad — touch only */}
        <div className="md:hidden flex gap-6">
          <button aria-label="Move up" className="game-btn btn-toy w-20 h-20 rounded-2xl bg-candy-yellow text-ink text-3xl font-black flex items-center justify-center"
            onPointerDown={(e) => { e.preventDefault(); sendPaddle("up"); }}
            onPointerUp={() => sendPaddle("stop")}
            onPointerCancel={() => sendPaddle("stop")}>▲</button>
          <button aria-label="Move down" className="game-btn btn-toy w-20 h-20 rounded-2xl bg-candy-yellow text-ink text-3xl font-black flex items-center justify-center"
            onPointerDown={(e) => { e.preventDefault(); sendPaddle("down"); }}
            onPointerUp={() => sendPaddle("stop")}
            onPointerCancel={() => sendPaddle("stop")}>▼</button>
        </div>
      </div>

      <ResultOverlay
        open={!!winner || isDraw}
        outcome={outcomeFor(winner, isDraw, mySymbol)}
        title={resultTitle(gameState, winner, isDraw, mySymbol)}
        subtitle={<>
          <div className="font-black text-2xl tabular-nums">{`${scoreL} – ${scoreR}`}</div>
          <div className="text-sm">Match {scoreLine(matchScore, "L", "R")}</div>
        </>}
        onPlayAgain={handleRestart}
      />
    </div>
  );
}
