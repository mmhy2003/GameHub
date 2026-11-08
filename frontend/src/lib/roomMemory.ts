// Remembers the last room this tab entered, so the lobby can offer it again (GH-59)
const STORAGE_KEY = "gamehub_room";

export function getSavedRoom(): string {
  try { return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? ""; } catch { return ""; }
}

export function saveRoom(id: string) {
  const trimmed = id.trim();
  if (!trimmed) return;
  try { sessionStorage.setItem(STORAGE_KEY, trimmed); } catch { /* storage blocked */ }
}

export function clearSavedRoom() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
}
