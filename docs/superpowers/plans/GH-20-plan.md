# GH-20 implementation plan: Playful Toybox redesign

## Goal
Move the lobby, the room shell and all 12 games to the approved "Playful Toybox" look (mockup v2). The work adds:
- shared player cards, a turn banner and a result pop-up
- quick chat reactions
- synthesized sound
- a better phone layout
- two small backend additions: a per-room `match_score` and Minesweeper `revealed_by`

## Architecture
- **Backend.** `GameRoom` in `backend/main.py` keeps a win/draw tally. A `_result_counted` guard makes sure each finished game is counted once. The tally goes into every `game_state` message as `match_score`. `MinesweeperLogic` records which symbol revealed each cell and sends it as `revealed_by`.
- **Frontend theme and shared code.**
  - Tailwind v4 `@theme` tokens and utilities go in `globals.css`. Fredoka is the sans font.
  - Shared, typed helpers go in `frontend/src/lib/`: types, player helpers, sound and the `useOnChange` hook.
  - Presentational components go in `frontend/src/components/ui/`.
- **Room page.** It supplies the layout (header, chat panel or drawer, reactions) and passes the new optional `matchScore` prop.
- **Games.** Each game keeps `{ws, gameState, mySymbol, handleRestart}`, sends the same move messages and renders the shared UI pieces itself.

## Facts about the repo (checked at `79ca7c5`)
- Frontend: Next 16.4.5, React 19.2.4, Tailwind v4 (`@import "tailwindcss"` plus `@theme` in `frontend/src/app/globals.css`), lucide-react. The only path alias is `@/*` → `./src/*`, and `strict` is on. `frontend/src/lib/` does not exist yet.
- Fonts: `frontend/src/app/layout.tsx` loads Geist and Geist_Mono through `next/font/google` into `--font-geist-sans` and `--font-geist-mono`. `@theme` maps `--font-sans` and `--font-mono` to them.
- Room page `frontend/src/app/room/[id]/page.tsx`:
  - Renders the 12 games in a `switch`.
  - The header has the back button, the room id and a username/symbol pill. `GameHelp` floats at the top-left of `<main>`.
  - The chat column is `md:w-96`. On phones the chat body is toggled through `chatOpen`.
  - `?chat=false` hides the chat.
  - When no name or no token is saved, it redirects to `/`.
- Lobby `frontend/src/app/page.tsx` (405 lines) has 12 copy-pasted cards, each with its own room-code input. It supports these URL params:
  - `name`: skips the name form and fetches a token.
  - `room`: hides the code inputs; the buttons read "Join Room".
  - `chat=false`: forwarded to room URLs through `embedParams`.
- `frontend/src/data/gameRules.ts` has `GAME_RULES[key] = {title, icon, objective, rules, tips?}`. `GameHelp.tsx` (props `{gameType}`) renders a portal modal.
- `gameState.symbols` maps **name → symbol**, and `gameState.players` lists the names.

| Game | Symbols |
|---|---|
| TicTacToe | X/O |
| ConnectFour | R/Y |
| RPS, NumberDuel, Battleships, GuessWho, SnakesLadders, Stratego, Minesweeper | A/B |
| Hangman | W/G (the roles are in `setter`/`guesser`) |
| Tetris | P1/P2 |
| PingPong | L/R |

- Games that set `winner`/`is_draw`: tic_tac_toe, connect_four, battleships, hangman, rock_paper_scissors, number_duel, tetris and ping_pong set both. guess_who, snakes_ladders and stratego set `winner` only. Minesweeper has neither; it uses phase `won`/`lost`.
- Ping-Pong is the only game with `needs_server_loop`, through `GameRoom._game_loop`.
- Battleships sends `my_ships` as 17 flat indices (`row*10+col`). Shots are `shots[A|B][idx] = "hit"|"miss"`. Ship identity is never sent.
  - **Decision (human, 2026-11-08):** strike through your **own** fleet chips only, using the groups remembered from placement. The enemy fleet shows a "Hits n / 17" counter.
- There is no test framework. The checks are:
  - `python3 -m compileall backend`
  - `cd frontend && npx tsc --noEmit` (passes today)
  - `cd frontend && npx eslint .`, with a baseline of **94 problems (59 errors, 35 warnings)** that must not grow.

## File map
| File | Action | Responsibility |
|---|---|---|
| `backend/main.py` | modify | `match_score`, `match_draws`, `_result_counted`, `record_result()`; called in the move path and `_game_loop`; guard cleared in `reset_game()`; `match_score` in `broadcast_state()` |
| `backend/games/minesweeper.py` | modify | `revealed_by` grid filled by `reveal` and `_flood_reveal`, cleared in `reset()`, sent in `get_state()` |
| `frontend/src/app/globals.css` | modify | toybox tokens, utilities, keyframes, reduced motion |
| `frontend/src/app/layout.tsx` | modify | Fredoka replaces Geist Sans; cream body |
| `frontend/src/lib/types.ts` | create | `MatchScore`, `GameProps`, `Outcome` |
| `frontend/src/lib/players.ts` | create | `nameForSymbol`, `winsFor`, `scoreLine`, `outcomeFor` |
| `frontend/src/lib/sound.ts` | create | Web Audio synth, `play`, enabled store, `useSound` |
| `frontend/src/lib/useOnChange.ts` | create | runs a callback when a value changes (not on mount) |
| `frontend/src/components/ui/Avatar.tsx` | create | initial in a circle, colour from a hash of the name |
| `frontend/src/components/ui/ToyButton.tsx` | create | chunky button with colour and size variants |
| `frontend/src/components/ui/TurnBanner.tsx` | create | status pill |
| `frontend/src/components/ui/PlayerCards.tsx` | create | two player cards plus VS, active-turn wiggle, match score |
| `frontend/src/components/ui/ResultOverlay.tsx` | create | end-of-game pop-up with confetti, Play again, Lobby |
| `frontend/src/components/ui/SoundToggle.tsx` | create | 🔊/🔇 button |
| `frontend/src/components/GameHelp.tsx` | modify | toybox restyle, compact trigger for the header |
| `frontend/src/app/room/[id]/page.tsx` | modify | header, chat panel/drawer, reactions, screens, `matchScore` prop, redirect keeps the room |
| `frontend/src/data/games.ts` | create | `GAMES` list and `GAME_CATEGORIES` |
| `frontend/src/components/GameCard.tsx` | create | lobby card |
| `frontend/src/app/page.tsx` | modify | name screen, hero, code box, filters, card grid |
| `frontend/src/components/games/*.tsx` (12 files) | modify | per-game redesign |
| `frontend/src/components/games/GuessWhoFace.tsx` | create | SVG face built from traits |
| `frontend/src/components/games/SnakesBoardArt.tsx` | create | SVG snakes and ladders over the board |
| `frontend/src/components/games/StrategoToken.tsx` | create | piece token (front and striped back) |
| `frontend/src/components/games/TetrisWell.tsx` | create | bevelled well renderer, used for both wells |

## Shared contracts (used by all frontend steps)

### Theme tokens (`globals.css`)
```css
@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-fredoka);
  --font-mono: var(--font-geist-mono);

  --color-ink: #2b2240;
  --color-cream: #fff8ec;
  --color-cream-2: #ffefd3;
  --color-candy-blue: #4d96ff;
  --color-candy-pink: #ff6fa8;
  --color-candy-yellow: #ffd23f;
  --color-candy-green: #3ddc84;
  --color-candy-purple: #8b5cf6;
  --color-candy-orange: #ff8c42;
  --color-candy-red: #ff4d4d;

  --shadow-chunk: 4px 4px 0 0 var(--color-ink);
  --shadow-chunk-sm: 2px 2px 0 0 var(--color-ink);

  --animate-pop: pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  --animate-drop: drop 0.45s cubic-bezier(0.5, 0, 0.75, 0) both; /* disc fall, uses --drop-from */
  --animate-bob: bob 1s ease-in-out infinite;
  --animate-wiggle: wiggle 0.9s ease-in-out infinite;
  --animate-confetti: confetti 1.6s ease-in forwards;
  --animate-flip-down: flip-down 0.45s ease-in forwards;
}
```
Utilities in `@layer utilities`:
- `.chunk`: `border: 3px solid var(--color-ink); border-radius: 1rem; box-shadow: var(--shadow-chunk);`
- `.chunk-sm`: the same with 2px borders and `--shadow-chunk-sm`.
- `.btn-toy`: chunk-sm, plus `transition: transform .08s, box-shadow .08s`. On `:active`: `transform: translate(2px,2px); box-shadow: none`. On `:disabled`: `opacity:.5; cursor:not-allowed`.
- `.bg-toy-stripes`: `repeating-linear-gradient(45deg, var(--color-cream) 0 14px, var(--color-cream-2) 14px 28px)`.

