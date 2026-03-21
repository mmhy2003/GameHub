import random

# 24 unique characters with defined attributes
CHARACTERS = [
    {"id": 0,  "name": "Alex",   "gender": "male",   "hair_color": "brown", "hair_style": "short",  "skin": "light",  "eyes": "brown", "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 1,  "name": "Emma",   "gender": "female", "hair_color": "blond", "hair_style": "long",   "skin": "light",  "eyes": "blue",  "glasses": False, "facial_hair": "none",     "hat": False, "earrings": True,  "freckles": False},
    {"id": 2,  "name": "Marcus", "gender": "male",   "hair_color": "black", "hair_style": "short",  "skin": "dark",   "eyes": "brown", "glasses": False, "facial_hair": "beard",    "hat": False, "earrings": False, "freckles": False},
    {"id": 3,  "name": "Sofia",  "gender": "female", "hair_color": "red",   "hair_style": "long",   "skin": "medium", "eyes": "green", "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 4,  "name": "James",  "gender": "male",   "hair_color": "gray",  "hair_style": "bald",   "skin": "light",  "eyes": "blue",  "glasses": False, "facial_hair": "mustache", "hat": True,  "earrings": False, "freckles": False},
    {"id": 5,  "name": "Lily",   "gender": "female", "hair_color": "black", "hair_style": "curly",  "skin": "medium", "eyes": "brown", "glasses": False, "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 6,  "name": "Omar",   "gender": "male",   "hair_color": "black", "hair_style": "short",  "skin": "dark",   "eyes": "brown", "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 7,  "name": "Claire", "gender": "female", "hair_color": "blond", "hair_style": "short",  "skin": "light",  "eyes": "blue",  "glasses": False, "facial_hair": "none",     "hat": True,  "earrings": False, "freckles": False},
    {"id": 8,  "name": "Henri",  "gender": "male",   "hair_color": "brown", "hair_style": "curly",  "skin": "medium", "eyes": "green", "glasses": False, "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 9,  "name": "Raya",   "gender": "female", "hair_color": "brown", "hair_style": "long",   "skin": "dark",   "eyes": "brown", "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": True,  "freckles": False},
    {"id": 10, "name": "Tom",    "gender": "male",   "hair_color": "blond", "hair_style": "short",  "skin": "light",  "eyes": "blue",  "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 11, "name": "Zoe",    "gender": "female", "hair_color": "red",   "hair_style": "curly",  "skin": "light",  "eyes": "green", "glasses": False, "facial_hair": "none",     "hat": False, "earrings": False, "freckles": True},
    {"id": 12, "name": "Diego",  "gender": "male",   "hair_color": "black", "hair_style": "short",  "skin": "medium", "eyes": "brown", "glasses": False, "facial_hair": "mustache", "hat": False, "earrings": False, "freckles": False},
    {"id": 13, "name": "Anna",   "gender": "female", "hair_color": "white", "hair_style": "long",   "skin": "light",  "eyes": "blue",  "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": True,  "freckles": False},
    {"id": 14, "name": "Leo",    "gender": "male",   "hair_color": "brown", "hair_style": "short",  "skin": "light",  "eyes": "brown", "glasses": False, "facial_hair": "beard",    "hat": True,  "earrings": False, "freckles": False},
    {"id": 15, "name": "Nina",   "gender": "female", "hair_color": "blond", "hair_style": "long",   "skin": "medium", "eyes": "brown", "glasses": False, "facial_hair": "none",     "hat": True,  "earrings": False, "freckles": False},
    {"id": 16, "name": "Kai",    "gender": "male",   "hair_color": "red",   "hair_style": "short",  "skin": "light",  "eyes": "green", "glasses": False, "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 17, "name": "Priya",  "gender": "female", "hair_color": "black", "hair_style": "long",   "skin": "dark",   "eyes": "brown", "glasses": False, "facial_hair": "none",     "hat": False, "earrings": True,  "freckles": False},
    {"id": 18, "name": "Sam",    "gender": "male",   "hair_color": "gray",  "hair_style": "short",  "skin": "medium", "eyes": "blue",  "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 19, "name": "Mia",    "gender": "female", "hair_color": "brown", "hair_style": "curly",  "skin": "light",  "eyes": "brown", "glasses": False, "facial_hair": "none",     "hat": False, "earrings": False, "freckles": True},
    {"id": 20, "name": "Victor", "gender": "male",   "hair_color": "black", "hair_style": "short",  "skin": "light",  "eyes": "brown", "glasses": False, "facial_hair": "beard",    "hat": False, "earrings": False, "freckles": False},
    {"id": 21, "name": "Iris",   "gender": "female", "hair_color": "blond", "hair_style": "short",  "skin": "dark",   "eyes": "brown", "glasses": True,  "facial_hair": "none",     "hat": True,  "earrings": True,  "freckles": False},
    {"id": 22, "name": "Ben",    "gender": "male",   "hair_color": "blond", "hair_style": "bald",   "skin": "light",  "eyes": "blue",  "glasses": False, "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
    {"id": 23, "name": "Fatima", "gender": "female", "hair_color": "black", "hair_style": "long",   "skin": "dark",   "eyes": "green", "glasses": True,  "facial_hair": "none",     "hat": False, "earrings": False, "freckles": False},
]

PRESET_QUESTIONS = [
    {"id": "q_female",    "text": "Is your character female?"},
    {"id": "q_glasses",   "text": "Does your character wear glasses?"},
    {"id": "q_long_hair", "text": "Does your character have long hair?"},
    {"id": "q_short_hair","text": "Does your character have short hair?"},
    {"id": "q_curly",     "text": "Does your character have curly hair?"},
    {"id": "q_bald",      "text": "Is your character bald?"},
    {"id": "q_beard",     "text": "Does your character have a beard?"},
    {"id": "q_mustache",  "text": "Does your character have a mustache?"},
    {"id": "q_blond",     "text": "Does your character have blond hair?"},
    {"id": "q_black",     "text": "Does your character have black hair?"},
    {"id": "q_brown_hair","text": "Does your character have brown hair?"},
    {"id": "q_red_hair",  "text": "Does your character have red hair?"},
    {"id": "q_gray_hair", "text": "Does your character have white or gray hair?"},
    {"id": "q_blue_eyes", "text": "Does your character have blue eyes?"},
    {"id": "q_green_eyes","text": "Does your character have green eyes?"},
    {"id": "q_hat",       "text": "Does your character wear a hat?"},
    {"id": "q_dark_skin", "text": "Does your character have dark skin?"},
    {"id": "q_light_skin","text": "Does your character have light skin?"},
    {"id": "q_freckles",  "text": "Does your character have freckles?"},
    {"id": "q_earrings",  "text": "Does your character wear earrings?"},
]


class GuessWhoLogic:
    def __init__(self):
        self.phase = "waiting"       # "waiting" | "playing" | "finished"
        self.char_A: int | None = None
        self.char_B: int | None = None
        self.turn = "A"              # whose turn to ask or guess
        self.current_question: dict | None = None   # pending question awaiting answer
        self.history: list[dict] = []
        self.winner: str | None = None
        self.winning_char: int | None = None

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        if username in existing_symbols:
            return existing_symbols[username]
        if "A" not in existing_symbols.values():
            return "A"
        if "B" not in existing_symbols.values():
            return "B"
        return None

    def _start_game(self):
        ids = random.sample(range(len(CHARACTERS)), 2)
        self.char_A = ids[0]
        self.char_B = ids[1]
        self.phase = "playing"

    def get_state(self):
        return {
            "phase": self.phase,
            "char_A": self.char_A,
            "char_B": self.char_B,
            "turn": self.turn,
            "current_question": self.current_question,
            "history": self.history,
            "winner": self.winner,
            "winning_char": self.winning_char,
            "preset_questions": PRESET_QUESTIONS,
            "total_characters": len(CHARACTERS),
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        action_type = kwargs.get("action_type")

        # Second player joining triggers game start
        if action_type == "ready":
            if self.phase == "waiting" and symbol in ("A", "B"):
                # Only start when both symbols exist — caller must ensure this
                self._start_game()
                return True
            return False

        if action_type == "ask":
            if self.phase != "playing" or self.turn != symbol or self.current_question:
                return False
            text = kwargs.get("text", "").strip()
            if not text:
                return False
            self.current_question = {"asker": symbol, "text": text, "awaiting_answer": True}
            return True

        if action_type == "answer":
            if self.phase != "playing" or not self.current_question:
                return False
            # Answerer must be the non-asker
            if symbol == self.current_question["asker"]:
                return False
            answer = kwargs.get("answer")
            if not isinstance(answer, bool):
                return False
            q = self.current_question
            self.history.append({"asker": q["asker"], "text": q["text"], "answer": answer})
            self.current_question = None
            # Switch turn to the answerer (they ask next)
            self.turn = "B" if self.turn == "A" else "A"
            return True

        if action_type == "guess":
            if self.phase != "playing" or self.turn != symbol or self.current_question:
                return False
            try:
                char_id = int(kwargs["character_id"])
            except (KeyError, ValueError, TypeError):
                return False
            if char_id < 0 or char_id >= len(CHARACTERS):
                return False
            opponent_char = self.char_B if symbol == "A" else self.char_A
            if char_id == opponent_char:
                self.winner = symbol
                self.winning_char = char_id
            else:
                # Wrong guess — opponent wins
                self.winner = "B" if symbol == "A" else "A"
                self.winning_char = opponent_char
            self.phase = "finished"
            return True

        return False

    def reset(self):
        self.phase = "waiting"
        self.char_A = None
        self.char_B = None
        self.turn = "A"
        self.current_question = None
        self.history = []
        self.winner = None
        self.winning_char = None
