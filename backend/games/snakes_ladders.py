import random

# ─── Board definitions ────────────────────────────────────────────────────────
SNAKES:  dict[int, int] = {99: 78, 95: 75, 87: 36, 62: 19, 54: 34, 17: 7}
LADDERS: dict[int, int] = {4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91}
WIN_SQUARE = 100

# ─── Power Cards ─────────────────────────────────────────────────────────────
ALL_CARDS = [
    {"id": "double_roll",  "name": "Double Roll",    "emoji": "🎲", "desc": "Roll twice and move by the sum of both dice."},
    {"id": "shield",       "name": "Shield",         "emoji": "🛡️", "desc": "Block the next snake you land on."},
    {"id": "swap",         "name": "Position Swap",  "emoji": "🔄", "desc": "Instantly swap positions with your opponent."},
    {"id": "sabotage",     "name": "Sabotage",       "emoji": "💣", "desc": "Force your opponent to lose their next turn."},
    {"id": "lucky_leap",   "name": "Lucky Leap",     "emoji": "✨", "desc": "Leap forward 6–15 squares (counts as your roll)."},
    {"id": "extra_turn",   "name": "Extra Turn",     "emoji": "⏩", "desc": "Take another turn immediately after this one."},
]

def _make_deck() -> list[str]:
    deck = (
        ["double_roll"] * 5 +
        ["shield"]      * 5 +
        ["lucky_leap"]  * 5 +
        ["sabotage"]    * 4 +
        ["swap"]        * 3 +
        ["extra_turn"]  * 3
    )
    random.shuffle(deck)
    return deck