Keyframes:
- `pop`: scale 0.3 → 1.1 → 1.
- `drop`: translateY(var(--drop-from, -300px)) → 0, with a small bounce at 85%.
- `bob`: translateY 0 / -6px.
- `wiggle`: rotate -2deg / 2deg.
- `confetti`: translateY(-10vh) rotate(0) → translateY(100vh) rotate(720deg), opacity → 0.
- `flip-down`: rotateX(0) → rotateX(180deg).

Keep the existing `fadeIn`, `scaleIn`, `bounceShort`, `.animate-*` and `.game-btn`. Recolour `.custom-scrollbar` to ink and cream. Add:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-wiggle, .animate-bob, .animate-confetti, .animate-drop { animation: none !important; }
}
```

### `frontend/src/lib/types.ts`
```ts
export interface MatchScore { wins: Record<string, number>; draws: number; }
export type Outcome = "win" | "lose" | "draw" | "spectator";
export interface GameProps {
  ws: WebSocket;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameState: any;
  mySymbol: string | null;
  handleRestart: () => void;
  matchScore?: MatchScore;
}
```

### `frontend/src/lib/players.ts`
```ts
import type { MatchScore, Outcome } from "./types";
type WithSymbols = { symbols?: Record<string, string> } | null | undefined;
export function nameForSymbol(gs: WithSymbols, symbol: string | null | undefined): string | undefined {
  if (!gs?.symbols || !symbol) return undefined;
  return Object.keys(gs.symbols).find(n => gs.symbols![n] === symbol);
}
export const winsFor = (ms: MatchScore | undefined, symbol: string) => ms?.wins?.[symbol] ?? 0;
export const scoreLine = (ms: MatchScore | undefined, a: string, b: string) => `${winsFor(ms, a)} – ${winsFor(ms, b)}`;
export function outcomeFor(winner: string | null | undefined, isDraw: boolean, mySymbol: string | null): Outcome {
  if (isDraw) return "draw";
  if (!mySymbol) return "spectator";
  return winner === mySymbol ? "win" : "lose";
}
```
Spectator title convention: `` `${nameForSymbol(gs, winner) ?? "Player " + winner} wins!` ``. For a player: "You win! 🎉", "You lose 😢" or "It's a draw!".

### `frontend/src/lib/sound.ts`
```ts
"use client";
import { useEffect, useSyncExternalStore } from "react";

export type SoundName = "click" | "place" | "drop" | "hit" | "miss" | "pop" | "dice" | "turn" | "win" | "lose";
const STORAGE_KEY = "gamehub_sound";
type Note = { freq: number; to?: number; at: number; dur: number; type?: OscillatorType; gain?: number };
const tones = (freqs: number[], step: number, dur: number, type: OscillatorType): Note[] =>
  freqs.map((freq, i) => ({ freq, at: i * step, dur, type }));
const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ freq: 660, at: 0, dur: 0.05, type: "square", gain: 0.06 }],
  place: [{ freq: 520, to: 780, at: 0, dur: 0.09, type: "triangle" }],
  drop:  [{ freq: 700, to: 180, at: 0, dur: 0.18 }, { freq: 140, at: 0.17, dur: 0.06, type: "square", gain: 0.08 }],
  hit:   [{ freq: 160, to: 60, at: 0, dur: 0.25, type: "sawtooth", gain: 0.12 }],
  miss:  [{ freq: 900, to: 300, at: 0, dur: 0.2, gain: 0.08 }],
  pop:   [{ freq: 1200, to: 200, at: 0, dur: 0.08, type: "square", gain: 0.1 }],
  dice:  tones([300, 420, 360, 480], 0.06, 0.04, "square"),
  turn:  tones([880, 1320], 0.1, 0.14, "sine"),
  win:   tones([523, 659, 784, 1047], 0.11, 0.16, "triangle"),
  lose:  tones([392, 330, 262], 0.16, 0.22, "sine"),
};

let ctx: AudioContext | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();

export function isSoundEnabled(): boolean {
  if (enabled === null) {
    try { enabled = localStorage.getItem(STORAGE_KEY) !== "off"; } catch { enabled = true; }
  }
  return enabled;
}
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try { localStorage.setItem(STORAGE_KEY, on ? "on" : "off"); } catch { /* storage blocked */ }
  listeners.forEach(l => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

export function play(name: SoundName) {
  if (!isSoundEnabled()) return;
  unlockAudio();
  if (!ctx || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime;
    for (const n of SOUNDS[name]) {
      const t = now + n.at;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type ?? "sine";
      osc.frequency.setValueAtTime(n.freq, t);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(n.gain ?? 0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + n.dur + 0.02);
    }
  } catch { /* never throw from sound */ }
}

export function useSound() {
  const on = useSyncExternalStore(subscribe, isSoundEnabled, () => true);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  return { enabled: on, toggle: () => setSoundEnabled(!on), play };
}
```

### `frontend/src/lib/useOnChange.ts`
```ts
import { useEffect, useRef } from "react";
/** Calls onChange(next, prev) when value changes after mount (Object.is). Never on the first render. */
export function useOnChange<T>(value: T, onChange: (next: T, prev: T) => void) {
  const prev = useRef(value);
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });
  useEffect(() => {
    if (!Object.is(prev.current, value)) {
      const p = prev.current;
      prev.current = value;
      cb.current(value, p);
    }
  }, [value]);
}
```
Standard game sound pattern:
```ts
const isMyTurn = !!mySymbol && currentTurn === mySymbol && !over;
useOnChange(isMyTurn, now => { if (now) play("turn"); });
useOnChange(moveCount, (n, p) => { if (n > p) play("place"); });
```

### UI component props
```ts
// Avatar.tsx
export const AVATAR_COLORS = ["bg-candy-blue","bg-candy-pink","bg-candy-yellow","bg-candy-green","bg-candy-purple","bg-candy-orange"] as const;
export function avatarColor(name: string): string; // sum of char codes (or a djb2 hash) % 6
export default function Avatar(p: { name: string; size?: number /*px, default 40*/; className?: string }): JSX.Element;
// circle, chunk-sm border, bold uppercase first letter, "?" when name is empty

// ToyButton.tsx
export type ToyColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange" | "white";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: ToyColor; size?: "sm" | "md" | "lg" };
// default color "yellow", size "md"; className "btn-toy font-bold text-ink rounded-xl ..." with a static map color→bg-candy-*
// onClick wrapper calls play("click") and then props.onClick

// TurnBanner.tsx
export default function TurnBanner(p: { tone?: "mine" | "wait" | "good" | "bad" | "info"; children: React.ReactNode }): JSX.Element;
// mine = green + animate-wiggle, wait = white, good = yellow, bad = red/white text, info = blue. rounded-full chunk-sm px-5 py-2 font-bold

// PlayerCards.tsx
export interface PlayerSlot { symbol: string; subtitle?: React.ReactNode; token?: React.ReactNode }
export default function PlayerCards(p: {
  gameState: { symbols?: Record<string, string> } | null;
  mySymbol: string | null;
  players: [PlayerSlot, PlayerSlot];
  activeSymbol?: string | null;   // whose turn; that card gets bg-candy-green + animate-wiggle
  matchScore?: MatchScore;
  showScore?: boolean;            // default true; shows winsFor(matchScore, symbol)
  centerLabel?: React.ReactNode;  // default "VS"
}): JSX.Element;
// Name = nameForSymbol(gameState, symbol) ?? "Waiting…"; " (you)" when symbol === mySymbol.
// Layout: flex row, cards flex-1 max-w-[220px]; on <sm the subtitle is hidden and avatars are 32px.

