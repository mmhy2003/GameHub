"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameProps } from "@/lib/types";

const SNAKES:  Record<number, number> = { 99:78, 95:75, 87:36, 62:19, 54:34, 17:7 };
const LADDERS: Record<number, number> = { 4:14, 9:31, 20:38, 28:84, 40:59, 51:67, 63:81, 71:91 };

function cellToGrid(n: number): [number, number] {
  if (n <= 0) return [-1, -1];
  const row0 = Math.floor((n - 1) / 10);
  const colInRow = (n - 1) % 10;
  const col = row0 % 2 === 0 ? colInRow : 9 - colInRow;
  return [col, 9 - row0];
}

function cellCenter(n: number, cs: number): [number, number] {
  const [col, row] = cellToGrid(n);
  return [col * cs + cs / 2, row * cs + cs / 2];
}

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

const EVENT_MESSAGES: Record<string, string> = {
  snake:            "🐍 Hit a snake! Slid down…",
  ladder:           "🪜 Climbed a ladder!",
  shield_blocked:   "🛡️ Shield blocked the snake!",
  sabotaged:        "💣 Sabotaged! Turn lost — your Double Roll is safe.",
  normal:           "",
  none:             "",
  win:              "🏆 Reached 100!",
  card_shield:      "🛡️ Shield activated! Next snake blocked.",
  card_swap:        "🔄 Positions swapped!",
  card_sabotage:    "💣 Opponent sabotaged! They lose their next turn.",
  card_double_roll: "🎲 Double Roll ready! Next roll counts twice.",
  card_extra_turn:  "⏩ Extra turn granted!",
};

const CARD_COLORS: Record<string, string> = {
  double_roll: "border-indigo-500/60 bg-indigo-900/30 hover:bg-indigo-800/50",
  shield:      "border-cyan-500/60 bg-cyan-900/30 hover:bg-cyan-800/50",
  swap:        "border-purple-500/60 bg-purple-900/30 hover:bg-purple-800/50",
  sabotage:    "border-rose-500/60 bg-rose-900/30 hover:bg-rose-800/50",
  lucky_leap:  "border-amber-500/60 bg-amber-900/30 hover:bg-amber-800/50",
  extra_turn:  "border-green-500/60 bg-green-900/30 hover:bg-green-800/50",
};

