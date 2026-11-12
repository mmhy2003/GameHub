# GH-80 plan: random room code, Copy code and Share link

## Goal
The lobby room box always shows a room code (random if none is set), with New code, Copy code and Share link buttons, and the in-game header gets a Share button next to the existing copy-link button.

## Architecture
Only the frontend changes. A new pure helper module `frontend/src/lib/share.ts` holds `randomRoomCode()`, `copyText()` and `shareLink()` (Web Share first, clipboard fallback, AbortError = cancelled). The lobby (`frontend/src/app/page.tsx`) fills the box with a random code after mount when there is no `?room=` and no saved room, replaces ✕ Clear with 🔄 New code, and adds 📋 Copy code / 🔗 Share link. The room page (`frontend/src/app/room/[id]/page.tsx`) adds a lucide `Share2` button that shares the same invite link the copy button copies.

## What the code looks like today (checked at `a9ae079`)
- `frontend/src/app/page.tsx`
  - `paramRoom` line 16; `const [roomId, setRoomId] = useState(paramRoom)` line 23; `const [savedRoom, setSavedRoom] = useState("")` line 24.
  - `navigate()` lines 36-39: `const rid = roomId.trim() || Math.random().toString(36).substring(2, 8);`.
  - Room effect lines 93-105 (`[paramRoom]`): `?room=` → `saveRoom` + `setRoomId`; else saved → `setSavedRoom` + `setRoomId`. Has `// eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage after hydration` before line 98.
  - `actionLabel` line 129, `showSavedRoom` line 130, `clearRoom` lines 131-135.
  - Early return `if (!isNameSet)` at line 138: **all hooks must stay above it**.
  - Room section lines 199-223: `<section className="chunk bg-candy-yellow p-4 md:p-5 flex flex-col gap-2">`, label "Have a room code?", input `#room-code`, ✕ Clear `ToyButton` and "Last room" hint, only when `!paramRoom`.
- `frontend/src/app/room/[id]/page.tsx`
  - Imports `{ Send, ArrowLeft, Copy } from "lucide-react"` (line 4).
  - `copyStatus` state + `copyTimerRef` lines 57-58; unmount cleanup effect lines 153-155; `handleCopyInvite` lines 157-167 builds `${window.location.origin}/room/${roomId}?game=${gameType}` and calls `navigator.clipboard.writeText` directly.
  - Room pill with the copy button lines 261-274.
- `frontend/src/lib/roomMemory.ts`: `getSavedRoom()`, `saveRoom(id)`, `clearSavedRoom()`.
- `frontend/src/components/ui/ToyButton.tsx`: `ToyButton({ color, size: "sm"|"md"|"lg", className, onClick, type, ...rest })`, colors `yellow|pink|blue|green|purple|orange|white`; spreads other button props (so `disabled`, `aria-label` work).
- No test runner. Scripts: `npm run lint` (eslint), `npm run build`. Run `npm ci` in `frontend/` once first. Lint bar: no new problems vs. the baseline (record baseline with `npm run lint` before your first edit).
- Commit style: `feat(ui): … (GH-80)`.

## File map
| File | Change | Responsibility |
|---|---|---|
| `frontend/src/lib/share.ts` | create | `randomRoomCode()`, `copyText(text)`, `shareLink(url, text)`, `ShareResult` type |
| `frontend/src/app/page.tsx` | modify | random code at load, New code replaces Clear, label/hint/"New room" tag, Copy code + Share link buttons with timed status labels |
| `frontend/src/app/room/[id]/page.tsx` | modify | shared `inviteLink()` builder, copy via `copyText`, new 🔗 `Share2` button with its own status |

## Shared contract: `frontend/src/lib/share.ts` (full contents)
```ts
// Room-code and link-sharing helpers for the lobby and the room header (GH-80)

// Same 6-character generator the lobby used inline before
export function randomRoomCode(): string {
  return Math.random().toString(36).substring(2, 8);
}

// Clipboard can be missing (http origin) or blocked (iframe permissions); never throws
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

// Web Share sheet when available (mobile), otherwise copy the link
export async function shareLink(url: string, text: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "GameHub", text, url });
      return "shared";
    } catch (err) {
      // User closed the sheet: do nothing, no fallback copy
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Any other share error falls through to copying
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
```

## Lobby code for steps 2-3 (`frontend/src/app/page.tsx`)

Imports:
```ts
import { useState, useEffect, useRef, Suspense } from "react";
import { randomRoomCode, copyText, shareLink } from "@/lib/share";
```

State (next to `savedRoom`, above the `if (!isNameSet)` return):
```ts
const [generatedRoom, setGeneratedRoom] = useState("");
// step 3:
const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Room effect (replace the body after the `if (paramRoom) {…}` block):
```ts
const saved = getSavedRoom();
if (saved) {
  setSavedRoom(saved);
  setRoomId(saved);
  return;
}
// Nothing chosen yet: offer a fresh room. Not saved until the player enters it (GH-80)
const code = randomRoomCode();
setGeneratedRoom(code);
setRoomId(code);
```

Derived values and handlers (replace `clearRoom`):
```ts
const trimmedRoom = roomId.trim();
const showSavedRoom = savedRoom !== "" && trimmedRoom === savedRoom;
const showNewRoom = generatedRoom !== "" && trimmedRoom === generatedRoom;
const newCode = () => {
  clearSavedRoom();
  setSavedRoom("");
  const code = randomRoomCode();
  setGeneratedRoom(code);
  setRoomId(code);
};
```

Step 3 additions:
```ts
useEffect(() => () => {
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
}, []);

