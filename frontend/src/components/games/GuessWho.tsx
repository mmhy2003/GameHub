"use client";
import { useState, useEffect } from "react";
import { Loader2, HelpCircle, CheckCircle, XCircle } from "lucide-react";

// ─── Character Data (mirrors backend) ────────────────────────────────────────
export const CHARACTERS = [
  { id:  0, name: "Alex",   gender: "male",   hair_color: "brown", hair_style: "short",  skin: "light",  eyes: "brown", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  1, name: "Emma",   gender: "female", hair_color: "blond", hair_style: "long",   skin: "light",  eyes: "blue",  glasses: false, facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id:  2, name: "Marcus", gender: "male",   hair_color: "black", hair_style: "short",  skin: "dark",   eyes: "brown", glasses: false, facial_hair: "beard",    hat: false, earrings: false, freckles: false },
  { id:  3, name: "Sofia",  gender: "female", hair_color: "red",   hair_style: "long",   skin: "medium", eyes: "green", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  4, name: "James",  gender: "male",   hair_color: "gray",  hair_style: "bald",   skin: "light",  eyes: "blue",  glasses: false, facial_hair: "mustache", hat: true,  earrings: false, freckles: false },
  { id:  5, name: "Lily",   gender: "female", hair_color: "black", hair_style: "curly",  skin: "medium", eyes: "brown", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  6, name: "Omar",   gender: "male",   hair_color: "black", hair_style: "short",  skin: "dark",   eyes: "brown", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  7, name: "Claire", gender: "female", hair_color: "blond", hair_style: "short",  skin: "light",  eyes: "blue",  glasses: false, facial_hair: "none",     hat: true,  earrings: false, freckles: false },
  { id:  8, name: "Henri",  gender: "male",   hair_color: "brown", hair_style: "curly",  skin: "medium", eyes: "green", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  9, name: "Raya",   gender: "female", hair_color: "brown", hair_style: "long",   skin: "dark",   eyes: "brown", glasses: true,  facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id: 10, name: "Tom",    gender: "male",   hair_color: "blond", hair_style: "short",  skin: "light",  eyes: "blue",  glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 11, name: "Zoe",    gender: "female", hair_color: "red",   hair_style: "curly",  skin: "light",  eyes: "green", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: true  },
  { id: 12, name: "Diego",  gender: "male",   hair_color: "black", hair_style: "short",  skin: "medium", eyes: "brown", glasses: false, facial_hair: "mustache", hat: false, earrings: false, freckles: false },
  { id: 13, name: "Anna",   gender: "female", hair_color: "white", hair_style: "long",   skin: "light",  eyes: "blue",  glasses: true,  facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id: 14, name: "Leo",    gender: "male",   hair_color: "brown", hair_style: "short",  skin: "light",  eyes: "brown", glasses: false, facial_hair: "beard",    hat: true,  earrings: false, freckles: false },
  { id: 15, name: "Nina",   gender: "female", hair_color: "blond", hair_style: "long",   skin: "medium", eyes: "brown", glasses: false, facial_hair: "none",     hat: true,  earrings: false, freckles: false },
  { id: 16, name: "Kai",    gender: "male",   hair_color: "red",   hair_style: "short",  skin: "light",  eyes: "green", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 17, name: "Priya",  gender: "female", hair_color: "black", hair_style: "long",   skin: "dark",   eyes: "brown", glasses: false, facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id: 18, name: "Sam",    gender: "male",   hair_color: "gray",  hair_style: "short",  skin: "medium", eyes: "blue",  glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 19, name: "Mia",    gender: "female", hair_color: "brown", hair_style: "curly",  skin: "light",  eyes: "brown", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: true  },
  { id: 20, name: "Victor", gender: "male",   hair_color: "black", hair_style: "short",  skin: "light",  eyes: "brown", glasses: false, facial_hair: "beard",    hat: false, earrings: false, freckles: false },
  { id: 21, name: "Iris",   gender: "female", hair_color: "blond", hair_style: "short",  skin: "dark",   eyes: "brown", glasses: true,  facial_hair: "none",     hat: true,  earrings: true,  freckles: false },
  { id: 22, name: "Ben",    gender: "male",   hair_color: "blond", hair_style: "bald",   skin: "light",  eyes: "blue",  glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 23, name: "Fatima", gender: "female", hair_color: "black", hair_style: "long",   skin: "dark",   eyes: "green", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
];

type Character = typeof CHARACTERS[0];

// ─── SVG Avatar ──────────────────────────────────────────────────────────────
const SKIN_COLORS: Record<string, string> = { light: "#FDDBB4", medium: "#C68642", dark: "#6B3A2A" };
const HAIR_COLORS: Record<string, string> = { blond: "#FFD96A", brown: "#7B4F2E", black: "#1A1A1A", red: "#C0392B", gray: "#8E8E8E", white: "#E8E8E8" };
const EYE_COLORS: Record<string, string> = { blue: "#5B9FD4", brown: "#7B5230", green: "#4A9B6F" };

function CharacterAvatar({ char, size = 80 }: { char: Character; size?: number }) {
  const skin = SKIN_COLORS[char.skin];
  const hair = HAIR_COLORS[char.hair_color];
  const eye = EYE_COLORS[char.eyes];
  const s = size;
  const cx = s / 2, cy = s / 2;
  const faceR = s * 0.32;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="rounded-xl overflow-visible">
      {/* Hat */}
      {char.hat && (
        <g>
          <rect x={cx - faceR * 0.85} y={cy - faceR * 1.55} width={faceR * 1.7} height={faceR * 0.9} rx={3} fill="#2D3035" />
          <rect x={cx - faceR * 1.1} y={cy - faceR * 0.7} width={faceR * 2.2} height={faceR * 0.22} rx={2} fill="#2D3035" />
        </g>
      )}
      {/* Hair – back layer */}
      {char.hair_style === "long" && (
        <ellipse cx={cx} cy={cy + faceR * 0.8} rx={faceR * 0.85} ry={faceR * 1.1} fill={hair} />
      )}
      {char.hair_style === "curly" && (
        <>
          <circle cx={cx - faceR * 0.7} cy={cy - faceR * 0.6} r={faceR * 0.38} fill={hair} />
          <circle cx={cx + faceR * 0.7} cy={cy - faceR * 0.6} r={faceR * 0.38} fill={hair} />
          <circle cx={cx - faceR * 0.95} cy={cy - faceR * 0.15} r={faceR * 0.3} fill={hair} />
          <circle cx={cx + faceR * 0.95} cy={cy - faceR * 0.15} r={faceR * 0.3} fill={hair} />
        </>
      )}
      {/* Face */}
      <circle cx={cx} cy={cy} r={faceR} fill={skin} />
      {/* Freckles */}
      {char.freckles && (
        <>
          <circle cx={cx - faceR * 0.35} cy={cy + faceR * 0.1} r={faceR * 0.045} fill="#C0845A" opacity={0.7} />
          <circle cx={cx - faceR * 0.2}  cy={cy + faceR * 0.2} r={faceR * 0.04}  fill="#C0845A" opacity={0.7} />
          <circle cx={cx + faceR * 0.2}  cy={cy + faceR * 0.1} r={faceR * 0.045} fill="#C0845A" opacity={0.7} />
          <circle cx={cx + faceR * 0.36} cy={cy + faceR * 0.22}r={faceR * 0.04}  fill="#C0845A" opacity={0.7} />
        </>
      )}
      {/* Eyes */}
      <circle cx={cx - faceR * 0.38} cy={cy - faceR * 0.15} r={faceR * 0.13} fill="white" />
      <circle cx={cx + faceR * 0.38} cy={cy - faceR * 0.15} r={faceR * 0.13} fill="white" />
      <circle cx={cx - faceR * 0.38} cy={cy - faceR * 0.15} r={faceR * 0.07} fill={eye} />
      <circle cx={cx + faceR * 0.38} cy={cy - faceR * 0.15} r={faceR * 0.07} fill={eye} />
      {/* Glasses */}
      {char.glasses && (
        <g stroke="#333" strokeWidth={faceR * 0.06} fill="none">
          <circle cx={cx - faceR * 0.38} cy={cy - faceR * 0.15} r={faceR * 0.18} />
          <circle cx={cx + faceR * 0.38} cy={cy - faceR * 0.15} r={faceR * 0.18} />
          <line x1={cx - faceR * 0.2} y1={cy - faceR * 0.15} x2={cx + faceR * 0.2} y2={cy - faceR * 0.15} />
          <line x1={cx - faceR * 0.56} y1={cy - faceR * 0.15} x2={cx - faceR * 0.7} y2={cy - faceR * 0.22} />
          <line x1={cx + faceR * 0.56} y1={cy - faceR * 0.15} x2={cx + faceR * 0.7} y2={cy - faceR * 0.22} />
        </g>
      )}
      {/* Mouth */}
      <path d={`M ${cx - faceR * 0.25} ${cy + faceR * 0.3} Q ${cx} ${cy + faceR * 0.5} ${cx + faceR * 0.25} ${cy + faceR * 0.3}`} stroke="#9B6B5A" strokeWidth={faceR * 0.07} fill="none" strokeLinecap="round" />
      {/* Mustache */}
      {char.facial_hair === "mustache" && (
        <path d={`M ${cx - faceR * 0.3} ${cy + faceR * 0.2} Q ${cx} ${cy + faceR * 0.35} ${cx + faceR * 0.3} ${cy + faceR * 0.2}`} stroke={hair} strokeWidth={faceR * 0.13} fill="none" strokeLinecap="round" />
      )}
      {/* Beard */}
      {char.facial_hair === "beard" && (
        <path d={`M ${cx - faceR * 0.55} ${cy + faceR * 0.3} Q ${cx} ${cy + faceR * 0.9} ${cx + faceR * 0.55} ${cy + faceR * 0.3}`} stroke={hair} strokeWidth={faceR * 0.22} fill="none" strokeLinecap="round" />
      )}
      {/* Earrings */}
      {char.earrings && (
        <>
          <circle cx={cx - faceR * 1.0} cy={cy + faceR * 0.1} r={faceR * 0.09} fill="#FFD700" />
          <circle cx={cx + faceR * 1.0} cy={cy + faceR * 0.1} r={faceR * 0.09} fill="#FFD700" />
        </>
      )}
      {/* Hair – front top layer */}
      {char.hair_style !== "bald" && (
        <ellipse cx={cx} cy={cy - faceR * 0.7} rx={faceR * 0.85} ry={faceR * 0.45} fill={hair} />
      )}
      {char.hair_style === "short" && (
        <>
          <rect x={cx - faceR * 0.85} y={cy - faceR * 1.0} width={faceR * 1.7} height={faceR * 0.45} rx={faceR * 0.2} fill={hair} />
        </>
      )}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface GuessWhoProps {
  ws: WebSocket;
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
}

export default function GuessWho({ ws, gameState, mySymbol, handleRestart }: GuessWhoProps) {
  const [eliminated, setEliminated] = useState<Set<number>>(new Set());
  const [guessMode, setGuessMode] = useState(false);
  const [askText, setAskText] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  const phase: string = gameState?.phase ?? "waiting";
  const charA: number | null = gameState?.char_A ?? null;
  const charB: number | null = gameState?.char_B ?? null;
  const myChar = mySymbol === "A" ? charA : charB;
  const turn: string = gameState?.turn ?? "A";
  const currentQ = gameState?.current_question ?? null;
  const history: any[] = gameState?.history ?? [];
  const winner: string | null = gameState?.winner ?? null;
  const winningChar: number | null = gameState?.winning_char ?? null;
  const presetQuestions: any[] = gameState?.preset_questions ?? [];

  const isMyTurn = turn === mySymbol;
  const iAmAsker = currentQ?.asker === mySymbol;
  const iAmAnswerer = currentQ && currentQ.asker !== mySymbol;

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
    setEliminated(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sendAsk = (text: string) => {
    if (!text.trim()) return;
    ws.send(JSON.stringify({ action: "move", action_type: "ask", text: text.trim() }));
    setAskText("");
    setShowPresets(false);
  };

  const sendAnswer = (answer: boolean) => {
    ws.send(JSON.stringify({ action: "move", action_type: "answer", answer }));
  };

  const sendGuess = (charId: number) => {
    ws.send(JSON.stringify({ action: "move", action_type: "guess", character_id: charId }));
    setGuessMode(false);
  };

  if (!gameState || phase === "waiting") return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="animate-spin text-purple-400" size={40} />
      <p className="text-sm">Waiting for both players to join…</p>
    </div>
  );

  const myCharData = myChar !== null ? CHARACTERS[myChar] : null;
  const opponentSymbol = mySymbol === "A" ? "B" : "A";

  return (
    <div className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto max-w-3xl mx-auto w-full">

      {/* Top bar: my character + turn status */}
      <div className="flex items-center gap-3 flex-wrap">
        {myCharData && (
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-700 rounded-2xl px-4 py-2.5 flex-1 min-w-0">
            <CharacterAvatar char={myCharData} size={52} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Your Character</p>
              <p className="font-bold text-slate-100">{myCharData.name}</p>
            </div>
          </div>
        )}
        <div className={`px-4 py-2.5 rounded-2xl border text-sm font-semibold text-center
          ${isMyTurn && !currentQ ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" :
            "bg-slate-800 border-slate-700 text-slate-400"}`}>
          {currentQ ? (iAmAnswerer ? "Answer the question!" : "Waiting for answer…") :
           isMyTurn ? "Your turn to ask or guess" : `${opponentSymbol}'s turn`}
        </div>
      </div>

      {/* Q&A Panel */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">

        {/* Pending question */}
        {currentQ && (
          <div className="bg-slate-800 border border-purple-500/30 rounded-xl p-3 flex flex-col gap-2">
            <p className="text-xs text-purple-400 uppercase tracking-widest font-bold">
              {iAmAsker ? "Your question:" : `${currentQ.asker} asks:`}
            </p>
            <p className="text-slate-100 font-medium">"{currentQ.text}"</p>
            {iAmAnswerer && (
              <div className="flex gap-2 mt-1">
                <button onClick={() => sendAnswer(true)}  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-700/40 hover:bg-green-600/60 border border-green-500/40 text-green-300 font-bold rounded-xl transition-all">
                  <CheckCircle size={16} /> Yes
                </button>
                <button onClick={() => sendAnswer(false)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-700/40 hover:bg-red-600/60 border border-red-500/40 text-red-300 font-bold rounded-xl transition-all">
                  <XCircle size={16} /> No
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ask form */}
        {isMyTurn && !currentQ && phase === "playing" && !guessMode && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a yes/no question…"
                value={askText}
                onChange={e => setAskText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendAsk(askText)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
              <button onClick={() => sendAsk(askText)} disabled={!askText.trim()} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold transition-all">
                Ask
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowPresets(p => !p)} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-all">
                {showPresets ? "Hide" : "📋 Preset Questions"}
              </button>
              <button onClick={() => setGuessMode(true)} className="text-xs px-3 py-1.5 bg-rose-800/40 hover:bg-rose-700/60 border border-rose-600/40 text-rose-300 rounded-lg transition-all font-semibold">
                🎯 Make a Guess!
              </button>
            </div>
            {showPresets && (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {presetQuestions.map((q: any) => (
                  <button key={q.id} onClick={() => sendAsk(q.text)}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white rounded-lg transition-all">
                    {q.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="border-t border-slate-700 pt-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {[...history].reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`font-bold text-xs px-1.5 py-0.5 rounded-md shrink-0 ${h.asker === mySymbol ? "bg-indigo-600/40 text-indigo-300" : "bg-slate-700 text-slate-400"}`}>{h.asker}</span>
                <span className="text-slate-300 flex-1">{h.text}</span>
                <span className={`font-bold text-xs shrink-0 ${h.answer ? "text-green-400" : "text-red-400"}`}>{h.answer ? "Yes" : "No"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Character Grid */}
      <p className="text-slate-500 text-xs text-center">Click a character to cross them out. Right-click or tap again to restore.</p>
      <div className="grid grid-cols-6 gap-1.5">
        {CHARACTERS.map(char => {
          const isElim = eliminated.has(char.id);
          const isGuessing = guessMode && char.id !== myChar;
          return (
            <div
              key={char.id}
              onClick={() => guessMode && char.id !== myChar ? sendGuess(char.id) : toggleEliminate(char.id)}
              className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl border cursor-pointer transition-all select-none
                ${isElim ? "opacity-25 bg-slate-900 border-slate-800" :
                  isGuessing ? "bg-rose-900/30 border-rose-500/60 hover:border-rose-400 hover:bg-rose-800/40" :
                  char.id === myChar ? "bg-indigo-900/30 border-indigo-500/40 cursor-default" :
                  "bg-slate-800/60 border-slate-700 hover:border-slate-500 hover:bg-slate-700/60"}`}
            >
              {isElim && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><span className="text-2xl">✕</span></div>}
              {char.id === myChar && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-indigo-300 z-10" />}
              <CharacterAvatar char={char} size={52} />
              <p className="text-[9px] font-medium text-slate-400 truncate w-full text-center">{char.name}</p>
            </div>
          );
        })}
      </div>

      {/* Guess mode overlay */}
      {guessMode && (
        <div className="sticky bottom-0 bg-rose-900/90 border border-rose-500/50 rounded-xl p-3 text-center backdrop-blur">
          <p className="text-rose-200 font-semibold text-sm">🎯 Tap a character to guess that's who the opponent has!</p>
          <button onClick={() => setGuessMode(false)} className="mt-1.5 text-xs text-rose-400 underline">Cancel</button>
        </div>
      )}

      {/* Win / Lose overlay */}
      {phase === "finished" && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50">
          <div className={`bg-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl border
            ${winner === mySymbol ? "border-green-500/50 shadow-green-500/10" : "border-red-500/50 shadow-red-500/10"}`}>
            <p className="text-5xl">{winner === mySymbol ? "🎉" : "😔"}</p>
            <h2 className={`text-3xl font-black ${winner === mySymbol ? "text-green-400" : "text-red-400"}`}>
              {winner === mySymbol ? "You Won!" : "You Lost!"}
            </h2>
            {winningChar !== null && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-slate-400 text-sm">The opponent's character was:</p>
                <CharacterAvatar char={CHARACTERS[winningChar]} size={80} />
                <p className="font-bold text-slate-100 text-lg">{CHARACTERS[winningChar].name}</p>
              </div>
            )}
            <button onClick={handleRestart} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-all">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
