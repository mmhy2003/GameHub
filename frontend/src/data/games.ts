export type GameCategory = "Classic" | "Quick" | "Action" | "Strategy" | "Words" | "Co-op" | "Luck" | "Deduction";
export type Accent = "blue" | "pink" | "yellow" | "green" | "purple" | "orange";

export interface GameInfo {
  key: string;
  title: string;
  description: string;
  cover: string;
  emoji: string;
  category: GameCategory;
  playTime: string;
  accent: Accent;
}

export const GAME_CATEGORIES: ("All" | GameCategory)[] = [
  "All", "Classic", "Quick", "Action", "Strategy", "Words", "Co-op", "Luck", "Deduction",
];

export const GAMES: GameInfo[] = [
  {
    key: "tic-tac-toe", title: "Tic-Tac-Toe", cover: "/games/tic_tac_toe_cover.png", emoji: "⭕",
    category: "Classic", playTime: "2 min", accent: "purple",
    description: "The classic multi-player game of X's and O's. Challenge a friend in real-time.",
  },
  {
    key: "battleships", title: "Battleships", cover: "/games/battleships_cover.png", emoji: "🚢",
    category: "Strategy", playTime: "10 min", accent: "blue",
    description: "Command your fleet and sink enemy vessels in strategic naval warfare.",
  },
  {
    key: "tetris", title: "Tetris", cover: "/games/tetris_cover.png", emoji: "🟦",
    category: "Action", playTime: "5 min", accent: "purple",
    description: "Drop blocks and clear lines to send garbage attacks to opposing players.",
  },
  {
    key: "ping-pong", title: "Ping-Pong", cover: "/games/pong_cover.png", emoji: "🏓",
    category: "Action", playTime: "4 min", accent: "orange",
    description: "Real-time paddle battle. Deflect the ball and outscore your opponent to 7 points.",
  },
  {
    key: "pong-4", title: "4-Player Pong", cover: "/games/pong_cover.png", emoji: "🏓",
    category: "Action", playTime: "5 min", accent: "green",
    description: "Up to 4 friends defend the sides of a square court. Miss and lose a heart, and the last player standing wins!",
  },
  {
    key: "connect-four", title: "Connect Four", cover: "/games/connect_four_cover.png", emoji: "🔴",
    category: "Classic", playTime: "5 min", accent: "blue",
    description: "Drop discs and connect four in a row — horizontally, vertically, or diagonally.",
  },
  {
    key: "rock-paper-scissors", title: "Rock Paper Scissors", cover: "/games/rps_cover.png", emoji: "✊",
    category: "Quick", playTime: "2 min", accent: "pink",
    description: "Pick simultaneously and outsmart your rival. First to 3 round victories wins the match.",
  },
  {
    key: "hangman", title: "Hangman", cover: "/games/hangman_cover.png", emoji: "🎈",
    category: "Words", playTime: "5 min", accent: "yellow",
    description: "One player hides a word, the other guesses letters one at a time. 6 wrong guesses and it's over.",
  },
  {
    key: "number-duel", title: "Number Duel", cover: "/games/number_duel_cover.png", emoji: "🔢",
    category: "Quick", playTime: "3 min", accent: "orange",
    description: "Pick a number 1–100. Closest to the hidden target wins the round. First to 3 wins takes the match.",
  },
  {
    key: "minesweeper", title: "Minesweeper", cover: "/games/minesweeper_cover.png", emoji: "💣",
    category: "Co-op", playTime: "8 min", accent: "green",
    description: "Co-op! Both players share one board and work together to clear all mines. One wrong click ends it for everyone.",
  },
  {
    key: "guess-who", title: "Guess Who", cover: "/games/guess_who_cover.png", emoji: "🎭",
    category: "Deduction", playTime: "8 min", accent: "pink",
    description: "Each player gets a secret character. Take turns asking yes/no questions to deduce who the opponent has — then guess!",
  },
  {
    key: "snakes-ladders", title: "Snakes & Ladders", cover: "/games/snakes_ladders_cover.png", emoji: "🐍",
    category: "Luck", playTime: "10 min", accent: "green",
    description: "Classic race to 100! Roll the dice, climb lucky ladders, and avoid deadly snakes. First to reach square 100 wins!",
  },
  {
    key: "stratego", title: "Stratego Lite", cover: "/games/stratego_cover.png", emoji: "⚔️",
    category: "Strategy", playTime: "15 min", accent: "orange",
    description: "Hidden piece war strategy! Deploy your army in secret, then hunt the enemy flag. Higher rank wins in combat — but beware the Spy and Bombs!",
  },
];