const copyCode = async () => {
  if (!trimmedRoom) return;
  setCopyStatus((await copyText(trimmedRoom)) ? "copied" : "failed");
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  copyTimerRef.current = setTimeout(() => setCopyStatus("idle"), 1500);
};

const shareRoom = async () => {
  if (!trimmedRoom) return;
  const url = `${window.location.origin}/?${new URLSearchParams({ room: trimmedRoom }).toString()}`;
  const result = await shareLink(url, `Join my GameHub room: ${trimmedRoom}`);
  if (result !== "copied" && result !== "failed") return;
  setShareStatus(result);
  if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
  shareTimerRef.current = setTimeout(() => setShareStatus("idle"), 1500);
};
```
(The `useEffect` cleanup and `trimmedRoom` must be declared above the `if (!isNameSet)` early return; `copyCode`/`shareRoom` are plain functions and may sit next to `newCode`, which is also above it.)

Section markup (replaces lines 199-223; final form after step 3):
```tsx
{!paramRoom && (
  <section className="chunk bg-candy-yellow p-4 md:p-5 flex flex-col gap-2">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <label htmlFor="room-code" className="font-bold text-lg shrink-0 flex items-center gap-2">
        Your room code
        {showNewRoom && (
          <span className="chunk-sm bg-candy-green text-ink text-xs font-bold px-2 py-0.5">New room</span>
        )}
      </label>
      <input
        id="room-code"
        type="text"
        placeholder="Paste a friend's code here"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        className="flex-1 min-w-0 chunk-sm bg-white px-4 py-2 font-mono focus:outline-none"
      />
    </div>
    <div className="flex flex-wrap gap-2">
      <ToyButton color="white" size="sm" onClick={newCode} aria-label="Get a new room code">🔄 New code</ToyButton>
      <ToyButton color="white" size="sm" onClick={copyCode} disabled={!trimmedRoom} aria-label="Copy room code">
        {copyStatus === "copied" ? "Copied! ✓" : copyStatus === "failed" ? "Copy failed" : "📋 Copy code"}
      </ToyButton>
      <ToyButton color="white" size="sm" onClick={shareRoom} disabled={!trimmedRoom} aria-label="Share room link">
        {shareStatus === "copied" ? "Link copied! ✓" : shareStatus === "failed" ? "Copy failed" : "🔗 Share link"}
      </ToyButton>
    </div>
    {showSavedRoom ? (
      <p className="text-sm font-semibold text-ink/80">
        Last room: <span className="font-mono font-bold">{savedRoom}</span>. Pick the next game to play there, or get a new code to start a new room.
      </p>
    ) : (
      <p className="text-sm font-semibold text-ink/80">
        Share this code with a friend, or paste a friend&apos;s code over it. Then pick a game.
      </p>
    )}
  </section>
)}
```

## Room page code for step 4 (`frontend/src/app/room/[id]/page.tsx`)
```ts
import { Send, ArrowLeft, Copy, Share2 } from "lucide-react";
import { copyText, shareLink } from "@/lib/share";

const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => () => {
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
}, []);

// One builder for the direct invite link, used by both Copy and Share (GH-80)
const inviteLink = () =>
  `${window.location.origin}/room/${encodeURIComponent(roomId)}?${new URLSearchParams({ game: gameType }).toString()}`;

const handleCopyInvite = async () => {
  setCopyStatus((await copyText(inviteLink())) ? "copied" : "failed");
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  copyTimerRef.current = setTimeout(() => setCopyStatus("idle"), 1500);
};

const handleShareInvite = async () => {
  const result = await shareLink(inviteLink(), `Play ${gameType.replace(/-/g, " ")} with me on GameHub!`);
  if (result !== "copied" && result !== "failed") return;
  setShareStatus(result);
  if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
  shareTimerRef.current = setTimeout(() => setShareStatus("idle"), 1500);
};
```
`inviteLink` is a function (not a render-time constant) because `window` does not exist during prerender; it is still the single place the link is built.

Button, right after the copy button inside the room pill:
```tsx
<button
  type="button"
  onClick={handleShareInvite}
  aria-label="Share invite link"
  title="Share invite link"
  className="shrink-0 flex items-center gap-1 rounded-lg bg-candy-blue/15 hover:bg-candy-blue/30 px-1.5 py-1 font-sans font-bold transition-colors"
>
  {shareStatus === "copied" ? "Link copied! ✓" : shareStatus === "failed" ? "Copy failed" : <Share2 size={14} />}
