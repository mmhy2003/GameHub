# GH-67 Implementation Plan: Caddy reverse proxy

**Goal:** Serve GameHub from one origin through Caddy, with `/auth/*` and `/ws/*` going to FastAPI and everything else going to Next.js, and with no domain baked into the frontend build.

**Architecture:** A root `Caddyfile` listens on plain HTTP `:80` for any Host and proxies to `backend:8000` / `frontend:3000` on the compose network. Only the `caddy` service publishes a host port (`HTTP_PORT`, default 80). The browser reaches the backend on its own origin through a small client helper (`lib/backendUrl.ts`). Server-rendered metadata, robots and sitemap get their URL from request headers through `lib/siteUrl.ts`.

**Conventions:** There is no test runner and no CI (project convention), so each step's "failing test" is a concrete check: a grep, a `tsc` error, or a curl. The gates are `npx tsc --noEmit`, `npm run lint` (baseline 15 problems: 6 errors and 9 warnings; no new ones allowed) and `npm run build`, all run from `frontend/`. `frontend/node_modules` is not installed in a fresh checkout, so run `npm ci` in `frontend/` first. Commits use conventional commits with a scope and the issue ref. Do not commit `.megoocolab/` or any `docs/` plan or design file. Next.js 16.4.5: `headers()` from `next/headers` is **async** (`await headers()`). See `frontend/AGENTS.md`, and read `node_modules/next/dist/docs/` if in doubt.

## File map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/lib/backendUrl.ts` | create | Client-only `getBackendHttpUrl()` / `getBackendWsUrl()` |
| `frontend/src/app/page.tsx` | modify (~line 44) | Token fetch uses `getBackendHttpUrl()` |
| `frontend/src/app/room/[id]/page.tsx` | modify (~line 89) | WebSocket uses `getBackendWsUrl()` |
| `frontend/src/lib/siteUrl.ts` | create | Server-only `async getSiteUrl()` from forwarded headers |
| `frontend/src/app/layout.tsx` | modify | `generateMetadata()` replaces static `metadata` and `SITE_URL` |
| `frontend/src/app/robots.ts`, `frontend/src/app/sitemap.ts` | modify | async, use `getSiteUrl()` |
| `Caddyfile` | create (repo root) | Routing |
| `docker-compose.yml` | modify | Add `caddy`; drop backend/frontend `ports`, backend `PORT`, frontend `NEXT_PUBLIC_*` |
| `frontend/Dockerfile` | modify | Drop the `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_SITE_URL` ARG/ENV |
| `env.sample` | modify | `HTTP_PORT`; remove the old ports and site URL; comment out the backend URL |
| `README.md` | modify | Run instructions, routing, TLS note |

## Reference code

### `frontend/src/lib/backendUrl.ts`
```ts
// Where the browser reaches the backend (GH-67). Behind Caddy the backend shares the
// page's origin, so no domain is baked into the build. NEXT_PUBLIC_BACKEND_URL is an
// optional override for `npm run dev` without Caddy (e.g. http://localhost:8000).
// Client-only: call at runtime (effects, handlers), never during render.
export function getBackendHttpUrl(): string {
  const override = process.env.NEXT_PUBLIC_BACKEND_URL;
  return (override || window.location.origin).replace(/\/+$/, "");
}

// Same base with http→ws and https→wss
export function getBackendWsUrl(): string {
  return getBackendHttpUrl().replace(/^http/, "ws");
}
```

### `frontend/src/lib/siteUrl.ts`
```ts
import { headers } from "next/headers";

// Public URL of the site, worked out per request so any domain works (GH-67).
// Caddy forwards X-Forwarded-Proto/Host, keeping an upstream TLS proxy's values.
// Server-only: reading headers makes the caller render dynamically.
export async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host") || "localhost";
  return `${proto}://${host}`;
}
```

### `frontend/src/app/layout.tsx` (metadata part)
Remove `const SITE_URL = ...` and `export const metadata: Metadata = {...}`. Add `import { getSiteUrl } from "@/lib/siteUrl";` and:
```ts
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl();
  return {
    metadataBase: new URL(siteUrl),
    // ...title, description, keywords, authors, creator: unchanged...
    openGraph: {
      type: "website",
      url: siteUrl,
      // ...rest unchanged...
    },
    // ...twitter, robots: unchanged...
  };
}
```
All other fields are copied verbatim from the current object.

### `frontend/src/app/robots.ts`
```ts
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await getSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

### `frontend/src/app/sitemap.ts`
```ts
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = await getSiteUrl();
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
```

### `Caddyfile`
```
{
	servers {
		# Keep X-Forwarded-Proto/Host from a TLS proxy on a private network (e.g. Coolify's Traefik)
		trusted_proxies static private_ranges
	}
}

# Plain HTTP for any Host; TLS is terminated by a proxy in front (GH-67)
:80 {
	# Backend routes. Any new backend route needs a matcher here.
	@backend path /auth/* /ws/*
	handle @backend {
		reverse_proxy backend:8000
	}
	handle {
		reverse_proxy frontend:3000
	}
}
```

### `docker-compose.yml`
```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "${HTTP_PORT:-80}:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file:
      - .env
    environment:
      - JWT_SECRET=${JWT_SECRET:-changeme-use-a-real-secret-in-production}

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED:-1}
    env_file:
      - .env
    environment:
      - NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED:-1}
    depends_on:
      - backend
```

### `frontend/Dockerfile` (middle section after the change)
```dockerfile
# Accept build-time variables from docker-compose (args)
ARG NEXT_TELEMETRY_DISABLED=1

ENV NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED
```

