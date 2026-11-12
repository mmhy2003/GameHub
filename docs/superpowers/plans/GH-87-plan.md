# GH-87 — PWA support: implementation plan

## Goal
Make GameHub installable on phones (manifest, icons, a small service worker, iOS meta tags), add an **Install app** button on the home page, and show a static "You're offline" page when the installed app has no network.

## Architecture
Next's built-in `src/app/manifest.ts` serves `/manifest.webmanifest`. It uses relative URLs only, so no host is baked in (GH-67). A hand-written `public/sw.js` precaches only `/offline.html` and the 192 icon. It answers failed **navigation** requests with that page and lets every other request go straight to the network. A render-nothing client component `PwaRegister` registers the worker in production. A client component `InstallAppButton` in the home header uses `beforeinstallprompt` on Chrome/Edge and shows a "Share → Add to Home Screen" sheet on iOS Safari. No new npm dependency, and no Caddy change: everything except `/auth/*` and `/ws/*` already goes to the frontend.

## Repository facts the steps rely on
- The frontend lives in `frontend/`. Run every command from `frontend/`. `node_modules` is **not installed** in a fresh worktree, so run `npm ci` first.
- `frontend/AGENTS.md` says: read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (Next 16.4.5). Find the PWA and metadata guides with `grep -ril 'progressive web app' node_modules/next/dist/docs` and `grep -ril 'generateViewport\|themeColor' node_modules/next/dist/docs`.
- There is no test runner. The quality gates are `npx tsc --noEmit`, `npm run lint` (baseline is 15 problems: 6 errors and 9 warnings in untouched files; the bar is **no new problems**, and a targeted `eslint-disable-next-line` with a reason is fine), and `npm run build`. Manual checks go through `docker compose up -d --build` from the repo root (Caddy at http://localhost).
- `src/app/icon.png` is really a **JPEG** (640×640, dark neon "G" logo on a dark background). ImageMagick `convert` is on the host. Use the `PNG24:` prefix so the outputs are real PNGs.
- Theme colours (from `src/app/globals.css`): cream `#fff8ec`, ink `#2b2240`, candy-purple `#8b5cf6`, candy-green `#3ddc84`. Classes: `chunk` (3px ink border, radius 1rem, 4px shadow), `chunk-sm`, `btn-toy`, `animate-pop`.
- `src/components/ui/ToyButton.tsx`: `<ToyButton color="green" size="sm" ...>` renders a `btn-toy` button and plays a click sound.
- `src/app/layout.tsx` uses an async `generateMetadata()` and mounts `<SwetrixAnalytics />` and `<GameBtnGuard />` (a `"use client"` component that returns `null`) inside `<body>`.
- In `src/app/page.tsx` the "Playing as …" chip/button is the right-hand child of the purple `<header>` (lines 222–235). Its ancestor `div.animate-fade-in` keeps `transform: translateY(0)` after the animation (`forwards`). That makes it the containing block for `position: fixed` children, so **any full-screen overlay must be rendered with `createPortal(..., document.body)`**.
- The lint config has the `react-hooks/set-state-in-effect` rule. The repo already silences it with `// eslint-disable-next-line react-hooks/set-state-in-effect -- reason` (page.tsx:103).
- `next.config.ts` already has `headers()` with a `/(.*)` rule (X-Frame-Options ALLOWALL, frame-ancestors *). Keep it.
- Commits use the conventional, scoped format with the issue reference, e.g. `feat(ui): ... (GH-87)`. Never commit `.megoocolab/` or `docs/` plan/design files.

## File map
| File | Status | Responsibility |
|---|---|---|
| `frontend/public/icons/icon-192.png` | new | 192×192 icon (manifest, SW precache) |
| `frontend/public/icons/icon-512.png` | new | 512×512 icon (manifest) |
| `frontend/public/icons/icon-maskable-512.png` | new | 512×512 maskable: logo at 400px centred on cream |
| `frontend/public/icons/apple-touch-icon.png` | new | 180×180 iOS home-screen icon |
| `frontend/src/app/manifest.ts` | new | Web app manifest → `/manifest.webmanifest` |
| `frontend/src/app/layout.tsx` | modify | `appleWebApp`, `icons.apple`, `viewport` export with `themeColor`; mount `PwaRegister` |
| `frontend/public/offline.html` | new | Static offline page with a Try again button |
| `frontend/public/sw.js` | new | Install/activate/fetch (navigation fallback only) |
| `frontend/next.config.ts` | modify | No-cache and `Service-Worker-Allowed` headers for `/sw.js` |
| `frontend/src/components/PwaRegister.tsx` | new | Registers `/sw.js` in production |
| `frontend/src/components/InstallAppButton.tsx` | new | Install button + iOS steps sheet |
| `frontend/src/app/page.tsx` | modify | Put `InstallAppButton` next to "Playing as …" |

## Steps

### 1. Add the app icons, the web manifest and the iOS/theme metadata
1. `cd frontend; npm ci`. Read the Next 16 PWA guide and the metadata/viewport docs under `node_modules/next/dist/docs/` (find them with the grep commands above).
2. Generate the icons (run from `frontend/`):
```
mkdir -p public/icons
convert src/app/icon.png -resize 192x192 PNG24:public/icons/icon-192.png
convert src/app/icon.png -resize 512x512 PNG24:public/icons/icon-512.png
convert src/app/icon.png -resize 180x180 PNG24:public/icons/apple-touch-icon.png
convert src/app/icon.png -resize 400x400 -background '#fff8ec' -gravity center -extent 512x512 PNG24:public/icons/icon-maskable-512.png
```
Check them with `file public/icons/*.png`. Each must say `PNG image data` with the right size.

3. Create `frontend/src/app/manifest.ts`:
```ts
import type { MetadataRoute } from "next";

// Installable app (GH-87). Relative URLs only, so it works on any host (GH-67)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GameHub",
    short_name: "GameHub",
    description: "Play classic multiplayer games with friends instantly. No sign-up required.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff8ec",
    theme_color: "#8b5cf6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```
4. In `frontend/src/app/layout.tsx`: change the import to `import type { Metadata, Viewport } from "next";`. Add the following to the object returned by `generateMetadata()`, after `creator`:
```ts
    appleWebApp: {
      capable: true,
      title: "GameHub",
      statusBarStyle: "default",
    },
    icons: {
      apple: "/icons/apple-touch-icon.png",
    },
```
Do **not** list `icon` there: `src/app/icon.png` keeps working as the favicon through the file convention. Check in the built HTML that the `<link rel="icon">` is still there. Then add a top-level export next to `generateMetadata`:
```ts
export const viewport: Viewport = {
  themeColor: "#8b5cf6",
};
```
5. Verify: `npx tsc --noEmit` passes. `npm run lint` shows no new problems. `npm run build` passes and lists `/manifest.webmanifest`. Then run `npm start` and in another shell: `curl -s localhost:3000/manifest.webmanifest` (JSON with the three icons), `curl -sI localhost:3000/icons/icon-192.png` (200, image/png), `curl -s localhost:3000/ | grep -o '<link[^>]*apple-touch-icon[^>]*>\|<meta[^>]*theme-color[^>]*>\|<link[^>]*manifest[^>]*>\|<meta[^>]*apple-mobile-web-app[^>]*>'` (all present).
6. Commit: `feat(ui): add web app manifest, app icons and iOS metadata (GH-87)`

### 2. Add the offline page, the service worker and its registration
1. Create `frontend/public/offline.html`. It is a standalone HTML page with no Next assets and inline CSS only:
   - `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<meta name="theme-color" content="#8b5cf6">`, title "Offline | GameHub".
   - Body background `#fff8ec`, text `#2b2240`, font `system-ui, sans-serif` (Fredoka is a Next font and is not available offline). Centre the content in a flex column at min-height 100vh.
   - A card: white, `border: 3px solid #2b2240; border-radius: 1rem; box-shadow: 4px 4px 0 0 #2b2240; max-width: 22rem; padding: 1.5rem; text-align: center`.
   - Inside the card: `<img src="/icons/icon-192.png" alt="" width="72" height="72" style="border-radius:1rem">`, a big `📡` (2.5rem), `<h1>You're offline</h1>`, `<p>GameHub needs an internet connection to play. Check your connection and try again.</p>`, and `<button type="button" onclick="location.reload()">Try again</button>` styled like `btn-toy` green: `background:#3ddc84; color:#2b2240; font-weight:700; font-size:1.125rem; padding:.75rem 1.5rem; border:2px solid #2b2240; border-radius:1rem; box-shadow:2px 2px 0 0 #2b2240; width:100%; cursor:pointer`, plus `button:active{transform:translate(2px,2px);box-shadow:none}`.
2. Create `frontend/public/sw.js` with exactly this behaviour:
```js
// GameHub service worker (GH-87). Makes the app installable and shows /offline.html
// when a page can't load. Games are online-only: it never caches pages, assets, API or WS.
// Bump the version when offline.html or the precached icon changes.
const CACHE = "gamehub-offline-v1";
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads get the offline fallback; everything else goes straight to the network
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match("/offline.html").then((response) => response || Response.error()),
    ),
  );
});
```
3. In `frontend/next.config.ts`, add a second entry to the array returned by `headers()` and keep the existing `/(.*)` entry:
```ts
      {
        // Always fetch a fresh worker so deploys take effect right away (GH-87)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
```
4. Create `frontend/src/components/PwaRegister.tsx`:
```tsx
"use client";
import { useEffect } from "react";

/**
 * Registers the service worker that makes GameHub installable (GH-87).
 * Production only, so dev reloads never fight a cached worker.
 * Mount this once in the root layout.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Fails on plain-HTTP LAN IPs (no secure context); the app works the same without it
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}
```
5. In `frontend/src/app/layout.tsx`: `import PwaRegister from "@/components/PwaRegister";` and render `<PwaRegister />` right after `<GameBtnGuard />`.
6. Verify: `npx tsc --noEmit`. `npm run lint` shows no new problems; if ESLint reports anything in `public/sw.js`, fix it without disabling rules for the whole file. `npm run build`. Then `npm start` and:
   - `curl -sI localhost:3000/sw.js` shows 200, `Cache-Control: no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /` and a JavaScript content type.
   - `curl -s localhost:3000/offline.html | grep "You're offline"`.
   - Chrome at http://localhost:3000, DevTools → Application → Service workers: `sw.js` is activated. Cache storage `gamehub-offline-v1` holds exactly two entries. Network → Offline, then navigate to `/`: the offline page shows with its icon. Go back online and click Try again: the home page loads. In-game WebSocket and `/_next/` requests do not go through the cache (no "(ServiceWorker)" responses except navigations).
   - `npm run dev` registers no worker (unregister any old one first).
7. Commit: `feat(ui): add a service worker with an offline page (GH-87)`

### 3. Add the Install app button to the home page header
1. Create `frontend/src/components/InstallAppButton.tsx` with the code in the appendix below.
2. In `frontend/src/app/page.tsx`: add `import InstallAppButton from "@/components/InstallAppButton";`. In the logged-in header, wrap the existing `paramName ? <span…> : <button…>` expression and the new button in
   `<div className="self-start md:self-auto flex flex-wrap items-center gap-2"> … <InstallAppButton /> </div>`. Remove `self-start md:self-auto` from the inner span and button, because the wrapper now carries them. Order: Playing as … first, then Install app. Do not change anything else.
3. Behaviour (acceptance):
   - Hidden when running standalone (`display-mode: standalone` or `navigator.standalone`), inside an iframe, after `appinstalled`, after the native prompt was used once, and on browsers with neither path (Firefox desktop, Safari macOS before the event…).
   - Chrome/Edge (Android and desktop): it appears once `beforeinstallprompt` fires. A click opens the native prompt.
   - iPhone/iPad Safari: it shows on load. A click opens a sheet (portalled into `document.body`) with the steps "Tap Share → Add to Home Screen → Add" and a **Got it** button. A click on the backdrop, Got it or Escape closes it.
4. Verify: `npx tsc --noEmit`. `npm run lint` shows no new problems (the only disable is the commented one in the appendix). `npm run build`. Then `npm start`; Chrome at http://localhost:3000 after setting a name:
   - The button appears in the header. Click it: the native install dialog opens. Install: the app opens in its own window without the button.
   - DevTools device toolbar with an iPhone UA (Safari, e.g. `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`): reload, then click: the sheet is centred on the viewport (not on the header) and Got it closes it.
   - The layout is fine at 375px and on desktop. The header buttons wrap cleanly.
   - Embedded check: `?name=Test` still shows the "Playing as" chip. In a page that iframes http://localhost:3000 the Install button does not show.
5. Commit: `feat(ui): add an Install app button to the home page (GH-87)`

### 4. End-to-end check through Docker and Caddy
No new code unless a check fails. Fix any failure in the file it belongs to and commit as `fix(ui): … (GH-87)`.
1. From the repo root: `cp -n env.sample .env; docker compose config -q; docker compose up -d --build`.
2. `curl -s http://localhost/manifest.webmanifest` (JSON); `curl -sI http://localhost/sw.js` (200 with both headers); `curl -sI http://localhost/offline.html` (200); `curl -sI http://localhost/icons/icon-maskable-512.png` (200 image/png); `curl -sI http://localhost/auth/token` still reaches the backend (not 404 from Next).
3. Chrome http://localhost → DevTools → Application → Manifest: no errors, icons shown, and the maskable preview is fine. Lighthouse (or the Manifest pane's installability section) reports the app installable. Service worker active. Offline navigation shows the offline page. A game in two tabs still plays normally online (WebSockets untouched).
4. If a device is available: Android Chrome over the HTTPS deployment (Install app → native prompt → opens standalone, button hidden), and iPhone Safari (sheet steps → Add to Home Screen shows the GameHub icon and title). Note in the PR if this was not possible.
5. `git status` is clean (no `.megoocolab/`, no `docs/` plan files).

## Appendix A — `frontend/src/components/InstallAppButton.tsx`
```tsx
"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ToyButton from "@/components/ui/ToyButton";

// Chrome/Edge install event; not in TypeScript's DOM types
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "hidden" | "prompt" | "ios";

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin parent
  }
}

// iPhone/iPad Safari has no install event: install is Share → Add to Home Screen.
// iPadOS reports itself as a Mac, so check for touch too.
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** "Install app" for the home page header (GH-87). Renders nothing where install isn't possible. */
export default function InstallAppButton() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (isStandalone() || isInIframe()) return;
    if (isIosSafari()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads navigator after hydration
      setMode("ios");
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault(); // no mini-infobar; our button offers the install
      setPromptEvent(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setMode("hidden");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showSteps) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowSteps(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showSteps]);

  const install = async () => {
    if (mode === "ios") {
      setShowSteps(true);
      return;
    }
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    // A prompt event works only once; Chrome fires a new one if install is still possible
    setPromptEvent(null);
    setMode("hidden");
  };

  if (mode === "hidden") return null;

  return (
    <>
      <ToyButton color="green" size="sm" className="py-1.5" onClick={install} aria-label="Install GameHub as an app">
        📲 Install app
      </ToyButton>
      {showSteps && createPortal(
        <div
          className="fixed inset-0 z-50 bg-ink/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowSteps(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-steps-title"
            className="w-full max-w-sm chunk bg-white text-ink p-5 animate-pop"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="install-steps-title" className="text-xl font-bold mb-3">Install GameHub 📲</h2>
            <ol className="list-decimal pl-5 space-y-1 font-semibold mb-4">
              <li>Tap the <b>Share</b> button in Safari&apos;s toolbar.</li>
              <li>Choose <b>Add to Home Screen</b>.</li>
              <li>Tap <b>Add</b>.</li>
            </ol>
            <ToyButton color="green" className="w-full" onClick={() => setShowSteps(false)}>
              Got it
            </ToyButton>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
```
Notes: if lint flags the `set-state-in-effect` disable as unused (because the rule does not fire there), remove it. If the rule fires on another line, move the comment so it sits directly above the reported line. `bg-ink/50` works because `--color-ink` is a Tailwind theme colour.

## Final verification
From `frontend/`: `npm ci; npx tsc --noEmit; npm run lint` (≤ 15 problems, all pre-existing); `npm run build`. From the repo root: `docker compose up -d --build`, then the curl checks and the browser checks in step 4: manifest valid and installable, worker active, offline page on offline navigation, Install app works on Chrome, iOS sheet shows, button hidden standalone/in iframe, layout fine at 375px and desktop.
