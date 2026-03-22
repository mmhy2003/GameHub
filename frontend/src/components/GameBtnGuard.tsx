"use client";
import { useEffect } from "react";

/**
 * Prevents the browser context menu from appearing when the user
 * long-presses any element that has the .game-btn class.
 * Mount this once in the root layout — no per-button onContextMenu needed.
 */
export default function GameBtnGuard() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest(".game-btn")) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  return null;
}
