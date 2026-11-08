# GH-20: Playful Toybox redesign of GameHub (lobby, room shell, all 12 games)

## Goal
Make GameHub feel friendly, convenient and polished. One consistent "Playful Toybox" look covers the lobby, the room screen and all 12 games, along with clearer turn and score feedback, a celebratory end of game, quick chat reactions, a better phone layout and small sound effects. The approved mockup (v2, one tab per screen with a desktop/phone toggle) is the visual reference.

## Decisions
- **Visual direction: Playful Toybox** (chosen over Neon Arcade and Cozy Tabletop). Light cream background, 3px ink outlines, hard offset "sticker" shadows, a candy palette (blue, pink, yellow, green, purple, orange), a rounded font and bouncy animations.
- **Mockup approved as is** ("Looks good: keep going"), including the per-game ideas listed below.
- **Small backend additions allowed** (chosen over frontend-only): a per-room match tally, so scores survive a refresh and spectators see them, plus the Minesweeper "who revealed" owner.
- **Sound: small synthesized effects, on by default** (chosen over muted-by-default and no sound). Web Audio API only, with no audio files. The mute toggle is saved in `localStorage`.
- **The game contract stays the same.** Every component keeps the props `{ws, gameState, mySymbol, handleRestart}` and sends the same move messages. No game rules change.
- **YAGNI:** no new npm dependencies apart from the Google font loaded through `next/font`. No animation or audio libraries; the effects use CSS keyframes and Web Audio.

## Architecture

### 1. Theme foundation (`frontend/src/app/globals.css`, `layout.tsx`)
- Tailwind v4 `@theme` tokens: `--color-ink`, `--color-cream`, `--color-cream-2`, the candy colours and `--shadow-chunk` / `--shadow-chunk-sm`.
- Utility classes in `@layer utilities`: `.chunk`, `.chunk-sm`, `.btn-toy` (press-down on `:active`), `.bg-toy-stripes`, plus keyframes `pop`, `drop`, `bob`, `wiggle`, `confetti`, `flip-down`. The existing `fadeIn`/`scaleIn`/`bounceShort` and `.game-btn` stay.
- Swap Geist Sans for **Fredoka** through `next/font/google`; Geist Mono stays for codes. Respect `prefers-reduced-motion` by turning off the wiggle, bob and confetti animations.

### 2. Shared UI components (new, `frontend/src/components/ui/`)
Each component does one job and is used by every game:
- `PlayerCards.tsx`: two player cards (avatar circle with initial, name, subtitle slot, score) and a "VS" between them. The card whose turn it is wiggles green. Spectators see the same view.
- `TurnBanner.tsx`: a single status pill ("🎉 Your turn!", "Waiting for Sara…", custom text).
- `ResultOverlay.tsx`: a pop-up with confetti (win only), a title, a subtitle such as "3 – 2", **Play again** (calls `handleRestart`) and **Lobby**. It replaces the per-game win/lose boxes.
- `ToyButton.tsx`: the chunky button with colour variants.
- `Avatar.tsx`: a deterministic colour from a hash of the name.

Game components render `PlayerCards`/`TurnBanner`/`ResultOverlay` themselves, because only they know what turn, subtitle and outcome mean for their game. The shell provides layout only.

### 3. Room shell (`frontend/src/app/room/[id]/page.tsx`)
- Yellow chunky header: back button, room code pill with **copy-invite-link** button, help (`GameHelp`, restyled), and the 🔊/🔇 sound toggle.
- Chat becomes a pink-headed side panel on desktop and a bottom drawer on phones (the current toggle logic, restyled). New **quick reactions** row (👏 😂 😱 🔥 GG): each one sends an ordinary `chat` message, so the backend doesn't change. Bubble styles match the mockup.
- The room-conflict and loading screens are restyled in the same theme.
- Pass `matchScore` (from the new backend field) down to the game components as an **optional** prop. The existing props stay unchanged.

