"use client";
import { useSyncExternalStore } from "react";

// Chrome/Edge install event; not in TypeScript's DOM types
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Chrome fires beforeinstallprompt once per page load, often before the
// Install button mounts (e.g. while the name form shows), so keep it app-wide (GH-87)
let promptEvent: BeforeInstallPromptEvent | null = null;
let capturing = false;
const listeners = new Set<() => void>();

function setPromptEvent(e: BeforeInstallPromptEvent | null) {
  promptEvent = e;
  listeners.forEach(l => l());
}

/** Starts listening for the install event. Call once, as early as possible (PwaRegister). */
export function captureInstallPrompt() {
  if (capturing) return;
  capturing = true;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); // no mini-infobar; our button offers the install
    setPromptEvent(e as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => setPromptEvent(null));
}

/** A prompt event works only once; Chrome fires a new one if install is still possible. */
export function clearInstallPrompt() {
  setPromptEvent(null);
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const getPromptEvent = () => promptEvent;

export function useInstallPrompt(): BeforeInstallPromptEvent | null {
  return useSyncExternalStore(subscribe, getPromptEvent, () => null);
}
