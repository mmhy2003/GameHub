# GH-42: Tank Battle implementation plan

## Goal
Add a 14th game, **Tank Battle** (`tank-battle`). 2 to 4 players each drive a tank in one fixed top-down arena with steel blocks and breakable crates. Each tank has 3 hearts, and the last tank with hearts left wins.

## Architecture
- **Backend.** A new `TankBattleLogic` in `backend/games/tank_battle.py` holds the seats, the lobby, the map, tank movement, shells, hits and knockouts. It runs on the existing 30 fps server loop (`needs_server_loop = True`). It is registered in `backend/games/__init__.py`. `backend/main.py` is **not** changed.
- **Frontend.** Pure helpers and types go in `frontend/src/lib/tankBattle.ts`. The screen is split the same way as PongFour:
  - `TankBattle.tsx`: state, effects, input, the lobby, the layout and the result.
  - `TankBattleArena.tsx`: draws the arena as SVG.
  - `TankBattleCard.tsx`: one player card.

  It is wired in through `games.ts`, `gameRules.ts`, the room page switch and a new SVG cover.

## Facts about the repo (checked at `bae2b07`)
- **Duck-typed game contract** (see `backend/games/pong_four.py`):
  - `on_player_join(username, existing_symbols)`. `main.py` passes the **session id** as `username`.
  - `make_move(symbol, **kwargs) -> bool`, `get_state()`, `reset()`, `tick()`, and the attributes `phase`, `winner` and `is_draw`.
  - `main.py` only calls `make_move` for sessions that have a symbol, so spectators never reach it.
- **The game loop.**
  - It starts after a successful move (`room.maybe_start_loop()`) and runs while `phase == "playing"`.
  - After each tick it calls `record_result()` and broadcasts the state.
  - Once `winner` is set it posts "{name} won the game!" to the chat.
  - It adds `players`, `symbols` (name → symbol), `my_session` and `match_score` to every state.
- **There are no automated test frameworks.**
  - Backend logic is checked with a throwaway script, `/tmp/tank_check.py`. It is never committed and is run from the repo root with `python3 /tmp/tank_check.py`. Local Python is 3.10; Docker uses 3.11. `str | None` hints are fine.
  - The frontend is checked with `npm run lint` and `npm run build` in `frontend/`. **`frontend/node_modules` is not installed, so run `cd frontend; npm ci` once first.**
  - `npm run lint` may already report problems that are not ours. The rule is: **no lint errors or warnings in the files this plan creates or changes**. Check them with `cd frontend; npx eslint <files>`.
- **Running it locally:**
  - Backend: `cd backend; pip install -r requirements.txt; uvicorn main:app --port 8000`
  - Frontend: `cd frontend; NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev`
  - Open `http://localhost:3000`, then pick Tank Battle and create a room. Use separate browser profiles or private windows for each player, because the token is kept per tab in `sessionStorage`.
- **Frontend helpers:**
  - `nameForSymbol`, `winsFor`, `outcomeFor`, `resultTitle` and `hearts(lost, lives)` live in `@/lib/players`.
  - `play(name)` lives in `@/lib/sound`. Its sounds are `click place drop hit miss pop dice turn win lose`; step 6 adds `fire`.
  - `useOnChange(value, (next, prev) => …)` lives in `@/lib/useOnChange`. It never fires on the first render.
  - `ResultOverlay` props are `{open, outcome, title, subtitle?, children?, onPlayAgain}`.
  - `ToyButton` and `Avatar` live in `@/components/ui/`.
  - Classes:
    - Colours: `bg-candy-{blue,pink,purple,orange,yellow,green,red}`, `bg-cream`, `bg-cream-2`, `text-ink`.
    - Utilities: `chunk`, `chunk-sm`, `btn-toy`, `animate-pop`, and `game-btn` (stops long-press menus on held buttons).
  - Theme hex values: ink `#2b2240`, ink-soft `#8d86a3`, blue `#4d96ff`, pink `#ff6fa8`, purple `#8b5cf6`, orange `#ff8c42`, yellow `#ffd23f`, red `#ff4d4d`.
- **Lobby cards** render `cover` with a plain `<img className="object-cover">` inside an `h-36` box, so an SVG cover works. The emoji badge sits in the top-right corner of that box.

## Conventions used throughout
- **Seat symbols** are `"TL"`, `"TR"`, `"BL"` and `"BR"` (Blue top-left, Pink top-right, Purple bottom-left, Orange bottom-right), handed out in that join order.
- **Angles** are in degrees. 0 points along +x, and angles grow **clockwise on screen** (y points down): `dx = cos(a)`, `dy = sin(a)`. "right" turns +5° per tick and "left" turns −5°. SVG `rotate(a)` uses the same convention, and the tank drawing points along +x.
- **Tiles.** Tile `(row, col)` covers `x ∈ [col*40, col*40+40]` and `y ∈ [row*40, row*40+40]`. Its centre is `(col*40+20, row*40+20)`.

## File map
| File | Change | Responsibility |
|---|---|---|
| `backend/games/tank_battle.py` | create | `TankBattleLogic`: seats, ready/start, map, inputs, movement, shells, hits, knockout, state, reset |
| `backend/games/__init__.py` | modify | import it and map `"tank-battle"` to `TankBattleLogic()` |
| `frontend/public/games/tank_battle_cover.svg` | create | lobby cover art |
| `README.md` | modify | a Tank Battle row in the Games table |
| `frontend/src/lib/tankBattle.ts` | create | `Seat`, `SEATS`, `SEAT_INFO`, view types, `seatedSeats`, `ranking`, `matchWinsLine` |
| `frontend/src/components/games/TankBattleArena.tsx` | create | SVG arena: floor, steel, crates, tanks, wrecks, blink, shells, "you" tag, 💥 bursts, countdown and banner overlays |
| `frontend/src/components/games/TankBattleCard.tsx` | create | player card: avatar, name, colour dot, hearts / 💥 Out / sits out / empty |
| `frontend/src/components/games/TankBattle.tsx` | create | the game screen: lobby, layout, keyboard and touch input, effects, result |
| `frontend/src/data/games.ts` | modify | the `tank-battle` entry |
| `frontend/src/data/gameRules.ts` | modify | `GAME_RULES["tank-battle"]` |
| `frontend/src/app/room/[id]/page.tsx` | modify | import `TankBattle` and add `case "tank-battle"` |
| `frontend/src/lib/sound.ts` | modify | add the `fire` sound the design names (see Notes) |

---

## Reference A: `backend/games/tank_battle.py` (full target after step 2)
Step 1 creates everything except the gameplay parts, which are marked `# step 2`.

