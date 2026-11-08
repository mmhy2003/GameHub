"use client";
import type React from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { avatarColor } from "@/components/ui/Avatar";
import { hearts, nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const STEPS = [-10, -1, 1, 10] as const;

interface RoundResult {
  A: number; B: number; target: number;
  diff_A: number; diff_B: number;
  round_winner: string | null;
}

const clamp = (n: number) => Math.min(100, Math.max(1, n));
const percent = (n: number) => `${((n - 1) / 99) * 100}%`;

/** 1..100 track with 🎯 at the target and a pin per player; the closer pin glows. A sits above the track, B below, so equal picks never overlap. */
function NumberLine({ result, gameState, mySymbol }: { result: RoundResult; gameState: GameProps["gameState"]; mySymbol: string | null }) {
  const pin = (symbol: "A" | "B") => {
    const name = nameForSymbol(gameState, symbol) ?? "";
    const won = result.round_winner === symbol;
    const above = symbol === "A";
    return (
      <div
        className={`absolute -translate-x-1/2 flex items-center gap-0.5 ${above ? "bottom-1/2 mb-2 flex-col" : "top-1/2 mt-2 flex-col-reverse"}`}
        style={{ left: percent(result[symbol]) }}
      >
        <span className="text-xs font-bold text-ink tabular-nums">{result[symbol]}</span>
        <span
          className={`w-7 h-7 rounded-full border-2 border-ink flex items-center justify-center text-xs font-bold text-ink uppercase animate-pop
            ${avatarColor(name)} ${won ? "ring-4 ring-candy-yellow" : ""}`}
          title={name}
        >
          {name.charAt(0) || symbol}
        </span>
      </div>
    );
  };
  const nameOf = (s: "A" | "B") => (nameForSymbol(gameState, s) ?? `Player ${s}`) + (s === mySymbol ? " (you)" : "");
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="relative w-full h-28 px-4">
        <div className="relative h-full">
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-3 rounded-full border-2 border-ink bg-cream-2" />
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl leading-none animate-pop"
            style={{ left: percent(result.target) }}
            aria-label={`Target ${result.target}`}
          >
            🎯
          </span>
          {pin("A")}
          {pin("B")}
        </div>
      </div>
      <div className="flex justify-between text-xs font-bold text-ink/50 px-4"><span>1</span><span>100</span></div>
      <p className="text-center text-sm font-bold text-ink">🎯 Target was {result.target}</p>
      <div className="flex flex-col items-center text-sm text-ink/80">
        <span>{nameOf("A")}: {result.A} · off by {result.diff_A}</span>
        <span>{nameOf("B")}: {result.B} · off by {result.diff_B}</span>
      </div>
    </div>
  );
}

