# GH-61 Plan: Show allowed player count on game cards

## Goal
Every lobby game card shows a `👥 N players` / `👥 min–max players` chip in its tag row.

## Architecture
The player counts are static data on each `GameInfo` entry in `frontend/src/data/games.ts`: two new required fields, `minPlayers` and `maxPlayers`. `GameCard` adds a third `chunk-sm` chip after the category and ⏱ chips. The chip's label and aria-label come from those two fields. Range games get `bg-candy-yellow`, and fixed-count games get light green `bg-candy-green/25`. The backend is not changed and there is no new API.

## File map
- **Modify** `frontend/src/data/games.ts`: add `minPlayers: number; maxPlayers: number;` to `GameInfo`, and fill them in for all 14 entries.
- **Modify** `frontend/src/components/GameCard.tsx`: add the player-count chip with its label, aria-label and colour.

Testing note: the repo has no unit-test framework, and the design does not add one. A TypeScript build error is the failing check, then `npm run lint` and `npm run build` pass, then a manual lobby check.

## Steps

### 1. Add minPlayers/maxPlayers to GameInfo and every game entry
- **File:** `frontend/src/data/games.ts`
- **Failing check first:** add these two lines to `interface GameInfo`, after `accent: Accent;`:
  ```ts
  minPlayers: number;
  maxPlayers: number;
  ```
  Run `cd frontend; npx tsc --noEmit`. It is expected to fail: every entry in `GAMES` is missing `minPlayers`.
- **Implementation:** on each entry's second line (the `category: …, playTime: …, accent: …,` line), append `minPlayers: X, maxPlayers: Y,`. Use these values:
  - `pong-4`: 2, 4 (backend `backend/games/pong_four.py` `SEATS = ("B","T","L","R")`, at least 2 ready players)
  - `tank-battle`: 2, 4 (backend `backend/games/tank_battle.py` `SEATS = ("TL","TR","BL","BR")`)
  - all 12 others, each 2, 2: `tic-tac-toe`, `battleships`, `tetris`, `ping-pong`, `connect-four`, `rock-paper-scissors`, `hangman`, `number-duel`, `minesweeper`, `guess-who`, `snakes-ladders`, `stratego`

  Example:
  ```ts
  category: "Action", playTime: "5 min", accent: "green", minPlayers: 2, maxPlayers: 4,
  ```
- **Pass:** `cd frontend; npx tsc --noEmit` passes with no errors. `npm run lint` and `npm run build` pass. The UI does not change yet.
- **Commit:** `feat(ui): add player counts to game data (GH-61)`

### 2. Render the player-count chip in GameCard
- **File:** `frontend/src/components/GameCard.tsx`
- **Failing check first:** in the tag row, add `<span>{playersLabel}</span>` before you define it. Run `cd frontend; npx tsc --noEmit`. It is expected to fail with "Cannot find name 'playersLabel'".
- **Implementation:** inside `GameCard`, before `return`:
  ```tsx
  const { minPlayers, maxPlayers } = game;
  const isRange = minPlayers !== maxPlayers;
  const playersLabel = isRange
    ? `${minPlayers}–${maxPlayers} players`
    : `${minPlayers} ${minPlayers === 1 ? "player" : "players"}`;
  const playersAria = isRange ? `${minPlayers} to ${maxPlayers} players` : playersLabel;
  ```
  The range uses an en dash (U+2013 `–`), not a hyphen.

  Replace the placeholder span with the third chip, after the ⏱ chip in the existing `flex flex-wrap gap-2` row:
  ```tsx
  <span
    aria-label={playersAria}
    className={`chunk-sm px-2 py-0.5 ${isRange ? "bg-candy-yellow" : "bg-candy-green/25"}`}
  >
    <span aria-hidden>👥 </span>{playersLabel}
  </span>
  ```
  Use static class strings so Tailwind picks them up, as `ACCENT_BG` does.
- **Pass:** `cd frontend; npx tsc --noEmit`, `npm run lint` and `npm run build` all pass.
- **Manual check:** run `npm run dev` and open `/`.
  - On desktop and at 375px, all 14 cards show the chip after the category and ⏱ chips.
  - 4-Player Pong and Tank Battle show a yellow `👥 2–4 players` chip.
  - The other 12 cards show a light-green `👥 2 players` chip.
  - On narrow cards, the chip wraps to the next line instead of overflowing.
  - The category filter chips still filter the cards.
- **Commit:** `feat(ui): show player count chip on game cards (GH-61)`

## Final verification
- `cd frontend; npx tsc --noEmit; npm run lint; npm run build`: all pass.
- Manual lobby check as in step 2, on desktop and at 375px.
- `git diff main --stat` shows only `frontend/src/data/games.ts` and `frontend/src/components/GameCard.tsx`.
