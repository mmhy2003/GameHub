import { Loader2 } from "lucide-react";
import type { GameProps } from "@/lib/types";

export default function TicTacToe({ ws, gameState, mySymbol, handleRestart }: GameProps) {
  if (!gameState) {
     return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  const { board, current_turn: currentTurn, winner, is_draw: isDraw } = gameState;

  const handleCellClick = (index: number) => {
    if (winner || isDraw || board[index] !== null || currentTurn !== mySymbol) return;
    ws.send(JSON.stringify({ action: "move", index }));
  };

  return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full h-full">
          <div className="mb-8 flex flex-col items-center">
             {(winner || isDraw) ? (
               <div className="animate-bounce-short inset-0 absolute pt-10 pointer-events-none flex justify-center items-start z-50">
                 <div className="bg-slate-900/95 backdrop-blur-lg border border-slate-700 px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center w-56 pointer-events-auto">
                   <h2 className="text-xl font-black mb-1 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent text-center">
                     {winner ? `Player ${winner} Wins!` : "It's a Draw!"}
                   </h2>
                   <button 
                     onClick={handleRestart}
                     className="mt-3 px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
                   >
                     Play Again
                   </button>
                 </div>
               </div>
             ) : (
               <div className="text-lg font-medium text-slate-300 bg-slate-900/50 px-6 py-3 rounded-full border border-slate-800 shadow-inner">
                  {currentTurn === mySymbol 
                    ? <span className="text-indigo-400 animate-pulse">It's your turn!</span> 
                    : <span>Waiting for <strong className="text-white">Player {currentTurn}</strong>...</span>}
               </div>
             )}
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/80 rounded-2xl shadow-xl border border-slate-700 backdrop-blur-sm relative">
            {board.map((cell: string | null, idx: number) => (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                disabled={!!winner || !!isDraw || cell !== null || currentTurn !== mySymbol}
                className={`w-24 h-24 sm:w-32 sm:h-32 rounded-xl text-5xl sm:text-7xl font-black flex items-center justify-center transition-all duration-300
                  ${!cell && !winner && currentTurn === mySymbol ? "hover:bg-slate-800 cursor-pointer shadow-indigo-500/20" : "cursor-default bg-slate-800/50"} 
                  ${cell === "X" ? "text-blue-400 shadow-[inset_0_0_20px_rgba(96,165,250,0.1)]" : ""} 
                  ${cell === "O" ? "text-rose-400 shadow-[inset_0_0_20px_rgba(251,113,133,0.1)]" : ""}
                  bg-slate-950 border border-slate-800 shadow-inner
                `}
              >
                <span className={cell ? "animate-scale-in" : ""}>{cell}</span>
              </button>
            ))}
          </div>
        </div>
  );
}
