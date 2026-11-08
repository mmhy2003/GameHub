# GH-58 implementation plan: Remember the player name across visits

## Goal
A returning player with a saved name skips the name form and gets a fresh session token in the background, while `?name=` still takes priority.

## Architecture
The only change is in the mount `useEffect` of `frontend/src/app/page.tsx`, in the branch that runs when there is no `paramName`. When `localStorage.gamehub_username` is set and `sessionStorage.gamehub_token` is missing, the lobby shows the game list right away and calls the existing `fetchToken(savedName)`. On success it stores the token and calls `returnToInvite()`. On failure it goes back to the form, with the name filled in and `tokenError` set. Nothing changes in the backend, the storage keys or the room page.

## Facts about the repo (checked at `3d55294`)
- `frontend/src/app/page.tsx`:
  - `fetchToken(name): Promise<string | null>` is at lines 43-56. `returnToInvite()` is at lines 37-39 and does nothing unless both `?room=` and a valid `?game=` are present.
  - The mount effect is at lines 58-79. The `paramName` branch (60-72) stays as it is.
  - Lines 73-78 are the bug: the saved name is only used when `savedToken` is also set.
  - `const [tokenError, setTokenError] = useState("");` is declared at line 81, **after** the effect. Move it above the effect so the effect can use `setTokenError` without a use-before-declaration.
  - The error text the form already uses is `"Couldn't reach the server. Please try again."` (line 90).
  - `changeName()` (99-103) clears the saved name and stays as it is.
- There are no automated tests. The checks are `npm run lint` and `npm run build` in `frontend/`. `frontend/node_modules` is not installed, so run `npm ci` first.
- To run it locally:
  - Backend: `cd backend; pip install -r requirements.txt; uvicorn main:app --port 8000`
  - Frontend: `cd frontend; NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev`

## File map
| File | Change | Responsibility |
|---|---|---|
| `frontend/src/app/page.tsx` | Modify | Move the `tokenError` state above the mount effect. Replace the saved-name branch with the "skip the form and fetch a token in the background" logic. |

## Steps

### 1. Lobby: use the saved name without a token and fetch one in the background
**Files:** `frontend/src/app/page.tsx` only.

**Test first (manual, since the repo has no test framework).** With the current code, run the backend and frontend locally. Enter a name, close the tab, then open `http://localhost:3000/` in a new tab. **Expected failure:** the "What should we call you?" form shows again.

**Implementation**

1. Move `const [tokenError, setTokenError] = useState("");` from line 81 to just after `const [filter, setFilter] = ...` (line 22). Delete the old line. The value and every use stay the same.
2. In the mount effect, replace lines 73-78:
```tsx
    const savedName = localStorage.getItem("gamehub_username");
    const savedToken = sessionStorage.getItem("gamehub_token");
    if (savedName && savedToken) {
      setUsername(savedName);
      setIsNameSet(true);
    }
```
with:
```tsx
    const savedName = localStorage.getItem("gamehub_username");
    if (!savedName) return;
    setUsername(savedName);
    setIsNameSet(true);
    if (sessionStorage.getItem("gamehub_token")) return;
    // Returning player whose session token is gone: get a new one quietly instead of asking again
    fetchToken(savedName).then(token => {
      if (!token) {
        // Back to the form with the name kept filled in, so one click retries
        setIsNameSet(false);
        setTokenError("Couldn't reach the server. Please try again.");
        return;
      }
      sessionStorage.setItem("gamehub_token", token);
      returnToInvite();
    });
```
Leave the effect's dependency array `[paramName]` and the `paramName` branch as they are. Do not change `handleSaveName`, `changeName`, the JSX or any other file.

**Checks**
- `cd frontend; npm ci; npm run lint; npm run build` → no new lint errors, and the build succeeds. If lint shows a warning, compare it with `git stash`-free baseline output from `git show 3d55294:frontend/src/app/page.tsx`: any warning already there (for example exhaustive-deps on this effect) is not new.
- Manual checks against the local backend, all expected to pass:
  1. Enter a name, close the tab, open `/` again → the game list shows "Playing as <name>", and creating or joining a game opens the room without a redirect.
  2. With a saved name, in a new tab open `/room/<id>?game=tic-tac-toe` → the room page sends you to the lobby, which gets a token and sends you back into the room. The name form never shows.
  3. Stop the backend, open `/` in a new tab with a saved name → the form shows with the name filled in and "Couldn't reach the server. Please try again." Start the backend and click "Let's play!" → the game list shows.
  4. Open `/?name=Other` → "Playing as Other", and `localStorage.gamehub_username` is `Other`.
  5. Click "Playing as … ✏️" → an empty form shows, and `gamehub_username` is gone from localStorage.

If FastAPI cannot be installed on the machine, note in the commit or PR that manual checks 1-5 still need a run in a browser against a backend.

**Commit:** `fix(ui): remember player name across sessions (GH-58)`

## Self-review
- The design's flow (empty name → form; saved name → game list; no token → background fetch; success → token stored and `returnToInvite()`; failure → form filled in with `tokenError`) is all in step 1.
- `?name=`, `changeName`, the room page and the backend are left alone, as the design asks.
- The design's edge cases (a click before the token arrives, `UNAUTHORIZED` expiry, a blocked or empty name) are covered by the same branch and by manual checks 2 and 3. Nothing outside the design is added.

## Final verification
```
cd frontend
npm ci
npm run lint
npm run build
```
Then run manual checks 1-5 from step 1 against a local backend (`uvicorn main:app --port 8000`) and `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev`.
