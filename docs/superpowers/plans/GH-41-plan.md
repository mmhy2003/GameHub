# GH-41: 4-Player Pong implementation plan

## Goal
Add a 13th game, **4-Player Pong** (`pong-4`). Two to four players each defend one side of a square court. Each player has 3 hearts, and the last player with hearts left wins. The look follows mockup v1.

## Architecture
- **Backend.** A new `PongFourLogic` in `backend/games/pong_four.py` holds the seats, the lobby rules and the ball physics. It is registered in `backend/games/__init__.py`. `backend/main.py` is not changed: its 30 fps loop (`needs_server_loop = True`), `record_result`, the winner chat message and `match_score` already handle any number of seats.
- **Frontend.** Pure seat helpers go in `frontend/src/lib/pongFour.ts`. The screen is split into three components:
  - `PongFour.tsx`: state, effects, the lobby, the layout and the result pop-up.
  - `PongFourCourt.tsx`: draws the court.
  - `PongFourCard.tsx`: one player card.

  The game is wired in through `games.ts`, `gameRules.ts` and the switch on the room page. The 2-player Ping-Pong and the shared `PlayerCards` are not touched.

## Facts about the repo (checked at `e5f33cd`)
- **Duck-typed game contract:**
  - `on_player_join(username, existing_symbols)`. `main.py` passes the **session id** as `username`, and `existing_symbols` maps session id → symbol.
  - `make_move(symbol, **kwargs) -> bool`, `get_state()`, `reset()`, and the attributes `winner` and `is_draw`.
  - The loop calls `tick()` while `phase == "playing"`.
- **Seats are kept after a disconnect.** `main.py` never removes a seat from `player_symbols`, so a player who rejoins with the same session gets the same seat back.
- **The game loop starts** after a successful move (`room.maybe_start_loop()`). The loop sends a "X won the game!" chat message once `winner` is set.
- **There are no automated tests.** Backend logic is checked with throwaway scripts in `/tmp/` (never committed). The frontend is checked with `npm run lint` and `npm run build` in `frontend/`. `frontend/node_modules` is not installed, so run `npm ci` first.
- **Python is 3.10**, so `str | None` hints are fine.
- **Running it locally:**
  - Backend: `cd backend; pip install -r requirements.txt; uvicorn main:app --port 8000`
  - Frontend: `cd frontend; NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev`
- **Frontend helpers:**
  - `nameForSymbol(gs, sym)`, `winsFor(ms, sym)`, `outcomeFor(winner, isDraw, mySymbol)`, `resultTitle(gs, winner, isDraw, mySymbol)` and `hearts(lost, lives)` live in `@/lib/players`.
  - Sound names (`@/lib/sound`): `click`, `place`, `drop`, `hit`, `miss`, `pop`, `dice`, `turn`, `win`, `lose`.
  - Colour classes: `bg-candy-blue`, `bg-candy-pink`, `bg-candy-purple`, `bg-candy-orange`, `bg-candy-yellow`, `bg-cream`, `bg-cream-2`, `text-ink`.
  - Utility classes: `chunk`, `chunk-sm`, `btn-toy`, `game-btn`, `animate-pop`.
  - `ResultOverlay` props: `{open, outcome, title, subtitle?, children?, onPlayAgain}`.

## File map
| File | Change | Responsibility |
|---|---|---|
| `backend/games/pong_four.py` | create | `PongFourLogic`: seats, ready/start, serve, physics, hearts, knockout, state, reset |
| `backend/games/__init__.py` | modify | import it and map `"pong-4"` to `PongFourLogic()` |
| `frontend/src/lib/pongFour.ts` | create | `Seat`, `SEATS`, `SEAT_INFO`, `seatedSeats`, `ranking`, `matchWinsLine` |
| `frontend/src/components/games/PongFour.tsx` | create | the game screen: lobby, playing layout, controls, trail, countdown, knockout pop-up, result |
| `frontend/src/components/games/PongFourCourt.tsx` | create | the court: stripes, centre circle, corner blocks, walls, paddles, ball, trail, countdown |
| `frontend/src/components/games/PongFourCard.tsx` | create | one player card: avatar, name, side, hearts, out/wall/you states |
| `frontend/src/data/games.ts` | modify | the 13th `GAMES` entry |
| `frontend/src/data/gameRules.ts` | modify | `GAME_RULES["pong-4"]` |
| `frontend/src/app/room/[id]/page.tsx` | modify | import `PongFour` and add `case "pong-4"` |