// ResultOverlay.tsx
export default function ResultOverlay(p: {
  open: boolean;
  outcome: Outcome;
  title: string;
  subtitle?: React.ReactNode;     // e.g. scoreLine(...) or "The word was BANANA"
  children?: React.ReactNode;     // optional extra content (Guess Who card, Hangman word)
  onPlayAgain: () => void;
  playAgainLabel?: string;        // default "Play again"
}): JSX.Element | null;
// fixed inset-0 z-[150] bg-ink/40; card chunk bg-cream animate-pop; 24 confetti <span>s (positions from the index, colours cycle candy) only when outcome==="win".
// Buttons: ToyButton green "Play again" → onPlayAgain; ToyButton white "Lobby" → router.push("/"); small "👀 See board" link hides it until open goes false then true again.
// Sound: useOnChange(open, o => o && play(outcome === "lose" ? "lose" : "win")); when it is already open on mount, play nothing.
// Visible to spectators (the backend lets anyone restart).

// SoundToggle.tsx
export default function SoundToggle(): JSX.Element; // uses useSound(); 🔊/🔇, aria-label "Mute sounds"/"Unmute sounds", btn-toy bg-white w-9 h-9
```

### `frontend/src/data/games.ts`
```ts
export type GameCategory = "Classic" | "Quick" | "Action" | "Strategy" | "Words" | "Co-op" | "Luck" | "Deduction";
export type Accent = "blue" | "pink" | "yellow" | "green" | "purple" | "orange";
export interface GameInfo { key: string; title: string; description: string; cover: string; emoji: string; category: GameCategory; playTime: string; accent: Accent; }
export const GAME_CATEGORIES: ("All" | GameCategory)[] = ["All","Classic","Quick","Action","Strategy","Words","Co-op","Luck","Deduction"];
export const GAMES: GameInfo[] = [ /* in today's lobby order, descriptions copied verbatim from page.tsx */ ];
```
| key | title | cover | emoji | category | playTime | accent |
|---|---|---|---|---|---|---|
| tic-tac-toe | Tic-Tac-Toe | /games/tic_tac_toe_cover.png | ⭕ | Classic | 2 min | purple |
| battleships | Battleships | /games/battleships_cover.png | 🚢 | Strategy | 10 min | blue |
| tetris | Tetris | /games/tetris_cover.png | 🟦 | Action | 5 min | purple |
| ping-pong | Ping-Pong | /games/pong_cover.png | 🏓 | Action | 4 min | orange |
| connect-four | Connect Four | /games/connect_four_cover.png | 🔴 | Classic | 5 min | blue |
| rock-paper-scissors | Rock Paper Scissors | /games/rps_cover.png | ✊ | Quick | 2 min | pink |
| hangman | Hangman | /games/hangman_cover.png | 🎈 | Words | 5 min | yellow |
| number-duel | Number Duel | /games/number_duel_cover.png | 🔢 | Quick | 3 min | orange |
| minesweeper | Minesweeper | /games/minesweeper_cover.png | 💣 | Co-op | 8 min | green |
| guess-who | Guess Who | /games/guess_who_cover.png | 🎭 | Deduction | 8 min | pink |
| snakes-ladders | Snakes & Ladders | /games/snakes_ladders_cover.png | 🐍 | Luck | 10 min | green |
| stratego | Stratego Lite | /games/stratego_cover.png | ⚔️ | Strategy | 15 min | orange |

### Backend check script (scratch, NOT committed: write it to `/tmp/gh20_check_backend.py`)
```python
# Run from backend/:  python3 /tmp/gh20_check_backend.py
import asyncio, sys
sys.path.insert(0, ".")
from main import GameRoom
from games.minesweeper import MinesweeperLogic, ROWS, COLS

class FakeWS:
    def __init__(self): self.sent = []
    async def send_json(self, data): self.sent.append(data)

def seat(room):
    a, b = FakeWS(), FakeWS()
    room.players = [a, b]
    room.player_sessions = {a: "sa", b: "sb"}
    room.session_names = {"sa": "Ann", "sb": "Bob"}
    return a, b

async def check_match_score():
    room = GameRoom("r1", "tic-tac-toe")
    a, _ = seat(room)
    room.player_symbols = {"sa": "X", "sb": "O"}
    await room.broadcast_state()
    assert a.sent[-1]["match_score"] == {"wins": {}, "draws": 0}, a.sent[-1].get("match_score")
    for sid, idx in [("sa", 0), ("sb", 3), ("sa", 1), ("sb", 4), ("sa", 2)]:
        assert room.make_move(sid, index=idx)
    assert room.record_result() is True
    assert room.record_result() is False          # counted once
    await room.broadcast_state()
    assert a.sent[-1]["match_score"] == {"wins": {"X": 1}, "draws": 0}
    room.reset_game()
    assert room.match_score == {"X": 1} and room._result_counted is False
    for sid, idx in [("sa",0),("sb",1),("sa",2),("sb",4),("sa",3),("sb",5),("sa",7),("sb",6),("sa",8)]:
        assert room.make_move(sid, index=idx)
    assert room.record_result() is True
    assert room.match_draws == 1 and room.match_score == {"X": 1}
    print("match_score OK")

def check_revealed_by():
    m = MinesweeperLogic()
    assert all(v is None for row in m.get_state()["revealed_by"] for v in row)
    assert m.make_move("A", action_type="reveal", row=0, col=0)
    s = m.get_state()
    owned = [(r, c) for r in range(ROWS) for c in range(COLS) if s["revealed_by"][r][c]]
    assert len(owned) == m.revealed_count > 1, (len(owned), m.revealed_count)   # flood fill
    assert all(s["revealed_by"][r][c] == "A" for r, c in owned)
    r, c = next((r, c) for r in range(ROWS) for c in range(COLS)
                if not m.revealed[r][c] and m.board[r][c] >= 0)
    assert m.make_move("B", action_type="reveal", row=r, col=c)
    assert m.get_state()["revealed_by"][r][c] == "B"
    m.reset()
    assert all(v is None for row in m.get_state()["revealed_by"] for v in row)
    print("revealed_by OK")

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "score"): asyncio.run(check_match_score())
    if which in ("all", "mines"): check_revealed_by()
