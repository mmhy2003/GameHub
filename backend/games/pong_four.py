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
