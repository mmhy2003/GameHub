# GH-80: Random room code, Copy code and Share link

## Goal
In the lobby, the room box is already filled with a random code, so the player sees their room code before picking a game. They can copy the code or share an app link that carries it. Inside a game, the header gets a Share button next to the existing copy-link button.

## Decisions
- **Where the buttons go: the lobby and the in-game header** (your choice). We rejected "lobby only".
- **Random code at lobby load.** When there is no `?room=` and no saved room (GH-59), the box gets `Math.random().toString(36).substring(2, 8)`, the same 6-character generator `navigate()` uses today, plus a "New room" tag. The code is **not** saved until the player actually enters a room, so GH-59 keeps working: whatever room they enter is saved.
- **The saved room still wins.** The box is pre-filled with it, and the "Last room: …" hint stays.
- **🔄 New code replaces ✕ Clear** (mockup v2). Clear used to empty the box. Now that an empty box is no longer the normal state, New code instead forgets the saved room (`clearSavedRoom()`) and puts in a fresh random code. You can reject this when you review the design and mockup.
- **Label:** "Have a room code?" becomes "Your room code", and a hint says a friend's code can be pasted over it.
- **Share link target:**
  - Lobby: `${origin}/?room=<code>`. The friend lands on the lobby in Join mode (the existing `?room=` flow) and picks the same game.
  - In game: the direct link `${origin}/room/<id>?game=<game>`, which is the same link the copy button already copies.
- **Share behaviour:** use `navigator.share({ title: "GameHub", text, url })` when it is available (mobile). Otherwise copy the link to the clipboard and show "Link copied! ✓". If the user cancels the share sheet (AbortError), nothing happens: no error and no fallback copy.
- **Copy code** copies only the code and shows "Copied! ✓" for 1.5 s, or "Copy failed", the same as the header button today.

## Architecture
All changes are in the frontend. The backend does not change.
- **New `frontend/src/lib/share.ts`** (small, pure helpers):
  - `randomRoomCode()`: the 6-character generator, moved out of `page.tsx`.
  - `copyText(text): Promise<boolean>`.
  - `shareLink(url, text): Promise<"shared" | "copied" | "cancelled" | "failed">`: Web Share first, then the clipboard fallback.
- **`frontend/src/app/page.tsx` (lobby):**
  - The `[paramRoom]` effect sets a random code when there is no `?room=` and no saved room.
  - `navigate()` uses `randomRoomCode()` as its fallback.
  - Replace the Clear button with New code, and add the Copy code and Share link buttons (`ToyButton`) with short-lived status labels. Each button gets its own timer, cleared on unmount.
  - Copy and Share are disabled when the box is empty after trimming.
  - The section is still hidden when `?room=` is present.
- **`frontend/src/app/room/[id]/page.tsx`:** add a 🔗 icon button (lucide `Share2`) in the room pill next to the copy button. It shares the same link that `handleCopyInvite` copies, with its own status. Build the link with one shared `inviteLink` constant.
- `?room=` values in links are passed through `URLSearchParams` / `encodeURIComponent`.

## Error handling and edge cases
- The clipboard can be blocked (an insecure http origin, or iframe permissions). The button then shows "Copy failed" and does not throw.
- If `navigator.share` rejects with any error other than AbortError, the button falls back to copying.
- If the player empties the box by hand, the game cards still say "Create game", and clicking one still makes a random code (unchanged behaviour).
- Typing a different code hides the "New room" tag and the "Last room" hint, the same as GH-59 does today.
- Embedded mode (`?name=`, `?chat=false`) does not change. The lobby share link carries only `room`.
- Hydration: the random code is set inside the effect, after mount, so the server and client HTML still match. The box is empty for one frame.

## Testing
There is no test runner. From `frontend/`, run `npx tsc --noEmit`, `npm run lint` (no new problems) and `npm run build`. Then check by hand at desktop size and at 375 px:
- On a fresh tab, the lobby shows a random code and the New room tag.
- New code changes the code.
- Copy puts the code on the clipboard.
- On desktop, Share copies `/?room=<code>`. Opening that link in a second browser leads to Join mode, and picking the same game puts both players together.
- Coming back from a game shows the saved room and its hint. New code clears the saved room.
- The in-game 🔗 copies or shares the direct link, and the header still fits at 375 px.
- On a phone (or in Chrome's device mode with Web Share), the share sheet opens. Cancelling it shows no error.

## Out of scope
- Server-side checks that a room is unique or free.
- QR codes, and links to specific social networks.
- Changing the code format or length.
- Sharing which game was picked from the lobby.