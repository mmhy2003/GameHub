# GH-72 — Snake Arena: implementation plan

**Goal:** Add a 15th game, **Snake Arena** (`snake-arena`). It is a server-run, 2–6 player snake.io-style round. Snakes grow by eating pellets, crash into each other, respawn after 3 s, and the longest snake when the 3:00 timer ends wins.

**Architecture:**
- The backend is one new logic class, `SnakeArenaLogic` in `backend/games/snake_arena.py`. It has `needs_server_loop = True`, so the existing 30 Hz loop in `backend/main.py` ticks it, counts the result with `record_result()` and broadcasts its state. `main.py` is not changed.
- The frontend copies the Tank Battle split:
  - `lib/snakeArena.ts` holds seats, types and helpers.
  - `SnakeArena.tsx` handles the lobby, input, countdown, banner, cards, result and sounds.
  - `SnakeArenaCanvas.tsx` is a `<canvas>` renderer with a camera that follows your head, a minimap and an HTML HUD.
- The game is wired in through the room page switch, `data/games.ts`, `data/gameRules.ts`, a cover SVG and the README.

**Conventions:**
- There is no test runner and no CI.
  - Backend steps use check scripts in `/tmp` (never in the repo), run from the repo root with `python3`.
  - Frontend steps use a TypeScript error as the failing check.
- Gates, all run from `frontend/`:
  - `npm ci`, needed once because `node_modules` is missing in a fresh checkout.
  - `npx tsc --noEmit`, which must be clean.
  - `npm run lint`, with no new problems. Record the baseline number on the branch before your first frontend change; it was 15 at the last count (6 errors, 9 warnings), all in untouched files.
  - `npm run build`.
- Commits use conventional commits with a scope and `(GH-72)`.
- Never commit `.megoocolab/` or any `docs/` plan or design file.

## File map
| File | Action | Responsibility |
|---|---|---|
| `backend/games/snake_arena.py` | create | `SnakeArenaLogic`: seats, lobby, start, steering, body, eating, boost, crashes, death pellets, respawn, timer, winner/draw/ranking, state |
| `backend/games/__init__.py` | modify | import + `elif game_type == "snake-arena": return SnakeArenaLogic()` after `tank-battle` |
| `frontend/src/lib/snakeArena.ts` | create | `Seat`, `SEATS`, `SEAT_INFO`, `SnakeView`, `seatedSeats`, `ranking`, `matchWinsLine`, `clock`, `cameraFor` |
| `frontend/src/components/games/SnakeArenaCanvas.tsx` | create | canvas renderer (camera, grid, red out-of-bounds tint, pellets, snakes with eyes and name tags, minimap) + HTML HUD (timer, Longest board, your length), countdown and banner overlays |
| `frontend/src/components/games/SnakeArena.tsx` | create | lobby, pointer/touch/keyboard steering (≤15 steer msgs/s), boost, countdown, crash banner, 6 side cards (wide only), ⚡ button (narrow), sounds, `ResultOverlay` |
| `frontend/src/app/room/[id]/page.tsx` | modify | import + `case "snake-arena"` |
| `frontend/src/data/games.ts` | modify | catalog entry (Action, 3 min, green, 2–6) |
| `frontend/src/data/gameRules.ts` | modify | `"snake-arena"` rules |
| `frontend/public/games/snake_arena_cover.svg` | create | cover art |
| `README.md` | modify | games table row |

## Steps

### 1. Backend: Snake Arena seats, lobby, start, state and move validation; register `snake-arena`
- **Create `backend/games/snake_arena.py`** from Reference A, but leave out these methods for now: `_move`, `_follow`, `_eat`, `_crashes`, `_kill` and `_finish`. Use this `tick()` for now:
  ```python
  def tick(self):
      """Called by the server game loop each frame (~30fps)."""
      if self.phase != "playing":
          return
      self.ticks += 1   # movement, eating and crashes come in the next steps
  ```
- **Register the game** in `backend/games/__init__.py`:
  - Add `from .snake_arena import SnakeArenaLogic` after the `tank_battle` import.
  - Add `elif game_type == "snake-arena":` with `return SnakeArenaLogic()` after the `tank-battle` branch.
- **Test first.** Write `/tmp/snake_lobby_check.py` (Reference B) and run `python3 /tmp/snake_lobby_check.py` from the repo root.
  - Before the change, expect `AttributeError: 'NoneType' object has no attribute 'on_player_join'`.
  - After implementing, expect `lobby OK`.
- **Also run:**
  - `python3 -m compileall -q backend`, which must print no errors.
  - `python3 -c 'import sys; sys.path.insert(0, "backend"); import games'`, which must print no output.
- **Commit:** `feat(games): Snake Arena backend seats, lobby and state (GH-72)`

### 2. Backend: steering, body, eating, pellet refill and boost
- **Add** `_move`, `_follow` and `_eat` from Reference A, and change `tick()` to:
  ```python
  def tick(self):
      if self.phase != "playing":
          return
      self.ticks += 1
      for s in SEATS:
          sn = self.snakes.get(s)
          if sn is not None and sn["alive"]:
              self._move(sn)
      self._eat()
      self._refill_food()
  ```
- **The rules:**
  - The heading turns toward `target` by at most `MAX_TURN`, the short way round, and the angle is kept in [-π, π).
  - The head moves `SPEED`, or `BOOST_SPEED` while boosting. The body points are pulled to stay `SEG` apart.
  - A head within `EAT_R` of a pellet gains the pellet's value, capped at `MAX_LEN`.
  - Boosting needs `len > START_LEN`. Every 15th boosting tick costs 1 length and drops a value-1 pellet at the tail.
- **Test first.** Write `/tmp/snake_move_check.py` (Reference C).
  - Before the change, expect `AssertionError` at the first `close(b["angle"], 0.15)`.
  - After implementing, expect `movement OK`, and `python3 /tmp/snake_lobby_check.py` still prints `lobby OK`.
- **Commit:** `feat(games): Snake Arena steering, eating and boost (GH-72)`

### 3. Backend: crashes, death pellets, respawn, timer end, winner, draw and ranking
- **Add** `_crashes`, `_kill` and `_finish`, and change `tick()` to the final version in Reference A.
- **The rules:**
  - The crash check runs after all snakes have moved and eaten. Deaths are collected first and applied together.
  - A snake dies when its head leaves `[HEAD_R, WORLD - HEAD_R]`, or touches (`< HIT`) any point after the head of another alive snake.
  - When two heads touch, both snakes die. A snake never dies from its own body.
  - On death:
    - every second body point becomes a value-2 pellet;
    - `alive` and `boost` are set to False and `respawn` to `RESPAWN_TICKS`;
    - `pts` keeps only the head, for the camera;
    - `len` keeps the length at death, for the ranking.
  - Dead snakes count down and respawn through `_respawn`.
  - When `ticks >= ROUND_TICKS` the round finishes. A unique longest snake becomes `winner`; a tie sets `is_draw`.
- **Test first.** Write `/tmp/snake_end_check.py` (Reference D).
  - Before the change, expect an `AssertionError` at the first `not b["alive"]`.
  - After implementing, expect `crash and end OK`, and the other two scripts still pass.
- Also run `python3 -m compileall -q backend`.
- **Commit:** `feat(games): Snake Arena crashes, respawn and timed finish (GH-72)`

