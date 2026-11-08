import { useState, useMemo } from "react";
import { Loader2, Ship, Target, Shuffle } from "lucide-react";
import type { GameProps } from "@/lib/types";

export default function Battleships({ ws, gameState, mySymbol, handleRestart }: GameProps) {
  const [localPlacements, setLocalPlacements] = useState<number[]>([]);

  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  const { phase, current_turn: currentTurn, winner, ready, my_ships, shots } = gameState;
  const isSetup = phase === "setup";
  const enemySymbol = mySymbol === "A" ? "B" : "A";

  // Generate a very naive random valid-ish placement for UX speed
  // 1x5, 1x4, 2x3, 1x2 ships randomly horizontal/vertical
  const handleRandomize = () => {
    const s = [5, 4, 3, 3, 2];
    let grid = new Set<number>();
    for (let length of s) {
      let placed = false;
      while (!placed) {
        let isHoriz = Math.random() > 0.5;
        let startX = Math.floor(Math.random() * (isHoriz ? 10 - length : 10));
        let startY = Math.floor(Math.random() * (isHoriz ? 10 : 10 - length));
        
        let candidate = [];
        let valid = true;
        for (let i = 0; i < length; i++) {
           let idx = isHoriz ? (startY * 10 + startX + i) : ((startY + i) * 10 + startX);
           if (grid.has(idx)) valid = false;
           candidate.push(idx);
        }
        if (valid) {
          candidate.forEach(c => grid.add(c));
          placed = true;
        }
      }
    }
    setLocalPlacements(Array.from(grid));
  };

  const handleConfirmPlacement = () => {
    ws.send(JSON.stringify({ action: "move", action_type: "place_ships", ships: localPlacements }));
  };

  const handleFire = (index: number) => {
    if (!mySymbol) return;
    if (phase !== "playing" || currentTurn !== mySymbol || winner) return;
    if (shots[mySymbol] && shots[mySymbol][String(index)]) return;
    ws.send(JSON.stringify({ action: "move", index }));
  };

  return (
    <div className="flex-1 flex flex-col items-center py-8 relative z-10 w-full overflow-y-auto">
      {winner && (
        <div className="animate-bounce-short fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
          <div className="bg-slate-900/95 backdrop-blur-lg border border-slate-700 px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center w-64 pointer-events-auto">
            <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent text-center">
              {winner === mySymbol ? `Victory!` : `Defeat! Player ${winner} Won.`}
            </h2>
            <button onClick={handleRestart} className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-all shadow-lg">
              Play Again
            </button>
          </div>
        </div>
      )}

      {isSetup && (
        <div className="flex flex-col items-center bg-slate-900/80 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md mb-8">
          <h2 className="text-xl font-bold text-slate-200 mb-2 border-b border-slate-700 pb-2 w-full text-center">Setup Phase</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm text-center">Place your 5 ships on the grid before battle commences. Both players must be ready.</p>
          
          <div className="grid grid-cols-10 gap-1 bg-slate-950 p-2 rounded-lg border border-slate-800 shadow-inner mb-6">
             {Array.from({ length: 100 }).map((_, i) => (
                <div key={i} className={`w-6 h-6 sm:w-8 sm:h-8 rounded-[4px] border border-slate-800/50 transition-colors
                  ${localPlacements.includes(i) || my_ships.includes(i) ? "bg-indigo-500 shadow-indigo-500/30" : "bg-slate-900"}
                `}></div>
             ))}
          </div>

          {!mySymbol || !ready[mySymbol] ? (
            <div className="flex gap-4 w-full">
              <button onClick={handleRandomize} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Shuffle size={16} /> Randomize
              </button>
              <button 
                onClick={handleConfirmPlacement} 
                disabled={localPlacements.length !== 17}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-sm font-medium transition-colors"
               >
                Ready
              </button>
            </div>
          ) : (
            <div className="text-indigo-400 flex items-center gap-2 animate-pulse mt-2"><Loader2 className="animate-spin" size={16} /> Waiting for opponent...</div>
          )}
        </div>
      )}

      {!isSetup && (
        <div className="w-full max-w-4xl px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* My Board */}
          <div className="flex flex-col items-center">
             <div className="w-full flex justify-between items-end mb-4">
               <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2"><Ship size={20} /> My Fleet</h3>
             </div>
             <div className="grid grid-cols-10 gap-[2px] sm:gap-1 bg-slate-900/50 p-2 sm:p-3 rounded-xl border border-slate-700 shadow-xl backdrop-blur-sm relative">
                {Array.from({ length: 100 }).map((_, i) => {
                  const hasShip = my_ships.includes(i);
                  const status = shots[enemySymbol]?.[String(i)];
                  return (
                    <div key={i} className={`w-7 h-7 sm:w-9 sm:h-9 rounded-md flex items-center justify-center transition-colors relative shadow-inner
                      ${hasShip ? "bg-indigo-500/80" : "bg-slate-800"}
                      ${status === "hit" ? "ring-2 ring-rose-500" : ""}
                    `}>
                       {status === "hit" && <div className="absolute inset-1 bg-rose-500 rounded-sm animate-scale-in"></div>}
                       {status === "miss" && <div className="w-2 h-2 rounded-full bg-slate-400"></div>}
                    </div>
                  )
                })}
             </div>
          </div>

          {/* Enemy Board */}
          <div className={`flex flex-col items-center transition-all ${currentTurn !== mySymbol && !winner ? "opacity-60 scale-95 blur-[1px]" : "scale-100"}`}>
             <div className="w-full flex justify-between items-end mb-4">
               <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2"><Target size={20} /> Artillery Radar</h3>
               {currentTurn === mySymbol && !winner && <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 animate-pulse">Your Turn</span>}
             </div>
             <div className="grid grid-cols-10 gap-[2px] sm:gap-1 bg-slate-900/50 p-2 sm:p-3 rounded-xl border border-slate-700 shadow-xl backdrop-blur-sm relative">
                {Array.from({ length: 100 }).map((_, i) => {
                  const status = mySymbol ? shots[mySymbol]?.[String(i)] : undefined;
                  return (
                    <button 
                      key={i} 
                      onClick={() => handleFire(i)}
                      disabled={currentTurn !== mySymbol || !!winner || !!status}
                      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-md flex items-center justify-center transition-all relative shadow-inner
                        ${!status && currentTurn === mySymbol ? "bg-slate-800 hover:bg-slate-700 cursor-pointer" : "bg-slate-800/50 cursor-default"}
                      `}
                    >
                       {status === "hit" && <div className="absolute inset-1 bg-rose-500 rounded-sm animate-scale-in shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>}
                       {status === "miss" && <div className="w-2 h-2 rounded-full bg-slate-400"></div>}
                    </button>
                  )
                })}
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