### `env.sample`
```
# ─── Caddy (single entry point) ────────────────────────────────────────────────

# Host port Caddy listens on (plain HTTP). /auth/* and /ws/* go to the backend,
# everything else to the frontend. Put a TLS proxy in front for HTTPS.
HTTP_PORT=80

# ─── Frontend ────────────────────────────────────────────────────────────────

# Only for local `npm run dev` without Caddy: where the browser reaches the backend.
# Leave unset with Docker Compose — the browser uses the page's own origin.
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Disable Next.js anonymous telemetry (1 = disabled)
NEXT_TELEMETRY_DISABLED=1

# ─── Security ─────────────────────────────────────────────────────────────────
(JWT_SECRET block unchanged)
```

## Steps

### 1. Frontend: reach the backend on the page's own origin
- Create `frontend/src/lib/backendUrl.ts` exactly as in the reference code.
- `frontend/src/app/page.tsx`: delete `const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000");` (~line 44). In `fetchToken`, use ``fetch(`${getBackendHttpUrl()}/auth/token`, ...)``. Add `import { getBackendHttpUrl } from "@/lib/backendUrl";`. The call must stay inside `fetchToken` (runtime), not at component render, because `window` does not exist during SSR.
- `frontend/src/app/room/[id]/page.tsx` (~lines 89-90): replace the `backendUrl` and `wsUrl` lines with ``const wsUrl = `${getBackendWsUrl()}/ws/${gameType}/${roomId}?token=${encodeURIComponent(token)}`;``. Add the import.
- Failing check first: `grep -rn 'localhost:8000' frontend/src` currently finds 2 hits, and must find 0 after the change.
- Verify from `frontend/`: `npm ci`, `npx tsc --noEmit` (clean), `npm run lint` (≤15 problems, none in the touched files), `npm run build` (green).
- Commit: `feat(ui): call the backend on the page's own origin (GH-67)`

### 2. Frontend: work out the site URL per request
- Create `frontend/src/lib/siteUrl.ts`. Rewrite the metadata in `layout.tsx` as `generateMetadata()`, and make `robots.ts` / `sitemap.ts` async, all per the reference code.
- Failing check first: `grep -rn 'NEXT_PUBLIC_SITE_URL\|gamehub.example.com' frontend/src` currently finds 4 hits, and must find 0 after the change.
- Verify: `npx tsc --noEmit`, `npm run lint` (no new problems), `npm run build`. In the build output, `/robots.txt` and `/sitemap.xml` (and pages under the root layout) now show as dynamic (ƒ), which is accepted. Then check with `npm start` (port 3000): `curl -s -H 'Host: game.test' -H 'X-Forwarded-Proto: https' localhost:3000/robots.txt` must contain `Sitemap: https://game.test/sitemap.xml`. `curl -s -H 'X-Forwarded-Host: game.test' -H 'X-Forwarded-Proto: https,http' localhost:3000/ | grep -o 'og:url[^>]*'` must show `https://game.test`.
- Commit: `feat(seo): derive the site URL from the request (GH-67)`

### 3. Add Caddy as the single entry point in Docker Compose
- Create `Caddyfile`. Rewrite `docker-compose.yml`, `frontend/Dockerfile` and `env.sample` per the reference code.
- Failing check first: `curl -i localhost/auth/token` fails (nothing on :80) before the change.
- Verify (needs a `.env`: `cp env.sample .env` if missing, and make sure no `frontend/.env*.local` sets `NEXT_PUBLIC_BACKEND_URL`, because it would be copied into the build):
  - `docker compose config` is valid.
  - `docker compose up -d --build`, then `docker compose ps`: only `caddy` shows a published port (`0.0.0.0:80->80`).
  - `curl -i localhost/` returns Next.js HTML.
  - `curl -i -X POST localhost/auth/token -H 'Content-Type: application/json' -d '{"username":"a"}'` returns 200 with a token.
  - `curl -s localhost/robots.txt -H 'Host: game.test' -H 'X-Forwarded-Proto: https'` and the same for `/sitemap.xml` return URLs on `https://game.test`.
  - Browser at `http://localhost`: two tabs, same room, the WebSocket connects (DevTools shows `ws://localhost/ws/...`), and a game plus chat work.
  - `HTTP_PORT=8080 docker compose up -d` serves on `localhost:8080`. Then `docker compose down`.
- Commit: `feat(infra): route all traffic through a Caddy reverse proxy (GH-67)`

### 4. README: document Caddy routing and TLS
- "Run locally": `cp env.sample .env` and `docker compose up -d --build`, then open http://localhost (or `http://localhost:<HTTP_PORT>`).
- New "Reverse proxy (Caddy)" subsection: `/auth/*` and `/ws/*` go to the backend and everything else to the frontend. Only Caddy publishes a port. New backend routes need a matcher in `Caddyfile`. Caddy serves plain HTTP for any domain, so put a TLS proxy (Coolify, Cloudflare, ...) in front. The WebSocket then uses `wss:` automatically. Caveat: Caddy trusts `X-Forwarded-Proto` only from private-network proxies. A proxy that reaches the server over a public IP (e.g. Cloudflare directly) makes SEO/OpenGraph URLs show `http://`. App function is unaffected.
- Dev without Docker: set `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` in `frontend/.env.local` for `npm run dev`.
- Project structure tree: add `Caddyfile`.
- Verify: `grep -n '3000' README.md` shows no stale "open localhost:3000" instruction.
- Commit: `docs: document the Caddy entry point (GH-67)`

## Final verification
From `frontend/`: `npm ci; npx tsc --noEmit; npm run lint; npm run build` (lint at most 15 problems). From the repo root: `docker compose config`, `docker compose up -d --build`, `docker compose ps` (only Caddy has a port), the curl checks from step 3, a two-tab browser game plus chat at http://localhost, and the `HTTP_PORT=8080` check.
