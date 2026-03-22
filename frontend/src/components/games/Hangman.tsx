"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface HangmanProps {
  ws: WebSocket;
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
}

const MAX_WRONG = 6;

// SVG hangman drawing — parts appear progressively
function HangmanSVG({ wrong }: { wrong: number }) {
  return (
    <svg viewBox="0 0 120 150" className="w-36 h-44" strokeLinecap="round" strokeLinejoin="round">
      {/* Gallows */}
      <line x1="10" y1="145" x2="110" y2="145" stroke="#475569" strokeWidth="3" />
      <line x1="30" y1="145" x2="30"  y2="10"  stroke="#475569" strokeWidth="3" />
      <line x1="30" y1="10"  x2="80"  y2="10"  stroke="#475569" strokeWidth="3" />
      <line x1="80" y1="10"  x2="80"  y2="30"  stroke="#475569" strokeWidth="3" />
      {/* Head */}
      {wrong >= 1 && <circle cx="80" cy="42" r="12" stroke="#f87171" strokeWidth="2.5" fill="none" />}
      {/* Body */}
      {wrong >= 2 && <line x1="80" y1="54" x2="80" y2="95" stroke="#f87171" strokeWidth="2.5" />}
      {/* Left arm */}
      {wrong >= 3 && <line x1="80" y1="65" x2="58" y2="82" stroke="#f87171" strokeWidth="2.5" />}
      {/* Right arm */}
      {wrong >= 4 && <line x1="80" y1="65" x2="102" y2="82" stroke="#f87171" strokeWidth="2.5" />}
      {/* Left leg */}
      {wrong >= 5 && <line x1="80" y1="95" x2="60" y2="120" stroke="#f87171" strokeWidth="2.5" />}
      {/* Right leg */}
      {wrong >= 6 && <line x1="80" y1="95" x2="100" y2="120" stroke="#f87171" strokeWidth="2.5" />}
    </svg>
  );
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Hangman({ ws, gameState, mySymbol, handleRestart }: HangmanProps) {
  const [wordInput, setWordInput] = useState("");

  const phase = gameState?.phase ?? "setting";
  const setter: string = gameState?.setter ?? "W";
  const guesser: string = gameState?.guesser ?? "G";
  const displayWord: string = gameState?.display_word ?? "";
  const wordLength: number | null = gameState?.word_length ?? null;
  const guessedLetters: string[] = gameState?.guessed_letters ?? [];
  const wrongGuesses: number = gameState?.wrong_guesses ?? 0;
  const winner = gameState?.winner ?? null;
  const revealedWord: string | null = gameState?.revealed_word ?? null;

  const isSetter = mySymbol === setter;
  const isGuesser = mySymbol === guesser;

  const sendWord = (e: React.FormEvent) => {
    e.preventDefault();
    const w = wordInput.trim().toUpperCase();
    if (!w || !/^[A-Z]{2,20}$/.test(w)) return;
    ws.send(JSON.stringify({ action: "move", action_type: "set_word", word: w }));
    setWordInput("");
  };

  const guessLetter = (letter: string) => {
    ws.send(JSON.stringify({ action: "move", action_type: "guess_letter", letter }));
  };

  if (!gameState) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4 max-w-lg mx-auto w-full">

      {/* Role badge */}
      <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${isSetter ? "bg-purple-500/10 border-purple-500/30 text-purple-300" : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"}`}>
        {isSetter ? "🔤 Word Setter" : "🔍 Guesser"}
      </div>

      {/* SETTING PHASE */}
      {phase === "setting" && isSetter && (
        <div className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
          <h2 className="text-xl font-bold text-center text-slate-100">Your turn to set a word</h2>

          {/* Option 1: Set a word */}
          <form onSubmit={sendWord} className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Set a word for your opponent</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type your secret word…"
                value={wordInput}
                onChange={e => setWordInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-slate-200 placeholder-slate-600 uppercase tracking-widest"
                autoComplete="off"
              />
              <button type="submit" className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-semibold transition-all">
                Set
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-slate-600 text-xs uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* Option 2: Switch turns */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Let your opponent set the word instead</label>
            <button
              onClick={() => ws.send(JSON.stringify({ action: "move", action_type: "swap_roles" }))}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 font-semibold rounded-xl transition-all"
            >
              🔄 Switch Turns
            </button>
          </div>
        </div>
      )}

      {phase === "setting" && isGuesser && (
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="animate-spin text-purple-400" size={32} />
          <p className="text-sm">Waiting for opponent to set a word…</p>
        </div>
      )}

      {/* GUESSING PHASE */}
      {(phase === "guessing" || phase === "finished") && (
        <>
          <div className="flex gap-8 items-center">
            {/* Hangman drawing */}
            <HangmanSVG wrong={wrongGuesses} />

            {/* Word display */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2 flex-wrap justify-center">
                {displayWord.split(" ").map((ch, i) => (
                  <div key={i} className={`w-8 h-10 flex items-end justify-center border-b-2 text-lg font-bold font-mono
                    ${ch === "_" ? "border-slate-600 text-slate-600" : "border-indigo-400 text-indigo-200"}`}>
                    {ch !== "_" ? ch : ""}
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-xs">{wordLength} letters · {MAX_WRONG - wrongGuesses} guesses left</p>
            </div>
          </div>

          {/* Alphabet buttons — only for guesser during guessing */}
          {phase === "guessing" && isGuesser && (
            <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
              {ALPHABET.map(letter => {
                const isGuessed = guessedLetters.includes(letter);
                const isWrong = isGuessed && !displayWord.includes(letter);
                return (
                  <button
                    key={letter}
                    onClick={() => guessLetter(letter)}
                    disabled={isGuessed}
                    className={`game-btn w-9 h-9 rounded-lg text-sm font-bold font-mono transition-all
                      ${isGuessed
                        ? isWrong
                          ? "bg-rose-900/60 text-rose-500/50 border border-rose-800/40 cursor-not-allowed"
                          : "bg-green-900/60 text-green-400/70 border border-green-800/40 cursor-not-allowed"
                        : "bg-slate-800 hover:bg-indigo-700 border border-slate-600 text-slate-200 active:scale-95"}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          )}

          {phase === "guessing" && isSetter && (
            <p className="text-slate-500 text-sm italic">Watching your opponent guess…</p>
          )}
        </>
      )}

      {/* FINISHED */}
      {phase === "finished" && (
        <div className="flex flex-col items-center gap-3">
          <h2 className={`text-2xl font-black ${winner === mySymbol ? "text-green-400" : "text-rose-400"}`}>
            {winner === mySymbol ? "🏆 You Win!" : "💀 You Lose!"}
          </h2>
          {revealedWord && (
            <p className="text-slate-400 text-sm">The word was: <span className="text-indigo-300 font-bold font-mono tracking-widest">{revealedWord}</span></p>
          )}
          <p className="text-slate-600 text-xs">Roles swap — you'll {isSetter ? "guess" : "set a word"} next round</p>
          <button onClick={handleRestart} className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all shadow-lg">
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