## Reference A: `backend/games/pong_four.py` (full target after step 2)
```python
import math
import random

FIELD = 600            # square court, 600 x 600
CORNER = 50            # solid corner blocks, CORNER x CORNER
PADDLE_LEN = 100
PADDLE_W = 12
PADDLE_INSET = 20      # gap between a side's edge and its paddle
BALL_R = 9
BALL_SPEED = 6         # units per tick at ~30fps, constant
PADDLE_SPEED = 7
LIVES = 3
SERVE_SPREAD_DEG = 30
MAX_BOUNCE_DEG = 60
SEATS = ("B", "T", "L", "R")   # bottom, top, left, right, in join order
# Outward direction of each side; the ball leaves the court through it
OUT = {"B": (0, 1), "T": (0, -1), "L": (-1, 0), "R": (1, 0)}


class PongFourLogic:
    needs_server_loop = True  # Tells main.py to start a background game loop

    def __init__(self):
        self.seated = set()    # seats handed out by on_player_join; kept across restarts
        self._new_round()

    def _new_round(self):
        self.phase = "lobby"   # lobby -> playing -> finished
        self.ready = {s: False for s in SEATS}
        self.active = {s: False for s in SEATS}
        self.lives = {s: LIVES for s in SEATS}
        self.paddles = {s: FIELD / 2 for s in SEATS}
        self.inputs = {s: "stop" for s in SEATS}   # "neg" | "pos" | "stop"
        self.knockout_order = []
        self.last_out = None
        self.winner = None
        self.is_draw = False
        self.ball_x = FIELD / 2
        self.ball_y = FIELD / 2
        self.ball_vx = 0.0
        self.ball_vy = 0.0

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        """Seats B, T, L, R in join order; a rejoin keeps its seat; the 5th is a spectator."""
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
            "paddles": {s: round(p, 1) for s, p in self.paddles.items()},
            "ball_x": round(self.ball_x, 1),
            "ball_y": round(self.ball_y, 1),
            "knockout_order": list(self.knockout_order),
            "last_out": self.last_out,
            "winner": self.winner,
            "is_draw": self.is_draw,
            "field": FIELD,
            "corner": CORNER,
            "paddle_len": PADDLE_LEN,
            "paddle_w": PADDLE_W,
            "paddle_inset": PADDLE_INSET,
            "ball_r": BALL_R,
            "lives_max": LIVES,
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

        if action_type == "paddle":
            state = kwargs.get("state", "stop")
            if state not in ("neg", "pos", "stop"):
                return False
            if self.phase != "playing" or not self._alive(symbol):
                return False
            self.inputs[symbol] = state
            return True

        return False

    def _start(self):
        """Ready players play this round; everyone else's side is a wall."""
        self.phase = "playing"
        for s in SEATS:
            self.active[s] = self.ready[s]
            self.lives[s] = LIVES if self.ready[s] else 0
        self._serve()

    def _alive(self, s: str) -> bool:
        return self.active[s] and self.lives[s] > 0

    def _serve(self):
        """From the centre towards a random alive player, within +/-SERVE_SPREAD_DEG."""
        self.ball_x = FIELD / 2
        self.ball_y = FIELD / 2
        target = random.choice([s for s in SEATS if self._alive(s)])
        ox, oy = OUT[target]
        a = math.radians(random.uniform(-SERVE_SPREAD_DEG, SERVE_SPREAD_DEG))
        self.ball_vx = BALL_SPEED * (ox * math.cos(a) - oy * math.sin(a))
        self.ball_vy = BALL_SPEED * (ox * math.sin(a) + oy * math.cos(a))

    def _side(self, s: str):
        """(along, depth, v_out) for side s: ball position along the side, distance of the
        ball centre from the side's edge (negative = outside), and speed towards the edge."""
        ox, oy = OUT[s]
        if oy:
            depth = FIELD - self.ball_y if oy > 0 else self.ball_y
            return self.ball_x, depth, self.ball_vy * oy
        depth = FIELD - self.ball_x if ox > 0 else self.ball_x
        return self.ball_y, depth, self.ball_vx * ox

    def _place(self, s: str, depth: float, inward: float, sideways: float | None = None):
        """Put the ball at `depth` from side s, moving inward at `inward`; optionally set the along-side speed."""
        ox, oy = OUT[s]
        if oy:
            self.ball_y = FIELD - depth if oy > 0 else depth
            self.ball_vy = -oy * inward
            if sideways is not None:
                self.ball_vx = sideways
        else:
            self.ball_x = FIELD - depth if ox > 0 else depth
            self.ball_vx = -ox * inward
            if sideways is not None:
                self.ball_vy = sideways

    def tick(self):
        """Called by the server game loop each frame (~30fps)."""
        if self.phase != "playing":
            return
        lo, hi = CORNER + PADDLE_LEN / 2, FIELD - CORNER - PADDLE_LEN / 2
        for s in SEATS:
            if not self._alive(s):
                continue
            step = {"neg": -PADDLE_SPEED, "pos": PADDLE_SPEED}.get(self.inputs[s], 0)
            self.paddles[s] = min(hi, max(lo, self.paddles[s] + step))

        self.ball_x += self.ball_vx
        self.ball_y += self.ball_vy
        # Corners first, so a ball near a corner can never slip past it
        self._bounce_corners()
        self._bounce_paddles()
        self._walls_and_misses()

    def _bounce_corners(self):
        for x0 in (0, FIELD - CORNER):
            for y0 in (0, FIELD - CORNER):
                px = min(max(self.ball_x, x0), x0 + CORNER)
                py = min(max(self.ball_y, y0), y0 + CORNER)
                dx, dy = self.ball_x - px, self.ball_y - py
                if dx * dx + dy * dy >= BALL_R * BALL_R:
                    continue
                if dx == 0 and dy == 0:
                    # Centre inside the block: push out through the nearer inner face
                    nx = 1 if x0 == 0 else -1
                    ny = 1 if y0 == 0 else -1
                    inner_x = x0 + CORNER if x0 == 0 else x0
                    inner_y = y0 + CORNER if y0 == 0 else y0
                    if abs(inner_x - self.ball_x) <= abs(inner_y - self.ball_y):
                        self.ball_x = inner_x + nx * BALL_R
                        self.ball_vx = nx * abs(self.ball_vx)
                    else:
                        self.ball_y = inner_y + ny * BALL_R
                        self.ball_vy = ny * abs(self.ball_vy)
                elif abs(dx) >= abs(dy):
                    sx = 1 if dx > 0 else -1
                    self.ball_x = px + sx * BALL_R
                    self.ball_vx = sx * abs(self.ball_vx)
                else:
                    sy = 1 if dy > 0 else -1
                    self.ball_y = py + sy * BALL_R
                    self.ball_vy = sy * abs(self.ball_vy)

    def _bounce_paddles(self):
        half = PADDLE_LEN / 2
        near, far = PADDLE_INSET, PADDLE_INSET + PADDLE_W   # paddle faces, measured from the edge
        for s in SEATS:
            if not self._alive(s):
                continue
            along, depth, v_out = self._side(s)
            if v_out <= 0 or depth - BALL_R > far or depth + BALL_R < near:
                continue
            offset = (along - self.paddles[s]) / half
            if abs(offset) > 1 + BALL_R / half:
                continue
            # Same idea as Ping-Pong: the further from the centre, the steeper the return
            a = max(-1.0, min(1.0, offset)) * math.radians(MAX_BOUNCE_DEG)
            self._place(s, far + BALL_R, BALL_SPEED * math.cos(a), BALL_SPEED * math.sin(a))

    def _walls_and_misses(self):
        for s in SEATS:
            _, depth, v_out = self._side(s)
            if v_out <= 0:
                continue
            if self._alive(s):
                if depth < 0:
                    self._lose_life(s)
                    return
            elif depth <= BALL_R:
                self._place(s, BALL_R, v_out)   # empty or knocked-out side: a wall

    def _lose_life(self, s: str):
        self.lives[s] -= 1
        if self.lives[s] == 0:
            self.knockout_order.append(s)
            self.last_out = s
            self.inputs[s] = "stop"
            alive = [x for x in SEATS if self._alive(x)]
            if len(alive) == 1:
                self.winner = alive[0]
                self.phase = "finished"
                self.ball_x = FIELD / 2
                self.ball_y = FIELD / 2
                self.ball_vx = 0.0
                self.ball_vy = 0.0
                return
        self._serve()

    def reset(self):
        """Back to the lobby: seats kept, ready flags cleared, lives back to LIVES."""
        self._new_round()
```
Note: `paddle_inset` is also sent in the state, so the client does not hard-code it. This is a size field, as the design's "sizes" row allows.

