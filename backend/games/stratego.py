import random
from typing import Optional

ROWS, COLS = 8, 8

# Lakes: impassable 2×2 blocks in the centre
LAKES: set[tuple[int, int]] = {(3,2),(3,3),(4,2),(4,3),(3,5),(3,6),(4,5),(4,6)}

# Rank definitions  (0 = Flag, 11 = Bomb, 1-10 = normal)
RANK_INFO: dict[int, dict] = {
    0:  {"name": "Flag",       "short": "F",   "movable": False, "count": 1},
    11: {"name": "Bomb",       "short": "B",   "movable": False, "count": 3},
    1:  {"name": "Spy",        "short": "Spy", "movable": True,  "count": 1},
    2:  {"name": "Scout",      "short": "Sct", "movable": True,  "count": 2, "scout": True},
    3:  {"name": "Miner",      "short": "Min", "movable": True,  "count": 3},
    4:  {"name": "Sergeant",   "short": "Sgt", "movable": True,  "count": 2},
    5:  {"name": "Lieutenant", "short": "Lt",  "movable": True,  "count": 2},
    6:  {"name": "Captain",    "short": "Cap", "movable": True,  "count": 2},
    7:  {"name": "Major",      "short": "Maj", "movable": True,  "count": 1},
    8:  {"name": "Colonel",    "short": "Col", "movable": True,  "count": 1},
    9:  {"name": "General",    "short": "Gen", "movable": True,  "count": 1},
    10: {"name": "Marshal",    "short": "Mar", "movable": True,  "count": 1},
}

PIECE_COUNTS = {rank: info["count"] for rank, info in RANK_INFO.items()}
TOTAL_PIECES = sum(PIECE_COUNTS.values())  # 20

# A occupies rows 5-7 (bottom), B occupies rows 0-2 (top)
SETUP_ROWS: dict[str, set[int]] = {"A": {5, 6, 7}, "B": {0, 1, 2}}


def _opp(sym: str) -> str:
    return "B" if sym == "A" else "A"


