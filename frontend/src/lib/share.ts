// Room-code and link-sharing helpers for the lobby and the room header (GH-80)

// Same 6-character generator the lobby used inline before
export function randomRoomCode(): string {
  return Math.random().toString(36).substring(2, 8);
}

// Clipboard can be missing (http origin) or blocked (iframe permissions); never throws
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

// Web Share sheet when available (mobile), otherwise copy the link
export async function shareLink(url: string, text: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "GameHub", text, url });
      return "shared";
    } catch (err) {
      // User closed the sheet: do nothing, no fallback copy
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Any other share error falls through to copying
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
