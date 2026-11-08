# GH-42 — Tank Battle (2–4 players)

## Goal
Add a new real-time game, **Tank Battle**. 2 to 4 players each drive a tank in one top-down arena. They shoot each other and break crates, and the last tank with hearts left wins. It looks and behaves like the other games and reuses the 4-Player Pong lobby and result patterns. Approved together with **mockup v2**.

## Decisions
- **Win rule: last tank standing, 3 hearts each** (your choice). A shell hit costs 1 heart. At 0 hearts the tank is out. The result ranks players by knockout order (🥇🥈🥉), as in 4-Player Pong. *Rejected:* one-hit rounds (first to 3 rounds), and a timed deathmatch with respawns.
- **Controls: classic tank** (your choice).
  - W/↑ drives forward, S/↓ reverses, A/D or ←/→ turns, and Space fires straight ahead.
  - On a phone, there are hold buttons ▲ ▼ ⟲ ⟳ (driving and turning can be held at the same time) and a big FIRE button.
  - *Rejected:* 4-direction arcade movement, and aiming with the mouse.
- **Arena: one fixed map with steel blocks and breakable crates** (your choice).
  - Shells fly straight and stop at the first wall, crate or tank.
  - A crate breaks in one hit and stays broken until Play again. Steel never breaks.
  - *Rejected:* shells that bounce, and power-ups.
- **Lobby, the same as 4-Player Pong:**
  - Seats are given out in join order: Blue (top-left), Pink (top-right), Purple (bottom-left), Orange (bottom-right). A 5th person or later is a spectator.
  - Everyone presses Ready. The match starts on its own when every seated player is ready. Any ready player can also press "Start with N players" once at least 2 are ready.
  - A seated player who is not ready sits the round out, and no tank appears for them.
- **Small defaults I chose. Say so if you want them different:**
  - After a hit, the tank blinks for 1 s and cannot be hit again during that time.
  - Each tank can have at most 2 of its own shells in the air.
  - A tank's own shells never hit it.
  - An out tank stays on the map as a greyed-out wreck that blocks like steel.

## Architecture
It follows the existing server-loop pattern (`needs_server_loop = True`, `tick()` about 30 times per second, run by the `GameRoom._game_loop` already in `backend/main.py`). No changes to `main.py` are needed.

- **`backend/games/tank_battle.py`, new: `TankBattleLogic`.**
  - **Lobby.** `on_player_join` (seats in join order, a rejoin keeps its seat), `set_ready` and `start`, built the same way as `PongFourLogic`.
  - **Map.** A 15×15 grid of 40-unit tiles (600×600). It is built by mirroring one 8×8 quadrant, so all four corners are fair. Spawns are at tiles (1,1), (1,13), (13,1) and (13,13), and each tank faces the centre.
  - **Tank movement.** A tank is a circle (radius about 15). It turns about 5° per tick and moves about 3 units per tick. Moving along x and along y are checked one after the other against steel, crates, wrecks, other tanks and the arena edge, so a tank slides along a wall instead of sticking to it.
  - **Shells.** Radius about 5, speed about 9 units per tick, a fire cooldown of about 10 ticks, and at most 2 per tank. Each tick a shell moves, then:
    - A shell that hits a crate removes it.
    - A shell that hits steel, a wreck or the edge just disappears.
    - A shell that hits another tank costs that tank 1 heart (unless it is still blinking from a hit) and starts its 1 s blink.
  - **Knockout.** At 0 hearts the tank is added to `knockout_order` and becomes a wreck. When only one tank is left, `winner` is set and `phase = "finished"`. `match_score` and the "won the game!" chat message then work with no extra code.
  - **`reset()`** goes back to the lobby: seats are kept, ready flags are cleared, and the map and hearts are restored.