### 4. Lobby (`frontend/src/app/page.tsx`)
- Replace the 12 copy-pasted card blocks with a **single `GAMES` data list** (`frontend/src/data/games.ts`: key, title, cover, emoji, category, play time, accent colour) rendered by a `GameCard` component.
- Purple hero with the "Playing as <name> ✏️" chip (opens the existing change-name flow), **one shared "Have a room code?" box** at the top instead of a code input on every card, and **category filter chips** (All, Classic, Quick, Action, Strategy, Words, Co-op, Luck, Deduction), filtered on the client.
- The name-entry screen is restyled. The embed behaviour (`name`, `room`, `chat` params) is unchanged. When `room` is set, the code box is hidden and the card buttons read "Join".

### 5. Sound (`frontend/src/lib/sound.ts`)
- A tiny module around one lazily created `AudioContext` (created on the first user gesture, so the browser allows it). It exposes `play(name)` for `click`, `place`, `drop`, `hit`, `miss`, `pop`, `dice`, `turn`, `win`, `lose`. Each sound is a short oscillator and gain envelope.
- `useSound()` hook and `SoundToggle` component. The setting lives in `localStorage` key `gamehub_sound` (default on).
- Games call `play()` on their own actions and when the state changes (for example a new disc, or it becomes my turn).

### 6. Per-game redesign (`frontend/src/components/games/*.tsx`)
All 12 games move to the toybox tokens and shared components, as in the mockup tabs:
| Game | Changes |
|---|---|
| Tic-Tac-Toe | Purple board, white rounded tiles, sticker X/O with pop-in, a ghost of your mark on hover, the winning line in yellow. |
| Connect Four | Blue board with "holes", discs drop with a bounce, a bobbing arrow and preview over the column you're aiming at, the winning four flash. |
| Battleships | Cartoon sea grids ("Your fleet" / "Enemy waters"), crosshair on hover, 💥 for a hit and a splash for a miss, fleet chips struck through when a ship sinks. Phones stack the boards with a toggle. |
| Tetris | Bevelled candy blocks, sticker boxes for next piece, level and lines, a red garbage meter, a big ✅ ready lobby. On phones the opponent's well shrinks and touch controls get bigger. |
| Ping-Pong | Striped grass court, rounded colour paddles, ball trail and squish, big score bubbles, a 3-2-1 countdown overlay (client-side, shown when the phase turns to playing). |
| Rock Paper Scissors | Three big hand cards with lift and tilt when selected, a flip-and-clash "VS" reveal, hearts for best-of-5 (from the existing `scores`). |
| Hangman | Balloons replace the gallows: one 🎈 pops per wrong guess (from `wrong_guesses`/`max_wrong`), letter tiles, a keyboard that colours right and wrong keys, a fun secret-word input with a peek toggle for the setter. |
| Number Duel | Big picker (−10/−1/+1/+10 and a slider), "Lock it in", a reveal number line with both pins and the 🎯 target, the closer pin glows. |
| Minesweeper (co-op) | Two-tone grass tiles dug into sand, coloured numbers, 🚩 flags, a team progress bar (`revealed_count/cells_to_reveal`), a small dot in the revealer's colour on each tile. |
| Guess Who | Illustrated SVG faces built from each character's traits (hair colour and style, skin, glasses, hat, beard and so on), 3D flip-down when a card is eliminated, question chips (the existing `preset_questions`) plus a free-text question, the secret card pinned. |
| Snakes & Ladders | Pastel 10×10 board with SVG cartoon snakes and wooden ladders drawn from the existing `snakes`/`ladders` data, pawns that hop square by square, a 3D wobbling dice, power-up cards shown as a hand. |
| Stratego Lite | Grass board with lakes, chunky tokens (icon and rank), striped backs for hidden enemy pieces, legal-move dots, a "clash" card for battles, a captured/lost tray. |

Each component is restyled in place. Where a file is large (Stratego, Guess Who, Snakes & Ladders, Tetris), small presentational subcomponents (for example `GuessWhoFace.tsx`, `SnakesBoardArt.tsx`) go next to it in `components/games/`.