```python
import math

FIELD = 600            # square arena, 600 x 600
TILE = 40
GRID = FIELD // TILE   # 15 x 15 tiles
TANK_R = 15
TANK_SPEED = 3         # units per tick at ~30fps
TURN_DEG = 5           # degrees per tick
SHELL_R = 5
SHELL_SPEED = 9        # less than a tile or a tank per tick, so a shell never skips one
FIRE_COOLDOWN = 10     # ticks between two shots of one tank
MAX_SHELLS = 2         # own shells in the air per tank
BLINK_TICKS = 30       # 1 s that a hit tank cannot be hit again
LIVES = 3
SEATS = ("TL", "TR", "BL", "BR")   # Blue, Pink, Purple, Orange, in join order
# Spawn tile (row, col) and starting angle facing the centre.
# Degrees: 0 = +x, clockwise on screen (y points down).
SPAWN = {"TL": (1, 1, 45), "TR": (1, 13, 135), "BL": (13, 1, 315), "BR": (13, 13, 225)}
# Top-left 8 x 8 quadrant; row 7 and column 7 are the centre lines.
# "S" steel (never breaks), "C" crate (one hit), "." floor.
QUADRANT = (
    "........",
    "........",
    "..SS..C.",
    "..S..C..",
    "......S.",
    "..C.C...",
    ".C...S..",
    "...C..C.",
)


def build_map():
    """15 x 15 grid mirrored from QUADRANT, so all four corners are the same."""
    return [
        [QUADRANT[min(r, GRID - 1 - r)][min(c, GRID - 1 - c)] for c in range(GRID)]
        for r in range(GRID)
    ]


class TankBattleLogic:
    needs_server_loop = True  # Tells main.py to start a background game loop

    def __init__(self):
        self.seated = set()    # seats handed out by on_player_join; kept across restarts
        self._new_round()

    def _new_round(self):
        self.phase = "lobby"   # lobby -> playing -> finished
        self.ready = {s: False for s in SEATS}
        self.active = {s: False for s in SEATS}
        self.lives = {s: LIVES for s in SEATS}
        self.tanks = {}        # seat -> {x, y, angle, blink, cooldown}; active seats only, wrecks stay
        self.inputs = {s: {"drive": "stop", "turn": "stop"} for s in SEATS}
        self.shells = []       # {x, y, vx, vy, owner}
        self.grid = build_map()
        self.knockout_order = []
        self.last_out = None
        self.winner = None
        self.is_draw = False

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        """Seats TL, TR, BL, BR in join order; a rejoin keeps its seat; the 5th is a spectator."""
        if username in existing_symbols:
            return existing_symbols[username]
        taken = set(existing_symbols.values())
        for s in SEATS:
            if s not in taken:
                self.seated.add(s)
                return s
        return None

    def get_state(self):
        return {
            "phase": self.phase,
            "ready": dict(self.ready),
            "active": dict(self.active),
            "lives": dict(self.lives),
            "lives_max": LIVES,
            "tanks": {
                s: {
                    "x": round(t["x"], 1),
                    "y": round(t["y"], 1),
                    "angle": round(t["angle"], 1),
                    "alive": self._alive(s),
                    "blink": t["blink"] > 0,
                }
                for s, t in self.tanks.items()
            },
            "shells": [
                {"x": round(b["x"], 1), "y": round(b["y"], 1), "owner": b["owner"]}
                for b in self.shells
            ],
            "map": ["".join(row) for row in self.grid],
            "knockout_order": list(self.knockout_order),
            "last_out": self.last_out,
            "winner": self.winner,
            "is_draw": self.is_draw,
            "field": FIELD,
            "tile": TILE,
            "tank_r": TANK_R,
            "shell_r": SHELL_R,
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        if symbol not in self.seated:
            return False
        action_type = kwargs.get("action_type")

        if action_type == "set_ready":
            if self.phase != "lobby":
                return False
            self.ready[symbol] = True
            if len(self.seated) >= 2 and all(self.ready[s] for s in self.seated):
                self._start()
            return True

        if action_type == "start":
            ready_count = sum(1 for s in SEATS if self.ready[s])
            if self.phase != "lobby" or not self.ready[symbol] or ready_count < 2:
                return False
            self._start()
            return True

        if action_type in ("drive", "turn"):                       # step 2
            state = kwargs.get("state", "stop")
            allowed = ("fwd", "back", "stop") if action_type == "drive" else ("left", "right", "stop")
            if state not in allowed:
                return False
            if self.phase != "playing" or not self._alive(symbol):
                return False
            self.inputs[symbol][action_type] = state
            return True

        if action_type == "fire":                                  # step 2
            if self.phase != "playing" or not self._alive(symbol):
                return False
            return self._fire(symbol)

        return False

    def _start(self):
        """Ready players play this round; everyone else sits out with no tank."""
        self.phase = "playing"
        for s in SEATS:
            self.active[s] = self.ready[s]
            self.lives[s] = LIVES if self.ready[s] else 0
            if self.ready[s]:
                row, col, angle = SPAWN[s]
                self.tanks[s] = {
                    "x": col * TILE + TILE / 2,
                    "y": row * TILE + TILE / 2,
                    "angle": float(angle),
                    "blink": 0,
                    "cooldown": 0,
                }

    def _alive(self, s: str) -> bool:
        return self.active[s] and self.lives[s] > 0

    # ── step 2 from here on ──────────────────────────────────────────────

    def _fire(self, s: str) -> bool:
        t = self.tanks[s]
        if t["cooldown"] > 0 or sum(1 for b in self.shells if b["owner"] == s) >= MAX_SHELLS:
            return False
        a = math.radians(t["angle"])
        dx, dy = math.cos(a), math.sin(a)
        d = TANK_R + SHELL_R + 1   # just in front of the barrel
        self.shells.append({
            "x": t["x"] + dx * d, "y": t["y"] + dy * d,
            "vx": dx * SHELL_SPEED, "vy": dy * SHELL_SPEED, "owner": s,
        })
        t["cooldown"] = FIRE_COOLDOWN
        return True

    def tick(self):
        """Called by the server game loop each frame (~30fps)."""
        if self.phase != "playing":
            return
        for t in self.tanks.values():
            t["cooldown"] = max(0, t["cooldown"] - 1)
            t["blink"] = max(0, t["blink"] - 1)
        for s in SEATS:
            if self._alive(s):
                self._move_tank(s)
        self._move_shells()

    def _move_tank(self, s: str):
        t = self.tanks[s]
        inp = self.inputs[s]
        t["angle"] = (t["angle"] + {"left": -TURN_DEG, "right": TURN_DEG}.get(inp["turn"], 0)) % 360
        step = {"fwd": TANK_SPEED, "back": -TANK_SPEED}.get(inp["drive"], 0)
        if not step:
            return
        a = math.radians(t["angle"])
        # x then y on their own, so a tank slides along a wall instead of sticking to it
        nx = t["x"] + math.cos(a) * step
        if not self._tank_blocked(s, nx, t["y"]):
            t["x"] = nx
        ny = t["y"] + math.sin(a) * step
        if not self._tank_blocked(s, t["x"], ny):
            t["y"] = ny

    def _tank_blocked(self, s: str, x: float, y: float) -> bool:
        if x < TANK_R or x > FIELD - TANK_R or y < TANK_R or y > FIELD - TANK_R:
            return True
        if self._solid_tile_near(x, y, TANK_R) is not None:
            return True
        # Other tanks, alive or wrecked
        return any(o != s and math.hypot(t["x"] - x, t["y"] - y) < 2 * TANK_R
                   for o, t in self.tanks.items())

    def _solid_tile_near(self, x: float, y: float, rad: float):
        """(row, col) of the first steel or crate tile that a circle at (x, y) overlaps, else None."""
        for row in range(max(0, int((y - rad) // TILE)), min(GRID - 1, int((y + rad) // TILE)) + 1):
            for col in range(max(0, int((x - rad) // TILE)), min(GRID - 1, int((x + rad) // TILE)) + 1):
                if self.grid[row][col] == ".":
                    continue
                px = min(max(x, col * TILE), col * TILE + TILE)
                py = min(max(y, row * TILE), row * TILE + TILE)
                if (x - px) ** 2 + (y - py) ** 2 < rad * rad:
                    return row, col
        return None

    def _tank_hit_by(self, b: dict):
        for o, t in self.tanks.items():
            if o != b["owner"] and math.hypot(t["x"] - b["x"], t["y"] - b["y"]) < TANK_R + SHELL_R:
                return o
        return None

    def _move_shells(self):
        kept = []
        for b in self.shells:
            b["x"] += b["vx"]
            b["y"] += b["vy"]
            if not (0 <= b["x"] <= FIELD and 0 <= b["y"] <= FIELD):
                continue                      # left the arena
            tile = self._solid_tile_near(b["x"], b["y"], SHELL_R)
            if tile is not None:
                row, col = tile
                if self.grid[row][col] == "C":
                    self.grid[row][col] = "."  # crate breaks; steel stays
                continue
            target = self._tank_hit_by(b)
            if target is None:
                kept.append(b)
                continue
            # The shell stops at any tank; only an alive, non-blinking one loses a heart
            if self._alive(target) and self.tanks[target]["blink"] == 0:
                self._hit(target)
                if self.phase == "finished":
                    self.shells = []
                    return
        self.shells = kept

    def _hit(self, s: str):
        self.lives[s] -= 1
        self.tanks[s]["blink"] = BLINK_TICKS
        if self.lives[s] == 0:
            self.tanks[s]["blink"] = 0
            self.knockout_order.append(s)
            self.last_out = s
            self.inputs[s] = {"drive": "stop", "turn": "stop"}
            alive = [x for x in SEATS if self._alive(x)]
            if len(alive) == 1:
                self.winner = alive[0]
                self.phase = "finished"

    def reset(self):
        """Back to the lobby: seats kept, ready flags cleared, map and hearts restored."""
        self._new_round()
```