### 4. Frontend: `lib/snakeArena.ts` and the canvas renderer `SnakeArenaCanvas.tsx`
- **Create** `frontend/src/components/games/SnakeArenaCanvas.tsx` from Reference F.
- **Failing check:** run `npx tsc --noEmit` from `frontend/`. Expect `Cannot find module '@/lib/snakeArena'`.
- **Create** `frontend/src/lib/snakeArena.ts` from Reference E.
- **Pass:** `npx tsc --noEmit` is clean, `npm run lint` shows no new problems, and `npm run build` is green. Nothing renders the component yet.
- **Commit:** `feat(ui): Snake Arena seats and canvas renderer (GH-72)`

### 5. Frontend: the `SnakeArena` game component, wired into the room page
- **Edit** `frontend/src/app/room/[id]/page.tsx`:
  - Add `import SnakeArena from "@/components/games/SnakeArena";` after the TankBattle import.
  - Add this case after `case "tank-battle"`:
    ```tsx
    case "snake-arena":
      return <SnakeArena ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;
    ```
- **Failing check:** `npx tsc --noEmit` reports `Cannot find module '@/components/games/SnakeArena'`.
- **Create** `frontend/src/components/games/SnakeArena.tsx` from Reference G.
- **Pass:**
  - `npx tsc --noEmit`, `npm run lint` (no new problems) and `npm run build`.
  - A quick manual check without Docker:
    - Run `cd backend; uvicorn main:app --port 8000`, and in `frontend/` run `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev`.
    - Open `/room/<id>?game=snake-arena` in 2 tabs, the same way the home page builds room URLs for other games.
    - Ready both. Check that the countdown plays, steering follows the mouse, and the timer counts down.
- **Commit:** `feat(ui): Snake Arena game screen with camera, controls and results (GH-72)`

### 6. Catalog: lobby card, rules, cover art and README
- **Failing check:** `grep -c snake-arena frontend/src/data/games.ts frontend/src/data/gameRules.ts` prints `0` for both files.
- **`frontend/src/data/games.ts`:** add this entry right after the `tank-battle` entry:
  ```ts
  {
    key: "snake-arena", title: "Snake Arena", cover: "/games/snake_arena_cover.svg", emoji: "🐍",
    category: "Action", playTime: "3 min", accent: "green", minPlayers: 2, maxPlayers: 6,
    description: "2 to 6 snakes in one big arena. Eat to grow, make others crash into you, and be the longest when the 3-minute timer ends!",
  },
  ```
  `GameCard` then shows the yellow "👥 2–6 players" chip on its own.
- **`frontend/src/data/gameRules.ts`:** add the Reference I entry right after `"tank-battle"`.
- **Create** `frontend/public/games/snake_arena_cover.svg` from Reference H.
- **`README.md`:** add the row `| Snake Arena | Real-time | 2–6 |` after the Tank Battle row of the Games table.
- **Pass:** the grep prints `1` or more for both files. `npx tsc --noEmit`, `npm run lint` and `npm run build` pass. On the home page `npm run dev` shows the Snake Arena card with its cover and the 2–6 chip, and its ❓ help shows the rules.
- **Commit:** `feat(ui): add Snake Arena to the game catalog (GH-72)`

### 7. End-to-end check through Caddy and fixes
- **Run** `cp env.sample .env` if `.env` is missing, then `docker compose up -d --build`. Open http://localhost (or `:$HTTP_PORT`).
- **Manual pass:**
  - 3 browsers plus 1 spectator (a 4th join after 3 seats is still seated, so use a 7th join for a true spectator, or check spectating with players who never press Ready). Spectators follow the leader.
  - Desktop and a 375px-wide viewport. At narrow widths the cards are hidden, the ⚡ button shows, and dragging steers without scrolling the page.
  - Mouse steering, ←/→ and A/D, hold click, Space or ⚡ to boost (only when length > 10, and the length drops).
  - Crash into a body, a wall and head-on. Check the 💥 banner with the respawn countdown, the pellets that drop, and the respawn after 3 s.
  - The timer reaches 0:00 and the result overlay shows the ranking with lengths.
  - Play again goes back to the lobby with seats kept. Match wins carry over in the subtitle.
  - A page refresh mid-round does not replay the countdown.
- Re-run all three `/tmp` scripts, `python3 -m compileall -q backend`, `npx tsc --noEmit`, `npm run lint` and `npm run build`.
- **Commit** only if you fixed something: `fix(games): <what> (GH-72)`. Then run `docker compose down`.

## Final verification
```
python3 /tmp/snake_lobby_check.py      # lobby OK
python3 /tmp/snake_move_check.py       # movement OK
python3 /tmp/snake_end_check.py        # crash and end OK
python3 -m compileall -q backend
cd frontend; npm ci; npx tsc --noEmit; npm run lint; npm run build
docker compose up -d --build           # manual pass from step 7 at http://localhost
git status                             # clean; no .megoocolab/ or docs/ files committed
```

---

