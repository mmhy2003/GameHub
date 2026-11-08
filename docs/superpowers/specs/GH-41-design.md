# GH-41: 4-Player Pong design

## Goal
Add a new 13th game, **4-Player Pong**. Up to 4 friends each defend one side of a square court. Miss the ball and you lose a heart. Lose all 3 hearts and your side turns into a wall. The last player standing wins. Its look and flow follow **mockup v1** (Lobby, Playing, Player knocked out, Result, and the phone view).

## Decisions
- **Rules: lives and knockout** (your answer). Each player has 3 hearts. When the ball leaves the court through a player's side, that player loses a heart and the ball is re-served from the centre. At 0 hearts the player is out and their side becomes a wall. The last player with hearts wins. Rejected: a points race, and 2 vs 2 teams.
- **A separate game, `pong-4`** (your answer). It gets its own lobby card, rules entry and backend class. The existing 2-player Ping-Pong is not touched. Rejected: a 2P/4P mode inside Ping-Pong.
- **2 to 4 players, empty sides are walls** (your answer). The match can start once at least 2 seated players are ready. Rejected: computer paddles, and requiring exactly 4 players.
- Start flow: each seated player presses **Ready**. The match starts by itself when every seated player is ready. Once at least 2 are ready, any ready player can also press **Start with N players**. A seated player who is not ready when the match starts sits that round out, and their side is a wall.

## Architecture
**Backend**
- New `backend/games/pong_four.py` with `PongFourLogic`. It is modelled on `PingPongLogic`, uses `needs_server_loop = True` and has the same `phase` values (`lobby` → `playing` → `finished`).
- Register it in `backend/games/__init__.py` under the key `pong-4`.
- `backend/main.py` does not change. The 30 fps loop, `record_result`, the winner chat message and `match_score` already work for any number of seats, because `on_player_join` decides who gets a seat and everyone else becomes a spectator.

**Frontend**
- New `frontend/src/components/games/PongFour.tsx`. It takes the standard `GameProps` and reuses `ResultOverlay`, `ToyButton`, `Avatar`, `play()`, `useOnChange` and the helpers in `players.ts`. It borrows the trail, squish, countdown and scaling logic from `PingPong.tsx`.
  - It renders its own 4 player cards around the court. The shared `PlayerCards` component only handles 2 players.
  - On phones the cards sit in a 2×2 grid, as in the mockup.
- Add a `case "pong-4"` to the switch in `frontend/src/app/room/[id]/page.tsx`.
- Add a `GAMES` entry in `frontend/src/data/games.ts`: category Action, emoji 🏓, accent green. It reuses `/games/pong_cover.png`, so no new art is needed.
- Add a `GAME_RULES["pong-4"]` entry in `frontend/src/data/gameRules.ts`.

## Data and interfaces
**Seats.** Players get the seats `B` (bottom, blue), `T` (top, pink), `L` (left, purple) and `R` (right, orange), in join order. A 5th person and anyone after becomes a spectator. A player who rejoins gets their old seat back.

**Field.** 600 × 600. Each corner has a 50 × 50 solid block so the ball always bounces. Paddles are 100 long and 12 thick and sit 20 units in from their edge.
- Bottom and top paddles move along x. Left and right paddles move along y.
- A paddle is clamped between the corner blocks.
- A paddle hit sends the ball back at an angle that depends on where it hit the paddle (the same rule as Ping-Pong).
- A side with no active player reflects the ball like a wall.

**Moves** (`action: "move"`):
- `action_type: "set_ready"`
- `action_type: "start"`: allowed in the lobby when at least 2 players are ready.
- `action_type: "paddle"` with `state` = `neg` | `pos` | `stop`. `neg` means left or up, `pos` means right or down. The client maps the keys for the player's side: A/D and ←/→ for bottom and top, W/S and ↑/↓ for left and right. The phone D-pad shows ◀ ▶ or ▲ ▼ to match.

**Serving.** The ball serves from the centre towards a random active player, at a random angle within ±30°. It moves at a constant speed of 6 units per tick.

**State** (`get_state`):

| Field | Meaning |
|---|---|
| `phase` | `lobby`, `playing` or `finished` |
| `ready` | sym → bool |
| `active` | sym → bool (playing this round) |
| `lives` | sym → int |
| `paddles` | sym → position along its side |
| `ball_x`, `ball_y` | ball position |
| `knockout_order` | list of syms, in the order they were knocked out |
| `last_out` | sym, so the client can show the "💥 X is out!" pop-up |
| `winner` | sym |
| `is_draw` | always false |
| sizes | `field`, `corner`, `paddle_len`, `paddle_w`, `ball_r`, `lives_max` |

**Restart.** Restart puts the game back in the lobby. Seats are kept, ready flags are cleared, and lives go back to 3.

## UI (matches mockup v1)
- **Lobby card.**
  - A 2×2 grid of seats, each showing ✅ ready, ⏳ not ready or 🪑 empty, with the seat colour and side.
  - Ready and Start buttons.
  - The text "Needs at least 2 ready players. Empty seats are walls."
- **Playing.**
  - The square striped-green court with a dashed centre circle and cream corner blocks.
  - Colour-coded paddles, the yellow ball with its trail, and the 3-2-1-Go countdown.
  - Player cards on each side showing hearts (❤️ left, 🤍 lost). Your own card has a yellow ring.
  - A control hint for your side. Phones get a D-pad.
- **Knockout.**
  - A "💥 Name is out!" pop-up.
  - The player's card greys out and their side becomes a striped grey wall.
  - Sounds: `pop` when someone loses a heart, `hit` on paddle bounces.
- **Result.**
  - `ResultOverlay` shows a ranking: 🥇 the winner with their remaining hearts, then the other players by knockout order.
  - It also shows the match tally ("Match wins — Mo 2 · Sara 1 · Ali 0") and a Play again button.

## Edge cases
- **A player leaves mid-match.** Their paddle stops and they keep losing hearts until they are out, so the game always ends. Rejoining with the same session gives them their seat back.
- **Only one ready player.** Start is refused (the server returns false).
- **Spectators.** They see everything but have no controls. The paddle and start moves are refused because they have no seat.
- **A fast ball and a paddle collide on the same tick near a corner.** The corner blocks are checked first, so the ball cannot escape through a corner.
- **A move from a seated player who was not ready when the match started.** It is refused.

## Testing
- The repo has no automated tests, so the backend logic will be checked with throwaway Python scripts that are not committed. They will cover:
  - seat assignment
  - the ready and start rules (1, 2 and 4 players)
  - the wall bounce on an empty side
  - the paddle bounce
  - losing a heart, knockout and the winner
  - reset
- Then a manual QA pass with 2, 3 and 4 browser tabs plus a spectator, on desktop and at 375px. This follows the existing QA habit.
- Finally, `npm run lint` and `npm run build` in `frontend`.

## Out of scope
- Computer paddles.
- Team mode.
- A points mode.
- Changes to the 2-player Ping-Pong.
- New cover art.
- Changes to the shared `PlayerCards` component.
- Balancing the ball speed beyond the constants above.
