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