## Reference A: `backend/games/snake_arena.py` (final file)
```python
import math
import random

WORLD = 1800            # square world, 1800 x 1800
SEG = 10                # spacing of body points
HEAD_R = 10
HIT = 2 * HEAD_R        # a head this close to another snake's point crashes
EAT_R = HEAD_R + 6
SPEED = 3               # units per tick at ~30fps
BOOST_SPEED = 6
MAX_TURN = 0.15         # radians per tick
START_LEN = 10
MAX_LEN = 300           # so a runaway snake can't bloat the messages
FOOD_TARGET = 220
BOOST_COST_TICKS = 15   # every 15 ticks of boosting costs 1 length
ROUND_TICKS = 5400      # 3:00
RESPAWN_TICKS = 90      # 3 s
TPS = 30
SPAWN_MARGIN = 200      # spawns stay this far from the edge
SPAWN_GAP = 200         # ...and from every other snake
FOOD_MARGIN = 20
SEATS = ("B", "P", "U", "O", "G", "Y")   # Blue, Pink, Purple, Orange, Green, Yellow, in join order


class SnakeArenaLogic:
    needs_server_loop = True  # Tells main.py to start a background game loop

    def __init__(self):
        self.seated = set()    # seats handed out by on_player_join; kept across restarts
        self.rng = random.Random()
        self._new_round()

    def _new_round(self):
        self.phase = "lobby"   # lobby -> playing -> finished
        self.ready = {s: False for s in SEATS}
        self.active = {s: False for s in SEATS}
        # seat -> {pts: [[x, y], ...] head first, angle, target, len, alive, boost, boost_ticks, respawn}
        self.snakes = {}
        self.food = []         # [x, y, value]
        self.ticks = 0
        self.winner = None
        self.is_draw = False

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        """Seats B, P, U, O, G, Y in join order; a rejoin keeps its seat; the 7th is a spectator."""
        if username in existing_symbols:
            return existing_symbols[username]
        taken = set(existing_symbols.values())
        for s in SEATS:
            if s not in taken:
                self.seated.add(s)
                return s
        return None

    def ranking(self) -> list:
        """Seats with a snake, longest first (dead snakes by their length at death), seat order on ties."""
        return sorted((s for s in SEATS if s in self.snakes), key=lambda s: -self.snakes[s]["len"])

    def get_state(self):
        return {
            "phase": self.phase,
            "ready": dict(self.ready),
            "active": dict(self.active),
            "time_left": math.ceil(max(0, ROUND_TICKS - self.ticks) / TPS),
            "world": WORLD,
            "head_r": HEAD_R,
            "seg": SEG,
            "snakes": {
                s: {
                    "pts": [round(v) for p in sn["pts"] for v in p],
                    "angle": round(sn["angle"], 2),
                    "len": sn["len"],
                    "alive": sn["alive"],
                    "boost": sn["alive"] and self._boosting(sn),
                    "respawn_in": math.ceil(sn["respawn"] / TPS),
                }
                for s, sn in self.snakes.items()
            },
            "food": [round(v) for f in self.food for v in f],
            "winner": self.winner,
            "is_draw": self.is_draw,
            "ranking": self.ranking(),
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

        if action_type == "steer":
            angle = kwargs.get("angle")
            if isinstance(angle, bool) or not isinstance(angle, (int, float)) or not math.isfinite(angle):
                return False
            if not self._can_move(symbol):
                return False
            self.snakes[symbol]["target"] = float(angle)
            return True

        if action_type == "boost":
            on = kwargs.get("on")
            if not isinstance(on, bool) or not self._can_move(symbol):
                return False
            self.snakes[symbol]["boost"] = on
            return True

        return False

    def _can_move(self, s: str) -> bool:
        return self.phase == "playing" and s in self.snakes and self.snakes[s]["alive"]

    def _boosting(self, sn: dict) -> bool:
        return sn["boost"] and sn["len"] > START_LEN

    def _start(self):
        """Ready players play this round; everyone else sits out with no snake."""
        self.phase = "playing"
        self.ticks = 0
        for s in SEATS:
            self.active[s] = self.ready[s]
        for s in SEATS:
            if self.active[s]:
                self._respawn(s)
        self._refill_food()

    def _respawn(self, s: str):
        """A small snake at a random spot at least SPAWN_GAP from every other snake, facing the centre."""
        others = [p for o, sn in self.snakes.items() if o != s and sn["alive"] for p in sn["pts"]]
        for _ in range(50):
            x = self.rng.uniform(SPAWN_MARGIN, WORLD - SPAWN_MARGIN)
            y = self.rng.uniform(SPAWN_MARGIN, WORLD - SPAWN_MARGIN)
            if all(math.hypot(px - x, py - y) >= SPAWN_GAP for px, py in others):
                break
        self._place(s, x, y, math.atan2(WORLD / 2 - y, WORLD / 2 - x))

    def _place(self, s: str, x: float, y: float, angle: float):
        """A straight START_LEN snake with its head at (x, y); the body trails behind the heading."""
        dx, dy = math.cos(angle), math.sin(angle)
        self.snakes[s] = {
            "pts": [[x - dx * SEG * i, y - dy * SEG * i] for i in range(START_LEN)],
            "angle": angle, "target": angle, "len": START_LEN, "alive": True,
            "boost": False, "boost_ticks": 0, "respawn": 0,
        }

    def _set_len(self, sn: dict, n: int):
        """Length = number of body points; a new tail point starts on the old tail."""
        n = max(1, min(MAX_LEN, n))
        sn["len"] = n
        pts = sn["pts"]
        while len(pts) < n:
            pts.append(list(pts[-1]))
        del pts[n:]

    def _drop(self, x: float, y: float, value: int):
        self.food.append([
            min(max(x, FOOD_MARGIN), WORLD - FOOD_MARGIN),
            min(max(y, FOOD_MARGIN), WORLD - FOOD_MARGIN),
            value,
        ])

    def _refill_food(self):
        while len(self.food) < FOOD_TARGET:
            self._drop(self.rng.uniform(FOOD_MARGIN, WORLD - FOOD_MARGIN),
                       self.rng.uniform(FOOD_MARGIN, WORLD - FOOD_MARGIN), 1)

    def tick(self):
        """Called by the server game loop each frame (~30fps)."""
        if self.phase != "playing":
            return
        self.ticks += 1
        for s in SEATS:
            sn = self.snakes.get(s)
            if sn is None:
                continue
            if sn["alive"]:
                self._move(sn)
            else:
                sn["respawn"] -= 1
                if sn["respawn"] <= 0:
                    self._respawn(s)
        self._eat()
        self._crashes()
        self._refill_food()
        if self.ticks >= ROUND_TICKS:
            self._finish()

    def _move(self, sn: dict):
        diff = (sn["target"] - sn["angle"] + math.pi) % (2 * math.pi) - math.pi
        angle = sn["angle"] + max(-MAX_TURN, min(MAX_TURN, diff))
        sn["angle"] = (angle + math.pi) % (2 * math.pi) - math.pi
        speed = SPEED
        if self._boosting(sn):
            speed = BOOST_SPEED
            sn["boost_ticks"] += 1
            if sn["boost_ticks"] % BOOST_COST_TICKS == 0:
                tx, ty = sn["pts"][-1]
                self._drop(tx, ty, 1)
                self._set_len(sn, sn["len"] - 1)
        head = sn["pts"][0]
        head[0] += math.cos(sn["angle"]) * speed
        head[1] += math.sin(sn["angle"]) * speed
        self._follow(sn["pts"])

    @staticmethod
    def _follow(pts: list):
        """Pull each body point toward the one in front so they stay SEG apart."""
        for i in range(1, len(pts)):
            px, py = pts[i - 1]
            x, y = pts[i]
            d = math.hypot(x - px, y - py)
            if d > SEG:
                k = SEG / d
                pts[i][0] = px + (x - px) * k
                pts[i][1] = py + (y - py) * k

    def _eat(self):
        alive = [self.snakes[s] for s in SEATS if s in self.snakes and self.snakes[s]["alive"]]
        kept = []
        for f in self.food:
            eater = next((sn for sn in alive
                          if math.hypot(sn["pts"][0][0] - f[0], sn["pts"][0][1] - f[1]) < EAT_R), None)
            if eater is None:
                kept.append(f)
            else:
                self._set_len(eater, eater["len"] + f[2])
        self.food = kept

    def _crashes(self):
        """Walls and other snakes; deaths are applied together so a head-on kills both."""
        alive = [s for s in SEATS if s in self.snakes and self.snakes[s]["alive"]]
        dead = set()
        for s in alive:
            hx, hy = self.snakes[s]["pts"][0]
            if hx < HEAD_R or hx > WORLD - HEAD_R or hy < HEAD_R or hy > WORLD - HEAD_R:
                dead.add(s)
                continue
            for o in alive:
                if o == s:
                    continue          # never from its own body
                pts = self.snakes[o]["pts"]
                if math.hypot(pts[0][0] - hx, pts[0][1] - hy) < HIT:
                    dead.update((s, o))
                elif any(math.hypot(x - hx, y - hy) < HIT for x, y in pts[1:]):
                    dead.add(s)
        for s in dead:
            self._kill(s)

    def _kill(self, s: str):
        sn = self.snakes[s]
        for x, y in sn["pts"][::2]:
            self._drop(x, y, 2)
        sn["alive"] = False
        sn["boost"] = False
        sn["respawn"] = RESPAWN_TICKS
        sn["pts"] = [sn["pts"][0]]   # the head stays so the camera can wait there; len stays for the ranking

    def _finish(self):
        self.phase = "finished"
        for sn in self.snakes.values():
            sn["boost"] = False
        order = self.ranking()
        if not order:
            self.is_draw = True
            return
        best = self.snakes[order[0]]["len"]
        leaders = [s for s in order if self.snakes[s]["len"] == best]
        if len(leaders) == 1:
            self.winner = leaders[0]
        else:
            self.is_draw = True

    def reset(self):
        """Back to the lobby: seats kept, ready flags cleared."""
        self._new_round()
```

