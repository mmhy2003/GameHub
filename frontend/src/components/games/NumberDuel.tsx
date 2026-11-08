"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameProps } from "@/lib/types";

export default function NumberDuel({ ws, gameState, mySymbol, handleRestart }: GameProps) {
  const [pick, setPick] = useState(50);

  const phase = gameState?.phase ?? "picking";
  const scores = gameState?.scores ?? { A: 0, B: 0 };
  const picks = gameState?.picks ?? {};
  const target: number | null = gameState?.target ?? null;
  const lastResult = gameState?.last_result ?? null;
  const winner = gameState?.winner ?? null;
  const round: number = gameState?.round ?? 1;
  const enemySymbol = mySymbol === "A" ? "B" : "A";

  const myPick = picks[mySymbol ?? "A"];
  const enemyPick = picks[enemySymbol];

  const sendPick = (e: React.FormEvent) => {
    e.preventDefault();
    ws.send(JSON.stringify({ action: "move", action_type: "pick", number: pick }));
  };

  const nextRound = () => {
    ws.send(JSON.stringify({ action: "move", action_type: "next_round" }));
  };

  if (!gameState) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 max-w-md mx-auto w-full">

      {/* Score + round */}
      <div className="w-full flex justify-between items-center bg-slate-900/80 border border-slate-700 rounded-2xl px-6 py-4">
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">You ({mySymbol})</p>
          <p className="text-4xl font-black text-cyan-400">{scores[mySymbol ?? "A"] ?? 0}</p>
        </div>
        <div className="text-center">
          <p className="text-slate-600 text-lg font-bold">vs</p>
          <p className="text-slate-600 text-xs">Round {round}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Opponent ({enemySymbol})</p>
          <p className="text-4xl font-black text-rose-400">{scores[enemySymbol] ?? 0}</p>
        </div>
      </div>

      {/* PICKING PHASE */}
      {phase === "picking" && (
        <div className="w-full flex flex-col items-center gap-4">
          {myPick === "hidden" ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <div className="text-5xl font-black text-indigo-400">{pick}</div>
              <p className="text-sm">✅ Pick locked in! Waiting for opponent…</p>
            </div>
          ) : (
            <>
              <p className="text-slate-300 text-sm font-medium">Pick a number closest to the hidden target (1–100):</p>
              <form onSubmit={sendPick} className="w-full flex flex-col items-center gap-4">
                {/* Big number display */}
                <div className="text-6xl font-black text-indigo-400 tabular-nums w-24 text-center">{pick}</div>
                {/* Slider */}
                <input
                  type="range" min={1} max={100} value={pick}
                  onChange={e => setPick(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-2 rounded-full"
                />
                <div className="flex justify-between w-full text-xs text-slate-600 px-1">
                  <span>1</span><span>50</span><span>100</span>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold text-lg transition-all shadow-lg shadow-indigo-500/20">
                  Lock In {pick}
                </button>
              </form>
            </>
          )}
          {/* Opponent status */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className={`w-2 h-2 rounded-full ${enemyPick === "hidden" ? "bg-green-500 animate-pulse" : "bg-slate-600"}`} />
            {enemyPick === "hidden" ? "Opponent has picked!" : "Waiting for opponent…"}
          </div>
        </div>
      )}

      {/* REVEAL PHASE */}
      {phase === "reveal" && lastResult && (
        <div className="w-full flex flex-col items-center gap-5">
          {/* Number line visualization */}
          <div className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <p className="text-center text-slate-400 text-xs mb-3 uppercase tracking-widest">Target was</p>
            <p className="text-center text-5xl font-black text-yellow-400 mb-4">{lastResult.target}</p>

            <div className="relative w-full h-10 flex items-center">
              {/* Number line bar */}
              <div className="absolute w-full h-2 bg-slate-700 rounded-full" />
              {/* Target marker */}
              <div className="absolute h-6 w-0.5 bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                style={{ left: `${(lastResult.target - 1) / 99 * 100}%` }} />
              {/* My pick */}
              <div className="absolute flex flex-col items-center -translate-x-1/2"
                style={{ left: `${(lastResult[mySymbol ?? "A"] - 1) / 99 * 100}%` }}>
                <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <span className="text-cyan-400 text-xs font-bold mt-0.5">{lastResult[mySymbol ?? "A"]}</span>
              </div>
              {/* Enemy pick */}
              <div className="absolute flex flex-col items-center -translate-x-1/2"
                style={{ left: `${(lastResult[enemySymbol] - 1) / 99 * 100}%` }}>
                <div className="w-3 h-3 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
                <span className="text-rose-400 text-xs font-bold mt-0.5">{lastResult[enemySymbol]}</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-1 px-0.5"><span>1</span><span>100</span></div>
          </div>

          {/* Round result */}
          <p className={`text-lg font-bold ${lastResult.round_winner === mySymbol ? "text-green-400" : lastResult.round_winner === null ? "text-slate-400" : "text-rose-400"}`}>
            {lastResult.round_winner === mySymbol
              ? `🏆 You win this round! (off by ${lastResult[`diff_${mySymbol}`]})`
              : lastResult.round_winner === null
                ? `🤝 Tie! Both off by ${lastResult[`diff_${mySymbol}`]}`
                : `💀 Opponent wins! (you: ${lastResult[`diff_${mySymbol}`]} off, them: ${lastResult[`diff_${enemySymbol}`]} off)`}
          </p>

          {!winner && (
            <button onClick={nextRound} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all">
              Next Round →
            </button>
          )}
        </div>
      )}

      {/* WINNER */}
      {winner && (
        <div className="flex flex-col items-center gap-3">
          <h2 className={`text-3xl font-black ${winner === mySymbol ? "text-green-400" : "text-rose-400"}`}>
            {winner === mySymbol ? "🏆 Victory!" : "💀 Defeat!"}
          </h2>
          <button onClick={handleRestart} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all shadow-lg">
            Play Again
          </button>
        </div>
      )}

      <p className="text-slate-600 text-xs">First to 3 wins · Closest to the hidden target wins each round</p>
    </div>
  );
}