## Data and interfaces (backend)
- **`backend/main.py` `GameRoom`**
  - New `self.match_score: Dict[str, int]` (symbol → wins), `self.match_draws: int`, and a `self._result_counted: bool` guard.
  - New method `record_result()`. When the game has a `winner` (or `is_draw`) and `_result_counted` is false, it increments the right counter and sets the guard. It is called at both places where an outcome is detected today (the move path and `_game_loop`). `reset_game()` clears the guard but keeps the tally.
  - `broadcast_state()` adds `"match_score": {"wins": {...symbol: n}, "draws": n}` to every state message (additive; older clients ignore it).
  - The tally lives as long as the in-memory room (same lifetime as the existing room state; rooms are removed when empty).
- **`backend/games/minesweeper.py`**
  - New `self.revealed_by` grid (`symbol | None`), filled by `reveal` and `_flood_reveal` with the symbol that made the move, and cleared in `reset()`. It is exposed as `"revealed_by"` in `get_state()`.
- **Frontend types:** an optional `matchScore?: {wins: Record<string, number>; draws: number}` prop on the game components. A missing field means a score of 0.

## Error handling and edge cases
- **Spectators** (`mySymbol == null`): they see player cards, scores and the result overlay, but never "Your turn". The overlay shows "Sara wins!" instead of "You win/lose", and Play again stays visible to them, because the backend allows restart from anyone.
- **Missing or old state fields** (`match_score`, `revealed_by`): the UI renders fine without them.
- **Audio:** if `AudioContext` is unavailable or blocked, `play()` does nothing. Sound never throws.
- **Reduced motion:** confetti, wiggle, bob and drop are turned off.
- **Small screens:** each board scales with `min()`/`clamp()` sizes so the 14×14 Minesweeper, 10×10 Snakes and two Tetris wells fit a 360px-wide phone. The chat drawer stays collapsed by default.
- **Embeds:** `chat=false` still hides chat (and the reactions with it). Sound respects the saved setting inside iframes too.
- **Double counting:** the `_result_counted` guard makes sure a game that keeps broadcasting after it ends (the Pong loop, repeated moves rejected after a win) is only counted once.

## Testing
The repo has no test framework yet (adding pytest/Vitest is a separate task), so:
- **Backend:** run `python3 -m compileall backend`. Add a small runnable check script in the plan steps (run, not committed) or manual WebSocket checks: a win increments `match_score` exactly once, a restart keeps the tally, a draw increments `draws`, and Minesweeper `revealed_by` is filled for flood-revealed cells and cleared on reset.
- **Frontend:** `npx tsc --noEmit` must pass. `npx eslint` must not add problems beyond the existing baseline of 94.
- **Manual pass in two browsers** (desktop and a 375px phone viewport) for each of the 12 games: turn indicator, move feedback, result overlay and Play again, score after a restart, spectator view (third tab), sound toggle saved across a reload, `?chat=false` and `?name=` embed modes, reduced-motion setting.
- Compare visually against mockup v2 tab by tab.

## Delivery order (for the plan)
1. Theme tokens, font, shared UI components and the sound module.
2. Room shell (header, chat drawer and reactions), plus the backend `match_score`.
3. Lobby (`GAMES` data, `GameCard`, join box, filters).
4. Games in batches: classic (Tic-Tac-Toe, Connect Four, RPS, Number Duel), then words and deduction (Hangman, Guess Who), then boards (Battleships, Snakes & Ladders, Stratego, Minesweeper with `revealed_by`), then action (Tetris, Ping-Pong).

## Out of scope
- Game rule changes, new games, AI opponents, accounts or persistent stats beyond the in-memory room.
- Fixing the pre-existing issues: seats not freed on disconnect, Guess Who secret leak, client-trusted Tetris, lint debt, adding test frameworks.
- Audio files or music, theme switching or dark mode, and new lobby cover images (the existing PNGs stay, shown inside the new card frame next to the emoji or accent colour).
