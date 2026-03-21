MAX_WRONG = 6

class HangmanLogic:
    def __init__(self):
        self.phase = "setting"   # "setting" | "guessing" | "finished"
        self.word: str | None = None
        self.guessed_letters: set[str] = set()
        self.wrong_guesses = 0
        self.winner: str | None = None
        self.is_draw = False
        # Tracks which player symbol is the setter this round (toggles on reset)
        self.setter = "W"
        self.guesser = "G"

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        if username in existing_symbols:
            return existing_symbols[username]
        if "W" not in existing_symbols.values():
            return "W"
        if "G" not in existing_symbols.values():
            return "G"
        return None

    def get_state(self):
        display_word = None
        if self.word is not None:
            display_word = " ".join(
                c if c in self.guessed_letters else "_"
                for c in self.word
            )
        return {
            "phase": self.phase,
            "setter": self.setter,
            "guesser": self.guesser,
            "display_word": display_word,
            "word_length": len(self.word) if self.word else None,
            "guessed_letters": sorted(self.guessed_letters),
            "wrong_guesses": self.wrong_guesses,
            "max_wrong": MAX_WRONG,
            "winner": self.winner,
            "is_draw": self.is_draw,
            # Only reveal actual word once game is finished
            "revealed_word": self.word if self.phase == "finished" else None,
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        action_type = kwargs.get("action_type")

        if action_type == "set_word":
            if symbol != self.setter or self.phase != "setting":
                return False
            word = kwargs.get("word", "").strip().upper()
            if not word.isalpha() or len(word) < 2 or len(word) > 20:
                return False
            self.word = word
            self.phase = "guessing"
            return True

        if action_type == "swap_roles":
            # Setter can hand off the role to their opponent before setting a word
            if symbol != self.setter or self.phase != "setting":
                return False
            self.setter, self.guesser = self.guesser, self.setter
            return True

        if action_type == "guess_letter":
            if symbol != self.guesser or self.phase != "guessing":
                return False
            letter = kwargs.get("letter", "").strip().upper()
            if not letter or len(letter) != 1 or not letter.isalpha():
                return False
            if letter in self.guessed_letters:
                return False
            self.guessed_letters.add(letter)
            if letter not in self.word:
                self.wrong_guesses += 1
            # Win conditions
            if all(c in self.guessed_letters for c in self.word):
                self.winner = self.guesser
                self.phase = "finished"
            elif self.wrong_guesses >= MAX_WRONG:
                self.winner = self.setter
                self.phase = "finished"
            return True

        return False

    def reset(self):
        # Swap roles each round
        self.setter, self.guesser = self.guesser, self.setter
        self.phase = "setting"
        self.word = None
        self.guessed_letters = set()
        self.wrong_guesses = 0
        self.winner = None
        self.is_draw = False