## Reference B: throwaway check `/tmp/pong4_lobby_check.py` (step 1, not committed)
```python
import sys
sys.path.insert(0, "backend")
from games import get_game_logic

def seat(g, sids):
    syms = {}
    for sid in sids:
        s = g.on_player_join(sid, syms)
        if s:
            syms[sid] = s
    return syms

g = get_game_logic("pong-4")
syms = seat(g, ["a", "b", "c", "d", "e"])
assert syms == {"a": "B", "b": "T", "c": "L", "d": "R"}, syms
assert g.on_player_join("e", syms) is None          # 5th is a spectator
assert g.on_player_join("b", syms) == "T"           # rejoin keeps seat
assert g.make_move("X", action_type="set_ready") is False
assert g.make_move("B", action_type="start") is False
assert g.make_move("B", action_type="set_ready") is True
assert g.make_move("B", action_type="start") is False   # only 1 ready
assert g.make_move("T", action_type="start") is False   # T itself not ready
assert g.make_move("T", action_type="set_ready") is True
assert g.phase == "lobby"                               # L and R are seated but not ready
assert g.make_move("B", action_type="paddle", state="pos") is False  # not playing yet
assert g.make_move("T", action_type="start") is True
assert g.phase == "playing"
assert g.active == {"B": True, "T": True, "L": False, "R": False}
assert g.lives == {"B": 3, "T": 3, "L": 0, "R": 0}
assert abs((g.ball_vx ** 2 + g.ball_vy ** 2) ** 0.5 - 6) < 1e-6
assert g.make_move("L", action_type="paddle", state="pos") is False  # sat out
assert g.make_move("B", action_type="paddle", state="pos") is True
assert g.make_move("B", action_type="paddle", state="up") is False
assert g.make_move("B", action_type="set_ready") is False            # not in lobby
st = g.get_state()
for k in ["phase", "ready", "active", "lives", "paddles", "ball_x", "ball_y", "knockout_order",
          "last_out", "winner", "is_draw", "field", "corner", "paddle_len", "paddle_w",
          "paddle_inset", "ball_r", "lives_max"]:
    assert k in st, k
assert st["is_draw"] is False and st["field"] == 600
g.reset()
assert g.phase == "lobby" and not any(g.ready.values()) and set(g.lives.values()) == {3}
assert g.knockout_order == [] and g.winner is None
for s in "BTLR":
    g.make_move(s, action_type="set_ready")
assert g.phase == "playing" and all(g.active.values())   # all 4 ready: starts by itself
g2 = get_game_logic("pong-4")
seat(g2, ["a", "b"])
g2.make_move("B", action_type="set_ready")
assert g2.phase == "lobby"
g2.make_move("T", action_type="set_ready")
assert g2.phase == "playing"                              # all seated (2) ready: auto-start
assert get_game_logic("ping-pong").__class__.__name__ == "PingPongLogic"
print("lobby OK")
```

