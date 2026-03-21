class BattleshipsLogic:
    def __init__(self):
        self.phase = "setup" # "setup", "playing", "finished"
        # store ships format: symbol -> list of indices (0 to 99)
        self.ships = {"A": [], "B": []}
        # store shots format: symbol -> dict of str(index) -> "hit"/"miss"
        self.shots = {"A": {}, "B": {}}
        self.ready = {"A": False, "B": False}
        self.current_turn = "A"
        self.winner = None
        self.is_draw = False

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        """Each Battleships room supports exactly two players: A and B."""
        if username in existing_symbols:
            return existing_symbols[username]
        if "A" not in existing_symbols.values():
            return "A"
        if "B" not in existing_symbols.values():
            return "B"
        return None  # spectator

    def get_state_for_player(self, player_symbol):
        state = {
            "phase": self.phase,
            "current_turn": self.current_turn,
            "winner": self.winner,
            "is_draw": self.is_draw,
            "ready": self.ready,
            "my_ships": self.ships.get(player_symbol, []),
            "shots": self.shots
        }
        return state

    def make_move(self, symbol: str, **kwargs) -> bool:
        if symbol not in ["A", "B"]:
            return False

        if self.phase == "setup":
            if kwargs.get("action_type") == "place_ships":
                indices = kwargs.get("ships", [])
                if len(indices) == 17: # 5+4+3+3+2 = 17
                    self.ships[symbol] = list(indices)
                    self.ready[symbol] = True
                    if self.ready["A"] and self.ready["B"]:
                        self.phase = "playing"
                    return True
            return False
            
        elif self.phase == "playing":
            if self.winner or symbol != self.current_turn:
                return False
                
            index = kwargs.get("index")
            if index is None or index < 0 or index > 99:
                return False
            
            idx_str = str(index)
            if idx_str in self.shots[symbol]:
                return False 
                
            enemy = "B" if symbol == "A" else "A"
            if index in self.ships[enemy]:
                self.shots[symbol][idx_str] = "hit"
            else:
                self.shots[symbol][idx_str] = "miss"
                
            self.check_winner(symbol, enemy)
            
            if not self.winner:
                self.current_turn = enemy
            return True
        return False

    def check_winner(self, attacker, defender):
        hits = [k for k, v in self.shots[attacker].items() if v == "hit"]
        if len(hits) == len(self.ships[defender]):
            self.winner = attacker
            self.phase = "finished"

    def reset(self):
        self.phase = "setup"
        self.ships = {"A": [], "B": []}
        self.shots = {"A": {}, "B": {}}
        self.ready = {"A": False, "B": False}
        self.current_turn = "A"
        self.winner = None
        self.is_draw = False
