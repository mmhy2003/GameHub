from .tic_tac_toe import TicTacToeLogic
from .battleships import BattleshipsLogic
from .tetris import TetrisLogic
from .ping_pong import PingPongLogic

def get_game_logic(game_type: str):
    if game_type == "tic-tac-toe":
        return TicTacToeLogic()
    elif game_type == "battleships":
        return BattleshipsLogic()
    elif game_type == "tetris":
        return TetrisLogic()
    elif game_type == "ping-pong":
        return PingPongLogic()
    return None
