"use client";
import type React from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { hearts, nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const HANDS: Record<string, { emoji: string; label: string }> = {
  rock: { emoji: "✊", label: "Rock" },
  paper: { emoji: "✋", label: "Paper" },
  scissors: { emoji: "✌️", label: "Scissors" },
};
const CHOICES = ["rock", "paper", "scissors"] as const;

interface RoundResult { A: string; B: string; round_winner: string | null }

/** Both revealed hands side by side with a VS burst; the round winner gets a green ring, the loser goes grey. */
function RevealCards({ result, gameState, mySymbol }: { result: RoundResult; gameState: GameProps["gameState"]; mySymbol: string | null }) {
  const card = (symbol: "A" | "B", delay: string) => {
    const hand = HANDS[result[symbol]];
    const won = result.round_winner === symbol;
    const lost = result.round_winner !== null && !won;
    const name = nameForSymbol(gameState, symbol) ?? `Player ${symbol}`;
    return (
      <div
        className={`chunk w-[min(28vw,8rem)] aspect-[3/4] flex flex-col items-center justify-center gap-1 animate-pop
          ${won ? "bg-white ring-4 ring-candy-green" : lost ? "bg-cream-2 grayscale opacity-60" : "bg-white"}`}
        style={{ animationDelay: delay }}
      >
        <span className="text-[min(14vw,4rem)] leading-none">{hand?.emoji ?? "❓"}</span>
        <span className="text-xs sm:text-sm font-bold text-ink truncate max-w-full px-1">
          {name}{symbol === mySymbol && " (you)"}
        </span>
      </div>
    );
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        {card("A", "0s")}
        <div className="shrink-0 w-12 h-12 rounded-full! chunk-sm bg-candy-yellow flex items-center justify-center font-black text-ink animate-pop rotate-[-8deg]">
          VS
        </div>
        {card("B", "0.12s")}
      </div>
      {result.round_winner === null && <p className="text-2xl font-black text-ink animate-pop">Tie!</p>}
    </div>
  );
}

export default function RockPaperScissors({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  // The server only says "hidden" for my own pick, so remember which card I chose to highlight it
  const [myChoice, setMyChoice] = useState<string | null>(null);

  const phase: string = gameState?.phase ?? "picking";
  const scores: Record<string, number> = gameState?.scores ?? { A: 0, B: 0 };
  const picks: Record<string, string | null> = gameState?.picks ?? {};
  const lastResult: RoundResult | null = gameState?.last_result ?? null;
  const winner: string | null = gameState?.winner ?? null;
  const isDraw = !!gameState?.is_draw;
  const over = !!winner || isDraw;
  const enemySymbol = mySymbol === "A" ? "B" : "A";
  const myPick = mySymbol ? picks[mySymbol] : null;
  const selected = myPick === "hidden" ? myChoice : null;

  useOnChange(phase, now => { if (now === "reveal") play("hit"); });

  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;
  }

  const nameOf = (s: string) => nameForSymbol(gameState, s) ?? `Player ${s}`;
  const outcome = outcomeFor(winner, isDraw, mySymbol);
  const title = resultTitle(gameState, winner, isDraw, mySymbol);

  const sendChoice = (choice: string) => {
    if (!mySymbol || myPick) return;
    setMyChoice(choice);
    play("pop");
    ws.send(JSON.stringify({ action: "move", choice }));
  };

  const nextRound = () => {
    ws.send(JSON.stringify({ action: "move", action_type: "next_round" }));
  };

  const roundText = (rw: string | null) =>
    rw === null ? "🤝 Tie round!" : rw === mySymbol ? "🏆 You won this round!" : `${nameOf(rw)} wins this round`;

  let banner: React.ReactNode;
  if (over) {
    banner = <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>;
  } else if (phase === "reveal" && lastResult) {
    const rw = lastResult.round_winner;
    banner = <TurnBanner tone={!mySymbol || rw === null ? "info" : rw === mySymbol ? "good" : "bad"}>{roundText(rw)}</TurnBanner>;
  } else if (!mySymbol) {
    banner = <TurnBanner tone="info">Players are choosing…</TurnBanner>;
  } else if (myPick) {
    banner = <TurnBanner tone="wait">🔒 Locked in! Waiting for {nameOf(enemySymbol)}…</TurnBanner>;
  } else {
    banner = <TurnBanner tone="mine">🎉 Pick your hand!</TurnBanner>;
  }

  const status = (s: string) => (
    <span className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full border-2 border-ink ${picks[s] ? "bg-candy-green" : "bg-white animate-pulse"}`} />
      {picks[s] ? `${nameOf(s)} has picked!` : `${nameOf(s)} is thinking…`}
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

      {phase === "reveal" && lastResult && (
        <div className="flex flex-col items-center gap-4">
          <RevealCards result={lastResult} gameState={gameState} mySymbol={mySymbol} />
          {mySymbol ? (
            <ToyButton color="blue" size="lg" onClick={nextRound}>Next round →</ToyButton>
          ) : (
            <p className="text-sm font-bold text-ink/70">Waiting for the next round…</p>
          )}
        </div>
      )}

      {phase === "picking" && (
        <div className="flex flex-col items-center gap-4">
          {mySymbol && (
            <div className="flex gap-3 sm:gap-4">
              {CHOICES.map(choice => {
                const isSelected = selected === choice;
                return (
                  <button
                    key={choice}
                    onClick={() => sendChoice(choice)}
                    disabled={!!myPick}
                    aria-pressed={isSelected}
                    className={`chunk w-[min(28vw,8rem)] aspect-[3/4] flex flex-col items-center justify-center gap-1 transition-transform
                      ${isSelected ? "-translate-y-3 rotate-[-4deg] bg-candy-yellow" : "bg-white"}
                      ${myPick ? (isSelected ? "cursor-default" : "opacity-50 cursor-not-allowed") : "cursor-pointer hover:-translate-y-1 hover:bg-cream-2"}`}
                  >
                    <span className="text-[min(14vw,4rem)] leading-none">{HANDS[choice].emoji}</span>
                    <span className="text-sm sm:text-base font-bold text-ink">{HANDS[choice].label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-col items-center gap-1 text-sm font-bold text-ink/70">
            {mySymbol ? status(enemySymbol) : <>{status("A")}{status("B")}</>}
          </div>
        </div>
      )}

      <p className="text-ink/60 text-xs font-bold">Round score {scores.A ?? 0} – {scores.B ?? 0} · first to 3 wins</p>

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
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-ink/70">Final round</p>
            <RevealCards result={lastResult} gameState={gameState} mySymbol={mySymbol} />
          </div>
        )}
      </ResultOverlay>
    </div>
  );
}