- **`backend/games/__init__.py`**: register `"tank-battle"`.
- **Frontend.** These follow the PongFour files:
  - `frontend/src/lib/tankBattle.ts`: the seat type and `SEAT_INFO` (colour, corner, label), `seatedSeats`, `ranking`, `matchWinsLine`.
  - `frontend/src/components/games/TankBattle.tsx`: the lobby, keyboard and touch input, the 3-2-1-Go countdown, the "💥 Name is out!" banner, sounds (`fire`/`hit`/`pop` through the existing `play()`), and `ResultOverlay` with the ranking.
  - `frontend/src/components/games/TankBattleArena.tsx`: renders the SVG (sand floor, steel, crates, tanks as tread, body and turret drawings rotated by angle, shells, a short 💥 when something is hit, the blink, wrecks, and a "▼ you" tag). It scales to the game area with a ResizeObserver, as `PongFourCourt` does.
  - `frontend/src/components/games/TankBattleCard.tsx`: a player card with the avatar, name, colour dot, and ❤️ hearts or "💥 Out". On wide screens the four cards sit around the arena; on narrow screens they form a 2×2 grid above it.
  - `frontend/src/data/games.ts`: a new entry (`tank-battle`, "Tank Battle", 🛡️, Action, 5 min, yellow accent).
  - `frontend/src/data/gameRules.ts`: the rules and tips text.
  - `frontend/src/app/room/[id]/page.tsx`: a switch case for the new game.
  - `frontend/public/games/tank_battle_cover.svg`: a new drawn cover (two tanks, steel, a crate, a 💥), as in the mockup.
  - `README.md`: add the game to the list.

## Data and interfaces
- **Client → server** (all `{action:"move", action_type, …}`):
  - `set_ready`
  - `start`
  - `drive` with `state: "fwd"|"back"|"stop"`
  - `turn` with `state: "left"|"right"|"stop"`
  - `fire`

  Inputs are held states, as with the paddles in 4-Player Pong. The server ignores them unless `phase == "playing"` and the sender's tank is alive.
- **`get_state()`** returns:
  - `phase`, `ready`, `active`, `lives`, `lives_max`
  - `tanks: {seat: {x, y, angle, alive, blink}}`
  - `shells: [{x, y, owner}]`
  - `map: [15 strings of "." | "S" | "C"]`
  - `knockout_order`, `last_out`, `winner`, `is_draw` (always false)
  - the constants `field`, `tile`, `tank_r`, `shell_r`

  `main.py` adds `symbols` and `match_score` to every state as usual.

## Error handling and edge cases
- Bad or unknown `action_type` or `state` values return `False`. Messages from spectators are ignored because they have no seat.
- A player who closes the tab keeps their last held input (as in 4-Player Pong), so their tank can still be shot and the match still ends. Reopening the tab with the same session gives the seat back.
- Refreshing mid-match does not replay the countdown (the same `useOnChange` guard as PongFour).
- Shells are checked every tick at less than one tile per step (9 < 40), so a shell cannot pass through a crate or a tank.
- Tank-against-tank overlap is blocked during movement, so tanks can never spawn on top of each other.

## Testing
- A throwaway `/tmp/tank_check.py`, not committed, run from the repo root. It drives `TankBattleLogic` directly and checks:
  - seating and the spectator
  - auto-start and Start with N players
  - movement is blocked by steel and other tanks
  - a shell breaks a crate, and steel stays
  - a hit costs a heart, and the blink stops a second hit
  - the shell limit and cooldown
  - knockout order, the winner and `reset()`
- `cd frontend; npm run lint; npm run build`.
- Manual QA on desktop and at 375px:
  - 2, 3 and 4 players, plus a spectator tab
  - knockout through to the result
  - Play again
  - closing a tab mid-match, and refreshing mid-match
  - the touch controls on a phone-sized screen
  - 4-Player Pong is unchanged

## Out of scope
- Bouncing shells, power-ups, more than one map or a map editor, respawns, timers, team play, AI bots.
- Client-side prediction or smoothing beyond what PongFour does (state is drawn as received at 30 fps).
- Freeing seats on disconnect (the known room-wide issue).
