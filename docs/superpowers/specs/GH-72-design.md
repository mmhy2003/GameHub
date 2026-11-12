# GH-72 — Snake Arena (a snake.io-style multiplayer game)

## Goal
Add a 15th game, **Snake Arena** (key `snake-arena`). 2 to 6 players steer snakes around a large shared world, eat pellets to grow, and try to make others crash into them. A crashed snake drops pellets and respawns small. The **longest snake when the 3-minute timer ends wins**. The look follows mockup v2: the lobby card, the room lobby, the live arena with a camera that follows you, and the result screen.

## Decisions
| Topic | Choice | Rejected |
|---|---|---|
| Win rule | Timed round (3:00). Crashed snakes respawn after 3 s. Longest at the end wins (human) | Last snake alive; first to a target length |
| Seats | 2–6 players in candy colours Blue, Pink, Purple, Orange, Green, Yellow (join order). Later joiners are spectators (human) | 2–4; 2–8 |
| View | World 1800×1800. Each player sees about 600×600 centred on their head, plus a minimap (human) | Whole arena on screen |
| Controls | Point to steer (mouse, or drag/touch on a phone). ←/→ and A/D also turn. Hold click, Space or the ⚡ button to boost (human) | Left/right turn states only |
| Engine | Server-run, 30 Hz `needs_server_loop`, the same pattern as Tank Battle and 4-Player Pong | Client-side simulation |
| Lobby and match flow | Copy Tank Battle: `set_ready`, `start` (with 2+ ready), the `lobby → playing → finished` phases, a 3-2-1-Go countdown, `ResultOverlay`, and match wins through `record_result` | — |
| Name and key | "Snake Arena" / `snake-arena`, so it isn't confused with Snakes & Ladders. Rename now if you prefer another name | — |

## Architecture
**Backend**
- New file `backend/games/snake_arena.py` with class `SnakeArenaLogic` (`needs_server_loop = True`), registered with an `elif game_type == "snake-arena"` branch in `backend/games/__init__.py`.
- `main.py` is unchanged: it already ticks at 30 fps, calls `record_result()` and broadcasts state.

**Frontend**
- `frontend/src/lib/snakeArena.ts`: `SEATS`, `SEAT_INFO` (label and colour), view types, `ranking()` and `matchWinsLine()`, mirroring `lib/tankBattle.ts`.
- `frontend/src/components/games/SnakeArena.tsx`: lobby, input handling, countdown, the "💥 you crashed" banner, player cards, result overlay and sounds.
- `frontend/src/components/games/SnakeArenaCanvas.tsx`: a `<canvas>` renderer with the camera, grid, pellets, snakes (segment circles, eyes, name tags), the red out-of-bounds tint and the minimap. The HUD shows the timer, the "Longest" leaderboard and your length.
- Wiring: a `case "snake-arena"` in `app/room/[id]/page.tsx`; entries in `data/games.ts` (Action, 3 min, green accent, `minPlayers: 2, maxPlayers: 6`, which shows the yellow "2–6 players" chip) and `data/gameRules.ts`; a new cover `public/games/snake_arena_cover.svg`; a row in the README games table.

## Game rules and constants (server)
- `WORLD = 1800`, `SEG = 10` (spacing of body points), `HEAD_R = 10`, `SPEED = 3` and `BOOST_SPEED = 6` units per tick, `MAX_TURN = 0.15` rad per tick, `START_LEN = 10`, `FOOD_TARGET = 220`, `ROUND_TICKS = 5400` (3:00), `RESPAWN_TICKS = 90` (3 s).
- **Steering:** each snake turns its heading toward its stored target angle, at most `MAX_TURN` per tick.
- **Body:** each tick the head moves forward. The body is a list of points kept `SEG` apart, with as many points as the snake's length.
- **Eating:** a head within `HEAD_R + 6` of a pellet eats it and gains the pellet's value (1 for a normal pellet, 2 for a death pellet). Pellets are refilled up to `FOOD_TARGET` at random spots.
- **Boost:** allowed only while length > `START_LEN`. Every 15 ticks of boosting costs 1 length and drops a pellet at the tail.
- **Crash:**
  - A head that touches another snake's body or the world edge kills that snake.
  - When two heads touch, both snakes die.
  - A snake never dies from its own body (as in snake.io).
  - A dead snake turns every second body point into a value-2 pellet, then respawns with `START_LEN` after `RESPAWN_TICKS`, at a random spot at least 200 units from every other snake. Respawns go on until the timer ends.
- **End:** when `ROUND_TICKS` is reached, `phase = "finished"`. A unique longest snake becomes `winner`. A tie for longest sets `is_draw = True`. Dead snakes are ranked by their length at death.
- **Seats:** `on_player_join` hands out seats B, P, U, O, G, Y in join order. A player who rejoins keeps their seat, and the 7th player becomes a spectator, as in Tank Battle. `reset()` goes back to the lobby but keeps the seats.

## Data and interfaces
**Client → server moves** (through the existing `make_move` kwargs)
- `{"action_type": "set_ready"}` and `{"action_type": "start"}`, the same as Tank Battle.
- `{"action_type": "steer", "angle": <radians>}`: the client sends this at most 15 times a second, and only when the value changes. With the keys, the client rotates its own target angle by ±0.15 every frame from the snake's current heading and sends the result as `steer`.
- `{"action_type": "boost", "on": true|false}`: sent on press and release.

**Server → client state** (`get_state`; integers are rounded so it stays small)
```
phase, ready{seat}, active{seat}, time_left (s), world, head_r, seg,
snakes{seat: {pts:[x0,y0,x1,y1,...], angle, len, alive, boost, respawn_in}},
food:[x,y,v, x,y,v, ...], winner, is_draw, ranking:[seat...]
```
This is about 6–10 KB per tick at typical lengths. The snake length is capped at 300 points so a runaway snake can't bloat the messages.

## Error handling and edge cases
- Bad `angle` values (not a number or not finite) and moves from spectators, dead snakes or outside `playing` are rejected (`False`), as other games do.
- A player who disconnects mid-round keeps their snake, which goes straight until it crashes and respawns. The loop already stops when the room is empty.
- The countdown only plays on a `lobby → playing` change, so a page refresh mid-round doesn't replay it (the Tank Battle approach).
- **Spectators and dead players:** the camera follows the current leader for spectators. A dead player's camera stays where they died until they respawn.
- **Phones:** below 760px the side player cards are hidden. Drag on the canvas steers (`touch-action: none`), and a ⚡ button appears under the arena.

## Testing
- Logic check scripts in `/tmp` (never in the repo), run with `python3`:
  - seats and lobby (6 seats, 7th player spectator, rejoin keeps seat)
  - the turn limit on steering
  - eating and growing
  - boost cost and its minimum length
  - wall crash, body crash and head-on crash, with pellet drop and respawn
  - the timer ending with a winner, a draw and the ranking
- `python3 -m compileall backend`; from `frontend/`: `npx tsc --noEmit`, `npm run lint` (no new problems beyond the baseline), `npm run build`.
- `docker compose up -d --build`, then a manual pass through Caddy:
  - 3 browsers plus 1 spectator, on desktop and at 375px
  - mouse, keys, touch and boost
  - crash and respawn, the timer ending, the result overlay, Play again
  - match wins carried over between rounds

## Out of scope
- AI bots (the bots in the mockup only fill the demo).
- Self-collision, power-ups, skins and a persistent leaderboard.
- Client-side prediction or interpolation, and per-player trimming of state to the view (possible later if bandwidth becomes a problem).
- Changes to other games or to the shared `PlayerCards`.