**The full map**, for reference. Spawns are at `(1,1)`, `(1,13)`, `(13,1)` and `(13,13)`, and rows 8–14 mirror rows 6–0:
```
...............
...............
..SS..C.C..SS..
..S..C...C..S..
......S.S......
..C.C.....C.C..
.C...S...S...C.
...C..C.C..C...
```

## Reference B: `/tmp/tank_check.py` (full version, used in step 2)
Step 1 uses only the sections marked `[lobby]`.

```python
import json
import sys
sys.path.insert(0, "backend")
from games import get_game_logic
from games.tank_battle import (TankBattleLogic, SEATS, SPAWN, LIVES, FIRE_COOLDOWN)

def seat(g, n):
    syms = {}
    for i in range(n):
        s = g.on_player_join(f"s{i}", syms)
        if s is not None:
            syms[f"s{i}"] = s
    return syms

def playing(n=2):
    """n ready players, map cleared to floor so tests are exact."""
    g = TankBattleLogic(); seat(g, n)
    for s in SEATS[:n]:
        g.make_move(s, action_type="set_ready")
    assert g.phase == "playing"
    g.grid = [["."] * 15 for _ in range(15)]
    return g

# [lobby] seating, spectator, rejoin, registration
g = TankBattleLogic(); syms = seat(g, 5)
assert list(syms.values()) == ["TL", "TR", "BL", "BR"], syms
assert g.on_player_join("s0", syms) == "TL"
assert isinstance(get_game_logic("tank-battle"), TankBattleLogic)

# [lobby] map is fair, and spawns are open
m = TankBattleLogic().get_state()["map"]
assert len(m) == 15 and all(len(r) == 15 for r in m)
assert m == m[::-1] and all(r == r[::-1] for r in m)
assert any("S" in r for r in m) and any("C" in r for r in m)
for r, c, _ in SPAWN.values():
    assert m[r][c] == "."

# [lobby] auto-start when every seated player is ready
g = TankBattleLogic(); seat(g, 2)
assert g.make_move("TL", action_type="set_ready") and g.phase == "lobby"
assert g.make_move("TR", action_type="set_ready") and g.phase == "playing"
st = g.get_state()
assert set(st["tanks"]) == {"TL", "TR"}
assert st["tanks"]["TL"] == {"x": 60.0, "y": 60.0, "angle": 45.0, "alive": True, "blink": False}
assert st["tanks"]["BR" if "BR" in st["tanks"] else "TR"]["x"] == 540.0
assert not g.make_move("TL", action_type="set_ready")      # not in the lobby any more
json.dumps(st)

# [lobby] Start with N players; a not-ready seat sits out; bad input
g = TankBattleLogic(); seat(g, 3)
g.make_move("TL", action_type="set_ready")
assert not g.make_move("TL", action_type="start")          # only 1 ready
assert not g.make_move("TR", action_type="start")          # TR is not ready
g.make_move("TR", action_type="set_ready")
assert g.phase == "lobby"                                  # BL is not ready yet
assert g.make_move("TR", action_type="start") and g.phase == "playing"
assert g.active["BL"] is False and "BL" not in g.tanks and g.lives["BL"] == 0
assert not g.make_move("XX", action_type="set_ready")      # no seat (spectator)
assert not g.make_move("TL", action_type="dance")
assert not g.make_move("TL")

# [lobby] reset keeps seats, clears ready, restores the map
g.grid[2][6] = "."
g.reset()
assert g.phase == "lobby" and g.seated == {"TL", "TR", "BL"} and not any(g.ready.values())
assert g.tanks == {} and g.shells == [] and g.winner is None and g.knockout_order == []
assert g.lives == {s: LIVES for s in SEATS}
assert g.get_state()["map"] == TankBattleLogic().get_state()["map"]
print("lobby OK")

# ── step 2 sections ──
# bad drive/turn values; a sitting-out seat cannot drive
g = TankBattleLogic(); seat(g, 3)
g.make_move("TL", action_type="set_ready"); g.make_move("TR", action_type="set_ready")
g.make_move("TL", action_type="start")
assert not g.make_move("BL", action_type="drive", state="fwd")
assert not g.make_move("TL", action_type="drive", state="sideways")
assert not g.make_move("TL", action_type="turn", state="fwd")
assert g.make_move("TL", action_type="turn", state="right")
g.tick()
assert g.tanks["TL"]["angle"] == 50.0

# movement is blocked by steel
g = playing(); t = g.tanks["TL"]; t["angle"] = 0.0
g.grid[1][3] = "S"                                         # x 120..160, same row as the tank
assert g.make_move("TL", action_type="drive", state="fwd")
for _ in range(40): g.tick()
assert 102 <= t["x"] <= 105 and t["y"] == 60, t

# sliding along a wall
g = playing(); t = g.tanks["TL"]; t["angle"] = 30.0
for r in range(15): g.grid[r][3] = "S"
g.make_move("TL", action_type="drive", state="fwd")
for _ in range(60): g.tick()
assert t["x"] <= 105 and t["y"] > 120, t

# movement is blocked by another tank
g = playing(); t = g.tanks["TL"]; t["angle"] = 0.0
g.tanks["TR"]["x"], g.tanks["TR"]["y"] = 120.0, 60.0
g.make_move("TL", action_type="drive", state="fwd")
for _ in range(30): g.tick()
assert t["x"] <= 90, t

# a shell breaks a crate; steel stays
g = playing(); g.tanks["TL"]["angle"] = 0.0
g.grid[1][4] = "C"; g.grid[1][7] = "S"
assert g.make_move("TL", action_type="fire")
for _ in range(20): g.tick()
assert g.grid[1][4] == "." and g.shells == []
assert g.make_move("TL", action_type="fire")
for _ in range(40): g.tick()
assert g.grid[1][7] == "S" and g.shells == [] and g.lives["TR"] == LIVES

# a hit costs a heart, and the blink stops a second hit
g = playing(); g.tanks["TL"]["angle"] = 0.0
g.tanks["TR"]["x"], g.tanks["TR"]["y"] = 200.0, 60.0
g.make_move("TL", action_type="fire")
for _ in range(15): g.tick()
assert g.lives["TR"] == LIVES - 1 and g.get_state()["tanks"]["TR"]["blink"]
g.make_move("TL", action_type="fire")
for _ in range(15): g.tick()
assert g.lives["TR"] == LIVES - 1 and g.shells == []       # blinking: the shell stops, no damage
for _ in range(40): g.tick()
g.make_move("TL", action_type="fire")
for _ in range(15): g.tick()
assert g.lives["TR"] == LIVES - 2

# own shells never hit their tank
g = playing()
g.shells.append({"x": 60.0, "y": 60.0, "vx": 0.0, "vy": 0.0, "owner": "TL"})
g.tick()
assert g.lives["TL"] == LIVES and len(g.shells) == 1

# shell limit and cooldown
g = playing(); g.tanks["TL"]["angle"] = 90.0               # straight down an open lane
assert g.make_move("TL", action_type="fire")
assert not g.make_move("TL", action_type="fire")           # cooldown
for _ in range(FIRE_COOLDOWN): g.tick()
assert g.make_move("TL", action_type="fire")
for _ in range(FIRE_COOLDOWN): g.tick()
assert not g.make_move("TL", action_type="fire")           # already 2 in the air
assert len(g.shells) == 2

# knockout order, wreck, winner, reset
def kill(g, s):
    while g._alive(s):
        g.tanks[s]["blink"] = 0
        g._hit(s)
g = playing(3)
kill(g, "BL")
assert g.knockout_order == ["BL"] and g.last_out == "BL" and g.phase == "playing"
assert g.get_state()["tanks"]["BL"]["alive"] is False
assert not g.make_move("BL", action_type="fire")
g.tanks["TL"]["angle"] = 90.0                              # BL's wreck is at (60, 540), straight below
g.make_move("TL", action_type="fire")
for _ in range(60): g.tick()
assert g.shells == [] and g.knockout_order == ["BL"]        # the wreck stopped the shell
kill(g, "TR")
assert g.winner == "TL" and g.phase == "finished" and g.knockout_order == ["BL", "TR"] and not g.is_draw
g.tick()                                                    # no-op once finished
g.reset()
assert g.phase == "lobby" and g.tanks == {} and g.winner is None
assert g.get_state()["map"] == TankBattleLogic().get_state()["map"]

# smoke: 4 tanks on the real map, 20 s of driving, turning and firing
g = TankBattleLogic(); seat(g, 4)
for s in SEATS: g.make_move(s, action_type="set_ready")
for s in SEATS:
    g.make_move(s, action_type="drive", state="fwd")
    g.make_move(s, action_type="turn", state="right" if s in ("TL", "BR") else "left")
for i in range(600):
    if i % 7 == 0:
        for s in SEATS:
            if g.phase == "playing" and g._alive(s):
                g.make_move(s, action_type="fire")
    g.tick()
    json.dumps(g.get_state())
    for a in g.tanks.values():
        assert 15 <= a["x"] <= 585 and 15 <= a["y"] <= 585
print("physics OK")
```
*Tidy-up for the builder:* the line `assert st["tanks"]["BR" if ...]["x"] == 540.0` is meant to check TR's x. Write it simply as `assert st["tanks"]["TR"]["x"] == 540.0 and st["tanks"]["TR"]["angle"] == 135.0`.

