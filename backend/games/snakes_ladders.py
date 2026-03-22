import random

# Snakes: head -> tail (going DOWN)
SNAKES = {
    99: 78,
    95: 75,
    87: 36,
    62: 19,
    54: 34,
    17:  7,
}

# Ladders: bottom -> top (going UP)
LADDERS = {
     4: 14,
     9: 31,
    20: 38,
    28: 84,
    40: 59,
    51: 67,
    63: 81,
    71: 91,
}

WIN_SQUARE = 100


class SnakesLaddersLogic:
    def __init__(self):
        self.phase = "waiting"   # "waiting" | "playing" | "finished"
        self.pos: dict[str, int] = {"A": 0, "B": 0}
        self.turn = "A"
        self.last_roll: int | None = None
        self.last_event: str = "none"   # "normal" | "snake" | "ladder" | "win"
        self.winner: str | None = None

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        if username in existing_symbols:
            return existing_symbols[username]
        if "A" not in existing_symbols.values():
            return "A"
        if "B" not in existing_symbols.values():
            return "B"
        return None

    def get_state(self):
        return {
            "phase": self.phase,
            "pos_A": self.pos["A"],
            "pos_B": self.pos["B"],
            "turn": self.turn,
            "last_roll": self.last_roll,
            "last_event": self.last_event,
            "winner": self.winner,
            "snakes": SNAKES,
            "ladders": LADDERS,
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        action_type = kwargs.get("action_type")

        if action_type == "ready":
            if self.phase == "waiting":
                self.phase = "playing"
                return True
            return False

        if action_type == "roll":
            if self.phase != "playing" or self.turn != symbol:
                return False

            roll = random.randint(1, 6)
            self.last_roll = roll

            current = self.pos[symbol]
            new_pos = current + roll

            # Overshoot: bounce back
            if new_pos > WIN_SQUARE:
                new_pos = WIN_SQUARE - (new_pos - WIN_SQUARE)

            # Check snake or ladder
            if new_pos in SNAKES:
                new_pos = SNAKES[new_pos]
                self.last_event = "snake"
            elif new_pos in LADDERS:
                new_pos = LADDERS[new_pos]
                self.last_event = "ladder"
            else:
                self.last_event = "normal"

            self.pos[symbol] = new_pos

            if new_pos == WIN_SQUARE:
                self.winner = symbol
                self.phase = "finished"
                self.last_event = "win"
            else:
                # Switch turn
                self.turn = "B" if symbol == "A" else "A"

            return True

        return False

    def reset(self):
        self.phase = "waiting"
        self.pos = {"A": 0, "B": 0}
        self.turn = "A"
        self.last_roll = None
        self.last_event = "none"
        self.winner = None
