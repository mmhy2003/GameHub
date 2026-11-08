# GH-58: Remember the player name across visits

## Goal
A player who has entered a name before goes straight to the game list on their next visit, even in a new tab or after restarting the browser. A `?name=` URL param still takes priority and replaces the saved name.

## What already exists (checked at `3d55294`)
- The lobby already saves the name to `localStorage.gamehub_username` (`frontend/src/app/page.tsx:62, 93`).
- The lobby only uses the saved name when a session token is also in `sessionStorage.gamehub_token` (`page.tsx:73-78`). `sessionStorage` is cleared when the tab closes, so returning players see the name form again. **This is the bug.**
- `?name=` already wins and replaces the saved name, in the lobby (`page.tsx:60-72`) and on the room page (`room/[id]/page.tsx:67-74`). It stays as it is.

## Decisions
- **When a name is saved but there is no token, skip the form and fetch a token in the background.** This was the human's choice over showing the form with the name filled in. It reuses the pattern `?name=` already uses.
- The token stays in `sessionStorage`. Tokens expire after 24 h, and keeping the name alone is enough.
- The "Playing as <name> ✏️" button keeps working as it does now. It clears the saved name and shows the form.

## Architecture
The only file that changes is `frontend/src/app/page.tsx`, in the mount `useEffect`, in the branch where there is no `paramName`:
1. `savedName` = `localStorage.gamehub_username`. If it is empty, show the form (as now).
2. If it is set, call `setUsername(savedName)` and `setIsNameSet(true)`. If a token is already stored, stop there (as now).
3. If there is no token, call `fetchToken(savedName)`:
   - **Success:** store the token in `sessionStorage`, then call `returnToInvite()`. A player sent here from an invite link (`/?room=…&game=…`) then goes straight back to the room.
   - **Failure:** call `setIsNameSet(false)`, keep `username` = `savedName` so the form shows it filled in, and set `tokenError` ("Couldn't reach the server. Please try again."). The player can try again with one click.

There are no backend changes, no new storage keys and no UI changes.

## Edge cases
- **A click before the token arrives:** the room page finds no token and redirects to `/?room=…&game=…`. The lobby then fetches a token and calls `returnToInvite()`, so the player ends up in the room. Embed mode recovers the same way today.
- **The token expires (`UNAUTHORIZED`):** the room page clears the token and goes to `/`. The lobby now gets a new token quietly instead of asking for the name.
- **localStorage is blocked or the saved name is empty:** the form shows, as now.
- **`?name=` is present:** unchanged. It wins and replaces the saved name.

## Testing
There are no automated tests in the repo. The checks are `npm run lint` and `npm run build` in `frontend/`, plus these manual runs against a local backend:
1. Enter a name, close the tab, open `/` again → the game list shows with the saved name, and a game can be joined.
2. Open an invite link `/room/<id>?game=…` in a new tab with a saved name → you land in the room with no form.
3. Stop the backend, open `/` with a saved name → the form shows with the name filled in and the error message.
4. Open `/?name=Other` → "Playing as Other", and the saved name becomes Other.
5. Click "Playing as … ✏️" → the form shows empty, and the saved name is gone.

## Out of scope
- Keeping the token beyond the session (`localStorage`).
- Changes to how `?name=` behaves, or to the room page.