class StrategoLogic:
    def __init__(self):
        self.phase = "setup"      # "setup" | "playing" | "finished"
        self.board: list[list[Optional[dict]]] = [[None]*COLS for _ in range(ROWS)]
        self.turn  = "A"
        self.winner: Optional[str] = None
        self.setup_done: dict[str, bool] = {"A": False, "B": False}
        self.last_combat: Optional[dict] = None

    # ── player join ──────────────────────────────────────────────────────────
    def on_player_join(self, username: str, existing_symbols: dict) -> Optional[str]:
        if username in existing_symbols:
            return existing_symbols[username]
        if "A" not in existing_symbols.values():
            return "A"
        if "B" not in existing_symbols.values():
            return "B"
        return None

    # ── helpers ──────────────────────────────────────────────────────────────
    def _placed_counts(self, sym: str) -> dict[int, int]:
        counts: dict[int, int] = {}
        for row in self.board:
            for cell in row:
                if cell and cell["owner"] == sym:
                    counts[cell["rank"]] = counts.get(cell["rank"], 0) + 1
        return counts

    def _board_for_player(self, sym: str) -> list:
        result = []
        for row in self.board:
            row_out = []
            for cell in row:
                if cell is None:
                    row_out.append(None)
                elif cell["owner"] == sym:
                    row_out.append(dict(cell))
                else:
                    if cell.get("revealed", False):
                        row_out.append(dict(cell))
                    else:
                        row_out.append({"owner": cell["owner"], "rank": -1, "revealed": False})
            result.append(row_out)
        return result

    def _valid_moves(self, r: int, c: int) -> list[tuple[int, int]]:
        cell = self.board[r][c]
        if not cell or not RANK_INFO[cell["rank"]].get("movable", False):
            return []
        is_scout = RANK_INFO[cell["rank"]].get("scout", False)
        owner    = cell["owner"]
        moves    = []
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r+dr, c+dc
            while 0 <= nr < ROWS and 0 <= nc < COLS:
                if (nr, nc) in LAKES:
                    break
                target = self.board[nr][nc]
                if target is None:
                    moves.append((nr, nc))
                    if not is_scout:
                        break
                    nr += dr; nc += dc
                elif target["owner"] == owner:
                    break
                else:
                    moves.append((nr, nc))
                    break
        return moves

    def _combat(self, att_rank: int, def_rank: int) -> str:
        """Return 'attacker', 'defender', or 'both'."""
        if def_rank == 0:                        return "attacker"          # flag captured
        if def_rank == 11:                       # bomb
            return "attacker" if att_rank == 3 else "defender"
        if att_rank == 1 and def_rank == 10:     return "attacker"  # spy vs marshal
        if att_rank == def_rank:                 return "both"
        return "attacker" if att_rank > def_rank else "defender"

    def _has_moves(self, sym: str) -> bool:
        return any(
            self.board[r][c] and self.board[r][c]["owner"] == sym
            and bool(self._valid_moves(r, c))
            for r in range(ROWS) for c in range(COLS)
        )

    # ── state ─────────────────────────────────────────────────────────────────
    def get_state_for_player(self, sym: str) -> dict:
        if sym not in ("A", "B"):
            sym = "A"
        placed    = self._placed_counts(sym)
        remaining = {rank: PIECE_COUNTS[rank] - placed.get(rank, 0)
                     for rank in PIECE_COUNTS}
        return {
            "phase":       self.phase,
            "board":       self._board_for_player(sym),
            "turn":        self.turn,
            "winner":      self.winner,
            "setup_done":  self.setup_done,
            "remaining":   {str(k): v for k, v in remaining.items()},
            "last_combat": self.last_combat,
            "rank_info":   {str(k): v for k, v in RANK_INFO.items()},
            "lakes":       [list(lk) for lk in LAKES],
            "my_symbol":   sym,
            "total_pieces": TOTAL_PIECES,
            "placed_count": sum(placed.values()),
        }

    def get_state(self) -> dict:
        return self.get_state_for_player("A")

    # ── moves ─────────────────────────────────────────────────────────────────
    def make_move(self, symbol: str, **kwargs) -> bool:
        action = kwargs.get("action_type")

        # ── place piece (setup) ───────────────────────────────────────────────
        if action == "place":
            if self.phase != "setup" or self.setup_done.get(symbol):
                return False
            try:
                rank = int(kwargs["rank"])
                row  = int(kwargs["row"])
                col  = int(kwargs["col"])
            except (KeyError, ValueError):
                return False
            if rank not in RANK_INFO: return False
            if row not in SETUP_ROWS[symbol] or not (0 <= col < COLS): return False
            if (row, col) in LAKES: return False
            placed = self._placed_counts(symbol)
            if placed.get(rank, 0) >= PIECE_COUNTS[rank]: return False
            existing = self.board[row][col]
            if existing and existing["owner"] != symbol: return False
            self.board[row][col] = {"owner": symbol, "rank": rank, "revealed": False}
            return True

        # ── remove piece (setup) ──────────────────────────────────────────────
        if action == "remove":
            if self.phase != "setup" or self.setup_done.get(symbol):
                return False
            try:
                row = int(kwargs["row"]); col = int(kwargs["col"])
            except (KeyError, ValueError):
                return False
            cell = self.board[row][col]
            if not cell or cell["owner"] != symbol: return False
            self.board[row][col] = None
            return True

        # ── auto-fill remaining (setup) ───────────────────────────────────────
        if action == "auto_fill":
            if self.phase != "setup" or self.setup_done.get(symbol):
                return False
            placed = self._placed_counts(symbol)
            remaining_ranks: list[int] = []
            for rank, total in PIECE_COUNTS.items():
                remaining_ranks.extend([rank] * (total - placed.get(rank, 0)))
            random.shuffle(remaining_ranks)
            empty_cells = [
                (r, c) for r in SETUP_ROWS[symbol] for c in range(COLS)
                if (r, c) not in LAKES and self.board[r][c] is None
            ]
            random.shuffle(empty_cells)
            for (r, c), rank in zip(empty_cells, remaining_ranks):
                self.board[r][c] = {"owner": symbol, "rank": rank, "revealed": False}
            return True

        # ── commit setup ──────────────────────────────────────────────────────
        if action == "ready":
            if self.phase != "setup" or self.setup_done.get(symbol):
                return False
            placed = self._placed_counts(symbol)
            if sum(placed.values()) < TOTAL_PIECES:
                return False
            self.setup_done[symbol] = True
            if self.setup_done["A"] and self.setup_done["B"]:
                self.phase = "playing"
                self.turn  = "A"
            return True

        # ── move / attack (playing) ───────────────────────────────────────────
        if action == "move":
            if self.phase != "playing" or self.turn != symbol:
                return False
            try:
                fr = int(kwargs["from_row"]); fc = int(kwargs["from_col"])
                tr = int(kwargs["to_row"]);   tc = int(kwargs["to_col"])
            except (KeyError, ValueError):
                return False
            if not (0 <= fr < ROWS and 0 <= fc < COLS and
                    0 <= tr < ROWS and 0 <= tc < COLS):
                return False
            piece = self.board[fr][fc]
            if not piece or piece["owner"] != symbol: return False
            if not RANK_INFO[piece["rank"]].get("movable", False): return False
            if (tr, tc) not in self._valid_moves(fr, fc): return False

            target = self.board[tr][tc]
            self.last_combat = None

            if target is None:
                # Simple move
                self.board[tr][tc] = piece
                self.board[fr][fc] = None
            else:
                # Attack
                opp_sym = _opp(symbol)
                result  = self._combat(piece["rank"], target["rank"])
                piece["revealed"]  = True
                target["revealed"] = True
                self.last_combat = {
                    "attacker_sym":  symbol,
                    "attacker_rank": piece["rank"],
                    "defender_rank": target["rank"],
                    "result": result,
                    "from": [fr, fc], "to": [tr, tc],
                }
                if target["rank"] == 0:       # Flag captured → win
                    self.winner = symbol
                    self.phase  = "finished"
                    self.board[fr][fc] = None
                    self.board[tr][tc] = None
                    return True

                if result == "attacker":
                    self.board[tr][tc] = piece
                    self.board[fr][fc] = None
                elif result == "defender":
                    self.board[fr][fc] = None
                else:  # both
                    self.board[fr][fc] = None
                    self.board[tr][tc] = None

                # Check if opponent is immobilised
                if not self._has_moves(_opp(symbol)):
                    self.winner = symbol
                    self.phase  = "finished"
                    return True

            self.turn = _opp(symbol)
            return True

        return False

    def reset(self):
        self.__init__()
