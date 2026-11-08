"use client";
import { Loader2 } from "lucide-react";
import ToyButton from "@/components/ui/ToyButton";
import { nameForSymbol } from "@/lib/players";
import { SEATS, SEAT_INFO, seatedSeats } from "@/lib/pongFour";
import type { GameProps } from "@/lib/types";

export default function PongFour({ ws, gameState, mySymbol }: GameProps) {
  const phase = gameState?.phase ?? "lobby";
  const ready: Record<string, boolean> = gameState?.ready ?? {};

  const sendMove = (action_type: "set_ready" | "start") =>
    ws.send(JSON.stringify({ action: "move", action_type }));

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
              <ToyButton size="lg" className="w-full"disabled={readyCount < 2} onClick={() => sendMove("start")}>
                Start with {readyCount} players
              </ToyButton>
              <div className="text-ink/60 text-xs font-bold">Starts by itself when everyone is ready</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Game / Finished ── (court arrives in the next step)
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="chunk bg-white text-ink font-black text-xl px-6 py-4">Match in progress…</div>
    </div>
  );
}