</button>
```

## Steps
1. Add `lib/share.ts` and use `randomRoomCode()` in `navigate()`
2. Lobby: random code at load, New code replaces Clear, new label, hint and New room tag
3. Lobby: Copy code and Share link buttons
4. Room header: Share button and shared invite-link builder
5. Full manual verification at desktop and 375 px

(Each step's full detail is in the `steps` array and repeated below.)

### Step 1 — Add `lib/share.ts` and use `randomRoomCode()` in `navigate()`
- `cd frontend; npm ci; npm run lint` and note the baseline problem count.
- Failing check first: in `frontend/src/app/page.tsx` add `import { randomRoomCode } from "@/lib/share";` and change line 37 to `const rid = roomId.trim() || randomRoomCode();`. Run `npx tsc --noEmit` → expect `Cannot find module '@/lib/share'`.
- Create `frontend/src/lib/share.ts` with the exact contents in "Shared contract".
- `npx tsc --noEmit` → passes; `npm run lint` → no new problems; `npm run build` → succeeds.
- Commit: `feat(ui): add share helpers and reuse the room code generator (GH-80)`.

### Step 2 — Lobby: random code at load, New code replaces Clear, new label, hint and New room tag
- Failing check first: replace `clearRoom` with `newCode` and switch the ToyButton to it, then run `npx tsc --noEmit` → fails until `generatedRoom` state exists (`Cannot find name 'setGeneratedRoom'`).
- Add `generatedRoom` state, the new room-effect body, `trimmedRoom`/`showSavedRoom`/`showNewRoom`/`newCode` (see "Lobby code"). Import `randomRoomCode` already present from step 1.
- Replace the section with the markup above **without** the Copy/Share buttons (only 🔄 New code in the button row). Remove `clearRoom`; keep `clearSavedRoom` import (used by `newCode`).
- `actionLabel` stays as is (now uses `trimmedRoom` is optional; keep behaviour: empty box → "Create game").
- `npx tsc --noEmit`, `npm run lint` (if a new `react-hooks/set-state-in-effect` is reported on the new lines, add the same `// eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage after hydration` comment above the first new `setState`), `npm run build`.
- Manual: `npm run dev` (backend via `docker compose up -d --build` or existing setup). Fresh tab → box shows 6-char code + "New room" tag; 🔄 New code changes it; typing another code hides the tag; enter a game, go back → saved code + "Last room" hint, no tag; New code → hint gone, sessionStorage `gamehub_room` removed; `/?room=abc` hides the section.
- Commit: `feat(ui): give the lobby a random room code with a New code button (GH-80)`.

### Step 3 — Lobby: Copy code and Share link buttons
- Failing check first: add the two `ToyButton`s to the button row referencing `copyCode`/`shareRoom`/`copyStatus`/`shareStatus`; `npx tsc --noEmit` → `Cannot find name 'copyCode'`.
- Add `useRef` import, `copyText, shareLink` import, the status state, refs, unmount cleanup effect (above the `if (!isNameSet)` return) and `copyCode`/`shareRoom` (see "Lobby code").
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Manual (desktop): Copy → clipboard has the code, label "Copied! ✓" for 1.5 s; Share → clipboard has `<origin>/?room=<code>`, label "Link copied! ✓"; empty box → both disabled; open the link in another browser → Join mode, same game puts both players together. On http non-localhost origin → "Copy failed", no console error.
- Commit: `feat(ui): add Copy code and Share link to the lobby (GH-80)`.

### Step 4 — Room header: Share button and shared invite-link builder
- Failing check first: add the Share `<button>` referencing `handleShareInvite`/`shareStatus`/`Share2`; `npx tsc --noEmit` → errors.
- Apply "Room page code": import `Share2`, `copyText`, `shareLink`; add `shareStatus` + `shareTimerRef`; extend the existing unmount cleanup effect (lines 153-155) to clear both timers; add `inviteLink()`, rewrite `handleCopyInvite` to use it and `copyText`, add `handleShareInvite`.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Manual: copy button still copies `<origin>/room/<id>?game=<game>`; 🔗 copies the same link on desktop ("Link copied! ✓"); header fits at 375 px with both buttons.
- Commit: `feat(ui): add a Share button to the room header (GH-80)`.

### Step 5 — Full manual verification at desktop and 375 px
Run the design's checklist end to end (see Final verification). Fix any defect in the file it belongs to and commit as `fix(ui): … (GH-80)`; if nothing needs fixing, no commit.

## Final verification
From `frontend/`:
```
npm ci
npx tsc --noEmit
npm run lint      # no new problems vs. baseline
npm run build
```
Then `docker compose up -d --build` from the repo root and check at desktop and 375 px (Chrome device mode):
- Fresh tab: lobby shows a random code and the "New room" tag; 🔄 New code changes it.
- 📋 Copy code puts the code on the clipboard ("Copied! ✓").
- 🔗 Share link on desktop copies `/?room=<code>`; opening it in a second browser → Join mode; picking the same game joins both players.
- Back from a game: saved room + "Last room" hint; New code clears the saved room.
- In game: copy and 🔗 both give the direct link; header fits at 375 px.
- With Web Share (phone or device mode supporting it): share sheet opens; cancelling shows no error and no "copied" label.
- Embedded mode (`/?name=Bob&chat=false`) still works; lobby share link carries only `room`.