## Reference C: `frontend/src/lib/tankBattle.ts`
```ts
import { nameForSymbol, winsFor } from "./players";
import type { MatchScore } from "./types";

export type Seat = "TL" | "TR" | "BL" | "BR";
export const SEATS: Seat[] = ["TL", "TR", "BL", "BR"];

/** label: tank colour name; corner: spawn corner; color: Tailwind class; hex: SVG fill. */
export const SEAT_INFO: Record<Seat, { label: string; corner: string; color: string; hex: string }> = {
  TL: { label: "Blue", corner: "Top-left", color: "bg-candy-blue", hex: "#4d96ff" },
  TR: { label: "Pink", corner: "Top-right", color: "bg-candy-pink", hex: "#ff6fa8" },
  BL: { label: "Purple", corner: "Bottom-left", color: "bg-candy-purple", hex: "#8b5cf6" },
  BR: { label: "Orange", corner: "Bottom-right", color: "bg-candy-orange", hex: "#ff8c42" },
};

export type DriveState = "fwd" | "back" | "stop";
export type TurnState = "left" | "right" | "stop";
export interface TankView { x: number; y: number; angle: number; alive: boolean; blink: boolean }
export interface ShellView { x: number; y: number; owner: Seat }
export interface Burst { id: number; x: number; y: number }

type WithSymbols = { symbols?: Record<string, string> } | null | undefined;

/** Seats that someone holds, in seat order. */
export function seatedSeats(gs: WithSymbols): Seat[] {
  const taken = Object.values(gs?.symbols ?? {});
  return SEATS.filter(s => taken.includes(s));
}

/** Winner first, then the others from last knocked out to first. */
export function ranking(winner: Seat | null, knockoutOrder: Seat[]): Seat[] {
  const rest = [...knockoutOrder].reverse();
  return winner ? [winner, ...rest] : rest;
}

/** "Match wins — Mo 2 · Sara 1 · Ali 0" */
export function matchWinsLine(gs: WithSymbols, ms: MatchScore | undefined): string {
  const parts = seatedSeats(gs).map(s => `${nameForSymbol(gs, s) ?? SEAT_INFO[s].label} ${winsFor(ms, s)}`);
  return `Match wins — ${parts.join(" · ")}`;
}
```

