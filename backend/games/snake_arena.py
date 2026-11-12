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