## Reference B: `/tmp/snake_lobby_check.py`
```python
import sys, math
sys.path.insert(0, "backend")
from games import get_game_logic

g = get_game_logic("snake-arena")
syms = {}
for n in ["a", "b", "c", "d", "e", "f", "g"]:
    syms[n] = g.on_player_join(n, {k: v for k, v in syms.items() if v})
assert [syms[n] for n in "abcdef"] == ["B", "P", "U", "O", "G", "Y"], syms
assert syms["g"] is None                       # 7th is a spectator
assert g.on_player_join("c", {k: v for k, v in syms.items() if v}) == "U"   # rejoin keeps seat

st = g.get_state()
assert st["phase"] == "lobby" and st["snakes"] == {} and st["time_left"] == 180
assert st["world"] == 1800 and st["head_r"] == 10 and st["seg"] == 10 and st["food"] == []

assert g.make_move("B", action_type="steer", angle=1.0) is False    # not playing
assert g.make_move("B", action_type="start") is False
assert g.make_move("B", action_type="set_ready")
assert g.make_move("B", action_type="start") is False               # only 1 ready
assert g.make_move("P", action_type="set_ready")
assert g.make_move("P", action_type="start")

st = g.get_state()
assert st["phase"] == "playing"
assert set(st["snakes"]) == {"B", "P"}
assert st["active"]["B"] and st["active"]["P"] and not st["active"]["U"]
b = st["snakes"]["B"]
assert len(b["pts"]) == 20 and b["len"] == 10 and b["alive"] and not b["boost"] and b["respawn_in"] == 0
assert all(isinstance(v, int) for v in b["pts"])
assert len(st["food"]) == 3 * 220
assert st["ranking"] == ["B", "P"]
hb, hp = g.snakes["B"]["pts"][0], g.snakes["P"]["pts"][0]
assert math.dist(hb, hp) >= 200

assert g.make_move("B", action_type="steer", angle=1.0)
assert g.snakes["B"]["target"] == 1.0
for bad in ["x", None, float("nan"), float("inf"), True]:
    assert g.make_move("B", action_type="steer", angle=bad) is False, bad
assert g.make_move("B", action_type="boost", on=True)
assert g.make_move("B", action_type="boost", on="yes") is False
assert g.make_move("U", action_type="steer", angle=0.5) is False    # sits out
assert g.make_move("Z", action_type="steer", angle=0.5) is False    # not a seat
assert g.make_move("B", action_type="fly") is False

g.reset()
st = g.get_state()
assert st["phase"] == "lobby" and st["snakes"] == {} and not st["ready"]["B"] and st["food"] == []
assert g.make_move("B", action_type="set_ready")                    # seats kept
print("lobby OK")
```

## Reference C: `/tmp/snake_move_check.py`
```python
import sys, math
sys.path.insert(0, "backend")
import games.snake_arena as sa
from games import get_game_logic

sa.FOOD_TARGET = 0   # no random pellets in these checks


def game():
    g = get_game_logic("snake-arena")
    assert g.on_player_join("a", {}) == "B"
    assert g.on_player_join("b", {"a": "B"}) == "P"
    assert g.make_move("B", action_type="set_ready")
    assert g.make_move("P", action_type="set_ready")
    assert g.phase == "playing"
    g._place("B", 300, 300, 0.0)
    g._place("P", 1500, 1500, math.pi)
    g.food = []
    return g


def close(a, b):
    return abs(a - b) < 1e-6


# Steering turns at most MAX_TURN a tick, the short way round
g = game(); b = g.snakes["B"]
assert g.make_move("B", action_type="steer", angle=1.0)
g.tick(); assert close(b["angle"], 0.15), b["angle"]
for _ in range(10):
    g.tick()
assert close(b["angle"], 1.0), b["angle"]
g = game(); b = g.snakes["B"]; b["angle"] = 3.0
assert g.make_move("B", action_type="steer", angle=-3.0)
g.tick(); assert close(b["angle"], 3.15 - 2 * math.pi), b["angle"]

# The head moves SPEED a tick and the body stays SEG apart
g = game(); b = g.snakes["B"]
g.tick()
assert close(b["pts"][0][0], 303) and close(b["pts"][0][1], 300)
assert len(b["pts"]) == sa.START_LEN
gaps = [math.dist(b["pts"][i], b["pts"][i + 1]) for i in range(len(b["pts"]) - 1)]
assert all(gap <= sa.SEG + 1e-6 for gap in gaps) and close(gaps[0], sa.SEG), gaps

# Eating: +1 for a normal pellet, +2 for a death pellet
g = game(); b = g.snakes["B"]
g.food = [[308, 300, 1]]
g.tick()
assert b["len"] == 11 and len(b["pts"]) == 11 and g.food == []
g.food = [[b["pts"][0][0] + 8, 300, 2]]
g.tick()
assert b["len"] == 13 and len(b["pts"]) == 13
st = g.get_state()["snakes"]["B"]
assert st["len"] == 13 and len(st["pts"]) == 26

# Boost: needs len > START_LEN, doubles speed, costs 1 length per 15 ticks and drops a pellet at the tail
g = game(); b = g.snakes["B"]
assert g.make_move("B", action_type="boost", on=True)
g.tick()
assert close(b["pts"][0][0], 303) and b["len"] == 10 and not g.get_state()["snakes"]["B"]["boost"]
g._set_len(b, 12)
x = b["pts"][0][0]
g.tick()
assert g.get_state()["snakes"]["B"]["boost"] and close(b["pts"][0][0], x + 6)
for _ in range(14):
    g.tick()
assert b["len"] == 11 and len(g.food) == 1 and g.food[0][2] == 1
assert close(b["pts"][0][0], x + 90)
for _ in range(15):
    g.tick()
assert b["len"] == 10 and len(g.food) == 2
for _ in range(15):
    g.tick()
assert b["len"] == 10 and len(g.food) == 2          # no boost at START_LEN
assert not g.get_state()["snakes"]["B"]["boost"]
print("movement OK")
```

## Reference D: `/tmp/snake_end_check.py`
```python
import sys, math
sys.path.insert(0, "backend")
import games.snake_arena as sa
from games import get_game_logic

sa.FOOD_TARGET = 0


def game():
    g = get_game_logic("snake-arena")
    assert g.on_player_join("a", {}) == "B"
    assert g.on_player_join("b", {"a": "B"}) == "P"
    assert g.make_move("B", action_type="set_ready")
    assert g.make_move("P", action_type="set_ready")
    g._place("B", 300, 300, 0.0)
    g._place("P", 1500, 1500, math.pi)
    g.food = []
    return g


# Wall crash: dies, drops value-2 pellets on every second point, respawns small after 3 s
g = game()
g._place("B", 12, 900, math.pi)
g.tick()
b = g.snakes["B"]
assert not b["alive"] and b["len"] == 10 and b["respawn"] == sa.RESPAWN_TICKS
assert len(g.food) == 5 and all(f[2] == 2 for f in g.food)
st = g.get_state()["snakes"]["B"]
assert st["respawn_in"] == 3 and len(st["pts"]) == 2 and not st["alive"] and not st["boost"]
assert g.make_move("B", action_type="steer", angle=0.0) is False   # dead snakes can't steer
for _ in range(sa.RESPAWN_TICKS - 1):
    g.tick()
assert not g.snakes["B"]["alive"]
g.tick()
b = g.snakes["B"]
assert b["alive"] and b["len"] == sa.START_LEN and len(b["pts"]) == sa.START_LEN
assert all(math.dist(b["pts"][0], p) >= sa.SPAWN_GAP for p in g.snakes["P"]["pts"])

# Body crash: B's head runs into P's body; P lives
g = game()
g._place("P", 900, 900, 0.0)
g._place("B", 850, 882, math.pi / 2)
g.tick()
assert not g.snakes["B"]["alive"] and g.snakes["P"]["alive"]

# Head-on: both die
g = game()
g._place("B", 500, 500, 0.0)
g._place("P", 525, 500, math.pi)
g.tick()
assert not g.snakes["B"]["alive"] and not g.snakes["P"]["alive"]

# Never from its own body: a long snake circling tightly lives
g = game()
g._place("B", 900, 900, 0.0)
g._set_len(g.snakes["B"], 40)
for _ in range(120):
    b = g.snakes["B"]
    b["target"] = b["angle"] + 1.0
    g.tick()
assert g.snakes["B"]["alive"]

# Timer end: unique longest wins
g = game()
g._set_len(g.snakes["B"], 15)
g._set_len(g.snakes["P"], 12)
g.ticks = sa.ROUND_TICKS - 1
g.tick()
st = g.get_state()
assert st["phase"] == "finished" and st["winner"] == "B" and not st["is_draw"]
assert st["ranking"] == ["B", "P"] and st["time_left"] == 0
t = g.ticks; g.tick(); assert g.ticks == t     # nothing moves after the end

# A tie for longest is a draw
g = game()
g._set_len(g.snakes["B"], 12)
g._set_len(g.snakes["P"], 12)
g.ticks = sa.ROUND_TICKS - 1
g.tick()
assert g.phase == "finished" and g.is_draw and g.winner is None

# A dead snake is ranked by its length at death
g = game()
g._set_len(g.snakes["B"], 15)
g._place("P", 12, 900, math.pi)
g._set_len(g.snakes["P"], 20)
g.tick()
assert not g.snakes["P"]["alive"] and g.snakes["P"]["len"] == 20
g.ticks = sa.ROUND_TICKS - 1
g.tick()
assert g.winner == "P" and g.ranking() == ["P", "B"]
print("crash and end OK")
```

