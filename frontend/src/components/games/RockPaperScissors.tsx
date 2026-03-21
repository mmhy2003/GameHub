"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface RPSProps {
  ws: WebSocket;
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
}

const EMOJI: Record<string, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
const CHOICES = ["rock", "paper", "scissors"] as const;

export default function RockPaperScissors({ ws, gameState, mySymbol, handleRestart }: RPSProps) {
  const [showReveal, setShowReveal] = useState(false);

  const phase = gameState?.phase ?? "picking";
  const scores = gameState?.scores ?? {};
  const picks = gameState?.picks ?? {};
  const lastResult = gameState?.last_result ?? null;
  const winner = gameState?.winner ?? null;
  const enemySymbol = mySymbol === "A" ? "B" : "A";
  const myPick = picks[mySymbol ?? "A"];
  const enemyPick = picks[enemySymbol];

  // Show reveal animation briefly
  useEffect(() => {
    if (phase === "reveal") {
      setShowReveal(true);
    } else {
      setShowReveal(false);
    }
  }, [phase, lastResult]);

  const sendChoice = (choice: string) => {
    ws.send(JSON.stringify({ action: "move", choice }));
  };

  const nextRound = () => {
    ws.send(JSON.stringify({ action: "move", action_type: "next_round" }));
  };

  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 relative z-10 max-w-md mx-auto w-full">

      {/* Score */}
      <div className="w-full flex justify-between items-center bg-slate-900/80 border border-slate-700 rounded-2xl px-6 py-4">
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">You ({mySymbol})</p>
          <p className="text-4xl font-black text-cyan-400">{scores[mySymbol ?? "A"] ?? 0}</p>
        </div>
        <p className="text-slate-600 font-bold text-lg">vs</p>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Opponent ({enemySymbol})</p>
          <p className="text-4xl font-black text-rose-400">{scores[enemySymbol] ?? 0}</p>
        </div>
      </div>

      {/* Reveal phase */}
      {phase === "reveal" && lastResult && (
        <div className="w-full flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="flex gap-8 items-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-6xl">{EMOJI[lastResult[mySymbol ?? "A"]] ?? "❓"}</span>
              <span className="text-xs text-slate-400">You</span>
            </div>
            <span className="text-2xl font-bold text-slate-500">vs</span>
            <div className="flex flex-col items-center gap-2">
              <span className="text-6xl">{EMOJI[lastResult[enemySymbol]] ?? "❓"}</span>
              <span className="text-xs text-slate-400">Opponent</span>
            </div>
          </div>
          <p className={`text-lg font-bold ${lastResult.round_winner === mySymbol ? "text-green-400" : lastResult.round_winner === null ? "text-slate-400" : "text-rose-400"}`}>
            {lastResult.round_winner === mySymbol ? "🏆 You won this round!" : lastResult.round_winner === null ? "🤝 Tie!" : "💀 Opponent wins this round"}
          </p>
          {!winner && (
            <button onClick={nextRound} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all">
              Next Round →
            </button>
          )}
        </div>
      )}

      {/* Picking phase */}
      {phase === "picking" && (
        <div className="w-full flex flex-col items-center gap-4">
          <p className="text-slate-400 text-sm">{myPick === "hidden" ? "✅ Pick submitted! Waiting for opponent…" : "Make your choice:"}</p>
          <div className="flex gap-4">
            {CHOICES.map(choice => (
              <button
                key={choice}
                onClick={() => sendChoice(choice)}
                disabled={myPick === "hidden"}
                className={`flex flex-col items-center gap-2 px-5 py-4 rounded-2xl border-2 transition-all shadow-lg
                  ${myPick === "hidden"
                    ? "border-slate-700 bg-slate-800/40 opacity-50 cursor-not-allowed"
                    : "border-slate-700 bg-slate-800/80 hover:border-indigo-500 hover:bg-slate-700 active:scale-95 cursor-pointer"}`}
              >
                <span className="text-4xl">{EMOJI[choice]}</span>
                <span className="text-xs text-slate-400 capitalize">{choice}</span>
              </button>
            ))}
          </div>
          {/* Opponent status */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className={`w-2 h-2 rounded-full ${enemyPick === "hidden" ? "bg-green-500 animate-pulse" : "bg-slate-600"}`} />
            {enemyPick === "hidden" ? "Opponent has picked!" : "Waiting for opponent…"}
          </div>
        </div>
      )}

      {/* Winner */}
      {winner && (
        <div className="w-full flex flex-col items-center gap-4">
          <h2 className={`text-3xl font-black ${winner === mySymbol ? "text-green-400" : "text-rose-400"}`}>
            {winner === mySymbol ? "🏆 Victory!" : "💀 Defeat!"}
          </h2>
          <button onClick={handleRestart} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all shadow-lg">
            Play Again
          </button>
        </div>
      )}

      <p className="text-slate-600 text-xs">First to 3 wins the match</p>
    </div>
  );
}
