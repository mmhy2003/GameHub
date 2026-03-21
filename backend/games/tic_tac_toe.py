class TicTacToeLogic:
    def __init__(self):
        self.board = [None] * 9
        self.current_turn = "X"
        self.winner = None
        self.is_draw = False

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        """Return the symbol to assign to this player, or None for spectators."""
        if username in existing_symbols:
            return existing_symbols[username]
        if "X" not in existing_symbols.values():
            return "X"
        if "O" not in existing_symbols.values():
            return "O"
        return None  # spectator

    def get_state(self):
        return {
            "board": self.board,
            "current_turn": self.current_turn,
            "winner": self.winner,
            "is_draw": self.is_draw,
        }

    def make_move(self, symbol: str, index: int) -> bool:
        if self.winner or self.is_draw:
            return False

        if index < 0 or index > 8 or self.board[index] is not None:
            return False

        if symbol != self.current_turn:
            return False

        self.board[index] = symbol
        self.check_winner()

        if not self.winner and not self.is_draw:
            self.current_turn = "O" if self.current_turn == "X" else "X"
        return True

    def check_winner(self):
        win_conditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], # rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], # cols
            [0, 4, 8], [2, 4, 6]             # diagonals
        ]
        for condition in win_conditions:
            a, b, c = condition
            if self.board[a] and self.board[a] == self.board[b] == self.board[c]:
                self.winner = self.board[a]
                return
        
        if all(cell is not None for cell in self.board):
            self.is_draw = True

    def reset(self):
        self.board = [None] * 9
        self.current_turn = "X"
        self.winner = None
        self.is_draw = False