## Reference D: `frontend/src/components/games/TankBattleArena.tsx`
```tsx
"use client";
import { SEATS, SEAT_INFO, type Burst, type Seat, type ShellView, type TankView } from "@/lib/tankBattle";

const INK = "#2b2240";
const STEEL = "#8d86a3";
const BLINK_CSS = "@keyframes tank-blink { 50% { opacity: 0.25; } }";

export interface ArenaSize { field: number; tile: number; tankR: number; shellR: number }

interface TankBattleArenaProps {
  size: ArenaSize;
  scale: number;
  map: string[];
  tanks: Partial<Record<Seat, TankView>>;
  shells: ShellView[];
  bursts: Burst[];
  mySeat: Seat | null;
  countdown: string | null;
  banner: string | null;
}

export default function TankBattleArena({
  size, scale: s, map, tanks, shells, bursts, mySeat, countdown, banner,
}: TankBattleArenaProps) {
  const { field, tile, tankR, shellR } = size;
  const k = tankR / 15; // the tank drawing is made for radius 15
  const me = mySeat ? tanks[mySeat] : undefined;
  const tagBelow = !!me && me.y - tankR - 6 < 12;

  return (
    <div className="relative chunk overflow-hidden" style={{ width: field * s, height: field * s, boxSizing: "content-box" }}>
      <svg viewBox={`0 0 ${field} ${field}`} width={field * s} height={field * s} className="block" aria-hidden="true">
        <defs><style>{BLINK_CSS}</style></defs>
        <rect width={field} height={field} fill="#f4dca8" />

        {/* Steel blocks and crates */}
        {map.flatMap((row, r) => [...row].map((cell, c) => {
          const x = c * tile, y = r * tile;
          if (cell === "S") return (
            <g key={`${r},${c}`}>
              <rect x={x + 1} y={y + 1} width={tile - 2} height={tile - 2} rx={4} fill={STEEL} stroke={INK} strokeWidth={2} />
              <rect x={x + 7} y={y + 7} width={tile - 14} height={6} rx={2} fill="#d6d1e3" />
            </g>
          );
          if (cell === "C") return (
            <g key={`${r},${c}`}>
              <rect x={x + 2} y={y + 2} width={tile - 4} height={tile - 4} rx={3} fill="#c98a4b" stroke={INK} strokeWidth={2} />
              <path d={`M${x + 8} ${y + 8}L${x + tile - 8} ${y + tile - 8}M${x + tile - 8} ${y + 8}L${x + 8} ${y + tile - 8}`}
                stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
            </g>
          );
          return null;
        }))}

        {/* Tanks: treads, body, barrel, turret; wrecks are grey; a hit tank blinks */}
        {SEATS.map(seat => {
          const t = tanks[seat];
          if (!t) return null;
          const fill = t.alive ? SEAT_INFO[seat].hex : STEEL;
          return (
            <g key={seat} transform={`translate(${t.x} ${t.y}) rotate(${t.angle}) scale(${k})`}
              opacity={t.alive ? 1 : 0.85}
              style={t.blink ? { animation: "tank-blink 0.2s steps(1) infinite" } : undefined}>
              <rect x={-15} y={-15} width={30} height={7} rx={2} fill={INK} />
              <rect x={-15} y={8} width={30} height={7} rx={2} fill={INK} />
              <rect x={-12} y={-10} width={24} height={20} rx={4} fill={fill} stroke={INK} strokeWidth={2} />
              <rect x={0} y={-3} width={21} height={6} rx={2} fill={INK} />
              <circle r={7} fill={fill} stroke={INK} strokeWidth={2} />
            </g>
          );
        })}

        {/* Shells, ringed in the owner's colour */}
        {shells.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={shellR} fill={INK} stroke={SEAT_INFO[b.owner]?.hex ?? INK} strokeWidth={2} />
        ))}

        {/* "▼ you" over your own tank (below it near the top edge) */}
        {me?.alive && (
          <text x={me.x} y={tagBelow ? me.y + tankR + 16 : me.y - tankR - 6} textAnchor="middle"
            fontSize={12} fontWeight={900} fill={INK}>{tagBelow ? "▲ you" : "▼ you"}</text>
        )}
      </svg>

      {/* 💥 bursts (HTML so animate-pop scales around the centre) */}
      {bursts.map(b => (
        <div key={b.id} aria-hidden="true" className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: b.x * s, top: b.y * s }}>
          <div className="animate-pop text-2xl sm:text-3xl">💥</div>
        </div>
      ))}

      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={countdown} className="chunk bg-white text-ink font-black text-5xl sm:text-7xl px-6 py-2 animate-pop">{countdown}</div>
        </div>
      )}
      {banner !== null && countdown === null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={banner} className="chunk bg-white text-ink font-black text-xl sm:text-3xl px-5 py-2 animate-pop text-center max-w-[80%]">{banner}</div>
        </div>
      )}
    </div>
  );
}
```

## Reference E: `frontend/src/components/games/TankBattleCard.tsx`
```tsx
"use client";
import Avatar from "@/components/ui/Avatar";
import { hearts } from "@/lib/players";
import { SEAT_INFO, type Seat } from "@/lib/tankBattle";

export type TankCardState = "playing" | "out" | "sitting" | "empty";

interface TankBattleCardProps {
  seat: Seat;
  name?: string;
  lives: number;
  livesMax: number;
  state: TankCardState;
  isMe: boolean;
}

export default function TankBattleCard({ seat, name, lives, livesMax, state, isMe }: TankBattleCardProps) {
  const shown = state === "empty" ? "Empty" : name ?? SEAT_INFO[seat].label;
  return (
    <div className={`chunk bg-white text-ink flex items-center gap-2 px-2 py-2 min-w-0 ${state === "out" ? "opacity-50 grayscale" : ""} ${isMe ? "ring-4 ring-candy-yellow" : ""}`}>
      <Avatar name={state === "empty" ? "" : name ?? ""} size={32} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{shown}{isMe && " (you)"}</div>
        <div className="flex items-center gap-1.5 text-xs text-ink/60 font-bold">
          <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
          {SEAT_INFO[seat].label}
        </div>
        <div className="text-sm font-bold whitespace-nowrap">
          {state === "playing" ? hearts(livesMax - lives, livesMax) : state === "out" ? "💥 Out" : state === "sitting" ? "🪑 Sits out" : "—"}
        </div>
      </div>
    </div>
  );
}
```

## Reference F: `frontend/src/components/games/TankBattle.tsx`, the parts that differ from `PongFour.tsx`
`PongFour.tsx` is the template. Its structure, the loading spinner, the lobby markup, the countdown effect (lines 94–110), the knockout banner effect (119–127), the timer cleanup, the ResizeObserver scaling (135–153), the `ResultOverlay` block (310–329) and the `MEDALS` list are copied and adapted as follows.

**State read from the server:**
```ts
const phase = gameState?.phase ?? "lobby";
const ready: Record<string, boolean> = gameState?.ready ?? {};
const active: Record<string, boolean> = gameState?.active ?? {};
const lives: Record<string, number> = gameState?.lives ?? {};
const tanks: Partial<Record<Seat, TankView>> = gameState?.tanks ?? {};
const shells: ShellView[] = gameState?.shells ?? [];
const map: string[] = gameState?.map ?? [];
const FIELD: number = gameState?.field ?? 600;
const TILE: number = gameState?.tile ?? 40;
const TANK_R: number = gameState?.tank_r ?? 15;
const SHELL_R: number = gameState?.shell_r ?? 5;
const LIVES_MAX: number = gameState?.lives_max ?? 3;
const knockoutOrder: Seat[] = gameState?.knockout_order ?? [];
const lastOut: Seat | null = gameState?.last_out ?? null;
const winner: Seat | null = gameState?.winner ?? null;
const mySeat = SEATS.find(s => s === mySymbol) ?? null;
const iCanMove = phase === "playing" && !!mySeat && !!tanks[mySeat]?.alive;
```