## Reference E: `frontend/src/lib/snakeArena.ts`
```ts
import { nameForSymbol, winsFor } from "./players";
import type { MatchScore } from "./types";

export type Seat = "B" | "P" | "U" | "O" | "G" | "Y";
export const SEATS: Seat[] = ["B", "P", "U", "O", "G", "Y"];

/** label: snake colour name; color: Tailwind class; hex: canvas fill. */
export const SEAT_INFO: Record<Seat, { label: string; color: string; hex: string }> = {
  B: { label: "Blue", color: "bg-candy-blue", hex: "#4d96ff" },
  P: { label: "Pink", color: "bg-candy-pink", hex: "#ff6fa8" },
  U: { label: "Purple", color: "bg-candy-purple", hex: "#8b5cf6" },
  O: { label: "Orange", color: "bg-candy-orange", hex: "#ff8c42" },
  G: { label: "Green", color: "bg-candy-green", hex: "#3ddc84" },
  Y: { label: "Yellow", color: "bg-candy-yellow", hex: "#ffd23f" },
};

/** One snake as sent by the server. pts is flat [x0, y0, x1, y1, ...], head first; a crashed snake keeps only its head. */
export interface SnakeView { pts: number[]; angle: number; len: number; alive: boolean; boost: boolean; respawn_in: number }

type WithSymbols = { symbols?: Record<string, string> } | null | undefined;

/** Seats that someone holds, in seat order. */
export function seatedSeats(gs: WithSymbols): Seat[] {
  const taken = Object.values(gs?.symbols ?? {});
  return SEATS.filter(s => taken.includes(s));
}

/** The server's ranking (longest first), kept to known seats. */
export function ranking(order: string[] | undefined): Seat[] {
  return (order ?? []).filter((s): s is Seat => (SEATS as string[]).includes(s));
}

/** "Match wins — Mo 2 · Sara 1 · Ali 0" */
export function matchWinsLine(gs: WithSymbols, ms: MatchScore | undefined): string {
  const parts = seatedSeats(gs).map(s => `${nameForSymbol(gs, s) ?? SEAT_INFO[s].label} ${winsFor(ms, s)}`);
  return `Match wins — ${parts.join(" · ")}`;
}

/** 125 → "2:05" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Where the camera looks: your head (it stays where you crashed until you respawn), else the leader's, else the centre. */
export function cameraFor(
  snakes: Partial<Record<Seat, SnakeView>>, mySeat: Seat | null, leaders: Seat[], world: number,
): { x: number; y: number } {
  const mine = mySeat ? snakes[mySeat] : undefined;
  if (mine && mine.pts.length >= 2) return { x: mine.pts[0], y: mine.pts[1] };
  const lead = leaders.map(s => snakes[s]).find(v => v?.alive && v.pts.length >= 2);
  return lead ? { x: lead.pts[0], y: lead.pts[1] } : { x: world / 2, y: world / 2 };
}
```