```
If `fastapi`/`jwt` are not installed locally:
```
python3 -m venv /tmp/gh20-venv && /tmp/gh20-venv/bin/pip install -r backend/requirements.txt
```
Then use `/tmp/gh20-venv/bin/python` instead of `python3`.

### Frontend check commands (every frontend step)
```
cd frontend
npm ci                      # only if node_modules is missing
npx tsc --noEmit            # must exit 0
npx eslint . 2>&1 | tail -n 3   # must report <= 94 problems (baseline "✖ 94 problems (59 errors, 35 warnings)")
```
Manual run:
- `cd backend && uvicorn main:app --reload --port 8000`
- `cd frontend && npm run dev`, then open http://localhost:3000.
- Use two browser windows (or a normal and a private window) for the two players and a third for a spectator. Use DevTools device mode at 375px for the phone layout.

---

## Steps

### 1. Backend: per-room match tally (`match_score`)
Files: `backend/main.py`.
- **Failing check first.** Write `/tmp/gh20_check_backend.py` (the script above), then run `cd backend && python3 /tmp/gh20_check_backend.py score`. Expected failure: a `KeyError`/`AssertionError` on `match_score`.
- **Implementation.**
  - In `GameRoom.__init__`, add `self.match_score: Dict[str, int] = {}`, `self.match_draws: int = 0` and `self._result_counted: bool = False`.
  - Add the method below:
    ```python
    def record_result(self) -> bool:
        """Count the finished game once. Returns True only when it counted now."""
        gl = self.game_logic
        if not gl or self._result_counted:
            return False
        winner = getattr(gl, "winner", None)
        if winner:
            self.match_score[winner] = self.match_score.get(winner, 0) + 1
        elif getattr(gl, "is_draw", False):
            self.match_draws += 1
        else:
            return False
        self._result_counted = True
        return True
    ```
  - `reset_game()`: after `self.game_logic.reset()`, set `self._result_counted = False`. Keep the tally.
  - `_game_loop`: call `self.record_result()` right after `self.game_logic.tick()` and before `await self.broadcast_state()`.
  - Move path in `websocket_endpoint`: inside `if success:` and before either `broadcast_state()`, call `room.record_result()`. The `match_score` must already be updated in the state message that announces the win.
  - `broadcast_state()`: add `"match_score": {"wins": dict(self.match_score), "draws": self.match_draws}` to the `game_state.update({...})` dict.
- **Verify.** Run `python3 /tmp/gh20_check_backend.py score` and expect "match_score OK". Then run `python3 -m compileall -q backend` and expect exit 0.
- **Commit.** `feat(backend): track per-room match score across restarts (GH-20)`

### 2. Backend: Minesweeper `revealed_by`
Files: `backend/games/minesweeper.py`.
- **Failing check.** `cd backend && python3 /tmp/gh20_check_backend.py mines` fails with `KeyError: 'revealed_by'`.
- **Implementation.**
  - `__init__` and `reset()`: `self.revealed_by: list[list[str | None]] = [[None] * COLS for _ in range(ROWS)]`.
  - `_flood_reveal(self, row, col, symbol)`: set `self.revealed_by[row][col] = symbol` next to `self.revealed[row][col] = True`, and pass `symbol` in the recursive call.
  - In `make_move` `reveal`: the mine branch sets `self.revealed_by[row][col] = symbol`, and the normal branch calls `self._flood_reveal(row, col, symbol)`. `flag` does not set an owner.
  - `get_state()`: add `"revealed_by": [row[:] for row in self.revealed_by]`.
- **Verify.** `python3 /tmp/gh20_check_backend.py` prints both OK lines, and `python3 -m compileall -q backend` succeeds. Delete `/tmp/gh20_check_backend.py` only after step 2 passes; it is never committed.
- **Commit.** `feat(minesweeper): record which player revealed each tile (GH-20)`

### 3. Theme foundation: tokens, utilities, keyframes and the Fredoka font
Files: `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`.
- **Baseline first.** Run `cd frontend && npx eslint . 2>&1 | tail -n 3` and note the number (expected 94).
- `globals.css`: apply the "Theme tokens" contract above exactly. Keep `fadeIn`, `scaleIn`, `bounceShort` and their `.animate-*` classes, `.custom-scrollbar` (recoloured thumb `#2b2240`, hover `#8b5cf6`) and `.game-btn`.
- `layout.tsx`:
  - Replace the `Geist` import with `Fredoka` (`import { Fredoka, Geist_Mono } from "next/font/google"`).
  - `const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });` (it is a variable font, so no weight list is needed).
  - `<html className={`${fredoka.variable} ${geistMono.variable} h-full antialiased`}>`
  - `<body className="min-h-full flex flex-col bg-cream text-ink font-sans">`
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer.
- **Manual check.** `npm run dev`. The lobby text renders in Fredoka. The page still looks dark, because the pages set their own `bg-slate-950`; that is expected until steps 6 to 8. In DevTools, `bg-candy-pink` and `shadow-chunk` resolve when added to an element.
- **Commit.** `feat(ui): add Playful Toybox theme tokens and Fredoka font (GH-20)`

### 4. Shared lib: types, player helpers, sound engine and `useOnChange`
Files to create: `frontend/src/lib/types.ts`, `frontend/src/lib/players.ts`, `frontend/src/lib/sound.ts`, `frontend/src/lib/useOnChange.ts`, `frontend/src/components/ui/SoundToggle.tsx`.
- **Failing check first.** Create `SoundToggle.tsx` importing `useSound` from `@/lib/sound`. Run `npx tsc --noEmit` and expect "Cannot find module '@/lib/sound'".
- **Implementation.** Copy the four lib contracts above verbatim, then build `SoundToggle` to its contract.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Then make a temporary manual check that is not committed: render `<SoundToggle/>` in `room/[id]/page.tsx`, and in the browser console after a click run:
  ```
  import("/_next/static/...")
  ```
  This is not needed; instead temporarily add `onClick={() => play("win")}` on some button. You hear the jingle. After toggling mute, `localStorage.gamehub_sound === "off"` and the button is silent. Revert the temporary code.
- **Commit.** `feat(ui): add shared game types, player helpers and synthesized sounds (GH-20)`

### 5. Shared UI components
Files to create in `frontend/src/components/ui/`: `Avatar.tsx`, `ToyButton.tsx`, `TurnBanner.tsx`, `PlayerCards.tsx`, `ResultOverlay.tsx`.
- **Failing check first.** Write `PlayerCards.tsx` importing `Avatar` and `@/lib/players`. tsc fails until `Avatar.tsx` exists.
- **Implementation.** Follow the "UI component props" contract exactly.
  - Use static Tailwind class strings in maps, never string-built classes, so that Tailwind can see them.
  - ResultOverlay uses `useRouter` from `next/navigation`, `ToyButton`, `play` and `useOnChange`.
  - Confetti: 24 `<span className="absolute top-0 w-2 h-3 rounded-sm animate-confetti" style={{ left: `${(i*37)%100}%`, animationDelay: `${(i%8)*0.08}s` }}/>`, with the colour from `AVATAR_COLORS[i % 6]`.
  - The overlay is `role="dialog" aria-modal="true"`, and the title is an `<h2>`.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. The visual check happens in step 9, when TicTacToe uses these components.
- **Commit.** `feat(ui): add PlayerCards, TurnBanner, ResultOverlay, ToyButton and Avatar (GH-20)`

### 6. Room shell: header, screens, help restyle and the `matchScore` prop
Files: `frontend/src/app/room/[id]/page.tsx`, `frontend/src/components/GameHelp.tsx`.
- **Failing check first.** In `renderGame()`, add `matchScore={matchScore}` to `<TicTacToe …/>`. tsc fails because `TicTacToeProps` has no `matchScore`. Fix it by changing `TicTacToe.tsx` to `import type { GameProps } from "@/lib/types"` and using `GameProps` as its props type; this is the only TicTacToe change in this step. Then do the same for the other 11 games: replace each local `XxxProps` interface with `GameProps`, keeping the destructuring as it is.
- Add `const matchScore: MatchScore | undefined = gameState?.match_score;` and pass `matchScore={matchScore}` to all 12 games.
- **Header** (`bg-candy-yellow border-b-[3px] border-ink`, `h-14`, `px-3`, flex):
  - Left: back `ToyButton` white (ArrowLeft, with "Lobby" hidden on phones).
  - Centre: `GAMES`-free title text `gameType.replace(/-/g," ")`, capitalised and hidden below sm.
  - Room pill `chunk-sm bg-white font-mono` showing `roomId` (truncate to 8 characters) plus a copy button. The copy button writes `${window.location.origin}/room/${roomId}?game=${gameType}` with `navigator.clipboard.writeText`, then shows "Copied! ✓" for 1.5 s; on error it shows "Copy failed".
  - Right: `<GameHelp gameType={gameType} />` and `<SoundToggle />`.
  - Remove the username/symbol pill (PlayerCards now shows the names) and the floating help `div` in `<main>`.
- **GameHelp restyle.** The trigger becomes a `btn-toy bg-white w-9 h-9` "?" button with `aria-label="How to play"`. The modal panel uses `chunk bg-cream text-ink`, the header strip `bg-candy-purple text-white`, rules as a numbered list with yellow bullets, and tips in a `bg-candy-green/20` box. Keep the portal, the close button and the escape/backdrop behaviour.
- **Screens.**
  - Loading and Suspense fallback: `bg-cream`, a bouncing 🎲 (`animate-bob`) and "Loading room…".
  - Conflict: `chunk bg-white` card with a ⚠️, a red title, and the existing two actions as `ToyButton` (blue "Join existing …", white "Back to lobby").