**Senders:**
```ts
const sendMove = (action_type: "set_ready" | "start") => ws.send(JSON.stringify({ action: "move", action_type }));
const sendInput = useCallback((action_type: "drive" | "turn", state: DriveState | TurnState) => {
  ws.send(JSON.stringify({ action: "move", action_type, state }));
}, [ws]);
const sendFire = useCallback(() => {
  ws.send(JSON.stringify({ action: "move", action_type: "fire" }));
}, [ws]);
```

**Keyboard.** Driving and turning are separate held axes; Space fires. Keys typed into the chat box are left alone.
```ts
const KEYS: Record<string, { axis: "drive" | "turn"; state: "fwd" | "back" | "left" | "right" }> = {
  ArrowUp: { axis: "drive", state: "fwd" }, w: { axis: "drive", state: "fwd" }, W: { axis: "drive", state: "fwd" },
  ArrowDown: { axis: "drive", state: "back" }, s: { axis: "drive", state: "back" }, S: { axis: "drive", state: "back" },
  ArrowLeft: { axis: "turn", state: "left" }, a: { axis: "turn", state: "left" }, A: { axis: "turn", state: "left" },
  ArrowRight: { axis: "turn", state: "right" }, d: { axis: "turn", state: "right" }, D: { axis: "turn", state: "right" },
};
// (module level, above the component)

useEffect(() => {
  if (!iCanMove) return;
  // Held states per axis, most recent last; the last one wins
  const held: Record<"drive" | "turn", string[]> = { drive: [], turn: [] };
  const typing = (e: KeyboardEvent) =>
    e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
  const sendAxis = (axis: "drive" | "turn") =>
    sendInput(axis, (held[axis][held[axis].length - 1] ?? "stop") as DriveState | TurnState);
  const onDown = (e: KeyboardEvent) => {
    if (typing(e)) return;
    if (e.key === " ") { e.preventDefault(); if (!e.repeat) sendFire(); return; }
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault(); // Stop page scrolling for all tank keys
    if (e.repeat || held[k.axis].includes(k.state)) return;
    held[k.axis].push(k.state);
    sendAxis(k.axis);
  };
  const onUp = (e: KeyboardEvent) => {
    const k = KEYS[e.key];
    if (!k) return;
    held[k.axis] = held[k.axis].filter(x => x !== k.state);
    sendAxis(k.axis);
  };
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    sendInput("drive", "stop");
    sendInput("turn", "stop");
  };
}, [iCanMove, sendInput, sendFire]);
```

**Touch controls** (`md:hidden`, live players only). A held button sends its state on press and "stop" on release, so driving and turning can be held together with two fingers.
```tsx
const holdBtn = (axis: "drive" | "turn", state: DriveState | TurnState, label: string, glyph: string) => (
  <button aria-label={label}
    className="game-btn btn-toy touch-none w-16 h-16 rounded-2xl bg-candy-yellow text-ink text-3xl font-black flex items-center justify-center"
    onPointerDown={(e) => { e.preventDefault(); sendInput(axis, state); }}
    onPointerUp={() => sendInput(axis, "stop")}
    onPointerCancel={() => sendInput(axis, "stop")}
    onContextMenu={(e) => e.preventDefault()}>{glyph}</button>
);
// layout:
<div className="md:hidden flex items-center justify-between w-full max-w-sm gap-3">
  <div className="flex gap-2">{holdBtn("turn", "left", "Turn left", "⟲")}{holdBtn("turn", "right", "Turn right", "⟳")}</div>
  <div className="flex flex-col gap-2">{holdBtn("drive", "fwd", "Drive forward", "▲")}{holdBtn("drive", "back", "Reverse", "▼")}</div>
  <button aria-label="Fire"
    className="game-btn btn-toy touch-none w-24 h-24 rounded-full bg-candy-red text-white text-xl font-black"
    onPointerDown={(e) => { e.preventDefault(); sendFire(); }}
    onContextMenu={(e) => e.preventDefault()}>FIRE</button>
</div>
// desktop hint (hidden md:flex): "W / ↑ forward", "S / ↓ reverse", "A D / ← → turn", "Space fire"
```

**Layout (playing / finished):**
```tsx
<div ref={areaRef} className="@container flex-1 flex flex-col items-center justify-center gap-3 p-4 relative select-none overflow-hidden">
  {/* Narrow: 2×2 cards above the arena, in seat order TL TR / BL BR */}
  <div className="@3xl:hidden grid grid-cols-2 gap-2 w-full max-w-sm">
    {SEATS.map(s => <div key={s} className="min-w-0">{card(s)}</div>)}
  </div>
  {/* Wide: cards at the four corners of the arena */}
  <div className="flex justify-center @3xl:grid @3xl:grid-cols-[180px_auto_180px] @3xl:grid-rows-2 @3xl:gap-3">
    <div className="hidden @3xl:block @3xl:col-start-1 @3xl:row-start-1 self-start">{card("TL")}</div>
    <div className="hidden @3xl:block @3xl:col-start-1 @3xl:row-start-2 self-end">{card("BL")}</div>
    <div className="@3xl:col-start-2 @3xl:row-start-1 @3xl:row-span-2">
      <TankBattleArena size={{ field: FIELD, tile: TILE, tankR: TANK_R, shellR: SHELL_R }} scale={scale}
        map={map} tanks={tanks} shells={shells} bursts={bursts} mySeat={mySeat}
        countdown={countIdx !== null ? COUNTDOWN[countIdx] : null} banner={winner ? null : banner} />
    </div>
    <div className="hidden @3xl:block @3xl:col-start-3 @3xl:row-start-1 self-start">{card("TR")}</div>
    <div className="hidden @3xl:block @3xl:col-start-3 @3xl:row-start-2 self-end">{card("BR")}</div>
  </div>
  {iCanMove && /* desktop hint + touch controls */}
  <ResultOverlay … />   {/* as PongFour, with SEAT_INFO[s].label as the name fallback */}
</div>
```
Card state: `!seated.includes(s) ? "empty" : !active[s] ? "sitting" : (lives[s] ?? 0) === 0 ? "out" : "playing"`.

**Scaling** (in the ResizeObserver `update`, `WIDE = 768`):
- wide: `w = clientWidth - (32 + 2*180 + 2*12 + 6)` and `h = clientHeight - (32 + 40 + 6)`.
- narrow: `w = clientWidth - (32 + 6)` and `h = clientHeight - (2*80 + 8 + 2*12 + 32 + 140 + 6)`.
- `setScale(Math.max(Math.min(w / FIELD, Math.max(h, 100) / FIELD, 1), 0.1))`. Step 7 tunes the narrow constants.

**Lobby** (as PongFour, with these changes):
- The icon is `🛡️` (✅ when you are ready) and the title is "Tank Battle".
- Each seat tile's second line is `<dot> {label} · {corner}`.
- The help text is "Needs at least 2 ready players. Players who are not ready sit the round out."

