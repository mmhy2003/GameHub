class TetrisLogic:
    def __init__(self):
        self.phase = "lobby"  # "lobby", "playing", "finished"
        self.ready = {"P1": False, "P2": False}
        self.scores = {"P1": 0, "P2": 0}
        self.garbage_queue = {"P1": 0, "P2": 0}
        self.winner = None
        self.is_draw = False

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        """Two-player competitive Tetris: assign P1 then P2."""
        if username in existing_symbols:
            return existing_symbols[username]
        if "P1" not in existing_symbols.values():
            return "P1"
        if "P2" not in existing_symbols.values():
            return "P2"
        return None  # spectator

    def get_state(self):
        return {
            "phase": self.phase,
            "ready": self.ready,
            "scores": self.scores,
            "garbage_queue": self.garbage_queue,
            "winner": self.winner,
            "is_draw": self.is_draw
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        if symbol not in ["P1", "P2"] or self.winner:
            return False

        action_type = kwargs.get("action_type")

        if action_type == "set_ready":
            if self.phase == "lobby":
                self.ready[symbol] = True
                if self.ready["P1"] and self.ready["P2"]:
                    self.phase = "playing"
                return True
            return False

        # Only allow gameplay actions when in playing phase
        if self.phase != "playing":
            return False

        if action_type == "lines_cleared":
            count = kwargs.get("count", 0)
            if count > 0:
                self.scores[symbol] += count * 100
                enemy = "P2" if symbol == "P1" else "P1"
                if count >= 2:
                    garbage = count - 1 if count < 4 else 4
                    self.garbage_queue[enemy] += garbage
            return True

        elif action_type == "consume_garbage":
            count = kwargs.get("count", 0)
            self.garbage_queue[symbol] = max(0, self.garbage_queue[symbol] - count)
            return True

        elif action_type == "game_over":
            self.winner = "P2" if symbol == "P1" else "P1"
            self.phase = "finished"
            return True

        return False

    def reset(self):
        self.phase = "lobby"
        self.ready = {"P1": False, "P2": False}
        self.scores = {"P1": 0, "P2": 0}
        self.garbage_queue = {"P1": 0, "P2": 0}
        self.winner = None
        self.is_draw = False
