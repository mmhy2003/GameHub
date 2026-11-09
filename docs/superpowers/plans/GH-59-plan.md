# GH-59 plan: remember the room code between games

## Goal
When a player goes back to the lobby, the room box already holds the room they just used (for this browser tab only), so they can pick the next game without typing the code again.

## Architecture
Only the frontend changes. A new helper module, `frontend/src/lib/roomMemory.ts`, wraps `sessionStorage["gamehub_room"]` in try/catch. The room page saves its `roomId` once the name and token checks pass. On mount, the lobby uses `?room=` first (and saves it), then the saved code. When the box still holds the saved code, the lobby shows a "✕ Clear" button and a one-line hint.

## What the code looks like today (checked at `cc5a6d5`)
- `frontend/src/app/page.tsx`
  - `paramRoom` comes from `searchParams.get("room")` (line 14).
  - `const [roomId, setRoomId] = useState(paramRoom)` (line 21).
  - `navigate()` uses `roomId.trim()` or a random 6-character id (line 34).
  - The room box is rendered only when `!paramRoom` (lines 178-190): `<section className="chunk bg-candy-yellow p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3">` holding a label and an input.
  - `actionLabel = paramRoom || roomId.trim() ? "Join" : "Create game"` (line 114).
  - Storage is called directly elsewhere in the file (`gamehub_username`, `gamehub_token`).
- `frontend/src/app/room/[id]/page.tsx`
  - The connect `useEffect` starts at line 58. The name check is at lines 67-75 and the token check at lines 78-82, with `router.push(lobbyUrl); return;` on failure. The WebSocket is created from line 85.
  - `roomId = params.id as string` (line 33).
- `frontend/src/lib/sound.ts:29-35` sets the storage-wrapper style: `try { … } catch { /* storage blocked */ }`.
- `frontend/src/components/ui/ToyButton.tsx`: `ToyButton({ color, size: "sm"|"md"|"lg", className, onClick, type="button", ...rest })`. It plays a click sound.
- There is no frontend test runner. The scripts are `npm run lint` (eslint) and `npm run build` (next build). `node_modules` is not checked in, so run `npm ci` in `frontend/` first.
- Commits use the form `fix(ui): … (GH-59)` / `feat(ui): … (GH-59)`.

## File map
| File | Change | Responsibility |
|---|---|---|
| `frontend/src/lib/roomMemory.ts` | create | `getSavedRoom()`, `saveRoom(id)`, `clearSavedRoom()` on `sessionStorage["gamehub_room"]`; never throws |
| `frontend/src/app/room/[id]/page.tsx` | modify | call `saveRoom(roomId)` after the name and token checks pass |
| `frontend/src/app/page.tsx` | modify | fill the box from `?room=` or the saved code, show the hint and Clear button, wire Clear |

### `frontend/src/lib/roomMemory.ts` (full contents)
```ts
// Remembers the last room this tab entered, so the lobby can offer it again (GH-59)
const STORAGE_KEY = "gamehub_room";

export function getSavedRoom(): string {
  try { return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? ""; } catch { return ""; }
}

export function saveRoom(id: string) {
  const trimmed = id.trim();
  if (!trimmed) return;
  try { sessionStorage.setItem(STORAGE_KEY, trimmed); } catch { /* storage blocked */ }
}

export function clearSavedRoom() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
}
```

### Room page change
Add `import { saveRoom } from "@/lib/roomMemory";` next to `import { play } from "@/lib/sound";`. Then, in the connect effect, directly after the token check block (`if (!token) { router.push(lobbyUrl); return; }`) and before `// Initialize WebSocket with JWT token`, add:
```ts
    // Remember this room for the lobby, so the next game opens here too (GH-59)
    saveRoom(roomId);
```
This runs before the socket opens, so a Room Conflict (`ROOM_TYPE_MISMATCH`) still leaves the code saved. That is intended.

