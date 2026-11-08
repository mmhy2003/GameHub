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

    def tick(self):
        """Called by the server game loop each frame (~30fps)."""
        if self.phase != "playing":
            return
        pass  # physics added in the next step

    def reset(self):
        """Back to the lobby: seats kept, ready flags cleared, lives back to LIVES."""
        self._new_round()
