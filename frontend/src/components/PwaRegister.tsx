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