### Lobby change
1. Imports: `import { getSavedRoom, saveRoom, clearSavedRoom } from "@/lib/roomMemory";`
2. State: keep `const [roomId, setRoomId] = useState(paramRoom);` and add `const [savedRoom, setSavedRoom] = useState("");` after it.
3. New effect, placed after the existing name/token `useEffect`. Storage is read here, not in a `useState` initialiser, so the server and client renders match:
```ts
  useEffect(() => {
    // ?room= wins over the remembered room and becomes the remembered room (GH-59)
    if (paramRoom) {
      saveRoom(paramRoom);
      setRoomId(paramRoom);
      return;
    }
    const saved = getSavedRoom();
    if (!saved) return;
    setSavedRoom(saved);
    setRoomId(saved);
  }, [paramRoom]);
```
4. Next to `actionLabel`:
```ts
  const showSavedRoom = savedRoom !== "" && roomId.trim() === savedRoom;
  const clearRoom = () => {
    setRoomId("");
    setSavedRoom("");
    clearSavedRoom();
  };
```
Typing in the box still only calls `setRoomId`. The new code is saved by the room page once the player enters that room.

5. Replace the room box section (still wrapped in `{!paramRoom && ( … )}`) with:
```tsx
          <section className="chunk bg-candy-yellow p-4 md:p-5 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label htmlFor="room-code" className="font-bold text-lg shrink-0">Have a room code?</label>
              <input
                id="room-code"
                type="text"
                placeholder="Paste it here, then pick the game"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 min-w-0 chunk-sm bg-white px-4 py-2 font-mono focus:outline-none"
              />
              {showSavedRoom && (
                <ToyButton color="white" size="sm" onClick={clearRoom} aria-label="Clear saved room code" className="shrink-0 self-start sm:self-auto">
                  ✕ Clear
                </ToyButton>
              )}
            </div>
            {showSavedRoom && (
              <p className="text-sm font-semibold text-ink/80">
                Last room: <span className="font-mono font-bold">{savedRoom}</span>. Pick the next game to play there, or clear it to start a new room.
              </p>
            )}
          </section>
```
The `actionLabel` logic does not change: a code in the box gives "Join" and an empty box gives "Create game". Changing the name (`changeName`) does not touch the room memory.

## Lint note
eslint-config-next 16 includes the React Hooks rules. The lobby already calls `setState` synchronously inside an effect (`setUsername` at lines 64 and 76), so the new effect follows the same pattern. Before you change anything, run `npm run lint` on the untouched checkout and note the baseline. After your change, lint must report **no new** errors or warnings in the touched files. If `react-hooks/set-state-in-effect` flags only the new effect while the existing ones are not flagged, add the narrowest fix: `// eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage after hydration` on that line. Do not restructure the existing effects.

## Steps
1. **Add roomMemory helper and save the room on entry**: create `roomMemory.ts` and call `saveRoom(roomId)` in the room page.
2. **Lobby: pre-fill the room box with a hint and a Clear button**: the lobby effect, the `showSavedRoom` and `clearRoom` additions, and the section markup.

## Final verification
From `frontend/`:
- `npm ci`
- `npm run lint` (no new problems compared with the baseline)
- `npm run build` (succeeds)

Then from the repo root, run `docker compose up -d --build` (or run the backend and `npm run dev`) and do this manual QA:
1. Create a game, then go back to the lobby. The box is pre-filled and the hint is visible. Pick another game: it opens at `/room/<same id>`.
2. Click ✕ Clear. The box is empty, the cards say "Create game", and after a refresh the box is still empty.
3. With a different code saved, open `/?room=abc`. The box stays hidden. Pick a game: it opens `/room/abc`. Go back to `/`: the box holds `abc`.
4. Close the tab and open the lobby in a new tab: the box is empty.
5. Two tabs in different rooms: each tab's lobby shows its own room.
6. Pick a different game while a friend is still in the old one: the Room Conflict screen appears with "Join existing …".
7. Change the name with ✏️: the saved room code is still offered afterwards.
8. In DevTools, make `sessionStorage` throw (or use a sandboxed iframe): the lobby and rooms still work, just without remembering.