- **Redirect.** For the two initial redirects (no name, no token), use `router.push(`/?room=${encodeURIComponent(roomId)}`)` so that an invited player keeps the room code. `UNAUTHORIZED` stays `/`.
- The main area gets `bg-toy-stripes`.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually: the header works on desktop and at 375px; the copied link opens the room in a fresh private window after you enter a name; the conflict screen shows on a type mismatch; the help modal opens.
- **Commit.** `feat(room): toybox header with invite copy, help and sound toggle (GH-20)`

### 7. Room chat: pink side panel, phone drawer and quick reactions
Files: `frontend/src/app/room/[id]/page.tsx`.
- **Panel.** On desktop it is `md:w-80 md:h-screen bg-cream border-l-[3px] border-ink`. The header is `bg-candy-pink text-white font-bold`, with "Room chat 💬", the `players.length` count and an unread badge (yellow). On phones it is a fixed bottom drawer (`fixed inset-x-0 bottom-0 z-40 rounded-t-2xl chunk`). It is collapsed by default to a 48px handle with the unread badge, and opens to `h-[55vh]` with the existing `chatOpen` toggle. While the drawer is collapsed, the game area gets `pb-14` so nothing is hidden.
- **Unread fix (needed for the badge).** `onmessage` reads a stale `chatOpen`. Keep a `chatOpenRef` updated in an effect and use `chatOpenRef.current` there.
- **Bubbles.**
  - Mine: `bg-candy-blue text-white rounded-2xl rounded-br-sm chunk-sm`.
  - Others: `bg-white` with an `Avatar size={22}` and the sender name.
  - System: a small `bg-cream-2` pill.
  - A message that is only one to three emoji or "GG" (`/^(\p{Extended_Pictographic}|GG){1,3}$/u`) renders at text-3xl without a bubble.
- **Quick reactions.** `const REACTIONS = ["👏", "😂", "😱", "🔥", "GG"];` They appear as a row of `btn-toy bg-white` chips above the input. Clicking one sends `ws.send(JSON.stringify({ action: "chat", message: r }))` and plays `"pop"`. There is no backend change.
- Input `chunk-sm bg-white`, send `ToyButton` pink with the `Send` icon. Incoming non-system messages from others play `"pop"`. `?chat=false` still removes the whole panel, reactions included.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually with two windows: reactions appear on both sides; the unread badge counts while the drawer is closed on phones; `?chat=false` hides everything.
- **Commit.** `feat(room): toybox chat panel, phone drawer and quick reactions (GH-20)`

### 8. Lobby: GAMES data, GameCard, join box, filters and name screen
Files: create `frontend/src/data/games.ts` and `frontend/src/components/GameCard.tsx`; modify `frontend/src/app/page.tsx`.
- **Failing check first.** In `page.tsx`, import `GAMES` from `@/data/games` and `GameCard`. tsc fails until both exist.
- `games.ts`: follow the contract and table in the plan. Copy each description verbatim from the current card `<p>`.
- `GameCard` props:
  ```ts
  { game: GameInfo; actionLabel: string; onPlay: () => void }
  ```
  - Layout: `chunk bg-white` with `hover:-translate-y-1`. The cover `<img>` sits in an `h-36` frame with the accent background, and the emoji is in a corner sticker.
  - The title, the description (line-clamp-2) and the chips (category and ⏱ playTime) follow.
  - A `ToyButton` with the accent colour shows `actionLabel`.
  - Keep a static map from accent to `bg-candy-*`.
- `page.tsx`:
  - **Delete all 12 card blocks.** Keep `embedParams`, `navigate`, `fetchToken`, the name `useEffect` and `handleSaveName` unchanged in behaviour.
  - **Name screen.** `bg-cream` with a chunk card, a 🎲 sticker, "What should we call you?", the input `chunk-sm` and a green "Let's play!" button. Keep `tokenError`.
  - **Hero.** `bg-candy-purple text-white chunk` with "GameHub 🎮", a tagline, and the chip "Playing as <name> ✏️". When `!paramName`, clicking it runs the existing change-name reset; when `paramName` is set it is plain text.
  - **One "Have a room code?" box** (`chunk bg-candy-yellow`) with an input bound to `roomId`. Hide it when `paramRoom` is set.
  - **Filter chips** from `GAME_CATEGORIES`, with `useState<"All" | GameCategory>("All")`. The active chip is `bg-ink text-white`.
  - **Grid.** `grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl` over `GAMES.filter(g => filter === "All" || g.category === filter)`.
  - Each card has `actionLabel = paramRoom || roomId.trim() ? "Join" : "Create game"` and `onPlay={() => navigate(game.key)}`.
- **Verify.** `npx tsc --noEmit` passes. eslint shows 94 problems or fewer; it will likely drop, because the old card blocks with unescaped quotes are deleted. Manually:
  - all 12 games open the correct room
  - the filters work
  - `/?name=Sam` skips the name screen and shows "Playing as Sam"
  - `/?room=abc` hides the code box and the buttons read "Join"
  - `/?chat=false` forwards `chat=false`
  - the 375px layout is a single column
- **Commit.** `feat(lobby): data-driven toybox lobby with join box and category filters (GH-20)`

### 9. Games: Tic-Tac-Toe and Connect Four
Files: `frontend/src/components/games/TicTacToe.tsx`, `ConnectFour.tsx`.
- **Shared pattern (used again in steps 10 to 18).**
  - At the top: `PlayerCards` (with `activeSymbol={over ? null : currentTurn}` and `matchScore`) and `TurnBanner`.
  - For players: "🎉 Your turn!" with tone "mine", or "Waiting for {name}…" with tone "wait". For spectators: "{name}'s turn" with tone "info".
  - At the end: `ResultOverlay` with `outcome={outcomeFor(winner, isDraw, mySymbol)}`, the title from the plan's spectator convention, `subtitle={scoreLine(matchScore, a, b)}` and `onPlayAgain={handleRestart}`. The old win/draw boxes are deleted.
  - Sounds: the `useOnChange` pattern from the plan.
- **Tic-Tac-Toe.**
  - The board is `bg-candy-purple chunk p-3` with `grid-cols-3 gap-3`. Tiles are `bg-white rounded-2xl`, sized `w-[min(26vw,7.5rem)]` and square.
  - X marks are `text-candy-blue`, O marks `text-candy-pink`, both with a heavy text-stroke/shadow and `animate-pop`.
  - On hover over an empty tile on your turn, show a ghost of your mark at `opacity-25`.
  - Compute the winning line client-side from the 8 lines; its tiles get `bg-candy-yellow`.
  - Sounds: `play("place")` when the filled-cell count rises.
  - The move message stays `{action:"move", index}`.
- **Connect Four.**
  - The board is `bg-candy-blue chunk`. Holes are `bg-cream` circles with an inset shadow, sized `w-[min(11vw,3.5rem)]`.
  - R discs are `bg-candy-red` and Y discs `bg-candy-yellow`, both with an ink border.
  - A new disc animates with `animate-drop` and `style={{"--drop-from": `-${(row+1)*110}%`} as React.CSSProperties}`. Find it by diffing against the previous board, kept in a `useRef`.
  - Over the `hoverCol` column on my turn: a bobbing ▼ arrow (`animate-bob`) and a 40% preview disc in the lowest empty hole.
  - Winning four: compute client-side and add `animate-pulse ring-4 ring-white`.
  - Sounds: `play("drop")` when the disc count rises.
  - The move message stays `{action:"move", col}`.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manual check with 2 players and a spectator:
  - the turn wiggle
  - the overlay for the win, the loss and the spectator ("Ann wins!"), and for a draw
  - after Play again the score reads 1 – 0, and it survives a page refresh
  - the phone fits at 375px
  - with reduced motion on, nothing wiggles or bobs
- **Commit.** `feat(games): toybox Tic-Tac-Toe and Connect Four (GH-20)`