## Reference C: throwaway check `/tmp/pong4_physics_check.py` (step 2, not committed)
```python
import math, sys
sys.path.insert(0, "backend")
from games import get_game_logic

def two_player():
    g = get_game_logic("pong-4")
    syms = {}
    for sid in ["a", "b"]:
        syms[sid] = g.on_player_join(sid, syms)
    g.make_move("B", action_type="set_ready"); g.make_move("T", action_type="set_ready")
    assert g.phase == "playing"
    return g

def put(g, x, y, vx, vy):
    g.ball_x, g.ball_y, g.ball_vx, g.ball_vy = x, y, vx, vy

# Wall bounce on an empty side (L)
g = two_player(); put(g, 15, 300, -6, 0); g.tick()
assert g.ball_vx > 0 and g.ball_x >= 9 and g.lives == {"B": 3, "T": 3, "L": 0, "R": 0}

# Paddle bounce, centre hit goes straight back
g = two_player(); g.paddles["B"] = 300; put(g, 300, 545, 0, 6)
for _ in range(3): g.tick()
assert g.ball_vy < 0 and g.lives["B"] == 3

# Off-centre hit: angled return, speed stays 6
g = two_player(); g.paddles["B"] = 300; put(g, 340, 545, 0, 6)
for _ in range(3): g.tick()
assert g.ball_vy < 0 and g.ball_vx > 0 and abs(math.hypot(g.ball_vx, g.ball_vy) - 6) < 1e-6

# Paddle clamp between corner blocks
g = two_player(); g.make_move("B", action_type="paddle", state="neg")
for _ in range(100): g.tick(); put(g, 300, 300, 0, 0)
assert g.paddles["B"] == 100

# Corner block bounce (top-left block, ball coming from below)
g = two_player(); put(g, 40, 70, 0, -6); g.tick(); g.tick()
assert g.ball_vy > 0

# Miss: lose a heart, re-serve from the centre
g = two_player(); g.paddles["B"] = 100; put(g, 450, 560, 0, 6)
for _ in range(10):
    g.tick()
    if g.lives["B"] < 3: break
assert g.lives["B"] == 2 and abs(math.hypot(g.ball_vx, g.ball_vy) - 6) < 1e-6
assert abs(g.ball_x - 300) < 10 and abs(g.ball_y - 300) < 10

# Knockout and winner
g = two_player(); g.lives["B"] = 1; g.paddles["B"] = 100; put(g, 450, 560, 0, 6)
for _ in range(10): g.tick()
assert g.knockout_order == ["B"] and g.last_out == "B" and g.winner == "T" and g.phase == "finished"
assert g.make_move("T", action_type="paddle", state="pos") is False

# 3 players: one out, the game goes on and never serves to the out player
g = get_game_logic("pong-4"); syms = {}
for sid in "abc": syms[sid] = g.on_player_join(sid, syms)
for s in "BTL": g.make_move(s, action_type="set_ready")
g.lives["B"] = 1; g.paddles["B"] = 100; put(g, 450, 560, 0, 6)
for _ in range(10): g.tick()
assert g.knockout_order == ["B"] and g.phase == "playing" and g.winner is None
for _ in range(200):
    g._serve(); assert g.ball_vy < 5   # never aimed down at B

# Long run: 4 static paddles, the ball never escapes and the match ends
g = get_game_logic("pong-4"); syms = {}
for sid in "abcd": syms[sid] = g.on_player_join(sid, syms)
for s in "BTLR": g.make_move(s, action_type="set_ready")
for _ in range(200000):
    g.tick()
    assert -20 < g.ball_x < 620 and -20 < g.ball_y < 620
    if g.phase == "finished": break
assert g.phase == "finished" and len(g.knockout_order) == 3 and g.winner not in g.knockout_order
g.reset(); assert g.phase == "lobby" and g.knockout_order == [] and set(g.lives.values()) == {3}
print("physics OK")
```

