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
