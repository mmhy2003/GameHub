"use client";
import type React from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const BALLOON_FILLS = [
  "fill-candy-pink", "fill-candy-blue", "fill-candy-yellow",
  "fill-candy-green", "fill-candy-purple", "fill-candy-orange",
] as const;

/** One balloon on a string. When it gets popped it bursts into 💥 once, then stays hidden. */
function Balloon({ index, popped, tilt }: { index: number; popped: boolean; tilt: number }) {
  const [bursting, setBursting] = useState(false);
  useOnChange(popped, now => setBursting(now));

  return (
    <div
      className="relative w-[min(11vw,3rem)] -mx-1 origin-bottom"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {bursting && (
        <span
          className="absolute inset-x-0 top-0 text-center text-3xl animate-pop"
          onAnimationEnd={() => setBursting(false)}
          aria-hidden="true"
        >
          💥
        </span>
      )}
      <div
        className={`animate-bob ${popped ? "invisible" : ""}`}
        style={{ animationDelay: `${(index * 0.17) % 1}s` }}
      >
        <svg viewBox="0 0 40 96" className="w-full h-auto overflow-visible" aria-hidden="true">
          <path d="M20 44 Q14 58 20 70 T20 96" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
          <ellipse cx="20" cy="22" rx="16" ry="20" className={BALLOON_FILLS[index % BALLOON_FILLS.length]} stroke="var(--color-ink)" strokeWidth="2.5" />
          <ellipse cx="14" cy="14" rx="4" ry="6" fill="white" opacity="0.6" />
          <path d="M16 46 L20 41 L24 46 Z" className={BALLOON_FILLS[index % BALLOON_FILLS.length]} stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/** max_wrong balloons fanned out above a teddy holding their strings. */
function BalloonBunch({ total, popped }: { total: number; popped: number }) {
  const mid = (total - 1) / 2;
  return (
    <div className="flex flex-col items-center" aria-label={`${total - Math.min(popped, total)} of ${total} balloons left`} role="img">
      <div className="flex items-end justify-center">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ marginBottom: `${Math.abs(i - mid) * -6}px` }}>
            <Balloon index={i} popped={i < popped} tilt={(i - mid) * 9} />
          </div>
        ))}
      </div>
      <span className="text-5xl leading-none -mt-1" aria-hidden="true">🧸</span>
    </div>
  );
}