## Reference D: `frontend/src/lib/pongFour.ts`
```ts
import { nameForSymbol, winsFor } from "./players";
import type { MatchScore } from "./types";

export type Seat = "B" | "T" | "L" | "R";
export const SEATS: Seat[] = ["B", "T", "L", "R"];

export const SEAT_INFO: Record<Seat, { side: string; color: string; axis: "x" | "y" }> = {
  B: { side: "Bottom", color: "bg-candy-blue", axis: "x" },
  T: { side: "Top", color: "bg-candy-pink", axis: "x" },
  L: { side: "Left", color: "bg-candy-purple", axis: "y" },
  R: { side: "Right", color: "bg-candy-orange", axis: "y" },
};

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
  const parts = seatedSeats(gs).map(s => `${nameForSymbol(gs, s) ?? SEAT_INFO[s].side} ${winsFor(ms, s)}`);
  return `Match wins — ${parts.join(" · ")}`;
}
```

## Reference E: `GAMES` and `GAME_RULES` entries
Add this to `frontend/src/data/games.ts`, directly after the `ping-pong` entry:
```ts
  {
    key: "pong-4", title: "4-Player Pong", cover: "/games/pong_cover.png", emoji: "🏓",
    category: "Action", playTime: "5 min", accent: "green",
    description: "Up to 4 friends defend the sides of a square court. Miss and lose a heart, and the last player standing wins!",
  },
```
Add this to `frontend/src/data/gameRules.ts`, directly after `"ping-pong"`:
```ts
  "pong-4": {
    title: "4-Player Pong",
    icon: "🏓",
    objective: "Keep the ball out of your goal and be the last player with hearts left.",
    rules: [
      "2 to 4 players each defend one side of a square court. Empty sides are walls.",
      "Everyone presses Ready. The match starts when all seated players are ready, or when a ready player presses Start (at least 2 ready).",
      "Bottom and top players move left/right (A/D or ←/→). Left and right players move up/down (W/S or ↑/↓).",
      "When the ball goes past your paddle you lose a heart. Everyone starts with 3.",
      "With no hearts left you are out and your side becomes a wall.",
      "The last player with hearts wins.",
    ],
    tips: ["Hit the ball with the end of your paddle to send it off at a sharp angle."],
  },
```

## Reference F: frontend layout and behaviour contract
- **Coordinates.** The client uses the state's `field`, `corner`, `paddle_len`, `paddle_w`, `paddle_inset` and `ball_r`, with the defaults 600, 50, 100, 12, 20 and 9. `s` is the scale and every unit is multiplied by it. Paddle rectangles, where `p` is `paddles[sym]`:
  - B: `left=(p-len/2)`, `top=field-inset-w`, `width=len`, `height=w`
  - T: same as B, but `top=inset`
  - L: `left=inset`, `top=(p-len/2)`, `width=w`, `height=len`
  - R: same as L, but `left=field-inset-w`
- **A side is "alive"** when `active[sym] && lives[sym] > 0`. While the phase is not `lobby`, every side that is not alive draws a wall:
  - a strip 10 units thick along that edge, between the corner blocks
  - style: `repeating-linear-gradient(45deg, #8d86a3 0 8px, #d6d1e3 8px 16px)` with a 2px ink border
