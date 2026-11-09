# GH-59: Remember the room code between games

## Goal
When a player leaves a game and goes back to the lobby, the room code they were just using is already filled in. They pick the next game and land in the same room, without typing the code again. The code is kept only for the current browser tab.

## Decisions
- **Storage: `sessionStorage`, key `gamehub_room`** (your choice). The code lasts through lobby trips and refreshes and is gone when the tab closes. The login token (`gamehub_token`) already works this way. We rejected `localStorage` because friends could find an old code waiting for them next week.
- **No new flag. `?room=<code>` in the URL replaces the saved code** (your choice). We rejected an opt-out flag (`remember_room=false`) and an opt-in flag.
- **Lobby UI: option A** (your choice; mockup v2). The "Have a room code?" box comes pre-filled, with a **✕ Clear** button and a one-line hint: "Last room: **<code>**. Pick the next game to play there, or clear it to start a new room." We rejected option B, a pre-filled box with no extra UI.
- **What gets saved:** any room the player actually enters. That covers a typed code, an invite link, and a code the lobby generated at random with "Create game". This way the person who created the room also gets the convenience.

## Architecture
All changes are in the frontend. The backend does not change.

- **`frontend/src/lib/roomMemory.ts`** (new, small). It holds `getSavedRoom()`, `saveRoom(id)` and `clearSavedRoom()`, which wrap `sessionStorage` in try/catch the same way `lib/sound.ts` does, so blocked storage never throws.
- **`frontend/src/app/room/[id]/page.tsx`**: once the name and token checks pass in the connect effect, call `saveRoom(roomId)`. This runs before the socket opens, so a Room Conflict still leaves the code saved. That is correct: the room exists, and the conflict screen already offers "Join existing …".
- **`frontend/src/app/page.tsx`**:
  - On mount, set `roomId` to `paramRoom` if it is present (and also `saveRoom(paramRoom)`). Otherwise use `getSavedRoom()`. Otherwise start empty. Read storage in an effect, not in `useState`'s initialiser, so the server render and the client render match.
  - Show the hint and the Clear button only when a saved code exists and the box still holds it. Clear empties the input and calls `clearSavedRoom()`.
  - Editing the box by hand only changes local state. The new code is saved when the player enters that room.
  - When `?room=` is in the URL, the room box stays hidden, as it is today, so embed and invite behaviour does not change.
  - Labels stay as they are: a code in the box makes the cards say "Join", an empty box makes them say "Create game".

## Edge cases
- **The other players are still in the old game's room when someone picks a different game.** The server replies with `ROOM_TYPE_MISMATCH`, and the existing Room Conflict screen appears with "Join existing X game". That is today's behaviour for a typed code. Once everyone has left, the server deletes the room, and the next game starts cleanly under the same code.
- **The saved room is empty or expired on the server.** A fresh room is created under that code, which is harmless.
- **Storage is blocked** (private mode, sandboxed iframe). The feature quietly does nothing and the lobby works as it does today.
- **Changing the name** (✏️) does not clear the room code.

## Testing
The frontend has no test runner, so verification is `npm run lint`, `npm run build`, plus manual QA:
1. Create a game, go back to the lobby: the box is pre-filled and the hint is visible. Pick another game: it opens in the same room id.
2. Clear: the box is empty, the cards say "Create game", and a refresh keeps it empty.
3. Open `/?room=abc` while a different code is saved: `abc` is used and saved.
4. Close the tab and reopen the lobby: no code.
5. Two tabs: each one remembers its own room.
6. Switch to a different game while a friend is still in the old one: the Room Conflict screen appears with "Join existing".

## Out of scope
- Moving everyone in the room to a new game automatically (a server-side "change game" feature).
- Remembering codes across browser sessions, or keeping a history of several rooms.
- Any backend changes.