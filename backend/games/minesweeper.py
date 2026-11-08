import random

ROWS = 14
COLS = 14
MINES = 30


class MinesweeperLogic:
    def __init__(self):
        self.phase = "waiting"   # "waiting" | "playing" | "won" | "lost"
        self.board: list[list[int]] | None = None
        self.revealed = [[False] * COLS for _ in range(ROWS)]
        self.flagged = [[False] * COLS for _ in range(ROWS)]
        self.revealed_by: list[list[str | None]] = [[None] * COLS for _ in range(ROWS)]
        self.mine_positions: set[tuple[int, int]] = set()
        self.cells_to_reveal = ROWS * COLS - MINES
        self.revealed_count = 0
        self.first_click = True  # ensure first click is never a mine

    def on_player_join(self, username: str, existing_symbols: dict) -> str | None:
        if username in existing_symbols:
            return existing_symbols[username]
        if "A" not in existing_symbols.values():
            return "A"
        if "B" not in existing_symbols.values():
            return "B"
        return None

    def _generate_board(self, safe_row: int, safe_col: int):
        """Generate mine layout guaranteeing safe_row/col and its neighbours are mine-free."""
        safe_cells = {
            (safe_row + dr, safe_col + dc)
            for dr in range(-1, 2)
            for dc in range(-1, 2)
            if 0 <= safe_row + dr < ROWS and 0 <= safe_col + dc < COLS
        }
        candidates = [
            (r, c)
            for r in range(ROWS)
            for c in range(COLS)
            if (r, c) not in safe_cells
        ]
        self.mine_positions = set(map(tuple, random.sample(candidates, min(MINES, len(candidates)))))

        self.board = []
        for r in range(ROWS):
            row = []
            for c in range(COLS):
                if (r, c) in self.mine_positions:
                    row.append(-1)
                else:
                    count = sum(
                        1
                        for dr in range(-1, 2)
                        for dc in range(-1, 2)
                        if (r + dr, c + dc) in self.mine_positions
                    )
                    row.append(count)
            self.board.append(row)

    def _flood_reveal(self, row: int, col: int, symbol: str):
        if not (0 <= row < ROWS and 0 <= col < COLS):
            return
        if self.revealed[row][col] or self.flagged[row][col]:
            return
        self.revealed[row][col] = True
        self.revealed_by[row][col] = symbol
        self.revealed_count += 1
        if self.board[row][col] == 0:
            for dr in range(-1, 2):
                for dc in range(-1, 2):
                    if dr != 0 or dc != 0:
                        self._flood_reveal(row + dr, col + dc, symbol)

    def get_state(self):
        visible = []
        for r in range(ROWS):
            row = []
            for c in range(COLS):
                if self.revealed[r][c]:
                    if (r, c) in self.mine_positions:
                        row.append("X")   # triggered mine
                    elif self.board:
                        row.append(str(self.board[r][c]))
                    else:
                        row.append("?")
                elif self.flagged[r][c]:
                    row.append("F")
                elif self.phase == "lost" and self.board and (r, c) in self.mine_positions:
                    row.append("M")   # reveal all mines on loss
                else:
                    row.append("?")
            visible.append(row)

        flags_placed = sum(
            1 for r in range(ROWS) for c in range(COLS) if self.flagged[r][c]
        )
        return {
            "phase": self.phase,
            "board": visible,
            "rows": ROWS,
            "cols": COLS,
            "mines": MINES,
            "revealed_count": self.revealed_count,
            "cells_to_reveal": self.cells_to_reveal,
            "flags_placed": flags_placed,
            "mines_remaining": MINES - flags_placed,
            "revealed_by": [row[:] for row in self.revealed_by],
        }

    def make_move(self, symbol: str, **kwargs) -> bool:
        action_type = kwargs.get("action_type")

        if action_type == "reveal":
            if self.phase not in ("waiting", "playing"):
                return False
            try:
                row, col = int(kwargs["row"]), int(kwargs["col"])
            except (KeyError, ValueError, TypeError):
                return False
            if not (0 <= row < ROWS and 0 <= col < COLS):
                return False
            if self.revealed[row][col] or self.flagged[row][col]:
                return False

            if self.first_click:
                self.first_click = False
                self.phase = "playing"
                self._generate_board(row, col)

            if (row, col) in self.mine_positions:
                self.revealed[row][col] = True
                self.revealed_by[row][col] = symbol
                self.phase = "lost"
                return True

            self._flood_reveal(row, col, symbol)
            if self.revealed_count >= self.cells_to_reveal:
                self.phase = "won"
            return True

        if action_type == "flag":
            if self.phase != "playing":
                return False
            try:
                row, col = int(kwargs["row"]), int(kwargs["col"])
            except (KeyError, ValueError, TypeError):
                return False
            if not (0 <= row < ROWS and 0 <= col < COLS):
                return False
            if self.revealed[row][col]:
                return False
            self.flagged[row][col] = not self.flagged[row][col]
            return True

        return False

    def reset(self):
        self.phase = "waiting"
        self.board = None
        self.revealed = [[False] * COLS for _ in range(ROWS)]
        self.flagged = [[False] * COLS for _ in range(ROWS)]
        self.revealed_by: list[list[str | None]] = [[None] * COLS for _ in range(ROWS)]
        self.mine_positions = set()
        self.revealed_count = 0
        self.first_click = True
