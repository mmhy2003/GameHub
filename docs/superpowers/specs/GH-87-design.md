# GH-87 — PWA support

## Goal
GameHub can be installed on phones as an app: it opens full-screen from the home screen with its own icon. An **Install app** button on the home page makes this easy to find. When the installed app has no network, it shows an "You're offline" page instead of the browser's error page.

## Decisions
- **Scope: installable + Install app button** (your choice). Rejected: installable only (no in-app button), and asset caching (stale-cache risk after deploys, little gain for a real-time online game).
- **No offline play.** Games run over WebSockets, so the service worker never caches app pages or API/WS traffic. It only precaches the offline page and its icon.
- **No new dependency** (no next-pwa/serwist). We write a small hand-made `public/sw.js` and use Next's built-in `app/manifest.ts`, following the guide in `node_modules/next/dist/docs/` (Next 16 PWA guide).
- **Icons come from the current logo** (`src/app/icon.png`, 640×640). We add 192, 512 and maskable 512 PNGs and a 180 apple-touch-icon.

## Architecture
- `frontend/src/app/manifest.ts` (new): `name` "GameHub", `short_name` "GameHub", `start_url` "/", `scope` "/", `display` "standalone", `background_color` `#fff8ec` (cream), `theme_color` `#8b5cf6` (header purple), and the icons. The manifest uses relative URLs, so it works on any host (this follows GH-67: no domain baked in at build time).
- `frontend/public/icons/` (new): `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (logo with safe padding on cream), `apple-touch-icon.png` (180).
- `frontend/public/sw.js` (new, about 40 lines):
  - `install`: precache `/offline.html` and the 192 icon; `skipWaiting()`.
  - `activate`: delete old caches by version name; `clients.claim()`.
  - `fetch`: only for **navigation** requests: try the network, and on failure return the cached `/offline.html`. Every other request goes straight to the network.
- `frontend/public/offline.html` (new): a static page styled like the app (cream background, chunky card, 📡 "You're offline", **Try again** button that reloads). It is static so it doesn't depend on Next chunks.
- `frontend/src/components/PwaRegister.tsx` (new, client component, renders nothing): registers `/sw.js` in production when `serviceWorker` is supported. Mounted once in `app/layout.tsx`, next to `GameBtnGuard`.
- `frontend/src/components/InstallAppButton.tsx` (new, client component): placed in the home page header row next to "Playing as …" (`src/app/page.tsx`), using the existing `btn-toy` styling in green.
  - Listens for `beforeinstallprompt` (Android/desktop Chrome/Edge), stores the event, and on click calls `prompt()`.
  - On iOS Safari (no such event) it shows a small sheet with "Share → Add to Home Screen → Add" and a **Got it** button.
  - Hidden when the app is already running standalone (`display-mode: standalone` or `navigator.standalone`), after `appinstalled`, inside an iframe (the site allows embedding), and on browsers that support neither path.
- `app/layout.tsx`: add `appleWebApp` (capable, title "GameHub", status bar style) and `icons.apple` to metadata, plus a `viewport` export with `themeColor`.
- `next.config.ts`: give `/sw.js` the headers `Cache-Control: no-cache, no-store, must-revalidate` and `Service-Worker-Allowed: /`, so deploys pick up a new worker right away.
- Caddy needs no change: `/sw.js`, `/manifest.webmanifest` and `/offline.html` already go to the frontend.

## Edge cases
- Production runs behind TLS (Coolify/Cloudflare), which service workers need. Plain `http://localhost` also works. Over plain HTTP on a LAN IP the worker won't register, and the app keeps working as it does today.
- Room links (`/room/<id>`) still open in the browser or in the installed app as the OS decides. We don't add any deep-link handling.
- A new deploy: the SW cache name gets a version string, so `activate` removes the old offline page.

## Testing
No test runner, so we use the repo's quality gates: `npx tsc --noEmit`, `npm run lint` (no new problems), `npm run build`, and `docker compose up` through Caddy. Then:
- `curl` `/manifest.webmanifest`, `/sw.js` (check the headers) and `/offline.html`.
- Chrome DevTools → Application: the manifest is valid, the worker is active, and Lighthouse "Installable" passes.
- Android Chrome: tap Install app, the native prompt appears, the app installs and opens standalone, and the button is hidden inside the app.
- iPhone Safari: the button shows the steps, Add to Home Screen shows the right icon and title.
- Offline in DevTools: navigating shows the offline page, and Try again reloads once back online.
- Check the layout at 375px and on desktop.

## Out of scope
Offline play, caching assets or pages, push notifications, background sync, and app-store packaging.