export default function NumberDuel({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [pick, setPick] = useState(50);

  const phase: string = gameState?.phase ?? "picking";
  const scores: Record<string, number> = gameState?.scores ?? { A: 0, B: 0 };
  const picks: Record<string, number | string | null> = gameState?.picks ?? {};
  const lastResult: RoundResult | null = gameState?.last_result ?? null;
  const winner: string | null = gameState?.winner ?? null;
  const isDraw = !!gameState?.is_draw;
  const over = !!winner || isDraw;
  const round: number = gameState?.round ?? 1;
  const enemySymbol = mySymbol === "A" ? "B" : "A";
  const myPick = mySymbol ? picks[mySymbol] : null;

  useOnChange(phase, now => { if (now === "reveal") play("hit"); });

  if (!gameState) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;

  const nameOf = (s: string) => nameForSymbol(gameState, s) ?? `Player ${s}`;
  const outcome = outcomeFor(winner, isDraw, mySymbol);
  const title = resultTitle(gameState, winner, isDraw, mySymbol);

  const sendPick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mySymbol || myPick != null) return;
    play("place");
    ws.send(JSON.stringify({ action: "move", action_type: "pick", number: pick }));
  };

  const nextRound = () => {
    ws.send(JSON.stringify({ action: "move", action_type: "next_round" }));
  };

  let banner: React.ReactNode;
  if (over) {
    banner = <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>;
  } else if (phase === "reveal" && lastResult) {
    const rw = lastResult.round_winner;
    const text = rw === null ? "🤝 Tie round!" : rw === mySymbol ? "🏆 You were closer!" : `${nameOf(rw)} was closer`;
    banner = <TurnBanner tone={!mySymbol || rw === null ? "info" : rw === mySymbol ? "good" : "bad"}>{text}</TurnBanner>;
  } else if (!mySymbol) {
    banner = <TurnBanner tone="info">Players are choosing…</TurnBanner>;
  } else if (myPick != null) {
    banner = <TurnBanner tone="wait">🔒 Locked in! Waiting for {nameOf(enemySymbol)}…</TurnBanner>;
  } else {
    banner = <TurnBanner tone="mine">🎉 Guess the hidden number!</TurnBanner>;
  }

  const status = (s: string) => (
    <span className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full border-2 border-ink ${picks[s] != null ? "bg-candy-green" : "bg-white animate-pulse"}`} />
      {picks[s] != null ? `${nameOf(s)} has picked!` : `${nameOf(s)} is thinking…`}
    </span>
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-4 relative z-10 w-full h-full">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[
          { symbol: "A", subtitle: hearts(scores.B ?? 0) },
          { symbol: "B", subtitle: hearts(scores.A ?? 0) },
        ]}
        matchScore={matchScore}
      />

      {banner}

      {phase === "picking" && (
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          {mySymbol && (
            <form onSubmit={sendPick} className="w-full flex flex-col items-center gap-4">
              <div
                className={`chunk text-6xl font-bold text-ink tabular-nums w-40 py-3 text-center ${myPick != null ? "bg-candy-yellow" : "bg-white"}`}
                aria-live="polite"
              >
                {pick}
              </div>
              {myPick == null && (
                <>
                  <div className="flex gap-2">
                    {STEPS.map(step => (
                      <ToyButton
                        key={step}
                        color="white"
                        size="sm"
                        onClick={() => setPick(p => clamp(p + step))}
                        aria-label={`${step > 0 ? "Add" : "Subtract"} ${Math.abs(step)}`}
                      >
                        {step > 0 ? `+${step}` : `−${-step}`}
                      </ToyButton>
                    ))}
                  </div>
                  <input
                    type="range" min={1} max={100} value={pick}
                    onChange={e => setPick(Number(e.target.value))}
                    aria-label="Your number"
                    className="w-full accent-candy-purple cursor-pointer h-2"
                  />
                  <div className="flex justify-between w-full text-xs font-bold text-ink/50 px-1">
                    <span>1</span><span>50</span><span>100</span>
                  </div>
                  <ToyButton type="submit" color="green" size="lg" className="w-full">Lock it in 🔒</ToyButton>
                </>
              )}
            </form>
          )}
          <div className="flex flex-col items-center gap-1 text-sm font-bold text-ink/70">
            {mySymbol ? status(enemySymbol) : <>{status("A")}{status("B")}</>}
          </div>
        </div>
      )}

      {phase === "reveal" && lastResult && (
        <div className="w-full max-w-md flex flex-col items-center gap-4">
          <div className="w-full chunk bg-white p-4">
            <NumberLine result={lastResult} gameState={gameState} mySymbol={mySymbol} />
          </div>
          {mySymbol ? (
            <ToyButton color="blue" size="lg" onClick={nextRound}>Next round →</ToyButton>
          ) : (
            <p className="text-sm font-bold text-ink/70">Waiting for the next round…</p>
          )}
        </div>
      )}

      <p className="text-ink/60 text-xs font-bold">Round {round} · score {scores.A ?? 0} – {scores.B ?? 0} · first to 3 wins</p>

      <ResultOverlay
        open={over}
        outcome={outcome}
        title={title}
        subtitle={
          <>
            <div className="font-bold">This match {scores.A ?? 0} – {scores.B ?? 0}</div>
            <div className="text-sm">Matches won {scoreLine(matchScore, "A", "B")}</div>
          </>
        }
        onPlayAgain={handleRestart}
      >
        {lastResult && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-bold text-ink/70">Final round</p>
            <NumberLine result={lastResult} gameState={gameState} mySymbol={mySymbol} />
          </div>
        )}
      </ResultOverlay>
    </div>
  );
}
