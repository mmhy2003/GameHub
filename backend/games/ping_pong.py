import random

FIELD_W = 800
FIELD_H = 500
PADDLE_H = 80
PADDLE_W = 12
BALL_R = 9
PADDLE_SPEED = 5   # units per tick at ~30fps
BALL_SPEED = 5
WIN_SCORE = 7

class PingPongLogic:
    needs_server_loop = True  # Tells main.py to start a background game loop

    def __init__(self):
        self.phase = "lobby"   # lobby -> playing -> finished
        self.ready = {"L": False, "R": False}
        self.scores = {"L": 0, "R": 0}
        self.winner = None
        self.is_draw = False

        # Paddle centre-y positions
        self.left_y = FIELD_H / 2
        self.right_y = FIELD_H / 2

        # Paddle input states (set by players, consumed by loop)
        self.left_state = "stop"   # "up" | "down" | "stop"
        self.right_state = "stop"

        # Ball
        self.ball_x = FIELD_W / 2
        self.ball_y = FIELD_H / 2
        self.ball_vx = BALL_SPEED
        self.ball_vy = BALL_SPEED * 0.6

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        """Left paddle (L) then right paddle (R)."""
        if username in existing_symbols:
            return existing_symbols[username]
        if "L" not in existing_symbols.values():
            return "L"
        if "R" not in existing_symbols.values():
            return "R"
        return None  # spectator

    def get_state(self):
        return {
            "phase": self.phase,
            "ready": self.ready,
            "scores": self.scores,
            "winner": self.winner,
            "is_draw": self.is_draw,
            "ball_x": round(self.ball_x, 1),
            "ball_y": round(self.ball_y, 1),
            "left_y": round(self.left_y, 1),
            "right_y": round(self.right_y, 1),
            "field_w": FIELD_W,
            "field_h": FIELD_H,
            "paddle_h": PADDLE_H,
            "paddle_w": PADDLE_W,
            "ball_r": BALL_R,
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        if symbol not in ["L", "R"]:
            return False

        action_type = kwargs.get("action_type")

        if action_type == "set_ready":
            if self.phase == "lobby":
                self.ready[symbol] = True
                if self.ready["L"] and self.ready["R"]:
                    self.phase = "playing"
                    self._reset_ball(serve="L")
                return True
            return False

        if action_type == "paddle":
            state = kwargs.get("state", "stop")
            if state not in ("up", "down", "stop"):
                return False
            if symbol == "L":
                self.left_state = state
            else:
                self.right_state = state
            return True

        return False

    def tick(self):
        """Called by the server game loop each frame (~30fps)."""
        if self.phase != "playing":
            return

        # --- Move paddles ---
        half = PADDLE_H / 2
        if self.left_state == "up":
            self.left_y = max(half, self.left_y - PADDLE_SPEED)
        elif self.left_state == "down":
            self.left_y = min(FIELD_H - half, self.left_y + PADDLE_SPEED)

        if self.right_state == "up":
            self.right_y = max(half, self.right_y - PADDLE_SPEED)
        elif self.right_state == "down":
            self.right_y = min(FIELD_H - half, self.right_y + PADDLE_SPEED)

        # --- Move ball ---
        self.ball_x += self.ball_vx
        self.ball_y += self.ball_vy

        # Top / bottom bounce
        if self.ball_y <= BALL_R:
            self.ball_y = BALL_R
            self.ball_vy = abs(self.ball_vy)
        elif self.ball_y >= FIELD_H - BALL_R:
            self.ball_y = FIELD_H - BALL_R
            self.ball_vy = -abs(self.ball_vy)

        # Left paddle collision (paddle at x=30, width PADDLE_W inward)
        paddle_x_left = 30 + PADDLE_W
        if (self.ball_vx < 0 and
                self.ball_x - BALL_R <= paddle_x_left and
                self.ball_x + BALL_R >= 30 and
                abs(self.ball_y - self.left_y) <= half + BALL_R):
            self.ball_x = paddle_x_left + BALL_R
            self.ball_vx = abs(self.ball_vx)
            offset = (self.ball_y - self.left_y) / half
            self.ball_vy = offset * BALL_SPEED * 1.2

        # Right paddle collision (paddle at x=FIELD_W-30-PADDLE_W, extends right)
        paddle_x_right = FIELD_W - 30 - PADDLE_W
        if (self.ball_vx > 0 and
                self.ball_x + BALL_R >= paddle_x_right and
                self.ball_x - BALL_R <= FIELD_W - 30 and
                abs(self.ball_y - self.right_y) <= half + BALL_R):
            self.ball_x = paddle_x_right - BALL_R
            self.ball_vx = -abs(self.ball_vx)
            offset = (self.ball_y - self.right_y) / half
            self.ball_vy = offset * BALL_SPEED * 1.2

        # --- Scoring ---
        if self.ball_x < 0:
            self.scores["R"] += 1
            if self.scores["R"] >= WIN_SCORE:
                self.winner = "R"
                self.phase = "finished"
            else:
                self._reset_ball(serve="L")
        elif self.ball_x > FIELD_W:
            self.scores["L"] += 1
            if self.scores["L"] >= WIN_SCORE:
                self.winner = "L"
                self.phase = "finished"
            else:
                self._reset_ball(serve="R")

    def _reset_ball(self, serve: str = "L"):
        self.ball_x = FIELD_W / 2
        self.ball_y = FIELD_H / 2
        direction = 1 if serve == "L" else -1
        self.ball_vx = BALL_SPEED * direction
        self.ball_vy = (random.random() * 2 - 1) * BALL_SPEED * 0.7

    def reset(self):
        self.phase = "lobby"
        self.ready = {"L": False, "R": False}
        self.scores = {"L": 0, "R": 0}
        self.winner = None
        self.is_draw = False
        self.left_y = FIELD_H / 2
        self.right_y = FIELD_H / 2
        self.left_state = "stop"
        self.right_state = "stop"
        self._reset_ball()
