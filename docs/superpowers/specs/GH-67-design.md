# GH-67: Add a Caddy reverse proxy to Docker Compose

## Goal
GameHub is served from a single origin through Caddy. Backend paths (`/auth/*`, `/ws/*`) go to FastAPI and everything else goes to Next.js. The same images work on any domain: no domain or backend URL is baked in at frontend build time.

## Decisions
- **Routing by the backend's real paths** (human's choice). Caddy matches `/auth/*` and `/ws/*` and sends them to `backend:8000`. Everything else goes to `frontend:3000`. Rejected: an `/api` prefix, either stripped by Caddy or added in FastAPI. Backend code is unchanged. The backend's `GET /` health route stays internal-only, because `/` belongs to the frontend.
- **Domain-agnostic frontend** (human's choice). The browser reaches the backend on the page's own origin: `window.location.origin` for HTTP, and `ws:`/`wss:` derived from `location.protocol` for the WebSocket. `NEXT_PUBLIC_BACKEND_URL` remains only as an *optional* override for `npm run dev` without Caddy. It is no longer passed as a compose build arg.
- **Plain HTTP on `:80` for any Host** (human's choice). TLS is terminated in front of Caddy, for example by Coolify's proxy or Cloudflare. Rejected: automatic HTTPS with a runtime `DOMAIN`, and on-demand TLS.
- **Site URL per request** (human's choice). `NEXT_PUBLIC_SITE_URL` is removed. The metadata base, OpenGraph URL, robots and sitemap are built from the request's forwarded headers.
- **Only Caddy publishes a host port**, set by `HTTP_PORT` (default `80`) (human's choice). Backend and frontend are reachable only inside the compose network.

## Architecture
**`Caddyfile`** (new, repo root):
```
{
	servers {
		trusted_proxies static private_ranges
	}
}

:80 {
	@backend path /auth/* /ws/*
	handle @backend {
		reverse_proxy backend:8000
	}
	handle {
		reverse_proxy frontend:3000
	}
}
```
`reverse_proxy` upgrades WebSocket connections automatically and keeps the original `Host`. `trusted_proxies private_ranges` makes Caddy keep the `X-Forwarded-Proto: https` set by an upstream proxy on a private network, such as Coolify's Traefik, instead of overwriting it with `http`.

**`docker-compose.yml`**:
- New `caddy` service: `image: caddy:2-alpine`, `ports: "${HTTP_PORT:-80}:80"`, mounts `./Caddyfile:/etc/caddy/Caddyfile:ro`, `depends_on: [backend, frontend]`, `restart: unless-stopped`.
- `backend`: drop `ports` and the unused `PORT` env. The backend never reads `PORT`; its Dockerfile hard-codes 8000.
- `frontend`: drop `ports`, and drop `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_SITE_URL` from build args and env. Keep `NEXT_TELEMETRY_DISABLED`.

**`frontend/Dockerfile`**: remove the `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_SITE_URL` `ARG`/`ENV` lines.

**Frontend code**:
- New `frontend/src/lib/backendUrl.ts`, client-only:
  - `getBackendHttpUrl()` returns `process.env.NEXT_PUBLIC_BACKEND_URL` if set, else `window.location.origin`.
  - `getBackendWsUrl()` returns the same base with `http`→`ws` / `https`→`wss`.
- `frontend/src/app/page.tsx:44` (token fetch) and `frontend/src/app/room/[id]/page.tsx:89` (WebSocket) use these helpers. Both are already `"use client"` and call them only at runtime.
- New `frontend/src/lib/siteUrl.ts`, server-only:
  - `async getSiteUrl()` reads `headers()`.
  - Protocol is the first value of `x-forwarded-proto`, else `http`.
  - Host is `x-forwarded-host`, else `host`, else `localhost`.
- `frontend/src/app/layout.tsx`: replace the static `metadata` and `SITE_URL` constant with `generateMetadata()`, which uses `getSiteUrl()` for `metadataBase`, `openGraph.url` and every other `SITE_URL` use.
- `robots.ts` and `sitemap.ts` become `async` and use `getSiteUrl()`. These routes become dynamic, which is accepted.

**`env.sample`**:
- Add `HTTP_PORT=80`.
- Remove `BACKEND_PORT`, `FRONTEND_PORT` and `NEXT_PUBLIC_SITE_URL`.
- Keep `NEXT_PUBLIC_BACKEND_URL` commented out, documented as "only for local `npm run dev` without Caddy".

**`README.md`**: "Run locally" opens `http://localhost` (or `:HTTP_PORT`). Add a short note on the Caddy routing and putting a TLS proxy in front.

## Edge cases
- HTTPS behind a proxy: the page is on `https:`, so the WebSocket uses `wss:`, and the proxy forwards it to Caddy over HTTP.
- An upstream proxy that is not on a private network (for example, Cloudflare hitting the server's public IP directly): Caddy rewrites `X-Forwarded-Proto` to `http`. That affects only SEO/OG URLs, not app function. This is documented in the README.
- A multi-value `x-forwarded-proto` (`https,http`) takes the first value.
- Any future backend route needs a matching matcher in the Caddyfile. A comment in the Caddyfile says so.

## Testing
No test runner (project convention). Verify:
- `docker compose config` is valid.
- `docker compose up -d --build`, then:
  - `curl -i localhost/` → Next.js HTML
  - `curl -i -X POST localhost/auth/token -H 'Content-Type: application/json' -d '{"username":"a"}'` → token
  - `curl -i localhost/robots.txt` and `/sitemap.xml` with `-H 'Host: game.test' -H 'X-Forwarded-Proto: https'` → URLs on `https://game.test`
- Browser at `http://localhost`: create a room in two tabs, check that the WebSocket connects and a game plus chat work. Check that `HTTP_PORT=8080` moves the port.
- `npx tsc --noEmit`, `npm run lint` (no new problems over the 15-problem baseline) and `npm run build` from `frontend/`.
- Check that `docker compose ps` shows only Caddy publishing a port.

## Out of scope
- TLS in Caddy, and a separate production compose file.
- Changing backend routes or CORS.
- Deploying to the Coolify server.