export default function SnakesLadders({ ws, gameState, mySymbol, handleRestart }: GameProps) {
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState(1);
  const [animIv, setAnimIv] = useState<ReturnType<typeof setInterval> | null>(null);

  const phase      = gameState?.phase      ?? "waiting";
  const posA       = gameState?.pos_A      ?? 0;
  const posB       = gameState?.pos_B      ?? 0;
  const turn       = gameState?.turn       ?? "A";
  const lastRoll   = gameState?.last_roll  ?? null;
  const lastEvent  = gameState?.last_event ?? "none";
  const winner     = gameState?.winner     ?? null;
  const readyCount: number = gameState?.ready_count ?? 0;
  const cardsPlayedThisTurn: number = gameState?.cards_played_this_turn ?? 0;
  const allCards: any[] = gameState?.all_cards ?? [];
  const handA: string[] = gameState?.hand_A ?? [];
  const handB: string[] = gameState?.hand_B ?? [];
  const myHand       = mySymbol === "A" ? handA : handB;
  const oppHandCount = mySymbol === "A" ? (gameState?.hand_B_count ?? 0) : (gameState?.hand_A_count ?? 0);

  const shieldMe    = mySymbol === "A" ? gameState?.shield_A      : gameState?.shield_B;
  const sabotagedMe = mySymbol === "A" ? gameState?.sabotaged_A   : gameState?.sabotaged_B;
  const dblMe       = mySymbol === "A" ? gameState?.double_roll_A  : gameState?.double_roll_B;
  const extraMe     = mySymbol === "A" ? gameState?.extra_turn_A   : gameState?.extra_turn_B;

  const isMyTurn = turn === mySymbol && phase === "playing";
  const cardById = (id: string) => allCards.find((c: any) => c.id === id);

  useEffect(() => {
    if (lastRoll !== null && rolling) {
      setRolling(false);
      if (animIv) clearInterval(animIv);
      setDisplayDice(lastRoll > 6 ? lastRoll % 6 || 6 : lastRoll);
    }
  }, [lastRoll]);

  useEffect(() => {
    if (phase === "waiting" && mySymbol) {
      ws.send(JSON.stringify({ action: "move", action_type: "ready" }));
    }
  }, [phase, mySymbol]);

  const handleRoll = () => {
    if (!isMyTurn || rolling) return;
    setRolling(true);
    const iv = setInterval(() => setDisplayDice(Math.ceil(Math.random() * 6)), 80);
    setAnimIv(iv);
    setTimeout(() => {
      clearInterval(iv);
      ws.send(JSON.stringify({ action: "move", action_type: "roll" }));
    }, 500);
  };

  const handlePlayCard = (cardId: string) => {
    if (!isMyTurn) return;
    ws.send(JSON.stringify({ action: "move", action_type: "play_card", card_id: cardId }));
  };

  const CELL = 42;
  const BOARD = CELL * 10;

  const renderBoard = () => {
    const cells = [];
    for (let n = 100; n >= 1; n--) {
      const [col, row] = cellToGrid(n);
      const isSnakeHead = n in SNAKES;
      const isSnakeTail = Object.values(SNAKES).includes(n);
      const isLadderBot = n in LADDERS;
      const isLadderTop = Object.values(LADDERS).includes(n);
      const hasA = posA === n, hasB = posB === n;
      const isCheckerDark = (Math.floor((n-1)/10) + (n-1)%10) % 2 === 1;

      let bg = isCheckerDark ? "bg-slate-800" : "bg-slate-900";
      if (isSnakeHead) bg = "bg-rose-900/70";
      if (isSnakeTail) bg = "bg-rose-950/60";
      if (isLadderBot) bg = "bg-emerald-900/70";
      if (isLadderTop) bg = "bg-emerald-950/60";

      cells.push(
        <div key={n} className={`relative flex flex-col items-center justify-center border border-slate-700/40 ${bg}`}
          style={{ gridColumn: col+1, gridRow: row+1, width: CELL, height: CELL }}>
          <span className="text-[7px] text-slate-500 absolute top-0.5 left-1 leading-none">{n}</span>
          <span className="text-sm leading-none select-none">
            {isSnakeHead ? "🐍" : isLadderBot ? "🪜" : isSnakeTail ? "🔴" : isLadderTop ? "⭐" : ""}
          </span>
          <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
            {hasA && <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-cyan-200 flex items-center justify-center shadow-lg shadow-cyan-500/40"><span className="text-[7px] font-black text-slate-900">A</span></div>}
            {hasB && <div className="w-4 h-4 rounded-full bg-rose-400 border-2 border-rose-200 flex items-center justify-center shadow-lg shadow-rose-500/40"><span className="text-[7px] font-black text-slate-900">B</span></div>}
          </div>
        </div>
      );
    }

    const svgLines = (
      <svg className="absolute inset-0 pointer-events-none z-10" width={BOARD} height={BOARD}>
        {Object.entries(LADDERS).map(([bot, top]) => {
          const [x1,y1] = cellCenter(+bot, CELL), [x2,y2] = cellCenter(+top, CELL);
          return (<g key={`l${bot}`}>
            <line x1={x1-3} y1={y1} x2={x2-3} y2={y2} stroke="#4ade80" strokeWidth={2.5} strokeLinecap="round" opacity={0.7}/>
            <line x1={x1+3} y1={y1} x2={x2+3} y2={y2} stroke="#4ade80" strokeWidth={2.5} strokeLinecap="round" opacity={0.7}/>
            {[0.3,0.6].map(t=><line key={t} x1={(x1-3)*(1-t)+(x2-3)*t} y1={y1*(1-t)+y2*t} x2={(x1+3)*(1-t)+(x2+3)*t} y2={y1*(1-t)+y2*t} stroke="#4ade80" strokeWidth={2} opacity={0.6}/>)}
          </g>);
        })}
        {Object.entries(SNAKES).map(([head, tail]) => {
          const [x1,y1] = cellCenter(+head, CELL), [x2,y2] = cellCenter(+tail, CELL);
          const mx=(x1+x2)/2+20, my=(y1+y2)/2;
          return <path key={`s${head}`} d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} stroke="#f87171" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.75}/>;
        })}
      </svg>
    );

    return (
      <div className="relative border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl" style={{width:BOARD,height:BOARD}}>
        <div className="grid absolute inset-0" style={{gridTemplateColumns:`repeat(10,${CELL}px)`,gridTemplateRows:`repeat(10,${CELL}px)`}}>{cells}</div>
        {svgLines}
      </div>
    );
  };

  if (!gameState || phase === "waiting") return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="animate-spin text-amber-400" size={40}/>
      {readyCount === 1
        ? <p className="text-sm">Waiting for your opponent to join…</p>
        : <p className="text-sm">Waiting for both players…</p>}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center gap-3 p-3 overflow-auto">

      {/* Scoreboard */}
      <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-cyan-400 border-2 border-cyan-200 flex items-center justify-center"><span className="text-[8px] font-black text-slate-900">A</span></div>
          <span className={`font-bold ${mySymbol==="A"?"text-cyan-300":"text-slate-300"}`}>{posA||"Start"}</span>
          {gameState?.shield_A      && <span title="Shield">🛡️</span>}
          {gameState?.sabotaged_A   && <span title="Sabotaged">💣</span>}
          {gameState?.double_roll_A && <span title="Double Roll">🎲</span>}
          {gameState?.extra_turn_A  && <span title="Extra Turn">⏩</span>}
        </div>
        <div className={`text-xs font-bold px-3 py-1 rounded-xl border ${isMyTurn?"bg-amber-500/20 border-amber-500/50 text-amber-300":"bg-slate-800 border-slate-600 text-slate-500"}`}>
          {phase==="playing" ? (isMyTurn ? "Your turn!" : `${turn}'s turn`) : "Game over"}
        </div>
        <div className="flex items-center gap-2">
          {gameState?.shield_B      && <span title="Shield">🛡️</span>}
          {gameState?.sabotaged_B   && <span title="Sabotaged">💣</span>}
          {gameState?.double_roll_B && <span title="Double Roll">🎲</span>}
          {gameState?.extra_turn_B  && <span title="Extra Turn">⏩</span>}
          <span className={`font-bold ${mySymbol==="B"?"text-rose-300":"text-slate-300"}`}>{posB||"Start"}</span>
          <div className="w-5 h-5 rounded-full bg-rose-400 border-2 border-rose-200 flex items-center justify-center"><span className="text-[8px] font-black text-slate-900">B</span></div>
        </div>
      </div>

      {/* Event message */}
      {lastEvent && lastEvent !== "none" && lastEvent !== "normal" && (
        <div className="text-sm font-semibold text-amber-300 bg-amber-900/20 border border-amber-500/30 px-4 py-2 rounded-xl text-center">
          {lastEvent.startsWith("card_leap") ? "✨ Lucky Leap! Bounded forward!" : EVENT_MESSAGES[lastEvent] ?? lastEvent}
        </div>
      )}

      {/* ── Main row: board+dice TOP on mobile, cards panel BELOW; side-by-side on desktop ── */}
      <div className="flex flex-col-reverse md:flex-row gap-4 items-start flex-wrap justify-center">

        {/* Cards panel: horizontal row on mobile, vertical sidebar on desktop */}
        <div className="flex flex-col gap-2 w-full md:w-36 md:shrink-0">
          <div className="flex items-center justify-between md:block">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Your Hand</p>
            <p className="text-[10px] text-slate-600">Opp: {oppHandCount} cards</p>
          </div>

          <div className="flex flex-row flex-wrap gap-2 md:flex-col md:gap-2">
            {myHand.map((cid: string, i: number) => {
              const card = cardById(cid);
              if (!card) return null;
              const cardUsed = cardsPlayedThisTurn >= 1;
              return (
                <button key={`${cid}-${i}`} onClick={() => handlePlayCard(cid)}
                  disabled={!isMyTurn || cardUsed}
                  title={cardUsed ? "Only 1 card per turn" : card.desc}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border text-center transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed active:scale-95
                    md:w-full
                    ${CARD_COLORS[cid] ?? "border-slate-600 bg-slate-800 hover:bg-slate-700"}`}>
                  <span className="text-xl">{card.emoji}</span>
                  <span className="font-bold text-slate-100 text-[10px] leading-tight">{card.name}</span>
                  {/* Hide description on mobile to stay compact */}
                  <span className="hidden md:block text-[8px] text-slate-400 leading-tight">{card.desc}</span>
                </button>
              );
            })}
            {cardsPlayedThisTurn >= 1 && isMyTurn && (
              <p className="text-[9px] text-slate-500 text-center italic w-full">1 card per turn used</p>
            )}
          </div>

          {/* Active effects */}
          <div className="flex flex-row flex-wrap gap-1 md:flex-col text-[9px]">
            {shieldMe    && <span className="bg-cyan-900/40 border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded-lg text-center">🛡️ Shield active</span>}
            {sabotagedMe && <span className="bg-rose-900/40 border border-rose-500/40 text-rose-300 px-2 py-1 rounded-lg text-center">💣 Sabotaged!</span>}
            {dblMe       && <span className="bg-indigo-900/40 border border-indigo-500/40 text-indigo-300 px-2 py-1 rounded-lg text-center">🎲 Double Roll</span>}
            {extraMe     && <span className="bg-green-900/40 border border-green-500/40 text-green-300 px-2 py-1 rounded-lg text-center">⏩ Extra Turn</span>}
          </div>
        </div>

        {/* Right panel: board + legend + dice */}
        <div className="flex flex-col items-center gap-3">
          <div className="overflow-auto max-w-full">{renderBoard()}</div>

          <div className="flex gap-3 text-xs text-slate-500">
            <span>🐍 Snake (down)</span><span>🪜 Ladder (up)</span>
          </div>

          <div className="flex items-center gap-4">
            <span className={`text-5xl transition-all ${rolling?"animate-bounce":""}`}>
              {lastRoll ? DICE_FACES[Math.min(displayDice, 6)] : "🎲"}
            </span>
            {lastRoll && lastRoll > 6 && (
              <span className="text-slate-400 text-sm font-bold">= {lastRoll}</span>
            )}
            <button onClick={handleRoll} disabled={!isMyTurn||rolling}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-black text-base rounded-2xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
              {rolling?"Rolling…":isMyTurn?"🎲 Roll Dice!":`Waiting for ${turn}…`}
            </button>
          </div>
        </div>

      </div>{/* end main row */}

      {/* Win overlay */}
      {phase === "finished" && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50">
          <div className={`bg-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl border
            ${winner===mySymbol?"border-amber-500/50 shadow-amber-500/10":"border-slate-600"}`}>
            <p className="text-5xl">{winner===mySymbol?"🏆":"😔"}</p>
            <h2 className={`text-3xl font-black ${winner===mySymbol?"text-amber-400":"text-slate-400"}`}>
              {winner===mySymbol?"You Won!":`Player ${winner} Won!`}
            </h2>
            <p className="text-slate-400 text-sm">{winner===mySymbol?"You reached square 100 first!":"Better luck next time!"}</p>
            <button onClick={handleRestart} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 rounded-xl text-slate-900 font-bold transition-all">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
