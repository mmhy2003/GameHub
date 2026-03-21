"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Gamepad2, Hash, ArrowRight, Ship, Bomb, HelpCircle } from "lucide-react";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params — set by embedding parent via iframe src
  const paramName = searchParams.get("name") ?? "";
  const paramRoom = searchParams.get("room") ?? "";
  const chatEnabled = searchParams.get("chat") !== "false";

  const [username, setUsername] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [roomId, setRoomId] = useState(paramRoom);

  // Build a query string that forwards all embed params into room URLs
  const embedParams = (game: string, rid: string) => {
    const p = new URLSearchParams({ game });
    if (paramName) p.set("name", paramName);
    if (!chatEnabled) p.set("chat", "false");
    return `/room/${rid}?${p.toString()}`;
  };

  const navigate = (game: string) => {
    const rid = roomId.trim() || Math.random().toString(36).substring(2, 8);
    router.push(embedParams(game, rid));
  };

  useEffect(() => {
    // If name was passed as URL param, use it directly and skip the name form
    if (paramName) {
      const trimmed = paramName.trim();
      localStorage.setItem("gamehub_username", trimmed);
      setUsername(trimmed);
      setIsNameSet(true);
      return;
    }
    const savedName = localStorage.getItem("gamehub_username");
    if (savedName) {
      setUsername(savedName);
      setIsNameSet(true);
    }
  }, [paramName]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem("gamehub_username", username.trim());
      setIsNameSet(true);
    }
  };

  const joinTicTacToe = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("tic-tac-toe");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 md:py-12 pb-16 px-4 sm:px-6 selection:bg-indigo-500/30">
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
             {!paramName && (
               <button onClick={() => { setIsNameSet(false); setUsername(""); localStorage.removeItem("gamehub_username"); }} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors underline decoration-slate-700 underline-offset-4 w-full sm:w-auto text-left sm:text-right">Change Player Name ({username})</button>
             )}
             {paramName && (
               <span className="text-sm text-slate-500">Playing as <span className="text-indigo-400 font-medium">{username}</span></span>
             )}
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
                {!paramRoom && (
                  <input
                    type="text"
                    placeholder="Room Code (optional)"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600"
                  />
                )}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">
                  {paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}
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
              
              <form onSubmit={(e) => { e.preventDefault(); navigate("battleships"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && (
                  <input
                    type="text"
                    placeholder="Room Code (optional)"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600"
                  />
                )}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">
                  {paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}
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
              
              <form onSubmit={(e) => { e.preventDefault(); navigate("tetris"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && (
                  <input
                    type="text"
                    placeholder="Room Code (optional)"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600"
                  />
                )}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">
                  {paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}
                </button>
              </form>
            </div>

            {/* Ping-Pong Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800 ring-offset-slate-900/50">
                <img src="/games/pong_cover.png" alt="Ping-Pong" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none"></div>
              </div>

              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Ping-Pong
                <Gamepad2 size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Real-time paddle battle. Deflect the ball and outscore your opponent to 7 points.</p>

              <form onSubmit={(e) => { e.preventDefault(); navigate("ping-pong"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && (
                  <input
                    type="text"
                    placeholder="Room Code (optional)"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600"
                  />
                )}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">
                  {paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}
                </button>
              </form>
            </div>

            {/* Connect Four Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800">
                <img src="/games/connect_four_cover.png" alt="Connect Four" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Connect Four <Hash size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Drop discs and connect four in a row — horizontally, vertically, or diagonally.</p>
              <form onSubmit={(e) => { e.preventDefault(); navigate("connect-four"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && <input type="text" placeholder="Room Code (optional)" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600" />}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">{paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}</button>
              </form>
            </div>

            {/* Rock Paper Scissors Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800">
                <img src="/games/rps_cover.png" alt="Rock Paper Scissors" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Rock Paper Scissors <Gamepad2 size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Pick simultaneously and outsmart your rival. First to 3 round victories wins the match.</p>
              <form onSubmit={(e) => { e.preventDefault(); navigate("rock-paper-scissors"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && <input type="text" placeholder="Room Code (optional)" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600" />}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">{paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}</button>
              </form>
            </div>

            {/* Hangman Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800">
                <img src="/games/hangman_cover.png" alt="Hangman" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Hangman <Hash size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">One player hides a word, the other guesses letters one at a time. 6 wrong guesses and it's over.</p>
              <form onSubmit={(e) => { e.preventDefault(); navigate("hangman"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && <input type="text" placeholder="Room Code (optional)" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600" />}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">{paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}</button>
              </form>
            </div>

            {/* Number Duel Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800">
                <img src="/games/number_duel_cover.png" alt="Number Duel" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Number Duel <Gamepad2 size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Pick a number 1–100. Closest to the hidden target wins the round. First to 3 wins takes the match.</p>
              <form onSubmit={(e) => { e.preventDefault(); navigate("number-duel"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && <input type="text" placeholder="Room Code (optional)" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600" />}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">{paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}</button>
              </form>
            </div>

            {/* Minesweeper Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800">
                <img src="/games/minesweeper_cover.png" alt="Minesweeper" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Minesweeper <Bomb size={24} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Co-op! Both players share one board and work together to clear all mines. One wrong click ends it for everyone.</p>
              <form onSubmit={(e) => { e.preventDefault(); navigate("minesweeper"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && <input type="text" placeholder="Room Code (optional)" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600" />}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">{paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}</button>
              </form>
            </div>

            {/* Guess Who Card */}
            <div className="group w-full md:w-[320px] bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col">
              <div className="overflow-hidden rounded-2xl mb-4 w-full h-44 relative shadow-inner ring-1 ring-slate-800">
                <img src="/games/guess_who_cover.png" alt="Guess Who" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition-all duration-700 ease-in-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-400 transition-colors relative z-10 flex items-center justify-between">
                Guess Who <HelpCircle size={22} className="text-indigo-500/50" />
              </h3>
              <p className="text-slate-400 mb-6 flex-grow text-sm relative z-10">Each player gets a secret character. Take turns asking yes/no questions to deduce who the opponent has — then guess!</p>
              <form onSubmit={(e) => { e.preventDefault(); navigate("guess-who"); }} className="mt-auto space-y-3 relative z-10">
                {!paramRoom && <input type="text" placeholder="Room Code (optional)" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-200 placeholder-slate-600" />}
                <button type="submit" className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold py-2.5 rounded-lg transition-all shadow-sm">{paramRoom ? "Join Room" : roomId.trim() ? "Join Room" : "Create New Game"}</button>
              </form>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