## Reference F: `frontend/src/components/games/SnakeArenaCanvas.tsx`
```tsx
"use client";
import { useEffect, useRef } from "react";
import { SEATS, SEAT_INFO, cameraFor, clock, type Seat, type SnakeView } from "@/lib/snakeArena";

const INK = "#2b2240";
const FLOOR = "#fff6e5";
const OUTSIDE = "#ffd6d6";   // red tint past the world edge
const VIEW = 600;            // world units across the canvas
const GRID = 60;
const MINI = 110;            // minimap size in CSS px
const FOOD_COLORS = SEATS.map(s => SEAT_INFO[s].hex);

interface SnakeArenaCanvasProps {
  size: number;              // CSS px, square
  world: number;
  headR: number;
  snakes: Partial<Record<Seat, SnakeView>>;
  food: number[];            // flat [x, y, value, ...]
  names: Record<Seat, string>;
  mySeat: Seat | null;
  timeLeft: number;
  leaders: Seat[];           // longest first
  countdown: string | null;
  banner: string | null;
}

export default function SnakeArenaCanvas({
  size, world, headR, snakes, food, names, mySeat, timeLeft, leaders, countdown, banner,
}: SnakeArenaCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    const cam = cameraFor(snakes, mySeat, leaders, world);
    const k = (size / VIEW) * dpr;
    const pad = 2 * headR;
    const x0 = cam.x - VIEW / 2 - pad, x1 = cam.x + VIEW / 2 + pad;
    const y0 = cam.y - VIEW / 2 - pad, y1 = cam.y + VIEW / 2 + pad;
    const inView = (x: number, y: number) => x > x0 && x < x1 && y > y0 && y < y1;
    const dot = (x: number, y: number, r: number, fill: string) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
    };

    // Outside the world: red tint
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = OUTSIDE;
    ctx.fillRect(0, 0, px, px);

    // World space, centred on the camera
    ctx.setTransform(k, 0, 0, k, px / 2 - cam.x * k, px / 2 - cam.y * k);
    ctx.fillStyle = FLOOR;
    ctx.fillRect(0, 0, world, world);
    ctx.strokeStyle = "rgba(43, 34, 64, 0.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let g = GRID; g < world; g += GRID) {
      if (g > x0 && g < x1) { ctx.moveTo(g, Math.max(0, y0)); ctx.lineTo(g, Math.min(world, y1)); }
      if (g > y0 && g < y1) { ctx.moveTo(Math.max(0, x0), g); ctx.lineTo(Math.min(world, x1), g); }
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, world, world);

    // Pellets; the colour comes from the position so it does not flicker when others are eaten
    ctx.lineWidth = 1.5;
    for (let i = 0; i + 2 < food.length; i += 3) {
      const x = food[i], y = food[i + 1];
      if (!inView(x, y)) continue;
      dot(x, y, food[i + 2] > 1 ? 7 : 4, FOOD_COLORS[Math.abs(x * 7 + y) % FOOD_COLORS.length]);
    }

    // Snakes, yours on top: body from the tail, then the head with eyes and a name tag
    const order: Seat[] = mySeat ? [...SEATS.filter(s => s !== mySeat), mySeat] : SEATS;
    for (const seat of order) {
      const sn = snakes[seat];
      if (!sn?.alive || sn.pts.length < 2) continue;
      const p = sn.pts, hex = SEAT_INFO[seat].hex;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      if (sn.boost) { ctx.shadowColor = hex; ctx.shadowBlur = 18; }
      for (let i = p.length - 2; i >= 2; i -= 2) {
        if (inView(p[i], p[i + 1])) dot(p[i], p[i + 1], headR * 0.9, hex);
      }
      dot(p[0], p[1], headR, hex);
      ctx.shadowBlur = 0;
      const c = Math.cos(sn.angle), s = Math.sin(sn.angle);
      ctx.lineWidth = 1;
      for (const side of [-1, 1]) {
        const ex = p[0] + c * 4 - s * side * 5, ey = p[1] + s * 4 + c * side * 5;
        dot(ex, ey, 3.5, "#fff");
        ctx.beginPath(); ctx.arc(ex + c * 1.3, ey + s * 1.3, 1.8, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      }
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = INK;
      ctx.fillText(seat === mySeat ? "you" : names[seat], p[0], p[1] - headR - 8);
    }

    // Minimap (screen space): the world, your view, every snake's head
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = Math.min(MINI, size * 0.25), mx = size - m - 8, my = size - m - 8, ms = m / world;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff";
    ctx.fillRect(mx, my, m, m);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, m, m);
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + (cam.x - VIEW / 2) * ms, my + (cam.y - VIEW / 2) * ms, VIEW * ms, VIEW * ms);
    for (const seat of order) {
      const sn = snakes[seat];
      if (!sn?.alive || sn.pts.length < 2) continue;
      dot(mx + sn.pts[0] * ms, my + sn.pts[1] * ms, seat === mySeat ? 4.5 : 3, SEAT_INFO[seat].hex);
    }
  }, [size, world, headR, snakes, food, names, mySeat, leaders]);

  const me = mySeat ? snakes[mySeat] : undefined;
  return (
    <div className="relative chunk overflow-hidden" style={{ width: size, height: size, boxSizing: "content-box" }}>
      <canvas ref={ref} role="img" aria-label="Snake arena" className="block" style={{ width: size, height: size }} />

      {/* HUD: timer, the Longest board, your length */}
      <div className="absolute top-2 left-2 chunk-sm bg-white px-2 py-0.5 text-sm font-black text-ink pointer-events-none">⏱ {clock(timeLeft)}</div>
      <div className="absolute top-2 right-2 chunk-sm bg-white px-2 py-1 text-xs font-bold text-ink pointer-events-none min-w-[110px]">
        <div className="text-[11px] font-black uppercase tracking-wide text-ink/60">Longest</div>
        {leaders.slice(0, 3).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-3 text-right">{i + 1}</span>
            <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[s].color}`} />
            <span className="truncate max-w-[80px]">{s === mySeat ? "You" : names[s]}</span>
            <span className="ml-auto pl-1">{snakes[s]?.len ?? 0}</span>
          </div>
        ))}
      </div>
      {me && (
        <div className="absolute bottom-2 left-2 chunk-sm bg-white px-2 py-0.5 text-sm font-black text-ink pointer-events-none">📏 {me.len}</div>
      )}

      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={countdown} className="chunk bg-white text-ink font-black text-5xl sm:text-7xl px-6 py-2 animate-pop">{countdown}</div>
        </div>
      )}
      {banner !== null && countdown === null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div className="chunk bg-white text-ink font-black text-xl sm:text-3xl px-5 py-2 animate-pop text-center max-w-[80%]">{banner}</div>
        </div>
      )}
    </div>
  );
}
```

## Reference G: `frontend/src/components/games/SnakeArena.tsx`
```tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ResultOverlay from "@/components/ui/ResultOverlay";
import ToyButton from "@/components/ui/ToyButton";
import { nameForSymbol, outcomeFor, resultTitle } from "@/lib/players";
import { SEATS, SEAT_INFO, matchWinsLine, ranking, seatedSeats, type Seat, type SnakeView } from "@/lib/snakeArena";
import { play } from "@/lib/sound";
import { useOnChange } from "@/lib/useOnChange";
import type { GameProps } from "@/lib/types";
import SnakeArenaCanvas from "./SnakeArenaCanvas";

const COUNTDOWN = ["3", "2", "1", "Go!"];
const COUNTDOWN_MS = 1500;
const MEDALS = ["🥇", "🥈", "🥉"];
const STEER_MS = 1000 / 15;   // at most 15 steer messages a second
const KEY_TURN = 0.15;        // radians a frame from the current heading with ←/→ or A/D
const MAX_SIZE = 720;         // largest arena in CSS px
// Game-area width (px) from which the player cards sit beside the arena (matches @min-[760px] below)
const WIDE = 760;
const LEFT: Seat[] = ["B", "U", "G"];
const RIGHT: Seat[] = ["P", "O", "Y"];
const TURN_KEYS: Record<string, "left" | "right"> = {
  ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
};

function SeatCard({ seat, name, status, dim, isMe }: { seat: Seat; name?: string; status: string; dim: boolean; isMe: boolean }) {
  return (
    <div className={`chunk bg-white text-ink flex items-center gap-2 px-2 py-2 min-w-0 ${dim ? "opacity-50 grayscale" : ""} ${isMe ? "ring-4 ring-candy-yellow" : ""}`}>
      <Avatar name={name ?? ""} size={32} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{name ?? "Empty"}{isMe && " (you)"}</div>
        <div className="flex items-center gap-1.5 text-xs text-ink/60 font-bold">
          <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
          {SEAT_INFO[seat].label}
        </div>
        <div className="text-sm font-bold whitespace-nowrap">{status}</div>
      </div>
    </div>
  );
}