class SnakesLaddersLogic:
    def __init__(self):
        self.phase = "waiting"
        self.pos:    dict[str, int]  = {"A": 0, "B": 0}
        self.turn    = "A"
        self.last_roll:  int | None  = None
        self.last_event: str         = "none"
        self.winner: str | None      = None

        # FIX 1: track which players have signalled ready
        self.ready_set: set[str] = set()

        # Cards
        self.deck:  list[str]            = []
        self.hands: dict[str, list[str]] = {"A": [], "B": []}

        # Per-turn effects
        self.shield:      dict[str, bool] = {"A": False, "B": False}
        self.sabotaged:   dict[str, bool] = {"A": False, "B": False}
        self.double_roll: dict[str, bool] = {"A": False, "B": False}
        self.extra_turn:  dict[str, bool] = {"A": False, "B": False}

        # FIX 3: limit 1 card play per turn
        self.cards_played_this_turn: int  = 0

        self.last_card:        str | None = None
        self.last_card_player: str | None = None

    # ── helpers ──────────────────────────────────────────────────────────────
    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        if username in existing_symbols:
            return existing_symbols[username]
        if "A" not in existing_symbols.values():
            return "A"
        if "B" not in existing_symbols.values():
            return "B"
        return None

    def _draw(self, symbol: str):
        if len(self.hands[symbol]) < 4 and self.deck:
            self.hands[symbol].append(self.deck.pop())

    def _apply_move(self, symbol: str, roll: int) -> str:
        current = self.pos[symbol]
        new_pos = current + roll
        if new_pos > WIN_SQUARE:
            new_pos = WIN_SQUARE - (new_pos - WIN_SQUARE)

        event = "normal"
        if new_pos in SNAKES:
            if self.shield[symbol]:
                self.shield[symbol] = False
                event = "shield_blocked"
            else:
                new_pos = SNAKES[new_pos]
                event = "snake"
        elif new_pos in LADDERS:
            new_pos = LADDERS[new_pos]
            event = "ladder"

        self.pos[symbol] = new_pos
        if new_pos == WIN_SQUARE:
            event = "win"
        return event

    def _switch_turn(self, to: str):
        """Switch the active turn and reset the per-turn card counter."""
        self.turn = to
        self.cards_played_this_turn = 0

    def _start(self):
        self.deck = _make_deck()
        for sym in ("A", "B"):
            for _ in range(3):
                self._draw(sym)
        self.cards_played_this_turn = 0
        self.phase = "playing"

    def get_state(self):
        return {
            "phase":      self.phase,
            "pos_A":      self.pos["A"],
            "pos_B":      self.pos["B"],
            "turn":       self.turn,
            "last_roll":  self.last_roll,
            "last_event": self.last_event,
            "winner":     self.winner,
            "snakes":     SNAKES,
            "ladders":    LADDERS,
            "hand_A":     self.hands["A"],
            "hand_B":     self.hands["B"],
            "hand_A_count": len(self.hands["A"]),
            "hand_B_count": len(self.hands["B"]),
            "shield_A":      self.shield["A"],
            "shield_B":      self.shield["B"],
            "sabotaged_A":   self.sabotaged["A"],
            "sabotaged_B":   self.sabotaged["B"],
            "double_roll_A": self.double_roll["A"],
            "double_roll_B": self.double_roll["B"],
            "extra_turn_A":  self.extra_turn["A"],
            "extra_turn_B":  self.extra_turn["B"],
            "cards_played_this_turn": self.cards_played_this_turn,
            "last_card":        self.last_card,
            "last_card_player": self.last_card_player,
            "all_cards":   ALL_CARDS,
            # FIX 1: expose ready count so frontend can show "waiting for opponent"
            "ready_count": len(self.ready_set),
        }

    # ── moves ─────────────────────────────────────────────────────────────────
    def make_move(self, symbol: str, **kwargs) -> bool:
        action = kwargs.get("action_type")

        # ── ready ──────────────────────────────────────────────────────────
        # FIX 1: only start once BOTH players have signalled ready
        if action == "ready":
            if self.phase == "waiting" and symbol in ("A", "B"):
                self.ready_set.add(symbol)
                if len(self.ready_set) >= 2:
                    self._start()
                return True
            return False

        # ── play_card ───────────────────────────────────────────────────────
        if action == "play_card":
            if self.phase != "playing" or self.turn != symbol:
                return False
            card_id = kwargs.get("card_id")
            if card_id not in self.hands[symbol]:
                return False

            # FIX 3: only 1 card per turn
            if self.cards_played_this_turn >= 1:
                return False

            self.hands[symbol].remove(card_id)
            self.last_card = card_id
            self.last_card_player = symbol
            self.cards_played_this_turn += 1
            opp = "B" if symbol == "A" else "A"

            if card_id == "shield":
                self.shield[symbol] = True
                self.last_event = "card_shield"

            elif card_id == "swap":
                self.pos["A"], self.pos["B"] = self.pos["B"], self.pos["A"]
                self.last_event = "card_swap"

            elif card_id == "sabotage":
                self.sabotaged[opp] = True
                self.last_event = "card_sabotage"

            elif card_id == "double_roll":
                self.double_roll[symbol] = True
                self.last_event = "card_double_roll"

            elif card_id == "lucky_leap":
                leap = random.randint(6, 15)
                ev = self._apply_move(symbol, leap)
                self.last_event = f"card_leap_{ev}"
                if ev == "win":
                    self.winner = symbol
                    self.phase = "finished"
                    self._draw(symbol)
                    return True
                # Lucky Leap ends the turn (replaces the roll)
                if self.extra_turn[symbol]:
                    self.extra_turn[symbol] = False
                    self.cards_played_this_turn = 0   # fresh turn for this player
                else:
                    self._switch_turn(opp)
                self._draw(symbol)
                return True

            elif card_id == "extra_turn":
                self.extra_turn[symbol] = True
                self.last_event = "card_extra_turn"

            self._draw(symbol)
            return True

        # ── roll ────────────────────────────────────────────────────────────
        if action == "roll":
            if self.phase != "playing" or self.turn != symbol:
                return False

            opp = "B" if symbol == "A" else "A"

            # FIX 2: sabotage wastes the turn but does NOT destroy double_roll
            if self.sabotaged[symbol]:
                self.sabotaged[symbol] = False
                self.last_roll = random.randint(1, 6)   # show a dice face
                self.last_event = "sabotaged"
                # double_roll is intentionally preserved for next turn
                self._switch_turn(opp)
                return True

            # Double roll
            if self.double_roll[symbol]:
                self.double_roll[symbol] = False
                r1 = random.randint(1, 6)
                r2 = random.randint(1, 6)
                roll = r1 + r2
            else:
                roll = random.randint(1, 6)

            self.last_roll = roll
            ev = self._apply_move(symbol, roll)
            self.last_event = ev

            if ev == "win":
                self.winner = symbol
                self.phase = "finished"
                return True

            # Extra turn: player goes again, but card counter resets
            if self.extra_turn[symbol]:
                self.extra_turn[symbol] = False
                self.cards_played_this_turn = 0   # fresh card slot for the bonus turn
            else:
                self._switch_turn(opp)

            self._draw(symbol)
            return True

        return False

    def reset(self):
        self.__init__()
