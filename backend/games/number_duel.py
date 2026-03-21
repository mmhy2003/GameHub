import random

WIN_ROUNDS = 3

class NumberDuelLogic:
    def __init__(self):
        self.phase = "picking"   # "picking" | "reveal" | "finished"
        self.scores = {"A": 0, "B": 0}
        self.picks: dict[str, int | None] = {"A": None, "B": None}
        self.target = random.randint(1, 100)
        self.last_result: dict | None = None
        self.winner: str | None = None
        self.is_draw = False
        self.round = 1

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
            "scores": self.scores,
            "round": self.round,
            # Hide target and picks until reveal phase
            "target": self.target if self.phase in ("reveal", "finished") else None,
            "picks": self.picks if self.phase in ("reveal", "finished") else {
                "A": "hidden" if self.picks["A"] is not None else None,
                "B": "hidden" if self.picks["B"] is not None else None,
            },
            "last_result": self.last_result,
            "winner": self.winner,
            "is_draw": self.is_draw,
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        if symbol not in ["A", "B"] or self.winner:
            return False

        action_type = kwargs.get("action_type", "pick")

        if action_type == "pick" and self.phase == "picking":
            if self.picks[symbol] is not None:
                return False
            try:
                number = int(kwargs.get("number", 0))
            except (ValueError, TypeError):
                return False
            if number < 1 or number > 100:
                return False
            self.picks[symbol] = number
            # Both have picked — resolve
            if self.picks["A"] is not None and self.picks["B"] is not None:
                self.phase = "reveal"
                self._resolve_round()
            return True

        if action_type == "next_round" and self.phase == "reveal":
            if not self.winner:
                self.picks = {"A": None, "B": None}
                self.target = random.randint(1, 100)
                self.last_result = None
                self.phase = "picking"
                self.round += 1
            return True

        return False

    def _resolve_round(self):
        a, b = self.picks["A"], self.picks["B"]
        diff_a = abs(a - self.target)
        diff_b = abs(b - self.target)

        if diff_a < diff_b:
            round_winner = "A"
            self.scores["A"] += 1
        elif diff_b < diff_a:
            round_winner = "B"
            self.scores["B"] += 1
        else:
            round_winner = None   # exact tie

        self.last_result = {
            "A": a, "B": b,
            "target": self.target,
            "diff_A": diff_a, "diff_B": diff_b,
            "round_winner": round_winner,
        }

        if self.scores["A"] >= WIN_ROUNDS:
            self.winner = "A"
            self.phase = "finished"
        elif self.scores["B"] >= WIN_ROUNDS:
            self.winner = "B"
            self.phase = "finished"

    def reset(self):
        self.phase = "picking"
        self.scores = {"A": 0, "B": 0}
        self.picks = {"A": None, "B": None}
        self.target = random.randint(1, 100)
        self.last_result = None
        self.winner = None
        self.is_draw = False
        self.round = 1
