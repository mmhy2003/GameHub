// Central game rules for the help popup
export interface GameRule {
  title: string;
  icon: string;
  objective: string;
  rules: string[];
  tips?: string[];
}

export const GAME_RULES: Record<string, GameRule> = {
  "tetris": {
    title: "Tetris",
    icon: "🟦",
    objective: "Clear as many lines as possible before the stack reaches the top.",
    rules: [
      "Tetrominoes (7 shapes: I, O, T, S, Z, J, L) fall from the top of the board.",
      "Move pieces left/right and rotate them to fit them together.",
      "When a horizontal line is completely filled, it clears and you score points.",
      "Clearing multiple lines at once scores more: 2 lines = double, 3 = triple, 4 (Tetris) = max bonus.",
      "Pieces fall faster as your level increases.",
      "The game ends when a new piece cannot enter the board — the stack has reached the top.",
    ],
    tips: [
      "Keep your stack flat and low — avoid creating gaps you can't fill.",
      "Save the I-piece (long bar) for a 4-line Tetris clear for maximum score.",
      "Use the ghost piece shadow to see exactly where a piece will land.",
    ],
  },

  "tic-tac-toe": {
    title: "Tic-Tac-Toe",
    icon: "⭕",
    objective: "Get 3 of your marks in a row — horizontally, vertically, or diagonally.",
    rules: [
      "Players take turns placing their mark (X or O) on a 3×3 grid.",
      "The first player to align 3 marks wins.",
      "If all 9 squares are filled with no winner, the game is a draw.",
    ],
    tips: ["Control the centre square — it's part of the most possible winning lines."],
  },

  "connect-four": {
    title: "Connect Four",
    icon: "🔴",
    objective: "Connect 4 of your discs in a row before your opponent does.",
    rules: [
      "Players alternate dropping a disc into any of the 7 columns.",
      "Discs fall to the lowest empty row in the chosen column.",
      "First to connect 4 discs horizontally, vertically, or diagonally wins.",
      "If the board fills up with no winner, the game is a draw.",
    ],
    tips: ["Block your opponent's three-in-a-row before completing your own."],
  },

  "battleships": {
    title: "Battleships",
    icon: "🚢",
    objective: "Sink all of your opponent's ships before they sink yours.",
    rules: [
      "Each player secretly places their fleet on their grid.",
      "Ships: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).",
      "Take turns calling out grid coordinates to fire a shot.",
      "A 'Hit 🔥' means your shot landed on a ship. A 'Miss 💧' means open water.",
      "A ship is sunk when all its squares are hit.",
      "The player who sinks the entire enemy fleet wins.",
    ],
    tips: ["After a hit, fire around it to find the rest of the ship."],
  },

  "hangman": {
    title: "Hangman",
    icon: "🔤",
    objective: "Guess the secret word before the hangman is complete.",
    rules: [
      "One player sets a secret word; the other must guess it letter by letter.",
      "Each incorrect guess adds a part to the hangman drawing.",
      "You have 6 wrong guesses before the hangman is complete and you lose.",
      "Guess the full word at any time — correct wins instantly, wrong costs a life.",
      "Roles swap after each round.",
    ],
    tips: ["Start with common letters: E, T, A, O, I, N."],
  },

  "rock-paper-scissors": {
    title: "Rock Paper Scissors",
    icon: "✊",
    objective: "Win the most rounds in the best-of series.",
    rules: [
      "Both players simultaneously choose Rock, Paper, or Scissors.",
      "Rock beats Scissors. Scissors beats Paper. Paper beats Rock.",
      "Ties are replayed. Best of 5 rounds wins the match.",
    ],
  },

  "number-duel": {
    title: "Number Duel",
    icon: "🔢",
    objective: "Pick the number closest to the hidden target to win each round.",
    rules: [
      "Each round, both players secretly pick a number in the given range.",
      "The player whose number is closest to the hidden target wins the round.",
      "In case of a tie (equal distance), the round is drawn.",
      "Win the most rounds to win the match.",
    ],
    tips: ["Think about what your opponent might pick and adjust accordingly."],
  },

  "ping-pong": {
    title: "Ping Pong",
    icon: "🏓",
    objective: "Hit the ball past your opponent's paddle to score points.",
    rules: [
      "Control your paddle by moving your mouse or finger vertically.",
      "The ball speeds up with each hit.",
      "First player to reach the target score wins.",
    ],
    tips: ["Aim for the edges — angles are harder to return."],
  },

  "pong-4": {
    title: "4-Player Pong",
    icon: "🏓",
    objective: "Keep the ball out of your goal and be the last player with hearts left.",
    rules: [
      "2 to 4 players each defend one side of a square court. Empty sides are walls.",
      "Everyone presses Ready. The match starts when all seated players are ready, or when a ready player presses Start (at least 2 ready).",
      "Bottom and top players move left/right (A/D or ←/→). Left and right players move up/down (W/S or ↑/↓).",
      "When the ball goes past your paddle you lose a heart. Everyone starts with 3.",
      "With no hearts left you are out and your side becomes a wall.",
      "The last player with hearts wins.",
    ],
    tips: ["Hit the ball with the end of your paddle to send it off at a sharp angle."],
  },

  "minesweeper": {
    title: "Co-op Minesweeper",
    icon: "💣",
    objective: "Reveal all safe cells together without hitting a mine.",
    rules: [
      "Both players share the same board and work cooperatively.",
      "Left-click / tap to reveal a cell. Right-click / long-press to flag a suspected mine.",
      "Numbers show how many mines are adjacent to that cell.",
      "Revealing a mine ends the game — game over for both players!",
      "Reveal all non-mine cells to win.",
    ],
    tips: ["Use numbers to deduce safe cells before clicking unknown ones."],
  },

  "guess-who": {
    title: "Guess Who",
    icon: "🎭",
    objective: "Identify your opponent's secret character before they identify yours.",
    rules: [
      "Each player is secretly assigned a character from the roster.",
      "On your turn, ask a yes/no question about your opponent's character.",
      "Your opponent answers honestly, then asks you a question.",
      "Use the answers to eliminate characters from the board.",
      "When you're confident, make a guess — correct wins, wrong loses immediately.",
    ],
    tips: ["Ask about multiple attributes at once if rules allow free questions."],
  },

  "snakes-ladders": {
    title: "Snakes & Ladders",
    icon: "🐍",
    objective: "Race from square 1 to square 100 before your opponent.",
    rules: [
      "Players take turns rolling the dice and moving their token.",
      "Land on a ladder bottom 🪜 → climb to its top.",
      "Land on a snake head 🐍 → slide down to its tail.",
      "Roll past 100 → bounce back by the excess.",
      "First to land exactly on 100 wins.",
      "Each turn you may play one Power Card from your hand before rolling.",
    ],
    tips: [
      "🛡️ Shield: blocks the next snake. Play it before rolling into danger.",
      "💣 Sabotage: wastes opponent's next turn — great when they're close to 100.",
      "✨ Lucky Leap: bonus 6-15 squares without rolling — use when far behind.",
      "🔄 Swap: switch positions with your opponent when you're trailing.",
    ],
  },

  "stratego": {
    title: "Stratego Lite",
    icon: "⚔️",
    objective: "Capture the enemy Flag or immobilise all enemy movable pieces.",
    rules: [
      "Setup: secretly place all 20 pieces in your 3-row zone before the game starts.",
      "Pieces move 1 square orthogonally per turn (except Scout).",
      "Scout can move any number of squares in a straight line.",
      "Bombs 💣 and the Flag 🚩 cannot move.",
      "Attack by moving onto an enemy piece — higher rank wins. Ties eliminate both.",
      "💣 Bomb kills everything EXCEPT the Miner (rank 3).",
      "🕵️ Spy (rank 1) beats the Marshal (rank 10) only when Spy initiates the attack.",
      "Capture the enemy Flag 🚩 to win.",
    ],
    tips: [
      "Hide your Flag behind Bombs in a corner.",
      "Keep a Miner mobile to hunt enemy Bombs.",
      "Use Scouts early to probe and reveal opponent pieces.",
    ],
  },
};