export default function Hangman({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [wordInput, setWordInput] = useState("");
  const [peek, setPeek] = useState(false);

  const phase: string = gameState?.phase ?? "setting";
  const setter: string = gameState?.setter ?? "W";
  const guesser: string = gameState?.guesser ?? "G";
  const displayWord: string = gameState?.display_word ?? "";
  const wordLength: number | null = gameState?.word_length ?? null;
  const guessedLetters: string[] = gameState?.guessed_letters ?? [];
  const wrongGuesses: number = gameState?.wrong_guesses ?? 0;
  const maxWrong: number = gameState?.max_wrong ?? 6;
  const winner: string | null = gameState?.winner ?? null;
  const isDraw = !!gameState?.is_draw;
  const revealedWord: string | null = gameState?.revealed_word ?? null;
  const over = phase === "finished";

  const isSetter = mySymbol === setter;
  const isGuesser = mySymbol === guesser;
  const canGuess = isGuesser && phase === "guessing";

  const tiles = displayWord ? displayWord.split(" ") : [];
  const revealedCount = tiles.filter(c => c !== "_").length;

  useOnChange(wrongGuesses, (n, p) => { if (n > p) play("pop"); });
  useOnChange(revealedCount, (n, p) => { if (n > p) play("place"); });

  if (!gameState) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;

  const nameOf = (s: string) => nameForSymbol(gameState, s) ?? `Player ${s}`;
  const outcome = outcomeFor(winner, isDraw, mySymbol);
  const title = resultTitle(gameState, winner, isDraw, mySymbol);

  const cleanWord = wordInput.trim().toUpperCase();
  const wordValid = /^[A-Z]{2,20}$/.test(cleanWord);

  const sendWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordValid) return;
    ws.send(JSON.stringify({ action: "move", action_type: "set_word", word: cleanWord }));
    setWordInput("");
    setPeek(false);
  };

  const guessLetter = (letter: string) => {
    ws.send(JSON.stringify({ action: "move", action_type: "guess_letter", letter }));
  };

  let banner: React.ReactNode;
  if (over) {
    banner = <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>;
  } else if (phase === "setting") {
    if (isSetter) banner = <TurnBanner tone="mine">🤫 Pick a secret word!</TurnBanner>;
    else if (isGuesser) banner = <TurnBanner tone="wait">Waiting for {nameOf(setter)} to pick a word…</TurnBanner>;
    else banner = <TurnBanner tone="info">{nameOf(setter)} is picking a word…</TurnBanner>;
  } else if (isGuesser) {
    banner = <TurnBanner tone="mine">🎉 Guess the word!</TurnBanner>;
  } else {
    banner = <TurnBanner tone={isSetter ? "wait" : "info"}>{nameOf(guesser)} is guessing…</TurnBanner>;
  }

  // While finished, the full word replaces the masked one; letters the guesser never found stay faded.
  const shownLetters = over && revealedWord ? revealedWord.split("") : tiles;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-4 relative z-10 w-full h-full max-w-2xl mx-auto">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[
          { symbol: "W", subtitle: setter === "W" ? "🤫 Setter" : "🔍 Guesser" },
          { symbol: "G", subtitle: setter === "G" ? "🤫 Setter" : "🔍 Guesser" },
        ]}
        activeSymbol={over ? null : phase === "guessing" ? guesser : setter}
        matchScore={matchScore}
      />

      {banner}

      {phase === "setting" && isSetter && (
        <form onSubmit={sendWord} className="w-full max-w-sm chunk bg-candy-yellow p-5 flex flex-col gap-3 text-ink">
          <h2 className="text-xl font-bold text-center">Pick a secret word 🤫</h2>
          <div className="flex gap-2">
            <input
              type={peek ? "text" : "password"}
              placeholder="Secret word…"
              value={wordInput}
              onChange={e => setWordInput(e.target.value)}
              maxLength={20}
              aria-label="Secret word"
              className="flex-1 min-w-0 chunk-sm bg-white rounded-xl px-3 py-2 text-lg font-bold uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-candy-purple/40"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setPeek(p => !p)}
              aria-label={peek ? "Hide word" : "Show word"}
              aria-pressed={peek}
              className={`btn-toy w-11 shrink-0 text-xl ${peek ? "bg-candy-purple" : "bg-white"}`}
            >
              👁
            </button>
          </div>
          <p className={`text-sm font-bold ${wordInput && !wordValid ? "text-candy-red" : "text-ink/70"}`}>
            {cleanWord.length} {cleanWord.length === 1 ? "letter" : "letters"} · use 2–20 letters A–Z
          </p>
          <ToyButton type="submit" color="green" size="lg" disabled={!wordValid}>Lock it in 🔒</ToyButton>
          <div className="flex items-center gap-3 text-xs font-bold text-ink/60 uppercase tracking-widest">
            <div className="flex-1 h-0.5 bg-ink/20" />or<div className="flex-1 h-0.5 bg-ink/20" />
          </div>
          <ToyButton
            color="white"
            onClick={() => ws.send(JSON.stringify({ action: "move", action_type: "swap_roles" }))}
          >
            🔄 Let {nameOf(guesser)} pick instead
          </ToyButton>
        </form>
      )}

      {phase === "setting" && !isSetter && (
        <div className="flex flex-col items-center gap-2 text-ink/70 font-bold text-sm">
          <span className="text-5xl animate-bob" aria-hidden="true">🤫</span>
          <p>Shh… a secret word is on its way</p>
        </div>
      )}

      {(phase === "guessing" || over) && (
        <>
          <BalloonBunch total={maxWrong} popped={wrongGuesses} />

          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2" aria-label="Word">
            {shownLetters.map((ch, i) => {
              const found = tiles[i] != null && tiles[i] !== "_";
              return (
                <div
                  key={i}
                  className={`chunk-sm bg-white w-[min(9vw,2.75rem)] aspect-[4/5] flex items-center justify-center text-[min(6vw,1.75rem)] font-bold
                    ${over && !found ? "text-candy-red" : "text-ink"}`}
                >
                  {ch !== "_" && <span key={ch} className="animate-pop">{ch}</span>}
                </div>
              );
            })}
          </div>

          <p className="text-ink/70 text-xs font-bold">
            {wordLength} letters · {Math.max(0, maxWrong - wrongGuesses)} balloons left
          </p>

          <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 sm:gap-2 max-w-md">
            {ALPHABET.map(letter => {
              const guessed = guessedLetters.includes(letter);
              const right = guessed && displayWord.includes(letter);
              const wrong = guessed && !right;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => guessLetter(letter)}
                  disabled={!canGuess || guessed}
                  aria-label={`${letter}${right ? " (in the word)" : wrong ? " (not in the word)" : ""}`}
                  className={`btn-toy game-btn w-[min(11vw,2.5rem)] aspect-square rounded-lg! text-base sm:text-lg font-bold text-ink
                    ${right ? "bg-candy-green opacity-100!" : wrong ? "bg-candy-red/60 line-through opacity-100!" : "bg-white hover:bg-candy-yellow"}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </>
      )}

      <ResultOverlay
        open={over}
        outcome={outcome}
        title={title}
        subtitle={scoreLine(matchScore, "W", "G")}
        onPlayAgain={handleRestart}
      >
        <div className="flex flex-col items-center gap-1">
          {revealedWord && (
            <p className="text-ink">The word was <strong className="tracking-widest">{revealedWord}</strong></p>
          )}
          <p className="text-ink/70 text-xs font-bold">
            {mySymbol
              ? `Roles swap — you'll ${isSetter ? "guess" : "set a word"} next round`
              : "Roles swap next round"}
          </p>
        </div>
      </ResultOverlay>
    </div>
  );
}