## Reference G: step 6 effects in `TankBattle.tsx`
```ts
const BURST_MS = 450;
const [bursts, setBursts] = useState<Burst[]>([]);
const burstId = useRef(0);
const burstTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
const addBurst = (x: number, y: number) => {
  const id = ++burstId.current;
  setBursts(b => [...b, { id, x, y }]);
  burstTimers.current.push(setTimeout(() => setBursts(b => b.filter(v => v.id !== id)), BURST_MS));
};

// A tank lost a heart: 💥 on it + "hit". Skip the lobby (reset makes the totals drop).
const livesKey = SEATS.map(s => (active[s] ? lives[s] ?? 0 : 0)).join(",");
useOnChange<string | null>(gameState ? livesKey : null, (next, prev) => {
  if (phase === "lobby" || next === null || prev === null) return;
  const n = next.split(",").map(Number), p = prev.split(",").map(Number);
  let any = false;
  SEATS.forEach((s, i) => { if (n[i] < p[i] && tanks[s]) { addBurst(tanks[s]!.x, tanks[s]!.y); any = true; } });
  if (any) play("hit");
});

// A crate broke: 💥 on its tile + "pop"
const mapKey = map.join("");
useOnChange<string | null>(gameState ? mapKey : null, (next, prev) => {
  if (phase === "lobby" || next === null || prev === null || next.length !== prev.length) return;
  const cols = map[0]?.length ?? 15;
  let any = false;
  for (let i = 0; i < next.length; i++) {
    if (prev[i] === "C" && next[i] === ".") {
      addBurst((i % cols) * TILE + TILE / 2, Math.floor(i / cols) * TILE + TILE / 2);
      any = true;
    }
  }
  if (any) play("pop");
});

// Someone fired: a shell count per owner went up
const shellsKey = SEATS.map(s => shells.filter(b => b.owner === s).length).join(",");
useOnChange<string | null>(gameState ? shellsKey : null, (next, prev) => {
  if (phase !== "playing" || next === null || prev === null) return;
  const n = next.split(",").map(Number), p = prev.split(",").map(Number);
  if (n.some((v, i) => v > p[i])) play("fire");
});
```
The countdown (`COUNTDOWN = ["3","2","1","Go!"]`, `COUNTDOWN_MS = 1500`) and the knockout banner (`KNOCKOUT_MS = 1500`, text `` `💥 ${nameForSymbol(gameState, lastOut) ?? SEAT_INFO[lastOut].label} is out!` ``) are copied from `PongFour.tsx` lines 94–127. The unmount cleanup also clears `burstTimers`.

`sound.ts`:
- Add `"fire"` to `SoundName`.
- Add `fire: [{ freq: 240, to: 90, at: 0, dur: 0.12, type: "square", gain: 0.07 }],` to `SOUNDS`.

## Reference H: catalogue, rules, cover, README
`games.ts`, inserted right after the `pong-4` entry:
```ts
{
  key: "tank-battle", title: "Tank Battle", cover: "/games/tank_battle_cover.svg", emoji: "🛡️",
  category: "Action", playTime: "5 min", accent: "yellow",
  description: "2 to 4 tanks, one arena. Drive, shoot and smash crates. The last tank with hearts left wins!",
},
```
`gameRules.ts`, inserted right after `"pong-4"`:
```ts
"tank-battle": {
  title: "Tank Battle",
  icon: "🛡️",
  objective: "Shoot the other tanks and be the last tank with hearts left.",
  rules: [
    "2 to 4 players each drive a tank from one corner: Blue, Pink, Purple and Orange.",
    "Everyone presses Ready. The match starts when all seated players are ready, or when a ready player presses Start (at least 2 ready). Players who are not ready sit the round out.",
    "W / ↑ drives forward, S / ↓ reverses, A / D or ← / → turns, and Space fires. On a phone, hold ▲ ▼ ⟲ ⟳ and tap FIRE.",
    "Shells fly straight and stop at the first wall, crate or tank. You can have 2 shells in the air at once.",
    "Grey steel blocks never break. Wooden crates break in one hit.",
    "Each hit costs a heart, and everyone starts with 3. After a hit your tank blinks and cannot be hit for 1 second.",
    "With no hearts left your tank is out and stays on the map as a wreck. The last tank with hearts wins.",
  ],
  tips: ["Your own shells can't hurt you. Break crates to open new lanes and use steel as cover."],
},
```
`README.md`: in the Games table, add the row `| Tank Battle | Real-time | 2–4 |` after `| Ping-Pong | Real-time | 2 |`.

`frontend/public/games/tank_battle_cover.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
  <rect width="400" height="240" fill="#f4dca8"/>
  <path d="M40 0V240M80 0V240M120 0V240M160 0V240M200 0V240M240 0V240M280 0V240M320 0V240M360 0V240M0 40H400M0 80H400M0 120H400M0 160H400M0 200H400" stroke="#2b2240" stroke-opacity="0.08" stroke-width="2"/>
  <g fill="#8d86a3" stroke="#2b2240" stroke-width="3">
    <rect x="161" y="41" width="38" height="38" rx="4"/>
    <rect x="161" y="161" width="38" height="38" rx="4"/>
    <rect x="281" y="161" width="38" height="38" rx="4"/>
    <rect x="41" y="41" width="38" height="38" rx="4"/>
  </g>
  <g fill="#d6d1e3">
    <rect x="167" y="47" width="26" height="6" rx="2"/>
    <rect x="167" y="167" width="26" height="6" rx="2"/>
    <rect x="287" y="167" width="26" height="6" rx="2"/>
    <rect x="47" y="47" width="26" height="6" rx="2"/>
  </g>
  <rect x="202" y="102" width="36" height="36" rx="3" fill="#c98a4b" stroke="#2b2240" stroke-width="3"/>
  <path d="M208 108L232 132M232 108L208 132" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>
  <g transform="translate(90 120) scale(1.7)">
    <rect x="-15" y="-15" width="30" height="7" rx="2" fill="#2b2240"/>
    <rect x="-15" y="8" width="30" height="7" rx="2" fill="#2b2240"/>
    <rect x="-12" y="-10" width="24" height="20" rx="4" fill="#4d96ff" stroke="#2b2240" stroke-width="2"/>
    <rect x="0" y="-3" width="21" height="6" rx="2" fill="#2b2240"/>
    <circle r="7" fill="#4d96ff" stroke="#2b2240" stroke-width="2"/>
  </g>
  <g transform="translate(330 120) rotate(180) scale(1.7)">
    <rect x="-15" y="-15" width="30" height="7" rx="2" fill="#2b2240"/>
    <rect x="-15" y="8" width="30" height="7" rx="2" fill="#2b2240"/>
    <rect x="-12" y="-10" width="24" height="20" rx="4" fill="#ff6fa8" stroke="#2b2240" stroke-width="2"/>
    <rect x="0" y="-3" width="21" height="6" rx="2" fill="#2b2240"/>
    <circle r="7" fill="#ff6fa8" stroke="#2b2240" stroke-width="2"/>
  </g>
  <circle cx="160" cy="120" r="7" fill="#2b2240" stroke="#4d96ff" stroke-width="3"/>
  <text x="220" y="122" font-size="48" text-anchor="middle" dominant-baseline="central">💥</text>
</svg>
```
The emoji badge covers the top-right corner of the cover box, so that area is left empty.

---

## Steps

