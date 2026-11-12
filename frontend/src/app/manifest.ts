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
