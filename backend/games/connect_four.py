COLS = 7
ROWS = 6

class ConnectFourLogic:
    def __init__(self):
        # board[row][col]: None | "R" | "Y". Row 0 = top
        self.board = [[None] * COLS for _ in range(ROWS)]
        self.current_turn = "R"
        self.winner = None
        self.is_draw = False

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        if username in existing_symbols:
            return existing_symbols[username]
        if "R" not in existing_symbols.values():
            return "R"
        if "Y" not in existing_symbols.values():
            return "Y"
        return None

    def get_state(self):
        return {
            "board": self.board,
            "current_turn": self.current_turn,
            "winner": self.winner,
            "is_draw": self.is_draw,
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        if symbol not in ["R", "Y"] or self.winner or self.is_draw:
            return False
        if symbol != self.current_turn:
            return False

        col = kwargs.get("col")
        if col is None or col < 0 or col >= COLS:
            return False

        # Find lowest empty row in the column
        row = None
        for r in range(ROWS - 1, -1, -1):
            if self.board[r][col] is None:
                row = r
                break
        if row is None:
            return False  # Column full

        self.board[row][col] = symbol
        self._check_winner(row, col, symbol)

        if not self.winner:
            # Check draw
            if all(self.board[0][c] is not None for c in range(COLS)):
                self.is_draw = True
            else:
                self.current_turn = "Y" if symbol == "R" else "R"
        return True

    def _check_winner(self, row: int, col: int, symbol: str):
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for dr, dc in directions:
            count = 1
            for sign in (1, -1):
                r, c = row + dr * sign, col + dc * sign
                while 0 <= r < ROWS and 0 <= c < COLS and self.board[r][c] == symbol:
                    count += 1
                    r += dr * sign
                    c += dc * sign
            if count >= 4:
                self.winner = symbol
                return

    def reset(self):
        self.board = [[None] * COLS for _ in range(ROWS)]
        self.current_turn = "R"
        self.winner = None
        self.is_draw = False
