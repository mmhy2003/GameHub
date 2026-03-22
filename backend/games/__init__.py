from .tic_tac_toe import TicTacToeLogic
from .battleships import BattleshipsLogic
from .tetris import TetrisLogic
from .ping_pong import PingPongLogic
from .connect_four import ConnectFourLogic
from .rock_paper_scissors import RockPaperScissorsLogic
from .hangman import HangmanLogic
from .number_duel import NumberDuelLogic
from .minesweeper import MinesweeperLogic
from .guess_who import GuessWhoLogic
from .snakes_ladders import SnakesLaddersLogic
from .stratego import StrategoLogic

def get_game_logic(game_type: str):
    if game_type == "tic-tac-toe":
        return TicTacToeLogic()
    elif game_type == "battleships":
        return BattleshipsLogic()
    elif game_type == "tetris":
        return TetrisLogic()
    elif game_type == "ping-pong":
        return PingPongLogic()
    elif game_type == "connect-four":
        return ConnectFourLogic()
    elif game_type == "rock-paper-scissors":
        return RockPaperScissorsLogic()
    elif game_type == "hangman":
        return HangmanLogic()
    elif game_type == "number-duel":
        return NumberDuelLogic()
    elif game_type == "minesweeper":
        return MinesweeperLogic()
    elif game_type == "guess-who":
        return GuessWhoLogic()
    elif game_type == "snakes-ladders":
        return SnakesLaddersLogic()
    elif game_type == "stratego":
        return StrategoLogic()
    return None
