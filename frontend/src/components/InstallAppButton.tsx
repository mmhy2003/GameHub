"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ToyButton from "@/components/ui/ToyButton";
import { clearInstallPrompt, useInstallPrompt } from "@/lib/installPrompt";

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
  const promptEvent = useInstallPrompt(); // caught app-wide by PwaRegister
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (isStandalone() || isInIframe()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads navigator after hydration
    setMode(isIosSafari() ? "ios" : "prompt");
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
    // Clear first: a second click finds no event, and the button hides even if prompt() rejects
    clearInstallPrompt();
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // Already shown or no longer allowed; Chrome fires a new event if install is still possible
    }
  };

  if (mode === "hidden" || (mode === "prompt" && !promptEvent)) return null;

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
