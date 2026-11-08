# GH-61: Show allowed player count on game cards

## Goal
Each lobby game card shows how many players can play the game, so people can pick a game that fits their group.

## Decisions
- **Placement: a chip in the tag row** (option A, chosen by the human). It sits after the category and ⏱ play-time chips. A badge on the cover (option B) was rejected.
- **Text:** `👥 2 players` for a fixed count, and `👥 2–4 players` for a range (with an en dash).
- **Colour:** fixed-count games use a light-green chip. Range games (up to 4) use a `candy-yellow` chip so they stand out.
- **Counts come from the backend's seats:** 4-Player Pong (`pong-4`) and Tank Battle (`tank-battle`) are 2–4 (`SEATS` in `backend/games/pong_four.py` and `backend/games/tank_battle.py`, at least 2 ready players to start). The other 12 games are 2 players.
- The counts are static data in the frontend. There is no new API: the lobby is already built from the static `GAMES` list.

## Architecture
- `frontend/src/data/games.ts`
  - Add `minPlayers: number` and `maxPlayers: number` to `GameInfo`.
  - Fill them in for all 14 entries.
- `frontend/src/components/GameCard.tsx`
  - Render a third `chunk-sm` chip in the existing tag row.
  - The label is built from the two fields: when `min === max` it shows "N players", otherwise "min–max players".
  - Add an `aria-label` such as "2 to 4 players" for screen readers.

## Edge cases
- If `minPlayers === maxPlayers === 1` the chip shows "1 player" (singular). This is for future-proofing only; it is a one-line ternary.
- On narrow cards the tag row already uses `flex-wrap`, so the chip wraps to the next line.

## Testing
- `npm run lint` and `npm run build` in `frontend`.
- Manual check of the lobby on desktop and at 375px: every card shows the chip, Pong-4 and Tank Battle show a yellow "2–4 players" chip, and the filters still work.

## Out of scope
- Filtering or sorting by player count.
- Showing the count inside the room or game pages.
- Backend changes.

Matches mockup v2.