### 1. Backend: TankBattleLogic lobby, map and state, registered as tank-battle
- **Test first.** Write `/tmp/tank_check.py` with only the `[lobby]` sections of Reference B, ending in `print("lobby OK")`. Run `python3 /tmp/tank_check.py` from the repo root. It should fail with `ModuleNotFoundError: No module named 'games.tank_battle'`.
- **Implement.**
  - Create `backend/games/tank_battle.py` from Reference A without the `# step 2` parts: drop the `drive`, `turn` and `fire` branches of `make_move`, and everything below the `step 2` marker except `reset()`.
  - Add a `tick()` that only returns. The game loop still runs; nothing moves yet.
  - In `backend/games/__init__.py`, add `from .tank_battle import TankBattleLogic` and `elif game_type == "tank-battle": return TankBattleLogic()`.
- **Pass.** `python3 /tmp/tank_check.py` prints `lobby OK`.
- **Commit:** `feat(backend): Tank Battle lobby, map and state (GH-42)`

### 2. Backend: tank movement, shells, crates, hits, knockout and winner
- **Test first.** Replace `/tmp/tank_check.py` with the full Reference B (apply its tidy-up note). Run it: it should fail at the first step-2 check. `make_move(..., action_type="turn", state="right")` returns False.
- **Implement.** Add the `drive`, `turn` and `fire` branches to `make_move`, plus `_fire`, `tick`, `_move_tank`, `_tank_blocked`, `_solid_tile_near`, `_tank_hit_by`, `_move_shells` and `_hit`, exactly as in Reference A.
- **Pass.** `python3 /tmp/tank_check.py` prints `lobby OK`, then `physics OK`.
- **Commit:** `feat(backend): Tank Battle movement, shells and knockouts (GH-42)`

### 3. Tank Battle cover art and README row
- Create `frontend/public/games/tank_battle_cover.svg` from Reference H.
- Add the README row from Reference H.
- **Check:** `grep -c '<svg' frontend/public/games/tank_battle_cover.svg` prints 1. Open the file in a browser: it shows a blue tank firing at a crate with a 💥, a pink tank on the right, and grey steel blocks.
- **Commit:** `feat(ui): Tank Battle cover and README entry (GH-42)`

### 4. Frontend: tankBattle lib, TankBattleArena and TankBattleCard
- Run `cd frontend; npm ci` once if `node_modules` is missing.
- Create `frontend/src/lib/tankBattle.ts` (Reference C), `frontend/src/components/games/TankBattleArena.tsx` (Reference D) and `frontend/src/components/games/TankBattleCard.tsx` (Reference E).
- They are not used yet.
- **Check:** `cd frontend; npx eslint src/lib/tankBattle.ts src/components/games/TankBattleArena.tsx src/components/games/TankBattleCard.tsx` reports no problems, and `npm run build` passes.
- **Commit:** `feat(ui): Tank Battle arena, card and seat helpers (GH-42)`

### 5. Frontend: TankBattle screen (lobby, layout, controls, result) wired into the app
- **Create `frontend/src/components/games/TankBattle.tsx`** from `PongFour.tsx` and Reference F: the loading spinner, the lobby, the playing layout, keyboard and touch input, and `ResultOverlay` with the ranking.
- **For now**, pass `countdown={null}`, `banner={null}` and `bursts={[]}`.
- **Wire it in:**
  - `room/[id]/page.tsx`: `import TankBattle from "@/components/games/TankBattle";` and `case "tank-battle": return <TankBattle ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;`
  - `games.ts` and `gameRules.ts`: the entries from Reference H.
- **Check:**
  - `npx eslint` on the 4 changed files is clean, and `npm run build` passes.
  - Manual test with the backend running and 2 tabs: both press Ready and the match auto-starts. Tanks drive, turn, slide along walls and fire. Crates break and hits cost hearts. The last tank standing shows "You win! 🎉" with the 🥇🥈 ranking, and Play again returns to the lobby.
- **Commit:** `feat(ui): Tank Battle game screen and lobby entry (GH-42)`

### 6. Frontend: countdown, knockout banner, sounds and 💥 bursts
- Add the effects in Reference G to `TankBattle.tsx`: the 3-2-1-Go countdown, the "💥 Name is out!" banner, `fire`/`hit`/`pop` sounds and the 💥 bursts. Pass them to the arena.
- Add the `fire` sound to `frontend/src/lib/sound.ts`.
- **Check:**
  - `npx eslint` on the 2 files is clean, and `npm run build` passes.
  - Manual test:
    - The countdown plays at the start, and refreshing mid-match does not replay it.
    - A shot plays `fire`. A hit plays `hit` and shows 💥 on the tank. A broken crate plays `pop` and shows 💥 on the tile.
    - A knockout shows the banner, but not on the final knockout (the result takes over).
    - Play again does not trigger bursts.
- **Commit:** `feat(ui): Tank Battle countdown, knockout banner, sounds and bursts (GH-42)`

### 7. QA pass: 2, 3 and 4 players plus a spectator, desktop and 375px
Run the full matrix with the backend and `npm run dev`:
1. 2 players: auto-start.
2. 3 players: 2 ready plus "Start with 2 players". The 3rd card shows "🪑 Sits out", there is no tank for them, and their keys do nothing.
3. 4 players: auto-start and a full knockout to a winner. The wrecks stay grey and block tanks and shells. Only the winner's match tally goes up by 1.
4. A 5th tab is a spectator. It sees everything, has no Ready/Start/controls, and the result says "{name} wins!".
5. Close a player's tab mid-match: their tank keeps its last input and can still be shot, so the match ends. Reopen it with the same session: they get the seat back.
6. Refresh mid-match: no countdown replay.
7. Typing in the chat (w/a/s/d/space) works and does not move your tank.
8. At 375×667: the 2×2 cards, the arena (at least 280px wide) and the touch buttons fit. Hold ▲ and ⟳ together to drive in a circle; FIRE works; long-press opens no menu. Tune the narrow scaling constants in `TankBattle.tsx` if needed.
9. Desktop ≥ 1024px with chat open: the cards sit at the 4 corners of the arena, with no overflow.
10. 4-Player Pong and Ping-Pong are unchanged.

Fix issues only in the Tank Battle files. Re-run `python3 /tmp/tank_check.py`, `cd frontend; npm run lint; npm run build`.

**Commit** fixes, if there are any: `fix(ui): Tank Battle QA fixes (GH-42)`

## Final verification
- `python3 /tmp/tank_check.py` (from the repo root, not committed) prints `lobby OK` and `physics OK`.
- `cd frontend; npm ci; npm run lint; npm run build`: the build passes, and lint reports nothing in the Tank Battle files or the other changed files.
- The manual QA matrix in step 7 passes on desktop and at 375px.
- `git diff main --stat` touches only the 12 files in the file map.

## Notes
- **The design names a `fire` sound, but `sound.ts` has no `fire`.** Step 6 adds that one entry. It is the only change to a shared file. To avoid it, step 6 would map firing to the existing `click` sound instead.
- **Inputs are held states.** A closed tab keeps its last drive/turn input, as in 4-Player Pong (`main.py` does not tell the game about a disconnect). The tank keeps moving or turning, can still be shot, and the match still ends.
- **`is_draw` is always False.** `_move_shells` stops as soon as only one tank is alive, so two last tanks can never both go out in the same tick.
- **Tank sizes are sent in the state** (`tank_r`, `shell_r`, `tile`, `field`), so the client never hard-codes them; its fallbacks match the server.
