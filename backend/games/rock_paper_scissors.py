CHOICES = {"rock", "paper", "scissors"}
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}
WIN_ROUNDS = 3  # Best of 5

class RockPaperScissorsLogic:
    def __init__(self):
        self.phase = "picking"   # "picking" | "reveal" | "finished"
        self.scores = {"A": 0, "B": 0}
        self.picks = {"A": None, "B": None}
        self.last_result = None   # dict with picks + round winner
        self.winner = None
        self.is_draw = False

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        if username in existing_symbols:
            return existing_symbols[username]
        if "A" not in existing_symbols.values():
            return "A"
        if "B" not in existing_symbols.values():
            return "B"
        return None

    def get_state(self):
        # Hide opponent's pick while still picking
        return {
            "phase": self.phase,
            "scores": self.scores,
            "picks": self.picks if self.phase == "reveal" else {
                "A": "hidden" if self.picks["A"] else None,
                "B": "hidden" if self.picks["B"] else None,
            },
            "last_result": self.last_result,
            "winner": self.winner,
            "is_draw": self.is_draw,
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        if symbol not in ["A", "B"] or self.winner:
            return False

        if self.phase == "picking":
            choice = kwargs.get("choice", "").lower()
            if choice not in CHOICES:
                return False
            if self.picks[symbol] is not None:
                return False  # Already picked this round
            self.picks[symbol] = choice

            # Both picked — resolve round
            if self.picks["A"] and self.picks["B"]:
                self.phase = "reveal"
                self._resolve_round()
            return True

        if self.phase == "reveal":
            # Either player can advance to next round
            if kwargs.get("action_type") == "next_round":
                if not self.winner:
                    self.picks = {"A": None, "B": None}
                    self.last_result = None
                    self.phase = "picking"
                return True

        return False

    def _resolve_round(self):
        a, b = self.picks["A"], self.picks["B"]
        if a == b:
            round_winner = None  # Tie
        elif BEATS[a] == b:
            round_winner = "A"
            self.scores["A"] += 1
        else:
            round_winner = "B"
            self.scores["B"] += 1

        self.last_result = {"A": a, "B": b, "round_winner": round_winner}

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
        self.last_result = None
        self.winner = None
        self.is_draw = False