### 10. Games: Rock Paper Scissors and Number Duel
Files: `RockPaperScissors.tsx`, `NumberDuel.tsx`.
Both games: `PlayerCards` with A/B. The subtitle is ❤️ hearts: 3 hearts per player, with lost hearts (`scores[opponent]`) shown as 🤍. `matchScore` counts finished matches. `ResultOverlay` subtitle: `${scores.A} – ${scores.B}` for this match plus `scoreLine` for the matches. The final round goes straight to `finished` (the backend skips `reveal`), so the overlay must show `last_result` (both picks, and both pins for Number Duel) as `children`.
- **RPS.**
  - Three big hand cards (✊ ✋ ✌️ with labels), each `chunk bg-white w-[min(28vw,8rem)]`. The selected card gets `-translate-y-3 rotate-[-4deg] bg-candy-yellow`.
  - After you pick, show "Locked in! Waiting…".
  - Phase `reveal`: two cards flip in (`animate-pop`) with a "VS" burst in the middle. The round winner card gets a green ring, the loser card grey; a tie shows "Tie!".
  - Next round uses the existing `next_round` message, as a `ToyButton`.
  - Delete the unused `showReveal` state.
  - Sounds: `pop` when you pick, `hit` on reveal.
  - Messages are unchanged: `{action:"move", choice}` and `{action:"move", action_type:"next_round"}`.
- **Number Duel.**
  - A big number display (`text-6xl font-bold chunk bg-white`) with −10/−1/+1/+10 `ToyButton`s that clamp to 1..100, plus the existing slider restyled with `accent-candy-purple`.
  - The green "Lock it in 🔒" button sends `{action:"move", action_type:"pick", number: pick}`.
  - Reveal number line: a 1..100 track with a 🎯 at `target` and two pins (avatar colour plus initial) at the picks. The closer pin (`round_winner`) glows (`ring-4 ring-candy-yellow animate-pop`). Show the differences.
  - The next round message is unchanged.
  - Sounds: `click` on the ± buttons, `place` when locking in, `hit` on reveal.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually: play both games to the end; the hearts drain correctly; the final round's picks appear in the overlay; the spectator view works; it works at 375px.
- **Commit.** `feat(games): toybox Rock Paper Scissors and Number Duel (GH-20)`

### 11. Game: Hangman with balloons
Files: `Hangman.tsx`.
- Delete `HangmanSVG` and the hard-coded `MAX_WRONG`. Use `max_wrong` from the state, with a fallback of 6.
- **Balloon bunch.** `max_wrong` balloons, each an SVG ellipse plus string in a candy colour, held by a small figure 🧸. Balloon `i` is popped when `i < wrong_guesses`: it shows a 💥 `animate-pop` and then disappears. The rest bob gently (`animate-bob`, each with a different delay).
- **Word tiles.** Build them from `display_word.split(" ")`: each tile is `chunk-sm bg-white w-[min(9vw,2.75rem)]`. A revealed letter pops in. On finish, show `revealed_word`.
- **Keyboard.** A–Z `btn-toy` keys. A guessed key in the word is `bg-candy-green`; a guessed key not in the word is `bg-candy-red/60 line-through`. Disabled when it is not the guesser's turn.
  - A key is in the word when `display_word` contains the letter. A guessed letter that is not in `display_word` is wrong.
  - Sends `{action:"move", action_type:"guess_letter", letter}`.
- **Setter screen.** `chunk bg-candy-yellow` card titled "Pick a secret word 🤫". The input is `type={peek ? "text" : "password"}`, with a 👁 peek toggle and a letter count. Validation is 2–20 letters A–Z, as in the existing rule. It sends `set_word` unchanged, and keeps the `swap_roles` button.
- **Banners.** The guesser sees "Guess the word!" and the setter sees "{name} is guessing…".
- **PlayerCards.** W/G; the subtitle shows the role ("🤫 Setter" / "🔍 Guesser"); `activeSymbol` is the guesser while guessing and the setter while setting.
- **ResultOverlay.** Children: "The word was **WORD**" and the existing roles-swap note.
- **Sounds.** `pop` when `wrong_guesses` rises, `place` when the number of revealed letters rises.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually: set a word; balloons pop on misses; keys colour correctly; win and loss both work; roles swap after Play again; works at 375px.
- **Commit.** `feat(games): toybox Hangman with popping balloons (GH-20)`

### 12. Game: Guess Who with illustrated faces
Files: create `frontend/src/components/games/GuessWhoFace.tsx`; modify `GuessWho.tsx`.
- **`GuessWhoFace`.** Props are `{ character: (typeof CHARACTERS)[number]; size?: number }`.
  - Move the existing `CharacterAvatar` SVG and the `SKIN_COLORS`/`HAIR_COLORS`/`EYE_COLORS` maps out of `GuessWho.tsx` into it, and upgrade the art: a round face on a candy background circle (colour from `character.id % 6`), ink 2px strokes.
  - Hair by `hair_style`: short, long, curly or bald, using `hair_color`.
  - Optional parts: `glasses`, `hat` (a beanie in a candy colour), `facial_hair` (beard or mustache), `earrings`, `freckles`, and eyes in the `eyes` colour.
  - Use `viewBox="0 0 100 100"`. Keep the `export const CHARACTERS` in `GuessWho.tsx` and import it with `import { CHARACTERS } from "./GuessWho"`, or move it to `GuessWhoFace.tsx` and re-export it from `GuessWho.tsx`; pick one and avoid a circular import. **Use the second option:** define `CHARACTERS` in `GuessWhoFace.tsx`, and have `GuessWho.tsx` import it and `export { CHARACTERS }`.
- **Board.** The grid is `grid-cols-4 sm:grid-cols-6`. Each card is `chunk-sm bg-white` with the face and the name, wrapped in `[perspective:600px]`. When eliminated (local `eliminated` set), the card gets `animate-flip-down`; its back is `bg-toy-stripes` and it plays `click`.
- **Guess mode.** Cards get a pink outline and send `{action:"move", action_type:"guess", character_id}` (unchanged).
- **Secret card pinned.** A `chunk bg-candy-yellow` "Your secret" card with a 📌, sticky on desktop and at the top on phones.
- **Questions.**
  - Chips from `preset_questions` (`btn-toy bg-white text-sm`).
  - A free-text input with an "Ask" `ToyButton`.
  - Both send `{action:"move", action_type:"ask", text}`.
- **Answering.** When `current_question` is awaiting your answer, a big card shows the text and 👍 Yes / 👎 No buttons, sending `answer: true|false` (unchanged).
- **History.** Bubbles with Yes (green) / No (red) tags.
- Keep the auto-ready and clear-eliminations effects as they are.
- **ResultOverlay.** Children: both faces with names ("They had …"), from `char_A`/`char_B` and `winning_char`.
- **Sounds.** `turn` on my turn, `pop` when an answer arrives (the history length rises).
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually: all 24 faces render with distinct traits; flip-down works; ask, answer and guess all work; the overlay is correct for both players and the spectator; the phone grid at 375px has 4 columns with no horizontal scroll.
- **Commit.** `feat(games): toybox Guess Who with illustrated faces (GH-20)`

### 13. Game: Battleships
Files: `Battleships.tsx`.
- **Placement remembers ship groups.** Change `handleRandomize` so it also returns the groups, `number[][]` (sizes 5, 4, 3, 3, 2), and store them with `useState<number[][] | null>` as `fleetGroups`. Also save them to `sessionStorage` under the key `gamehub_bs_fleet_${roomId}`, where `roomId` comes from `useParams()`, and restore them on mount. The flat `ships` list is sent exactly as today: `{action:"move", action_type:"place_ships", ships}`.
- **Fallback when no groups are stored.** Show your fleet as a "Hits taken n / 17" counter instead of chips.
- **Grids.**
  - Two 10×10 cartoon sea grids: "🛟 Your fleet" (`bg-candy-blue/30`) and "🎯 Enemy waters" (`bg-candy-blue/60`). Each grid is `chunk`, with cells sized `w-[min(8.4vw,2.2rem)]`.
  - Ships are rounded grey capsules (`bg-slate-400` with an ink border).
  - A hit shows 💥 (`animate-pop`) and a miss shows a 💧 splash.
  - Hovering a valid enemy cell on my turn shows a crosshair ⊕ and `cursor-crosshair`.
