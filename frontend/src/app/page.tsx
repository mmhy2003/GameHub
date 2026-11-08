"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameCard from "@/components/GameCard";
import ToyButton from "@/components/ui/ToyButton";
import { GAMES, GAME_CATEGORIES, type GameCategory } from "@/data/games";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params — set by embedding parent via iframe src
  const paramName = searchParams.get("name") ?? "";
  const paramRoom = searchParams.get("room") ?? "";
  // Set when an invitee was bounced here from a room link, so we can send them straight back
  const inviteGame = GAMES.some(g => g.key === searchParams.get("game")) ? searchParams.get("game") : null;
  const chatEnabled = searchParams.get("chat") !== "false";

  const [username, setUsername] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [roomId, setRoomId] = useState(paramRoom);
  const [filter, setFilter] = useState<"All" | GameCategory>("All");

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

  const returnToInvite = () => {
    if (paramRoom && inviteGame) router.push(embedParams(inviteGame, paramRoom));
  };

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000");

  const fetchToken = async (name: string): Promise<string | null> => {
    try {
      const res = await fetch(`${BACKEND}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      if (!res.ok) return null;
      const { token } = await res.json();
      return token as string;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // If name was passed as URL param, use it directly and skip the name form
    if (paramName) {
      const trimmed = paramName.trim();
      localStorage.setItem("gamehub_username", trimmed);
      setUsername(trimmed);
      // Fetch a token for the embedded user
      fetchToken(trimmed).then(token => {
        if (!token) return;
        sessionStorage.setItem("gamehub_token", token);
        returnToInvite();
      });
      setIsNameSet(true);
      return;
    }
    const savedName = localStorage.getItem("gamehub_username");
    const savedToken = sessionStorage.getItem("gamehub_token");
    if (savedName && savedToken) {
      setUsername(savedName);
      setIsNameSet(true);
    }
  }, [paramName]);

  const [tokenError, setTokenError] = useState("");

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    setTokenError("");
    const token = await fetchToken(name);
    if (!token) {
      setTokenError("Couldn't reach the server. Please try again.");
      return;
    }
    localStorage.setItem("gamehub_username", name);
    sessionStorage.setItem("gamehub_token", token);
    setIsNameSet(true);
    returnToInvite();
  };

  const changeName = () => {
    setIsNameSet(false);
    setUsername("");
    localStorage.removeItem("gamehub_username");
  };

  const actionLabel = paramRoom || roomId.trim() ? "Join" : "Create game";
  const visibleGames = GAMES.filter(g => filter === "All" || g.category === filter);

  if (!isNameSet) {
    return (
      <main className="min-h-screen bg-cream text-ink flex items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-md chunk bg-white p-6 md:p-8 animate-pop">
          <span
            aria-hidden
            className="absolute -top-6 -left-4 w-14 h-14 chunk bg-candy-yellow flex items-center justify-center text-3xl -rotate-12"
          >
            🎲
          </span>
          <h1 className="text-3xl font-bold text-center mb-1">GameHub 🎮</h1>
          <h2 className="text-xl font-semibold text-center mb-6">What should we call you?</h2>
          <form onSubmit={handleSaveName} className="space-y-4">
            <label htmlFor="username" className="sr-only">Display Name</label>
            <input
              id="username"
              type="text"
              placeholder="e.g. CoolPlayer99"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full chunk-sm bg-cream px-4 py-3 text-lg font-semibold placeholder-ink/40 focus:outline-none focus:bg-white"
              required
            />
            {tokenError && (
              <p className="text-candy-red text-sm font-semibold text-center">{tokenError}</p>
            )}
            <ToyButton type="submit" color="green" size="lg" className="w-full">
              Let&apos;s play!
            </ToyButton>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream text-ink px-4 sm:px-6 py-6 md:py-10 pb-16">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
        <header className="chunk bg-candy-purple text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold">GameHub 🎮</h1>
            <p className="mt-1 text-base md:text-lg text-white/90">
              Grab a friend and play instantly. No sign-ups required.
            </p>
          </div>
          {paramName ? (
            <span className="self-start md:self-auto chunk-sm bg-white text-ink font-bold px-3 py-1.5">
              Playing as {username}
            </span>
          ) : (
            <button
              type="button"
              onClick={changeName}
              aria-label={`Playing as ${username}. Change name`}
              className="self-start md:self-auto btn-toy bg-white text-ink font-bold px-3 py-1.5"
            >
              Playing as {username} ✏️
            </button>
          )}
        </header>

        {!paramRoom && (
          <section className="chunk bg-candy-yellow p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <label htmlFor="room-code" className="font-bold text-lg shrink-0">Have a room code?</label>
            <input
              id="room-code"
              type="text"
              placeholder="Paste it here, then pick the game"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 min-w-0 chunk-sm bg-white px-4 py-2 font-mono focus:outline-none"
            />
          </section>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter games by category">
          {GAME_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={`btn-toy px-3 py-1 text-sm font-bold ${filter === cat ? "bg-ink text-white" : "bg-white text-ink"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
          {visibleGames.map(game => (
            <GameCard key={game.key} game={game} actionLabel={actionLabel} onPlay={() => navigate(game.key)} />
          ))}
        </div>
      </div>
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
