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
import Avatar from "@/components/ui/Avatar";
import { play } from "@/lib/sound";
import type { MatchScore } from "@/lib/types";

const REACTIONS = ["👏", "😂", "😱", "🔥", "GG"];
const BIG_EMOJI = /^(\p{Extended_Pictographic}|GG){1,3}$/u;

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
  const chatOpenRef = useRef(chatOpen);
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
        setUnreadCount(prev => chatOpenRef.current ? 0 : prev + 1);
        if (data.sender !== resolvedName && data.sender !== "System") play("pop");
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
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !ws) return;

    ws.send(JSON.stringify({ action: "chat", message: messageInput.trim() }));
    setMessageInput("");
  };

  const sendReaction = (reaction: string) => {
    if (!ws) return;
    ws.send(JSON.stringify({ action: "chat", message: reaction }));
    play("pop");
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
         return <div className="flex-1 flex flex-col items-center justify-center text-center mt-20 text-candy-red font-mono">Unknown Game Type: {gameType}</div>;
     }
  };

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col md:flex-row w-full max-w-full overflow-hidden">
      {/* Game Area */}
      <div className={`flex-1 flex flex-col relative w-full h-screen min-w-0 ${chatEnabled && !chatOpen ? "pb-14 md:pb-0" : ""}`}>
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
           {/* Mount the game only once real state arrives so its useOnChange sounds and animations start from it */}
           {gameState ? (
             renderGame()
           ) : (
             <div className="flex-1 flex items-center justify-center text-5xl animate-bob" aria-label="Connecting…">🎲</div>
           )}
        </main>
      </div>

      {/* Chat Area — hidden when ?chat=false. Bottom drawer on phones, side panel on desktop. */}
      {chatEnabled && (
      <aside className={`fixed inset-x-0 bottom-0 z-40 rounded-t-2xl chunk overflow-hidden bg-cream text-ink flex flex-col transition-[height] duration-300
        md:static md:z-20 md:w-80 md:h-screen md:shrink-0 md:rounded-none! md:border-0! md:border-l-[3px]! md:border-ink md:shadow-none!
        ${chatOpen ? "h-[55vh]" : "h-12"}`}>
        {/* Header — the 48px handle on phones, tap to toggle */}
        <button
          type="button"
          aria-expanded={chatOpen}
          onClick={() => { setChatOpen(o => !o); setUnreadCount(0); }}
          className="h-12 shrink-0 px-4 flex items-center justify-between gap-2 bg-candy-pink text-white font-bold border-b-[3px] border-ink select-none md:cursor-default"
        >
          <span className="flex items-center gap-2">
            Room chat 💬
            {!chatOpen && unreadCount > 0 && (
              <span className="md:hidden chunk-sm rounded-full! bg-candy-yellow text-ink text-xs px-2 py-0.5 leading-none">{unreadCount}</span>
            )}
          </span>
          <span className="flex items-center gap-2 text-xs">
            <span className="bg-white/25 rounded-full px-2 py-0.5">👥 {players.length}</span>
            <span className="md:hidden">{chatOpen ? "▼" : "▲"}</span>
          </span>
        </button>

        {/* Messages, reactions and input — always visible on desktop, drawer body on phones */}
        <div className={`flex-col flex-1 min-h-0 ${chatOpen ? "flex" : "hidden md:flex"}`}>
          <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
            {chatMessages.map((msg, idx) => {
              const isMe = msg.sender === username;
              const isSystem = msg.sender === "System";

              if (isSystem) {
                return (
                  <div key={idx} className="flex justify-center animate-fade-in">
                    <span className="text-[11px] font-medium bg-cream-2 text-ink/70 px-3 py-1 rounded-full text-center max-w-[90%]">
                      {msg.message}
                    </span>
                  </div>
                );
              }

              const isBig = BIG_EMOJI.test(msg.message);
              return (
                <div key={idx} className={`flex gap-2 animate-pop ${isMe ? "justify-end" : "justify-start"}`}>
                  {!isMe && <Avatar name={msg.sender} size={22} className="mt-0.5" />}
                  <div className={`flex flex-col min-w-0 max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && <span className="text-[11px] font-bold text-ink/60 mb-0.5 px-1">{msg.sender}</span>}
                    {isBig ? (
                      <p className="text-3xl leading-tight">{msg.message}</p>
                    ) : (
                      <p className={`chunk-sm rounded-2xl px-3 py-1.5 text-sm leading-relaxed wrap-break-word ${
                        isMe ? "bg-candy-blue text-white rounded-br-sm!" : "bg-white text-ink rounded-bl-sm!"
                      }`}>
                        {msg.message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t-[3px] border-ink bg-cream-2 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap" aria-label="Quick reactions">
              {REACTIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => sendReaction(r)}
                  className="btn-toy bg-white px-2.5 py-0.5 text-lg font-bold leading-snug"
                >
                  {r}
                </button>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-w-0 chunk-sm bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-candy-pink"
              />
              <ToyButton type="submit" color="pink" disabled={!messageInput.trim()} aria-label="Send message" className="px-3 text-white">
                <Send size={18} />
              </ToyButton>
            </form>
          </div>
        </div>
      </aside>
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
