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

    def tick(self):
        """Called by the server game loop each frame (~30fps). Movement comes in step 2."""
        return

    def reset(self):
        """Back to the lobby: seats kept, ready flags cleared, map and hearts restored."""
        self._new_round()