export default function SnakeArena({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps) {
  const phase = gameState?.phase ?? "lobby";
  const ready: Record<string, boolean> = gameState?.ready ?? {};
  const active: Record<string, boolean> = gameState?.active ?? {};
  const snakes: Partial<Record<Seat, SnakeView>> = gameState?.snakes ?? {};
  const food: number[] = gameState?.food ?? [];
  const WORLD: number = gameState?.world ?? 1800;
  const HEAD_R: number = gameState?.head_r ?? 10;
  const timeLeft: number = gameState?.time_left ?? 180;
  const order = ranking(gameState?.ranking);
  const winner: Seat | null = gameState?.winner ?? null;
  const isDraw = !!gameState?.is_draw;

  const mySeat = SEATS.find(s => s === mySymbol) ?? null;
  const mine = mySeat ? snakes[mySeat] : undefined;
  const iCanMove = phase === "playing" && !!mine?.alive;

  // 3-2-1-Go! when the round starts; null until the first state, so a refresh mid-round does not count down
  const [countIdx, setCountIdx] = useState<number | null>(null);
  const countTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useOnChange<string | null>(gameState ? phase : null, (next, prev) => {
    countTimers.current.forEach(clearTimeout);
    countTimers.current = [];
    if (next !== "playing" || prev !== "lobby") { setCountIdx(null); return; }
    const step = COUNTDOWN_MS / COUNTDOWN.length;
    COUNTDOWN.forEach((_, i) => {
      countTimers.current.push(setTimeout(() => {
        setCountIdx(i);
        play(i === COUNTDOWN.length - 1 ? "turn" : "click");
      }, i * step));
    });
    countTimers.current.push(setTimeout(() => setCountIdx(null), COUNTDOWN_MS));
  });
  useEffect(() => () => countTimers.current.forEach(clearTimeout), []);

  // Sounds: "pop" when you grow (at most every 150 ms), "hit" on any crash, "turn" when you respawn,
  // "click" each second of the last 10
  const lastPop = useRef(0);
  useOnChange<number | null>(gameState && mine ? mine.len : null, (next, prev) => {
    if (phase !== "playing" || next === null || prev === null || next <= prev) return;
    const now = Date.now();
    if (now - lastPop.current > 150) { lastPop.current = now; play("pop"); }
  });
  // Per seat: "-" no snake, "0" crashed, "1" alive
  const aliveKey = SEATS.map(s => (snakes[s] ? (snakes[s]!.alive ? "1" : "0") : "-")).join("");
  useOnChange<string | null>(gameState ? aliveKey : null, (next, prev) => {
    if (phase !== "playing" || next === null || prev === null) return;
    if ([...next].some((c, i) => c === "0" && prev[i] === "1")) play("hit");
    const i = mySeat ? SEATS.indexOf(mySeat) : -1;
    if (i >= 0 && prev[i] === "0" && next[i] === "1") play("turn");
  });
  useOnChange<number | null>(gameState ? timeLeft : null, (next, prev) => {
    if (phase === "playing" && next !== null && prev !== null && next < prev && next > 0 && next <= 10) play("click");
  });

  // Arena size from the game area (not the window: the chat panel takes part of it)
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(480);
  const inLobby = phase === "lobby" || !gameState;
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => {
      const wide = el.clientWidth >= WIDE;
      // Wide: p-4, a 150px card column and a 12px gap each side, the hint line. Narrow: p-2, the 64px ⚡ button and its gap.
      const w = el.clientWidth - (wide ? 32 + 2 * (150 + 12) + 6 : 16 + 6);
      const h = el.clientHeight - (wide ? 32 + 24 + 6 : 16 + 64 + 8 + 6);
      setSize(Math.max(160, Math.floor(Math.min(w, h, MAX_SIZE))));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [inLobby]);

  const send = useCallback((msg: Record<string, unknown>) => {
    ws.send(JSON.stringify({ action: "move", ...msg }));
  }, [ws]);
  const sendMove = (action_type: "set_ready" | "start") => send({ action_type });

  // Boost is sent on press and release only
  const boosting = useRef(false);
  const setBoost = useCallback((on: boolean) => {
    if (boosting.current === on) return;
    boosting.current = on;
    send({ action_type: "boost", on });
  }, [send]);

  // Steering: pointer and keys set the wanted angle; it is sent at most 15 times a second, only when it changed
  const wanted = useRef<number | null>(null);
  const sent = useRef<number | null>(null);
  const heading = useRef(0);
  useEffect(() => { heading.current = mine?.angle ?? 0; });
  useEffect(() => {
    if (!iCanMove) return;
    const held = new Set<"left" | "right">();
    const typing = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    const onDown = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === " ") { e.preventDefault(); setBoost(true); return; }
      const dir = TURN_KEYS[e.key];
      if (!dir) return;
      e.preventDefault();
      held.add(dir);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") { setBoost(false); return; }
      const dir = TURN_KEYS[e.key];
      if (dir) held.delete(dir);
    };
    let raf = 0;
    const frame = () => {
      const turn = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      if (turn) wanted.current = heading.current + turn * KEY_TURN;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const timer = setInterval(() => {
      const a = wanted.current;
      if (a === null || a === sent.current) return;
      sent.current = a;
      send({ action_type: "steer", angle: Math.round(a * 1000) / 1000 });
    }, STEER_MS);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      // The server drops boost on a crash; start clean after a respawn
      boosting.current = false;
      wanted.current = null;
      sent.current = null;
    };
  }, [iCanMove, send, setBoost]);

  // The camera is centred on your head, so the angle from the arena's centre to the pointer is the heading to aim for
  const aimAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (dx * dx + dy * dy > 16) wanted.current = Math.atan2(dy, dx);
  };

  // ── Loading ──
  if (!gameState) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-candy-purple" size={48} /></div>;
  }

  // ── Lobby ──
  if (phase === "lobby") {
    const seated = seatedSeats(gameState);
    const readyCount = seated.filter(s => ready[s]).length;
    const isSeated = !!mySymbol && seated.some(s => s === mySymbol);
    const iAmReady = isSeated && !!ready[mySymbol!];
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-2 sm:p-4 w-full overflow-y-auto">
        <div className="chunk bg-white p-6 sm:p-8 flex flex-col items-center gap-4 max-w-sm w-full text-ink animate-pop">
          <div className="text-6xl" aria-hidden="true">{iAmReady ? "✅" : "🐍"}</div>
          <h2 className="text-2xl font-black">Snake Arena</h2>
          <div className="w-full grid grid-cols-2 gap-2">
            {SEATS.map(seat => {
              const held = seated.includes(seat);
              return (
                <div key={seat} className={`chunk-sm rounded-xl px-2 py-2 text-center text-sm font-bold truncate ${held && ready[seat] ? "bg-candy-green" : "bg-cream-2"} ${seat === mySymbol ? "ring-4 ring-candy-yellow" : ""}`}>
                  <div className="text-2xl" aria-hidden="true">{held ? (ready[seat] ? "✅" : "⏳") : "🪑"}</div>
                  {held ? nameForSymbol(gameState, seat) : "Empty seat"}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-ink/60">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[seat].color}`} />
                    {SEAT_INFO[seat].label}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-ink/70 text-sm font-bold text-center">3-minute round. Needs at least 2 ready players. Players who are not ready sit the round out.</p>
          {!isSeated ? (
            <div className="text-ink/70 font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Watching — waiting for players…</div>
          ) : !iAmReady ? (
            <ToyButton color="green" size="lg" className="w-full" onClick={() => sendMove("set_ready")}>Ready?</ToyButton>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
              <ToyButton size="lg" className="w-full" disabled={readyCount < 2} onClick={() => sendMove("start")}>
                Start with {readyCount} players
              </ToyButton>
              <div className="text-ink/60 text-xs font-bold">Starts by itself when everyone is ready</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Game / Finished ──
  const seated = seatedSeats(gameState);
  const names = Object.fromEntries(SEATS.map(s => [s, nameForSymbol(gameState, s) ?? SEAT_INFO[s].label])) as Record<Seat, string>;
  const statusOf = (s: Seat) => {
    const sn = snakes[s];
    if (!seated.includes(s)) return "—";
    if (!active[s] || !sn) return "🪑 Sits out";
    return sn.alive ? `📏 ${sn.len}` : `💥 ${sn.len}`;
  };
  const card = (s: Seat) => (
    <SeatCard key={s} seat={s} name={seated.includes(s) ? names[s] : undefined} status={statusOf(s)}
      dim={!seated.includes(s) || (!!snakes[s] && !snakes[s]!.alive)} isMe={s === mySymbol} />
  );
  const crashed = phase === "playing" && !!mine && !mine.alive;
  const banner = crashed ? `💥 You crashed! Back in ${mine!.respawn_in}…` : null;
  const finished = phase === "finished" && (!!winner || isDraw);

  return (
    <div ref={areaRef} className="@container flex-1 flex flex-col relative select-none overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 @min-[760px]:p-4">
        <div className="flex items-center gap-3">
          <div className="hidden @min-[760px]:flex flex-col gap-3 w-[150px]">{LEFT.map(card)}</div>
          <div className="touch-none"
            onPointerDown={(e) => {
              if (!iCanMove) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              aimAt(e);
              if (e.pointerType === "mouse" && e.button === 0) setBoost(true);
            }}
            onPointerMove={(e) => { if (iCanMove && (e.pointerType === "mouse" || e.buttons)) aimAt(e); }}
            onPointerUp={(e) => { if (e.pointerType === "mouse") setBoost(false); }}
            onPointerCancel={() => setBoost(false)}
            onContextMenu={(e) => e.preventDefault()}>
            <SnakeArenaCanvas size={size} world={WORLD} headR={HEAD_R} snakes={snakes} food={food} names={names}
              mySeat={mySeat} timeLeft={timeLeft} leaders={order}
              countdown={countIdx !== null ? COUNTDOWN[countIdx] : null}
              banner={finished ? null : banner} />
          </div>
          <div className="hidden @min-[760px]:flex flex-col gap-3 w-[150px]">{RIGHT.map(card)}</div>
        </div>

        {/* Wide: keyboard hint. Narrow: the ⚡ boost button under the arena. */}
        <div className="hidden @min-[760px]:flex gap-6 text-ink/60 text-xs font-bold">
          <span>Point to steer</span><span>A D / ← → turn</span><span>Hold click or Space to boost</span>
        </div>
        <button aria-label="Boost" disabled={!iCanMove}
          className="@min-[760px]:hidden game-btn btn-toy touch-none w-16 h-16 rounded-full bg-candy-yellow text-ink text-3xl font-black disabled:opacity-40"
          onPointerDown={(e) => { e.preventDefault(); setBoost(true); }}
          onPointerUp={() => setBoost(false)}
          onPointerCancel={() => setBoost(false)}
          onPointerLeave={() => setBoost(false)}
          onContextMenu={(e) => e.preventDefault()}>⚡</button>
      </div>

      <ResultOverlay
        open={finished}
        outcome={outcomeFor(winner, isDraw, mySymbol)}
        title={resultTitle(gameState, winner, isDraw, mySymbol)}
        subtitle={matchWinsLine(gameState, matchScore)}
        onPlayAgain={handleRestart}
      >
        <ol className="flex flex-col gap-1.5 text-left font-bold">
          {order.map((s, i) => (
            <li key={s} className="chunk-sm bg-white rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="w-7 text-center shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
              <span className={`inline-block w-3 h-3 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[s].color}`} aria-hidden="true" />
              <span className="truncate">{names[s]}</span>
              <span className="ml-auto shrink-0 text-sm">📏 {snakes[s]?.len ?? 0}</span>
            </li>
          ))}
        </ol>
      </ResultOverlay>
    </div>
  );
}
```
Notes for the builder:
- `@min-[760px]:` is Tailwind v4's arbitrary container query. The project uses `tailwindcss ^4`, and Tank Battle already uses `@container` and `@2xl:`.
- If `eslint` flags a specific line, for example the ref write in an effect, fix it the way the lint rule asks, or add a targeted `eslint-disable-next-line` with a reason. The bar is no new lint problems.

## Reference H: `frontend/public/games/snake_arena_cover.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
  <rect width="400" height="240" fill="#fff6e5"/>
  <path d="M40 0V240M80 0V240M120 0V240M160 0V240M200 0V240M240 0V240M280 0V240M320 0V240M360 0V240M0 40H400M0 80H400M0 120H400M0 160H400M0 200H400" stroke="#2b2240" stroke-opacity="0.07" stroke-width="2"/>
  <g stroke="#2b2240" stroke-width="2">
    <circle cx="60" cy="50" r="5" fill="#ffd23f"/>
    <circle cx="150" cy="70" r="5" fill="#ff6fa8"/>
    <circle cx="250" cy="40" r="5" fill="#3ddc84"/>
    <circle cx="350" cy="190" r="5" fill="#8b5cf6"/>
    <circle cx="200" cy="210" r="5" fill="#ff8c42"/>
    <circle cx="40" cy="120" r="5" fill="#4d96ff"/>
    <circle cx="300" cy="200" r="8" fill="#ffd23f"/>
    <circle cx="110" cy="210" r="8" fill="#3ddc84"/>
  </g>
  <g fill="#4d96ff" stroke="#2b2240" stroke-width="3">
    <circle cx="70" cy="170" r="13"/><circle cx="88" cy="168" r="13"/><circle cx="106" cy="162" r="13"/>
    <circle cx="122" cy="152" r="13"/><circle cx="138" cy="142" r="13"/><circle cx="156" cy="136" r="13"/>
    <circle cx="174" cy="136" r="13"/><circle cx="192" cy="140" r="13"/><circle cx="208" cy="148" r="13"/>
    <circle cx="226" cy="155" r="15"/>
  </g>
  <g fill="#ff6fa8" stroke="#2b2240" stroke-width="3">
    <circle cx="372" cy="70" r="13"/><circle cx="356" cy="74" r="13"/><circle cx="340" cy="80" r="13"/>
    <circle cx="326" cy="88" r="13"/><circle cx="314" cy="98" r="13"/><circle cx="304" cy="110" r="13"/>
    <circle cx="296" cy="124" r="15"/>
  </g>
  <g fill="#fff" stroke="#2b2240" stroke-width="1.5">
    <circle cx="230" cy="148" r="5"/><circle cx="234" cy="160" r="5"/>
    <circle cx="288" cy="122" r="5"/><circle cx="299" cy="131" r="5"/>
  </g>
  <g fill="#2b2240">
    <circle cx="232" cy="149" r="2.5"/><circle cx="236" cy="161" r="2.5"/>
    <circle cx="286" cy="125" r="2.5"/><circle cx="297" cy="134" r="2.5"/>
  </g>
</svg>
```

## Reference I: `gameRules.ts` entry (after `"tank-battle"`)
```ts
  "snake-arena": {
    title: "Snake Arena",
    icon: "🐍",
    objective: "Be the longest snake when the 3-minute timer ends.",
    rules: [
      "2 to 6 players each steer a snake in one big arena: Blue, Pink, Purple, Orange, Green and Yellow.",
      "Everyone presses Ready. The round starts when all seated players are ready, or when a ready player presses Start (at least 2 ready). Players who are not ready sit the round out.",
      "Point with the mouse to steer, or use ← / → or A / D. Hold click or Space to boost. On a phone, drag on the arena to steer and hold ⚡ to boost.",
      "Eat pellets to grow. Boosting is twice as fast but costs length, and you can only boost while longer than 10.",
      "If your head hits another snake or the edge of the world, you crash. When two heads meet, both crash. You can't crash into yourself.",
      "A crashed snake turns into big pellets and comes back small after 3 seconds.",
      "When the timer ends, the longest snake wins. A tie for longest is a draw.",
    ],
    tips: ["Boost in front of a rival so they run into your body, then eat the pellets they drop."],
  },
```

## Self-review
- **Design coverage:**
  - win rule, timer and respawn: step 3;
  - seats and spectators: step 1;
  - the 1800 world, the ~600 view, the camera and the minimap: steps 4–5;
  - point, keys, touch and ⚡ controls, with steer limited to 15 messages a second: step 5;
  - server loop, `needs_server_loop` and the unchanged `main.py`: steps 1–3;
  - lobby, countdown, `ResultOverlay` and match wins: step 5;
  - name and key, catalog, rules, cover and README: step 6;
  - rejecting bad angles and moves from spectators, dead snakes or outside `playing`: steps 1 and 3;
  - spectator and dead camera (`cameraFor`): step 4;
  - phone layout below 760px: step 5;
  - testing: the `/tmp` scripts plus step 7.
- **Order:** no step depends on a later one. The game appears in the catalog only after its screen exists.
- **Not built:** AI bots, self-collision, power-ups, client-side interpolation and per-player state trimming, as the design asks.