- **Court parts:**
  - Background: `repeating-linear-gradient(90deg, #3ddc84 0 10%, #34c975 10% 20%)`, inside a `chunk` box.
  - Centre circle: radius 60 units, `border-[3px] border-dashed border-white/80`, centred.
  - Corner blocks: `bg-cream border-2 border-ink`.
  - Ball and trail: copied from `PingPong.tsx`.
- **Trail and bounce detection** (as in `PingPong.tsx`):
  - Keep `TELEPORT_DIST = 60`.
  - A bounce is a sign flip of `dx` **or** `dy` between frames. On every bounce, squish the ball.
  - Also `play("hit")`, but only when the ball is within `inset + w + ball_r + 8` units of an alive player's edge. That makes it a paddle bounce, not a wall bounce.
- **Sounds:**
  - `play("pop")` when the sum of `lives` over seats drops while the phase is `playing`.
  - The countdown uses the same timing as `PingPong.tsx`: `COUNTDOWN`, `COUNTDOWN_MS` and the `useOnChange` on `gameState ? phase : null`.
- **Knockout pop-up:**
  - Shown when `knockout_order.length` goes up: "💥 {name} is out!", where name is `nameForSymbol(gameState, last_out) ?? SEAT_INFO[last_out].side`.
  - It is a `chunk bg-white animate-pop` box in the middle of the court. It hides after 1500 ms (keep the timeout in a ref and clear it on unmount).
  - It is not shown when `winner` is set, because the result overlay takes over.
- **Controls.** These only appear when `mySymbol` is set and `active[mySymbol] && lives[mySymbol] > 0` while playing.
  - Axis `x`: ArrowLeft, a, A → `neg`; ArrowRight, d, D → `pos`.
  - Axis `y`: ArrowUp, w, W → `neg`; ArrowDown, s, S → `pos`.
  - Use the same `held` set pattern as `PingPong.tsx`. `preventDefault` on those keys, and send `stop` on cleanup.
  - Desktop hint: "A / ← move left · D / → move right" or "W / ↑ move up · S / ↓ move down".
  - Phone D-pad (`md:hidden`): two 20×20 `game-btn btn-toy` buttons, ◀ ▶ or ▲ ▼, with the pointer handlers as in `PingPong.tsx`.
- **Layout:**
  - Desktop (`hidden md:grid`): a 3×3 grid, `grid-cols-[auto_auto_auto]`. The T card is top-centre, L is middle-left, the court is in the centre, R is middle-right and B is bottom-centre.
  - Phone (`md:hidden`): a `grid grid-cols-2 gap-2` of the 4 cards in the order B, T, L, R, above the court, with the court below it.
  - Render the court once and the cards per layout: two card containers, each with responsive visibility classes.
  - Scale: `w = innerWidth - (innerWidth < 768 ? 32 : 32 + 2*190)`, `h = innerHeight - (innerWidth < 768 ? 380 : 2*110 + 120)`, `scale = max(min(w/field, max(h,100)/field, 1), 0.1)`. This is the same resize-listener pattern as `PingPong.tsx`.
- **Card (`PongFourCard`):**
  - Props: `{ seat, name?: string, lives: number, livesMax: number, state: "playing" | "out" | "wall" | "empty", isMe: boolean }`.
  - It is a `chunk bg-white text-ink` box with an `Avatar` (size 32). It shows the name, plus " (you)" when it is yours, and a dot in the seat colour next to `SEAT_INFO[seat].side`.
  - `playing`: hearts from `hearts(livesMax - lives, livesMax)`.
  - `out`: `opacity-50 grayscale` and the text "💥 Out".
  - `wall`: a seated player who sits this round out. Shows "🧱 Wall".
  - `empty`: no player in the seat. Shows "🧱 Wall" and the name "Empty".
  - `isMe`: adds `ring-4 ring-candy-yellow`.
