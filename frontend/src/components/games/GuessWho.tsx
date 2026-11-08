"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import PlayerCards from "@/components/ui/PlayerCards";
import TurnBanner from "@/components/ui/TurnBanner";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import GuessWhoFace, { CHARACTERS } from "./GuessWhoFace";
import { nameForSymbol, outcomeFor, resultTitle, scoreLine } from "@/lib/players";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";

export { CHARACTERS };

interface Question { asker: string; text: string; awaiting_answer?: boolean }
interface HistoryItem { asker: string; text: string; answer: boolean }
interface PresetQuestion { id: string; text: string }

export default function GuessWho({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const [eliminated, setEliminated] = useState<Set<number>>(new Set());
  const [guessMode, setGuessMode] = useState(false);
  const [askText, setAskText] = useState("");

  const phase: string = gameState?.phase ?? "waiting";
  const charA: number | null = gameState?.char_A ?? null;
  const charB: number | null = gameState?.char_B ?? null;
  const myChar = mySymbol === "A" ? charA : mySymbol === "B" ? charB : null;
  const turn: string = gameState?.turn ?? "A";
  const currentQ: Question | null = gameState?.current_question ?? null;
  const history: HistoryItem[] = gameState?.history ?? [];
  const winner: string | null = gameState?.winner ?? null;
  const presetQuestions: PresetQuestion[] = gameState?.preset_questions ?? [];
  const playing = phase === "playing";
  const over = phase === "finished";

  const isMyTurn = !!mySymbol && turn === mySymbol;
  const iAmAsker = !!mySymbol && currentQ?.asker === mySymbol;
  const iAmAnswerer = !!mySymbol && !!currentQ && currentQ.asker !== mySymbol;
  const canAsk = playing && isMyTurn && !currentQ;

  useOnChange(playing && (canAsk || iAmAnswerer), now => { if (now) play("turn"); });
  useOnChange(history.length, (n, p) => { if (n > p) play("pop"); });

  // Signal ready when both players exist and game is waiting
  useEffect(() => {
    if (phase === "waiting" && mySymbol) {
      ws.send(JSON.stringify({ action: "move", action_type: "ready" }));
    }
  }, [phase, mySymbol]);

  // Reset eliminations on restart
  useEffect(() => {
    if (phase === "waiting") setEliminated(new Set());
  }, [phase]);

  const toggleEliminate = (id: number) => {
    if (id === myChar) return; // can't eliminate own character
    play("click");
    setEliminated(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendAsk = (text: string) => {
    if (!text.trim()) return;
    ws.send(JSON.stringify({ action: "move", action_type: "ask", text: text.trim() }));
    setAskText("");
  };

  const sendAnswer = (answer: boolean) => {
    ws.send(JSON.stringify({ action: "move", action_type: "answer", answer }));
  };

  const sendGuess = (charId: number) => {
    ws.send(JSON.stringify({ action: "move", action_type: "guess", character_id: charId }));
    setGuessMode(false);
  };

  if (!gameState || phase === "waiting") return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ink/70 font-bold">
      <Loader2 className="animate-spin text-candy-purple" size={40} />
      <p className="text-sm">Waiting for both players to join…</p>
    </div>
  );

  const nameOf = (s: string) => nameForSymbol(gameState, s) ?? `Player ${s}`;
  const other = (s: string) => (s === "A" ? "B" : "A");
  const outcome = outcomeFor(winner, false, mySymbol);
  const title = resultTitle(gameState, winner, false, mySymbol);
  const myCharData = myChar !== null ? CHARACTERS[myChar] : null;
  const guessing = guessMode && canAsk;

  let banner: React.ReactNode;
  if (over) {
    banner = <TurnBanner tone={outcome === "lose" ? "bad" : "good"}>{title}</TurnBanner>;
  } else if (currentQ) {
    const answerer = other(currentQ.asker);
    if (iAmAnswerer) banner = <TurnBanner tone="mine">🤔 Answer {nameOf(currentQ.asker)}&apos;s question!</TurnBanner>;
    else if (iAmAsker) banner = <TurnBanner tone="wait">Waiting for {nameOf(answerer)} to answer…</TurnBanner>;
    else banner = <TurnBanner tone="info">{nameOf(answerer)} is answering…</TurnBanner>;
  } else if (isMyTurn) {
    banner = <TurnBanner tone="mine">🎉 Your turn: ask or guess!</TurnBanner>;
  } else if (mySymbol) {
    banner = <TurnBanner tone="wait">Waiting for {nameOf(turn)}…</TurnBanner>;
  } else {
    banner = <TurnBanner tone="info">{nameOf(turn)}&apos;s turn</TurnBanner>;
  }

  const asked = (s: string) => {
    const n = history.filter(h => h.asker === s).length;
    return `${n} ${n === 1 ? "question" : "questions"}`;
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-3 sm:p-4 overflow-y-auto overflow-x-hidden max-w-5xl mx-auto w-full custom-scrollbar">
      <PlayerCards
        gameState={gameState}
        mySymbol={mySymbol}
        players={[{ symbol: "A", subtitle: asked("A") }, { symbol: "B", subtitle: asked("B") }]}
        activeSymbol={over ? null : currentQ ? other(currentQ.asker) : turn}
        matchScore={matchScore}
      />

      {banner}

      {/* Big answer card */}
      {playing && iAmAnswerer && currentQ && (
        <div className="w-full max-w-md chunk bg-white p-5 flex flex-col items-center gap-4 text-ink animate-pop">
          <p className="text-xs font-bold uppercase tracking-widest text-ink/60">{nameOf(currentQ.asker)} asks</p>
          <p className="text-xl sm:text-2xl font-bold text-center">“{currentQ.text}”</p>
          <div className="flex gap-3 w-full">
            <ToyButton color="green" size="lg" className="flex-1" onClick={() => sendAnswer(true)}>👍 Yes</ToyButton>
            <ToyButton color="pink" size="lg" className="flex-1" onClick={() => sendAnswer(false)}>👎 No</ToyButton>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col md:flex-row md:items-start gap-4">
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-3 md:sticky md:top-0">
          {/* Secret card */}
          {myCharData && (
            <div className="relative chunk bg-candy-yellow p-3 flex md:flex-col items-center gap-3 text-ink">
              <span className="absolute -top-3 -right-2 text-2xl rotate-12" aria-hidden="true">📌</span>
              <div className="w-16 md:w-32 shrink-0">
                <GuessWhoFace character={myCharData} />
              </div>
              <div className="md:text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60">Your secret</p>
                <p className="text-xl font-bold">{myCharData.name}</p>
              </div>
            </div>
          )}

          {/* Questions */}
          {canAsk && !guessing && (
            <div className="chunk bg-white p-3 flex flex-col gap-3 text-ink">
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto custom-scrollbar p-0.5">
                {presetQuestions.map(q => (
                  <ToyButton key={q.id} color="white" size="sm" className="rounded-full! text-left" onClick={() => sendAsk(q.text)}>
                    {q.text}
                  </ToyButton>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); sendAsk(askText); }}>
                <input
                  type="text"
                  placeholder="Ask a yes/no question…"
                  aria-label="Your question"
                  value={askText}
                  onChange={e => setAskText(e.target.value)}
                  className="flex-1 min-w-0 chunk-sm rounded-xl! bg-cream px-3 py-2 text-sm font-bold placeholder:text-ink/40 focus:outline-none focus:ring-4 focus:ring-candy-purple/40"
                />
                <ToyButton type="submit" color="purple" disabled={!askText.trim()}>Ask</ToyButton>
              </form>
              <ToyButton color="pink" onClick={() => setGuessMode(true)}>🎯 Make a guess!</ToyButton>
            </div>
          )}

          {/* Pending question, seen by the asker and spectators */}
          {currentQ && !iAmAnswerer && (
            <div className="chunk-sm bg-candy-blue/20 p-3 text-ink">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60">
                {iAmAsker ? "You asked" : `${nameOf(currentQ.asker)} asked`}
              </p>
              <p className="font-bold">“{currentQ.text}”</p>
              <p className="text-xs font-bold text-ink/60 mt-1 animate-pulse">Waiting for an answer…</p>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto custom-scrollbar p-0.5">
              {[...history].reverse().map((h, i) => (
                <div
                  key={history.length - i}
                  className={`chunk-sm rounded-2xl! px-3 py-2 flex items-start gap-2 text-ink text-sm ${h.asker === mySymbol ? "bg-candy-blue/20" : "bg-white"} ${i === 0 ? "animate-pop" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60 truncate">{nameOf(h.asker)}</p>
                    <p className="font-bold">{h.text}</p>
                  </div>
                  <span className={`shrink-0 chunk-sm rounded-full! px-2 text-xs font-bold ${h.answer ? "bg-candy-green text-ink" : "bg-candy-red text-white"}`}>
                    {h.answer ? "Yes" : "No"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Board */}
        <section className="flex-1 min-w-0 flex flex-col gap-3">
          {guessing ? (
            <div className="chunk-sm bg-candy-pink p-3 flex items-center justify-between gap-2 text-ink">
              <p className="font-bold text-sm">🎯 Tap the character you think {nameOf(other(mySymbol ?? "A"))} has!</p>
              <ToyButton color="white" size="sm" onClick={() => setGuessMode(false)}>Cancel</ToyButton>
            </div>
          ) : (
            <p className="text-ink/60 text-xs font-bold text-center">Tap a character to flip them down. Tap again to flip back up.</p>
          )}

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
            {CHARACTERS.map(char => {
              const isElim = eliminated.has(char.id);
              const isMine = char.id === myChar;
              const canGuessThis = guessing && !isMine;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => (canGuessThis ? sendGuess(char.id) : toggleEliminate(char.id))}
                  aria-pressed={isElim}
                  aria-label={canGuessThis ? `Guess ${char.name}` : isElim ? `Flip ${char.name} back up` : `Flip ${char.name} down`}
                  className={`relative [perspective:600px] rounded-[10px] select-none min-w-0 ${isMine ? "cursor-default" : "cursor-pointer"}
                    ${canGuessThis ? "outline-4 outline-candy-pink outline-offset-2 hover:-translate-y-1 transition-transform" : ""}`}
                >
                  <div className={`relative [transform-style:preserve-3d] ${isElim ? "animate-flip-down" : ""}`}>
                    <div className={`[backface-visibility:hidden] chunk-sm rounded-[10px]! p-1 flex flex-col items-center gap-0.5 ${isMine ? "bg-candy-yellow" : "bg-white"}`}>
                      {isMine && <span className="absolute -top-2 -right-1 text-sm z-10" aria-hidden="true">📌</span>}
                      <GuessWhoFace character={char} />
                      <span className="text-[10px] sm:text-xs font-bold text-ink truncate w-full text-center">{char.name}</span>
                    </div>
                    <div
                      className="absolute inset-0 [backface-visibility:hidden] [transform:rotateX(180deg)] chunk-sm rounded-[10px]! bg-toy-stripes flex items-center justify-center text-2xl font-black text-ink/40"
                      aria-hidden="true"
                    >
                      ✕
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <ResultOverlay
        open={over}
        outcome={outcome}
        title={title}
        subtitle={scoreLine(matchScore, "A", "B")}
        onPlayAgain={handleRestart}
      >
        <div className="flex justify-center gap-4">
          {(["A", "B"] as const).map(s => {
            const id = s === "A" ? charA : charB;
            if (id === null) return null;
            const c = CHARACTERS[id];
            return (
              <div key={s} className="flex flex-col items-center gap-1 text-ink">
                <p className="text-xs font-bold text-ink/60">{s === mySymbol ? "You had" : `${nameOf(s)} had`}</p>
                <div className={`w-20 rounded-full ${gameState.winning_char === id ? "ring-4 ring-candy-yellow" : ""}`}>
                  <GuessWhoFace character={c} />
                </div>
                <p className="font-bold">{c.name}</p>
              </div>
            );
          })}
        </div>
      </ResultOverlay>
    </div>
  );
}
