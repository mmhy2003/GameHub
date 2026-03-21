"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Hash, ArrowRight, Ship } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("gamehub_username");
    if (savedName) {
      setUsername(savedName);
      setIsNameSet(true);
    }
  }, []);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem("gamehub_username", username.trim());
      setIsNameSet(true);
    }
  };

  const joinTicTacToe = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRoom = roomId.trim() || Math.random().toString(36).substring(2, 8);
    router.push(`/room/${targetRoom}?game=tic-tac-toe`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 md:py-12 px-4 sm:px-6 selection:bg-indigo-500/30">
      <div className="absolute top-0 w-full h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />
      
      <header className="mb-10 md:mb-16 text-center space-y-3 md:space-y-4 relative z-10">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-2 md:mb-4 ring-1 ring-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
          <Gamepad2 size={40} className="w-8 h-8 md:w-10 md:h-10" strokeWidth={1.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent px-2">
          GameHub
        </h1>
        <p className="text-slate-400 max-w-md mx-auto text-base md:text-lg px-4">
          Play classic peer-to-peer multiplayer games instantly. No sign-ups required.
        </p>
      </header>

      {!isNameSet ? (
        <div className="w-full max-w-md bg-slate-900/80 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-xl relative z-10 transition-all">
           <h2 className="text-2xl font-semibold mb-6 text-center">Enter your name</h2>
           <form onSubmit={handleSaveName} className="space-y-4">
             <div>
               <label htmlFor="username" className="sr-only">Display Name</label>
               <input
                 id="username"
                 type="text"
                 placeholder="e.g. CoolPlayer99"
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 placeholder-slate-500"
                 required
               />
             </div>
             <button
               type="submit"
               className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex justify-center items-center gap-2 group"
             >
               Start Playing
               <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
             </button>
           </form>
        </div>
      ) : (
        <div className="w-full justify-center max-w-5xl flex flex-col gap-4 relative z-10 animate-fade-in">
          
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-0 px-2 border-b border-slate-800 pb-3">
             <h2 className="text-lg md:text-xl font-semibold text-slate-300">Game Library</h2>
             <button onClick={() => { setIsNameSet(false); setUsername(""); localStorage.removeItem("gamehub_username"); }} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors underline decoration-slate-700 underline-offset-4 w-full sm:w-auto text-left sm:text-right">Change Player Name ({username})</button>
          </div>

          <div className="flex flex-wrap gap-6 justify-center w-full">
            {/* Tic Tac Toe Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800 ring-offset-slate-900/50">
                <img src="/games/tic_tac_toe_cover.png" alt="Tic-Tac-Toe" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none"></div>
              </div>
              
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Tic-Tac-Toe
                <Hash size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">The classic multi-player game of X's and O's. Challenge a friend in real-time.</p>
              
              <form onSubmit={joinTicTacToe} className="mt-auto space-y-3 relative z-10">
                <input
                  type="text"
                  placeholder="Room Code (optional)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm"
                >
                  {roomId.trim() ? "Join Room" : "Create New Game"}
                </button>
              </form>
            </div>

            {/* Battleships Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800 ring-offset-slate-900/50">
                <img src="/games/battleships_cover.png" alt="Battleships" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none"></div>
              </div>
              
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Battleships
                <Ship size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Command your fleet and sink enemy vessels in strategic naval warfare.</p>
              
              <form onSubmit={(e) => { e.preventDefault(); router.push(`/room/${roomId.trim() || Math.random().toString(36).substring(2, 8)}?game=battleships`); }} className="mt-auto space-y-3 relative z-10">
                <input
                  type="text"
                  placeholder="Room Code (optional)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm"
                >
                  {roomId.trim() ? "Join Room" : "Create New Game"}
                </button>
              </form>
            </div>

            {/* Tetris Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800 ring-offset-slate-900/50">
                <img src="/games/tetris_cover.png" alt="Tetris" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none"></div>
              </div>
              
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Tetris
                <Gamepad2 size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Drop blocks and clear lines to send garbage attacks to opposing players.</p>
              
              <form onSubmit={(e) => { e.preventDefault(); router.push(`/room/${roomId.trim() || Math.random().toString(36).substring(2, 8)}?game=tetris`); }} className="mt-auto space-y-3 relative z-10">
                <input
                  type="text"
                  placeholder="Room Code (optional)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm"
                >
                  {roomId.trim() ? "Join Room" : "Create New Game"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