- **Result.** `ResultOverlay`:
  - `open={!!winner}`
  - `outcome={outcomeFor(winner, false, mySymbol)}`
  - `title={resultTitle(gameState, winner, false, mySymbol)}`
  - `subtitle={matchWinsLine(gameState, matchScore)}`
  - children: an `<ol>` of `ranking(winner, knockout_order)`. Row 1 is "🥇 Name ❤️❤️🤍" (hearts from the winner's lives), rows 2 and 3 are 🥈 and 🥉, and row 4 is "4.". Each row has a seat-colour dot.
  - `onPlayAgain={handleRestart}`.

## Steps

### 1. Backend: PongFourLogic seats, lobby, state and reset; register `pong-4`
- **Create `backend/games/pong_four.py`** from Reference A, but leave out the physics for now:
  - Leave out `_side`, `_place`, `_bounce_corners`, `_bounce_paddles`, `_walls_and_misses` and `_lose_life`.
  - Make `tick()` only `if self.phase != "playing": return`, followed by a `pass` with the comment `# physics added in the next step`.
  - Keep everything else exactly as in Reference A, including all the constants and `_serve`.
- **Register it in `backend/games/__init__.py`.** Add `from .pong_four import PongFourLogic`, and add `elif game_type == "pong-4": return PongFourLogic()` after the `ping-pong` branch.
- **Test first.** Write `/tmp/pong4_lobby_check.py` (Reference B) in `/tmp`, never in the repo.
  - Run it from the repo root: `python3 /tmp/pong4_lobby_check.py`
  - Before the change, expect it to fail at `assert syms == ...` with `AttributeError: 'NoneType' object has no attribute 'on_player_join'`.
- **After implementing,** expect `lobby OK`.
- Also run `python3 -c "import sys; sys.path.insert(0,'backend'); import games"` and expect no output.
- **Commit:** `feat(games): 4-Player Pong backend seats and lobby (GH-41)`

### 2. Backend: 4-side physics, hearts, knockout and winner
- **Add the rest of Reference A** to `backend/games/pong_four.py`:
  - `_side`, `_place`, the full `tick()`, `_bounce_corners`, `_bounce_paddles`, `_walls_and_misses` and `_lose_life`.
- **The rules:**
  - The order in a tick is: corners, then paddles, then walls and misses.
  - The ball speed is always 6.
  - A paddle return has an angle of `offset * 60°`.
  - A side that is not alive reflects the ball.
  - When the ball's centre crosses an alive side's edge, that side loses a heart and the ball is re-served.
  - At 0 hearts the side is added to `knockout_order` and `last_out`.
  - When one side is left alive, `winner` is set, `phase = "finished"` and the ball stops.
- **Test first.** Write `/tmp/pong4_physics_check.py` (Reference C).
  - Run `python3 /tmp/pong4_physics_check.py`. Before the change, expect the first assert, the wall bounce, to fail with an `AssertionError`.
  - After implementing, expect `physics OK`, and `python3 /tmp/pong4_lobby_check.py` still prints `lobby OK`.
- **Smoke test with the real loop.** Run `cd backend; uvicorn main:app --port 8000`. Then connect 2 WebSocket clients to `/ws/pong-4/test1?token=...` and use the existing frontend later in step 3, or check manually in step 6.
- **Commit:** `feat(games): 4-Player Pong ball physics, hearts and knockout (GH-41)`

### 3. Frontend: register 4-Player Pong with helpers, rules and a lobby screen
- **Create `frontend/src/lib/pongFour.ts`** exactly as in Reference D.
- **Add the `GAMES` entry and the `GAME_RULES["pong-4"]` entry** from Reference E.
- **Create `frontend/src/components/games/PongFour.tsx`** with `"use client"` and the default export `PongFour({ ws, gameState, mySymbol, handleRestart, matchScore }: GameProps)`.
  - **Loading:** the `Loader2` spinner, as in `PingPong.tsx`.
  - **Lobby** (`phase === "lobby"`): a `chunk bg-white` card with the 🏓 emoji (✅ once you are ready) and the heading "4-Player Pong". Below it:
    - A 2×2 grid of seats in the order B, T, L, R. A seat that someone holds (`seatedSeats`) shows ✅ when ready or ⏳ when not. An empty seat shows 🪑 "Empty seat". Each seat shows the player's name, a dot in the seat colour and "{side} side".
    - The text "Needs at least 2 ready players. Empty seats are walls."
    - A seated player who is not ready sees `ToyButton` green "Ready?", which sends `{action:"move", action_type:"set_ready"}`.
    - A ready player sees `ToyButton` "Start with {N} players", where N is the number of ready players. It is disabled when N < 2 and sends `{action:"move", action_type:"start"}`. Next to it is the line "Starts by itself when everyone is ready".
    - Spectators see "Watching — waiting for players…".
  - **Other phases:** for now, return a centred "Match in progress…" text. Step 4 replaces it.
- **Edit `frontend/src/app/room/[id]/page.tsx`.** Add `import PongFour from "@/components/games/PongFour";` and `case "pong-4": return <PongFour ws={ws} gameState={gameState} mySymbol={mySymbol} handleRestart={handleRestart} matchScore={matchScore} />;` after `ping-pong`.
- **Check.** Run `cd frontend; npm ci` (only once), then `npm run lint` and `npm run build`. Expect both to pass with 0 errors.
- **Manual check.** Run the backend and `npm run dev`. The lobby shows a 13th "4-Player Pong" card under Action. With 3 tabs open, the seats fill B, T and L, and Start enables once 2 are ready.
- **Commit:** `feat(ui): 4-Player Pong lobby card, rules and seat lobby (GH-41)`

### 4. Frontend: court, player cards and controls
- **Create `frontend/src/components/games/PongFourCard.tsx`** with the props and states in Reference F, "Card".
- **Create `frontend/src/components/games/PongFourCourt.tsx`.** It is presentational, with these props:
  `{ size: {field, corner, paddleLen, paddleW, inset, ballR}, scale, paddles: Record<Seat, number>, alive: Record<Seat, boolean>, showWalls: boolean, ball: {x, y}, trail: {x, y}[], squish: boolean, countdown: string | null, banner: string | null }`.
  - It draws the stripes, the centre circle, the 4 corner blocks, the walls for sides that are not alive (when `showWalls` is set), the paddles for alive sides, the trail, the ball, and the countdown/banner overlays.
  - Follow Reference F, "Coordinates" and "Court parts".
- **In `PongFour.tsx`,** replace the placeholder for `playing` and `finished`. Add:
  - the scale effect
  - the trail and squish handling with hit detection
  - the countdown
  - the keyboard controls for your side's axis
  - the desktop hint and the phone D-pad
  - the desktop 3×3 layout and the phone 2×2 layout (Reference F, "Controls" and "Layout")
- **Card state for each seat:**
  - not held → `empty`
  - `!active` → `wall`
  - `lives === 0` → `out`
  - otherwise `playing`
- **Check:** `npm run lint` and `npm run build` pass.
- **Manual check** with 2 tabs:
  - The countdown runs, then the ball moves.
  - The bottom player moves with A/D and the top player moves with ←/→ (both left/right).
  - The left and right sides are striped walls, and the ball bounces off them and off the corners.
  - At 375px wide, the cards sit in a 2×2 grid and the D-pad shows ◀ ▶.
- **Commit:** `feat(ui): 4-Player Pong court, player cards and controls (GH-41)`

### 5. Frontend: heart and knockout feedback and the result ranking
- **In `PongFour.tsx`, add:**
  - `play("pop")` when the total number of lives drops.
  - The "💥 Name is out!" pop-up. It is passed as `banner` to `PongFourCourt`, hides after 1500 ms and is suppressed once there is a winner.
  - The `ResultOverlay` with the ranking list and the match-wins subtitle (Reference F, "Result").
- **Clear every timer** on unmount.
- **Check:** `npm run lint` and `npm run build` pass.
- **Manual check** with 3 tabs:
  - Losing a heart pops and turns a ❤️ into 🤍.
  - At 0 hearts the pop-up shows, that card greys out and that side becomes a wall.
  - The last player's tab shows "You win! 🎉", with the ranking 🥇/🥈/🥉 and "Match wins — …".
  - Play again returns everyone to the lobby with ready flags cleared and 3 hearts.
- **Commit:** `feat(ui): 4-Player Pong knockout pop-up and result ranking (GH-41)`

### 6. QA pass: 2, 3 and 4 players plus a spectator, desktop and 375px
- **Run the full manual QA matrix** with the backend and `npm run dev`:
  1. 2 players: auto-start when both are ready, and the empty sides are walls.
  2. 3 players: 2 ready plus Start, so the 3rd sits out as a wall and their keys do nothing.
  3. 4 players: auto-start, and the full knockout to a winner. The match tally goes up by 1 for the winner only.
  4. A 5th tab is a spectator. It sees everything but has no Ready/Start/controls, and the result title is "{name} wins!".
  5. Close a player's tab mid-match: the game still ends. Reopen it with the same session: they get the seat back.
  6. Refresh mid-match: no countdown replay.
  7. Check the 2-player Ping-Pong is unchanged.
- **Check all screens at 375px.** Fix any layout overflow found, only in the `PongFour*` files.
- **Re-run** `python3 /tmp/pong4_lobby_check.py`, `python3 /tmp/pong4_physics_check.py`, `cd frontend; npm run lint; npm run build`.
- **Commit** fixes, if there are any: `fix(ui): 4-Player Pong QA fixes (GH-41)`

## Final verification
- `python3 /tmp/pong4_lobby_check.py` prints `lobby OK`, and `python3 /tmp/pong4_physics_check.py` prints `physics OK`. Both are run from the repo root and are not committed.
- `cd frontend; npm run lint; npm run build` both pass.
- The manual QA matrix in step 6 passes on desktop and at 375px.
- `git diff main --stat` touches only the 9 files in the file map.

## Notes
- **A player who leaves keeps their last paddle input.** `main.py` does not tell the game when someone disconnects, so their paddle keeps moving the same way until it reaches its clamp, then stays there. Because it no longer follows the ball, that player keeps losing hearts and the match still ends, as the design requires.
- **The design lists `is_draw` as always false.** No draw path exists.
