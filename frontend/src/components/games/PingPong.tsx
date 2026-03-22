"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface PingPongProps {
  ws: WebSocket;
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
}

export default function PingPong({ ws, gameState, mySymbol, handleRestart }: PingPongProps) {
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

  const isMyLeft = mySymbol === "L";
  const enemySymbol = isMyLeft ? "R" : "L";

  // Scale field to fit the window.
  // Using window dimensions directly avoids the clientWidth=0 issue
  // that occurs in mobile browsers before flex layout settles.
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth - 32;
      // Reserve space for: compact header (~50px) + scoreboard (~70px)
      // + controls/padding (~130px on mobile, ~60px on desktop)
      const reservedH = window.innerWidth < 768 ? 260 : 160;
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
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  // ── Lobby ──
  if (phase === "lobby") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl backdrop-blur-md max-w-sm w-full">
          <h2 className="text-2xl font-bold text-slate-100">Ping-Pong</h2>
          <p className="text-slate-400 text-sm text-center">Both players must be ready to start.</p>
          <div className="w-full flex flex-col gap-2 my-2">
            {(["L", "R"] as const).map(sym => (
              <div key={sym} className={`flex items-center justify-between px-4 py-2 rounded-lg border ${ready[sym] ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
                <span className="font-mono text-sm">{sym === "L" ? "🏓 Left Paddle" : "🏓 Right Paddle"}</span>
                <span className="text-xs">{ready[sym] ? "✓ Ready" : "Waiting..."}</span>
              </div>
            ))}
          </div>
          {mySymbol && !ready[mySymbol] ? (
            <button onClick={() => ws.send(JSON.stringify({ action: "move", action_type: "set_ready" }))}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all shadow-lg shadow-indigo-500/20">
              Ready!
            </button>
          ) : (
            <div className="text-indigo-400 flex items-center gap-2 animate-pulse text-sm"><Loader2 className="animate-spin" size={16} /> Waiting for opponent...</div>
          )}
        </div>
      </div>
    );
  }

  // ── Game / Finished ──
  return (
    <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center gap-4 p-4 relative select-none overflow-hidden" tabIndex={0}>

      {/* Scoreboard */}
      <div className="flex gap-8 items-center text-slate-200 font-bold z-10">
        <span className={`text-3xl ${mySymbol === "L" ? "text-cyan-400" : "text-rose-400"}`}>{scores["L"] ?? 0}</span>
        <span className="text-slate-600 text-sm font-normal">vs</span>
        <span className={`text-3xl ${mySymbol === "R" ? "text-cyan-400" : "text-rose-400"}`}>{scores["R"] ?? 0}</span>
      </div>

      {/* Field */}
      <div
        className="relative bg-slate-950 rounded-xl border-2 border-slate-700 shadow-[0_0_40px_rgba(99,102,241,0.15)] overflow-hidden"
        style={{ width: FIELD_W * scale, height: FIELD_H * scale }}
      >
        {/* Centre line */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-slate-700/60" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 12px, #334155 12px, #334155 24px)" }} />

        {/* Left paddle — min 8px wide so it's always visible on small screens */}
        <div className="absolute rounded-sm bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]"
          style={{ left: PADDLE_X * scale, width: Math.max(PADDLE_W * scale, 8), height: PADDLE_H * scale, top: (leftY - PADDLE_H / 2) * scale }} />

        {/* Right paddle */}
        <div className="absolute rounded-sm bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.6)]"
          style={{ right: PADDLE_X * scale, width: Math.max(PADDLE_W * scale, 8), height: PADDLE_H * scale, top: (rightY - PADDLE_H / 2) * scale }} />

        {/* Ball */}
        <div className="absolute rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]"
          style={{ left: (ballX - BALL_R) * scale, top: (ballY - BALL_R) * scale, width: BALL_R * 2 * scale, height: BALL_R * 2 * scale }} />

        {/* Winner overlay */}
        {winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
            <h2 className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-4">
              {winner === mySymbol ? "🏆 Victory!" : "💀 Defeat!"}
            </h2>
            <button onClick={handleRestart}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all shadow-lg">
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Controls hint / mobile buttons */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm z-10">
        {/* Keyboard hint — desktop only */}
        <div className="hidden md:flex gap-6 text-slate-600 text-xs font-mono">
          <span>W / ↑ — move up</span>
          <span>S / ↓ — move down</span>
        </div>

        {/* Mobile D-pad — touch only */}
        <div className="md:hidden flex gap-4">
          <button className="w-16 h-16 bg-slate-800 active:bg-indigo-700 border border-slate-600 rounded-2xl text-2xl flex items-center justify-center shadow-lg touch-none"
            onPointerDown={(e) => { e.preventDefault(); sendPaddle("up"); }}
            onPointerUp={() => sendPaddle("stop")}
            onPointerCancel={() => sendPaddle("stop")}>▲</button>
          <button className="w-16 h-16 bg-slate-800 active:bg-indigo-700 border border-slate-600 rounded-2xl text-2xl flex items-center justify-center shadow-lg touch-none"
            onPointerDown={(e) => { e.preventDefault(); sendPaddle("down"); }}
            onPointerUp={() => sendPaddle("stop")}
            onPointerCancel={() => sendPaddle("stop")}>▼</button>
        </div>
      </div>
    </div>
  );
}