- **Fleet chips.**
  - Your fleet: 5 chips ("Carrier 5", "Battleship 4", "Cruiser 3", "Submarine 3", "Destroyer 2") from `fleetGroups`. A chip gets `line-through opacity-50` when every cell of its group is in `shots[enemy]` as "hit".
  - Enemy: a "Hits n / 17" progress bar, with n = the count of "hit" in `shots[me]` (human decision).
- **Phones (below md).** A two-button toggle, "Your fleet" / "Enemy waters", shows one board at a time. It defaults to Enemy on my turn and Your fleet otherwise, following the turn with `useOnChange`, and the user can still switch.
- **Setup phase.** "Shuffle ships 🎲" (existing randomize) and "Ready ✅" ToyButtons, and the opponent's ready state is shown in PlayerCards subtitles.
- **Sounds.** `hit` or `miss` when a new shot appears in either `shots` map (diff the counts; pick the sound from the new entry's value).
- **Spectators.** They see the fleets as `get_state_for_player(None)` provides; render whatever is in the state without crashing when `my_ships` is empty.
- **ResultOverlay.** Standard.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually:
  - place, play and sink a ship: your chip is struck through on your side
  - the enemy hits counter increments
  - after a refresh the chips are restored from sessionStorage
  - the phone toggle works at 375px
  - the spectator view does not crash
- **Commit.** `feat(games): toybox Battleships with fleet chips and phone board toggle (GH-20)`

### 14. Game: Snakes & Ladders
Files: create `frontend/src/components/games/SnakesBoardArt.tsx`; modify `SnakesLadders.tsx`.
- **`SnakesBoardArt`.**
  - Props: `{ snakes: Record<string, number>; ladders: Record<string, number>; cellCenter: (cell: number) => { x: number; y: number } }`.
  - It renders an absolutely positioned SVG over the board, using the same coordinate space as `cellCenter` in percentages of a 0–100 viewBox.
  - Snakes: a thick cubic-Bezier body with a stroke in a candy colour, an ink outline (draw it twice, the wider ink stroke underneath), a round head at the head cell with eyes, and a tapered tail.
  - Ladders: two brown rails (`#b07a44`) with rungs every ~6% of the length.
  - Read the data from the state (`gameState.snakes`/`ladders`, falling back to the existing constants), and delete the duplicated constants only if nothing else uses them.
- **Board.**
  - A 10×10 grid sized `w-[min(92vw,30rem)] aspect-square`, so cells shrink on phones; this replaces the fixed 42px.
  - Cells alternate between pastel candy tints (`/25`, `/40`) and show small numbers. Square 100 shows 🏁.
  - Make `cellToGrid`/`cellCenter` return percentages.
- **Pawns hop square by square.**
  - Keep `displayPos` per player in state, and step it toward the server position every 140 ms with `setInterval` inside an effect keyed on `pos_A`/`pos_B`.
  - When `0 < new - old <= 12`, step one square at a time.
  - Otherwise (a snake, a ladder or a swap): first hop to `old + last_roll` if that is valid and on the way, then jump straight to the final position with a CSS transition.
  - Pawns are `chunk-sm` circles in the avatar colour, with the initial. The two pawns are offset when they share a square.
- **3D dice.** A `chunk bg-white` cube face with pips, wobbling (`animate-wiggle`) while `rolling`. Keep the existing roll flow (80 ms face shuffle, `roll` sent after 500 ms). Play `dice` at the start of a roll.
- **Power-up hand.**
  - My `hand_*` is rendered as fanned cards (`rotate-[-6deg..6deg]`, `chunk-sm`, `CARD_COLORS`, emoji, name, desc on hover/tap). Clicking a card sends `{action:"move", action_type:"play_card", card_id}` (unchanged).
  - The opponent shows a count of face-down cards (striped).
  - Shield, sabotage, double-roll and extra-turn flags appear as small badges in the PlayerCards subtitle.
- **Event toast.** `EVENT_MESSAGES[last_event]` as a TurnBanner, tone "good" for a ladder or a card and "bad" for a snake or sabotage. Sounds: `pop` for a ladder, `miss` for a snake.
- **ResultOverlay.** Standard; there is no draw.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually: the snakes and ladders line up with their squares; pawns hop; snake and ladder moves look right; cards play; at 375px the board fits with no horizontal scroll.
- **Commit.** `feat(games): toybox Snakes & Ladders with drawn board and hopping pawns (GH-20)`

### 15. Game: Stratego Lite
Files: create `frontend/src/components/games/StrategoToken.tsx`; modify `Stratego.tsx`.
- **`StrategoToken`.**
  - Props: `{ owner: "A" | "B"; rank: number; mine: boolean; revealed: boolean; selected?: boolean; small?: boolean }`.
  - A rounded square (`chunk-sm`). Mine are `bg-candy-blue` and enemy `bg-candy-red`.
  - The front shows a rank icon (0 🚩, 11 💣, 1 🕵️, 2 🏃, 3 ⛏️, 4–6 🪖, 7–9 ⭐, 10 👑) and the rank number (`rank_info[rank].short`).
  - When `rank === -1` (a hidden enemy piece), render the striped back (`bg-toy-stripes` tinted red) with no icon.
  - `selected` adds `ring-4 ring-candy-yellow -translate-y-0.5`.
- **Board.**
  - 8×8 on grass, alternating `bg-candy-green/50` and `/70`. Lake cells (`lakes`) are `bg-candy-blue/70` with 🌊.
  - Size the board as `w-[min(94vw,28rem)] aspect-square` and position cells in a percentage grid; this replaces the absolute 46px.
- **Legal moves.** From the existing `getValidMoves`: `validMoves` cells show a small ink dot, and `validAttacks` show a red ⚔️ ring. Moves are sent as today.
- **Setup.** An inventory tray of tokens with counts (`remaining`, `placed_count/total_pieces`); clicking a token selects a rank; `place`, `remove`, `auto_fill` ("🎲 Auto-fill") and `ready` messages are unchanged. Setup rows are highlighted.
- **Clash card.** Replaces the combat banner. When `last_combat` changes and has not been dismissed, a centred `chunk bg-white animate-pop` card shows attacker token ⚔️ defender token, with `RESULT_MSG`. It auto-hides after 2.5 s, and clicking dismisses it (keep `dismissedCombat`). Sound: `hit`.
- **Captured/lost tray.** Derive it from `rank_info[r].count` minus the pieces still on the board:
  - Lost (mine): count my pieces on `board` per rank.
  - Captured (enemy): `remaining` gives the enemy's remaining counts if present. Otherwise count enemy pieces that are revealed or still on the board. A rank is shown only when it can be derived from the state; never guess hidden ranks.
  - Render small tokens in two rows.
- **ResultOverlay.** Standard; there is no draw.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually:
  - setup with auto-fill and manual placement
  - moves with dots, attacks and the clash card
  - hidden enemy pieces stay striped
  - a win shows the overlay
  - at 375px there is no horizontal scroll
- **Commit.** `feat(games): toybox Stratego Lite with tokens, clash card and trays (GH-20)`

### 16. Game: Minesweeper co-op with team progress and revealer dots
Files: `Minesweeper.tsx`.
- Fix the fallback defaults to `rows ?? 14`, `cols ?? 14` and `mines ?? 30`, to match the backend.
- **Tiles.**
  - Hidden tiles are two-tone grass in a checkerboard (`bg-candy-green` / `bg-candy-green/80`) with a bevel.
  - Revealed tiles are sand in a checkerboard (`bg-cream-2` / `#f5deb3`) with no bevel.
  - Numbers are bold in the classic colours, with an updated `NUM_COLORS`.
  - Flags are 🚩 with `animate-pop`. The triggered mine "X" is 💥 on red; mines shown after a loss ("M") are 💣.
  - Cell size is `w-[min(6.4vw,1.9rem)]` so 14 columns fit at 360px: 14 × 6.4vw ≈ 90vw.
- **Revealer dot.** When `revealed_by?.[r][c]` is set, draw a 6px dot in the bottom-right corner in that player's avatar colour (`avatarColor(nameForSymbol(gameState, sym) ?? sym)`). When `revealed_by` is missing, draw nothing.
- **Team header.**
  - `PlayerCards` with `showScore={false}` and `centerLabel="🤝"`. Each subtitle shows "dug n", counted from `revealed_by`.
  - A team progress bar: `revealed_count / cells_to_reveal`, `chunk-sm bg-white`, filled `bg-candy-green`, with the percentage.
  - `mines_remaining` appears as a 🚩 counter.
- **Flag mode.** A toggle `ToyButton` ("⛏️ Dig" / "🚩 Flag"), large on phones. Right-click flag stays. Moves are unchanged: `{action_type:"reveal"|"flag", row, col}`.
- **ResultOverlay.**
  - Phase `won`: outcome "win", title "Team win! 🎉".
  - Phase `lost`: outcome "lose", title "Boom! 💥".
  - Both titles apply to spectators too (they are co-op outcomes). Subtitle: "Cleared n of m".
  - This replaces the two fixed overlays.
- **Sounds.** `place` when `revealed_count` rises, `click` on a flag toggle, `hit` on a loss (ResultOverlay plays `lose`).
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually with 2 players: dots appear in two colours, including flood-revealed areas; the progress bar moves; win and loss work; after Play again the dots are cleared; at 375px all 14 columns fit with no horizontal scroll.
- **Commit.** `feat(games): toybox co-op Minesweeper with team progress and revealer dots (GH-20)`

### 17. Game: Tetris
Files: create `frontend/src/components/games/TetrisWell.tsx`; modify `Tetris.tsx`.
- **`TetrisWell`.**
  - Props: `{ board: number[][]; piece?: { shape: number[][]; x: number; y: number; type: number } | null; cellSize: string; dim?: boolean }`. Match the field names of the existing `piece` object in `Tetris.tsx` exactly, and adapt the prop type to them.
  - Rendering:
    - `chunk bg-ink/90` well; each filled cell is a bevelled candy block.
    - Bevel: `box-shadow: inset 3px 3px 0 rgba(255,255,255,.45), inset -3px -3px 0 rgba(0,0,0,.25)`.
    - The colour map 1–7 is candy blue, yellow, purple, green, red, orange and pink; 8 (garbage) is grey.
  - `dim` lowers the opacity for the opponent's well.
- **Next piece.** Add a `nextPieceRef` and pre-generate it, so `spawnPiece` takes the next piece and draws a new one. The random distribution and the drop interval (500 ms) are unchanged; there is no rule change. Show it in a sticker box ("Next").
- **Sticker boxes.** "Lines" (`scores[me] / 100`), "Level" (`Math.floor(lines / 10) + 1`, display only) and "Score", each `chunk-sm bg-white`.
- **Garbage meter.** A vertical red bar beside the well, with height from `garbage_queue[me]`, capped at 10 rows.
- **Lobby.** A big ✅ ready card: "Ready?" `ToyButton` (sends `set_ready`, unchanged), and both players' ready states as big ✅/⏳ stickers in PlayerCards subtitles.
- **Layout.**
  - Desktop: my well `cellSize="min(4.2vh,1.6rem)"` and the opponent's well at about half size.
  - Phones: my well `min(7vw,1.35rem)`, the opponent's well shrunk to `min(3vw,0.6rem)` beside it.
  - Touch controls get bigger: `w-16 h-16 btn-toy` (◀ ▶ ⟳ ▼ ⤓). Keep `onPointerDown` and the `.game-btn` class.
  - Keyboard handling is unchanged.
- **Sounds.** `place` on lock, `pop` on a line clear (when `scores[me]` rises), `hit` when garbage arrives.
- **ResultOverlay.** Its `onPlayAgain` must also run the existing local reset that the old Play Again button did: call that function, then `handleRestart()`.
- Keep the messages `lines_cleared`, `consume_garbage` and `game_over` exactly as they are.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually: a 2-player game with ready, play, a line clear sending garbage and a loss, then Play again. At 375px both wells and the controls fit.
- **Commit.** `feat(games): toybox Tetris with candy blocks, next piece and bigger touch controls (GH-20)`

### 18. Game: Ping-Pong
Files: `PingPong.tsx`.
- **Court.** A striped grass court (`repeating-linear-gradient(90deg, #3ddc84 0 10%, #34c975 10% 20%)`) in a `chunk` frame, with a white dashed centre line. Keep the existing `scale`/`containerRef` positioning with the 800×500 field coordinates.
- **Paddles.** Rounded pills (`rounded-full`), L `bg-candy-blue` and R `bg-candy-pink`, each with an ink border.
- **Ball.**
  - A yellow ball with an ink border.
  - Trail: keep the last 5 `(ball_x, ball_y)` positions in a ref and render them as fading circles (opacity 0.1–0.4).
  - Squish: when the ball's x-velocity sign flips (compare the last two x deltas), apply `scale(0.8,1.2)` for 120 ms and play `hit`.
- **Score bubbles.** Big `chunk bg-white text-4xl` bubbles above the court for L and R, labelled "First to 7".
- **Countdown overlay.** When the phase changes to `playing` (`useOnChange(phase, ...)`), show 3, 2, 1, "Go!" over the court for 1.5 s total (`animate-pop` each), with `pointer-events-none`. It is client-side only; the server is already running. Play `click` on each tick and `turn` on "Go!".
- **Lobby.** The ready card is styled like the Tetris lobby, using `set_ready` unchanged.
- **Phone controls.** Big ▲/▼ `btn-toy w-20 h-20` buttons, keeping `onPointerDown`/`Up`/`Cancel` and `.game-btn`. Keyboard handling is unchanged.
- **Sounds.** `pop` when either score rises.
- **ResultOverlay.** Subtitle `${scores.L} – ${scores.R}` plus `scoreLine(matchScore, "L", "R")`.
- **Verify.** `npx tsc --noEmit` passes, and eslint shows 94 problems or fewer. Manually: the countdown shows; the trail and squish work; scores update; after the win the match score increments **once** (the loop broadcasts after the end and the guard holds); the controls work at 375px.
- **Commit.** `feat(games): toybox Ping-Pong with trail, countdown and score bubbles (GH-20)`

### 19. Cross-game QA pass and polish
Files: only the files touched in steps 3–18, and only to fix problems this pass finds. No new features.
- Run `python3 -m compileall -q backend`, then `cd frontend && npx tsc --noEmit && npx eslint . 2>&1 | tail -n 3`, which must show 94 problems or fewer. Also run `npm run build`; it needs network access for Google Fonts, so if it fails only on the font fetch offline, note that and rely on tsc.
- Run the manual checklist (see Final verification) for all 12 games on desktop and at a 375px viewport. Fix any overflow, missing spectator handling or sound misfire found.
- Run `git grep -n 'slate-9[05]0' frontend/src`. It must return nothing in the lobby, the room or the games; every screen uses the toybox tokens.
- **Commit (only when there are fixes).** `fix(ui): toybox QA fixes across games (GH-20)`

## Final verification
1. `python3 -m compileall -q backend` exits 0. The backend check script from steps 1–2 prints "match_score OK" and "revealed_by OK".
2. `cd frontend && npx tsc --noEmit` exits 0. `npx eslint . 2>&1 | tail -n 3` shows 94 problems or fewer.
3. Manual pass, run the backend and frontend dev servers:
   - Lobby: all 12 cards, the filters, the code box, `?name=`, `?room=` and `?chat=false`.
   - For each of the 12 games, with two players and a third spectator tab, on desktop and at 375px:
     - the turn indicator and wiggle
     - move feedback and sound
     - the result overlay (win, lose, draw where possible, and the spectator title)
     - Play again
     - the match score after a restart and after a page refresh
   - Ping-Pong match score increments once per match.
   - Minesweeper revealer dots, including flood fill, and they clear on restart.
   - Battleships own-fleet strike-through and the enemy hits counter.
   - The sound toggle state survives a reload (`localStorage.gamehub_sound`).
   - With OS reduced motion on, there is no confetti, wiggle, bob or drop.
   - Chat reactions arrive on both sides; the phone drawer is collapsed by default.
   - The copy-invite link works in a fresh private window (enter a name, then the room code is kept).
4. Compare each screen against mockup v2, tab by tab.
