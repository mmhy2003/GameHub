"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Send, ArrowLeft, Copy } from "lucide-react";
import TicTacToe from "@/components/games/TicTacToe";
import Battleships from "@/components/games/Battleships";
import Tetris from "@/components/games/Tetris";
import PingPong from "@/components/games/PingPong";
import ConnectFour from "@/components/games/ConnectFour";
import RockPaperScissors from "@/components/games/RockPaperScissors";
import Hangman from "@/components/games/Hangman";
import NumberDuel from "@/components/games/NumberDuel";
import Minesweeper from "@/components/games/Minesweeper";
import GuessWho from "@/components/games/GuessWho";
import SnakesLadders from "@/components/games/SnakesLadders";
import Stratego from "@/components/games/Stratego";
import GameHelp from "@/components/GameHelp";
import SoundToggle from "@/components/ui/SoundToggle";
import ToyButton from "@/components/ui/ToyButton";
import type { MatchScore } from "@/lib/types";

function RoomContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const gameType = searchParams.get("game") || "tic-tac-toe";
  const paramName = searchParams.get("name") ?? "";
  const chatEnabled = searchParams.get("chat") !== "false"; 

  const [username, setUsername] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  // Game State
  const [gameState, setGameState] = useState<any>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [mySymbol, setMySymbol] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [actualGameType, setActualGameType] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{sender: string, message: string, timestamp: number}[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear any previous room error when reconnecting (e.g. after clicking "Join Existing Game")
    setRoomError(null);
    setActualGameType(null);

    // If name is passed via URL param (embedded mode), use it directly
    const resolvedName = paramName.trim() || localStorage.getItem("gamehub_username") || "";
    if (!resolvedName) {
      router.push(`/?room=${encodeURIComponent(roomId)}`);
      return;
    }
    if (paramName.trim()) {
      localStorage.setItem("gamehub_username", paramName.trim());
    }
    setUsername(resolvedName);

    // Get JWT token — redirect to home if missing
    const token = sessionStorage.getItem("gamehub_token");
    if (!token) {
      router.push(`/?room=${encodeURIComponent(roomId)}`);
      return;
    }

    // Initialize WebSocket with JWT token
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const wsUrl = backendUrl.replace("http", "ws") + `/ws/${gameType}/${roomId}?token=${encodeURIComponent(token)}`;
    
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "game_state") {
        setGameState(data);
        setPlayers(data.players || []);
        // symbols map is now name→symbol; look up by our display name
        if (data.symbols && data.symbols[resolvedName]) {
          setMySymbol(data.symbols[resolvedName]);
        }
      } else if (data.type === "chat") {
        setChatMessages(prev => [...prev, data]);
        setUnreadCount(prev => chatOpen ? 0 : prev + 1);
      } else if (data.type === "error") {
        if (data.code === "UNAUTHORIZED") {
          // Token expired — clear and redirect to get a fresh token
          sessionStorage.removeItem("gamehub_token");
          router.push("/");
          return;
        }
        setRoomError(data.message);
        if (data.actual_game_type) setActualGameType(data.actual_game_type);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [roomId, router, gameType]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !ws) return;

    ws.send(JSON.stringify({ action: "chat", message: messageInput.trim() }));
    setMessageInput("");
  };

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopyInvite = async () => {
    const link = `${window.location.origin}/room/${roomId}?game=${gameType}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyStatus("idle"), 1500);
  };

  const handleRestart = () => {
    if (!ws) return;
    ws.send(JSON.stringify({ action: "restart" }));
  };

  if (!username || !ws) {
    return <RoomLoading />;
  }

  if (roomError) {
    const joinExistingUrl = actualGameType
      ? (() => {
          const p = new URLSearchParams({ game: actualGameType });
          if (searchParams.get("name")) p.set("name", searchParams.get("name")!);
          if (searchParams.get("chat") === "false") p.set("chat", "false");
          return `/room/${roomId}?${p.toString()}`;
        })()
      : null;

    return (
      <div className="min-h-screen bg-toy-stripes flex items-center justify-center text-ink w-full px-4">
        <div className="chunk bg-white p-8 flex flex-col items-center gap-4 max-w-sm w-full text-center animate-pop">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-2xl font-bold text-candy-red">Room Conflict</h2>
          <p className="text-ink/70 text-sm">{roomError}</p>
          <div className="flex flex-col gap-3 w-full mt-2">
            {joinExistingUrl && (
              <ToyButton color="blue" className="w-full text-white" onClick={() => router.push(joinExistingUrl)}>
                Join existing {actualGameType?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())} game
              </ToyButton>
            )}
            <ToyButton color="white" className="w-full" onClick={() => router.push("/")}>
              Back to lobby
            </ToyButton>
          </div>
        </div>
      </div>
    );
  }

  const matchScore: MatchScore | undefined = gameState?.match_score;

  const renderGame = () => {
     switch (gameType) {
       case "tic-tac-toe":
         return <TicTacToe ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "battleships":
         return <Battleships ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "tetris":
         return <Tetris ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "ping-pong":
         return <PingPong ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "connect-four":
         return <ConnectFour ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "rock-paper-scissors":
         return <RockPaperScissors ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "hangman":
         return <Hangman ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "number-duel":
         return <NumberDuel ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "minesweeper":
         return <Minesweeper ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "guess-who":
         return <GuessWho ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "snakes-ladders":
         return <SnakesLadders ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       case "stratego":
         return <Stratego ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
       default:
         return <div className="flex-1 flex flex-col items-center justify-center text-center mt-20 text-rose-500 font-mono">Unknown Game Type: {gameType}</div>;
     }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row w-full max-w-full overflow-hidden">
      {/* Game Area */}
      <div className="flex-1 flex flex-col relative w-full h-screen min-w-0">
        <header className="h-14 shrink-0 px-3 flex items-center gap-2 bg-candy-yellow border-b-[3px] border-ink text-ink relative z-10">
          <ToyButton color="white" size="sm" onClick={() => router.push("/")} aria-label="Back to lobby" className="h-9">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Lobby</span>
          </ToyButton>
          <h1 className="hidden sm:block flex-1 min-w-0 truncate text-center text-lg font-bold capitalize">
            {gameType.replace(/-/g, " ")}
          </h1>
          <div className="flex-1 sm:flex-none flex items-center justify-end gap-2 min-w-0">
            <div className="chunk-sm bg-white font-mono text-xs flex items-center gap-1.5 pl-2.5 pr-1 h-9 min-w-0">
              <span className="truncate" title={roomId}>
                {roomId.length > 8 ? roomId.slice(0, 8) + "…" : roomId}
              </span>
              <button
                type="button"
                onClick={handleCopyInvite}
                aria-label="Copy invite link"
                title="Copy invite link"
                className="shrink-0 flex items-center gap-1 rounded-lg bg-candy-blue/15 hover:bg-candy-blue/30 px-1.5 py-1 font-sans font-bold transition-colors"
              >
                {copyStatus === "copied" ? "Copied! ✓" : copyStatus === "failed" ? "Copy failed" : <Copy size={14} />}
              </button>
            </div>
            <GameHelp gameType={gameType} />
            <SoundToggle />
          </div>
        </header>

        <main className="flex-1 flex flex-col relative z-0 overflow-y-auto overflow-x-hidden bg-toy-stripes">
           {renderGame()}
        </main>
      </div>

      {/* Chat Area — hidden when ?chat=false */}
      {chatEnabled && (
      <div className={`w-full md:h-screen md:w-96 md:min-w-[320px] bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shadow-2xl z-20 transition-all duration-300
        ${chatOpen ? "h-[38vh]" : "h-auto"}`}>
        {/* Chat header — always visible, tap to toggle on mobile */}
        <div
          className="p-3 md:p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-10 flex justify-between items-center cursor-pointer md:cursor-default select-none"
          onClick={() => { setChatOpen(o => !o); setUnreadCount(0); }}
        >
          <div>
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              Room Chat
              {!chatOpen && unreadCount > 0 && (
                <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </h2>
            <p className="text-[10px] md:text-xs text-slate-500">{players.length} player(s) joined</p>
          </div>
          {/* Chevron toggle — mobile only */}
          <span className="md:hidden text-slate-500 text-xs">{chatOpen ? "▼ Hide" : "▲ Show"}</span>
        </div>
        
        {/* Messages + input — always visible on desktop, toggle on mobile */}
        <div className={`flex-col flex-1 overflow-hidden ${chatOpen ? "flex" : "hidden md:flex"}`}>
          <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-4 custom-scrollbar">
            {chatMessages.map((msg, idx) => {
              const isMe = msg.sender === username;
              const isSystem = msg.sender === "System";
              
              if (isSystem) {
                return (
                  <div key={idx} className="flex justify-center my-2 animate-fade-in">
                    <span className="text-[10px] md:text-[11px] font-medium bg-slate-800/80 text-slate-400 px-3 py-1 rounded-full border border-slate-700/50 text-center max-w-[90%]">
                      {msg.message}
                    </span>
                  </div>
                );
              }

              return (
                <div key={idx} className={`flex flex-col animate-fade-in ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-[9px] md:text-[10px] font-medium text-slate-500 mb-1 px-1 uppercase tracking-wider">{msg.sender}</span>
                  <div className={`px-3 py-2 md:px-4 md:py-2 opacity-90 rounded-2xl max-w-[85%] ${
                    isMe 
                      ? "bg-indigo-600 text-slate-100 rounded-tr-sm shadow-md shadow-indigo-900/20" 
                      : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700 shadow-sm"
                  }`}>
                    <p className="text-[13px] md:text-[15px] leading-relaxed break-words">{msg.message}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 md:p-4 bg-slate-950 border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 md:px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 placeholder-slate-500 shadow-inner"
              />
              <button 
                type="submit"
                disabled={!messageInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl p-2 md:p-3 flex items-center justify-center transition-colors shadow-sm"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function RoomLoading() {
  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col items-center justify-center gap-3 w-full">
      <div className="text-6xl animate-bob" aria-hidden="true">🎲</div>
      <p className="font-bold text-lg">Loading room…</p>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={<RoomLoading />}>
      <RoomContent />
    </Suspense>
  )
}
