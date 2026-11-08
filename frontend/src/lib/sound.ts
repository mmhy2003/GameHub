"use client";
import { useEffect, useSyncExternalStore } from "react";

export type SoundName = "click" | "place" | "drop" | "hit" | "miss" | "pop" | "dice" | "turn" | "win" | "lose" | "fire";
const STORAGE_KEY = "gamehub_sound";
type Note = { freq: number; to?: number; at: number; dur: number; type?: OscillatorType; gain?: number };
const tones = (freqs: number[], step: number, dur: number, type: OscillatorType): Note[] =>
  freqs.map((freq, i) => ({ freq, at: i * step, dur, type }));
const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ freq: 660, at: 0, dur: 0.05, type: "square", gain: 0.06 }],
  place: [{ freq: 520, to: 780, at: 0, dur: 0.09, type: "triangle" }],
  drop:  [{ freq: 700, to: 180, at: 0, dur: 0.18 }, { freq: 140, at: 0.17, dur: 0.06, type: "square", gain: 0.08 }],
  hit:   [{ freq: 160, to: 60, at: 0, dur: 0.25, type: "sawtooth", gain: 0.12 }],
  miss:  [{ freq: 900, to: 300, at: 0, dur: 0.2, gain: 0.08 }],
  pop:   [{ freq: 1200, to: 200, at: 0, dur: 0.08, type: "square", gain: 0.1 }],
  dice:  tones([300, 420, 360, 480], 0.06, 0.04, "square"),
  turn:  tones([880, 1320], 0.1, 0.14, "sine"),
  win:   tones([523, 659, 784, 1047], 0.11, 0.16, "triangle"),
  lose:  tones([392, 330, 262], 0.16, 0.22, "sine"),
  fire:  [{ freq: 240, to: 90, at: 0, dur: 0.12, type: "square", gain: 0.07 }],
};

let ctx: AudioContext | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();

export function isSoundEnabled(): boolean {
  if (enabled === null) {
    try { enabled = localStorage.getItem(STORAGE_KEY) !== "off"; } catch { enabled = true; }
  }
  return enabled;
}
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try { localStorage.setItem(STORAGE_KEY, on ? "on" : "off"); } catch { /* storage blocked */ }
  listeners.forEach(l => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

export function play(name: SoundName) {
  if (!isSoundEnabled()) return;
  unlockAudio();
  if (!ctx || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime;
    for (const n of SOUNDS[name]) {
      const t = now + n.at;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type ?? "sine";
      osc.frequency.setValueAtTime(n.freq, t);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(n.gain ?? 0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + n.dur + 0.02);
    }
  } catch { /* never throw from sound */ }
}

export function useSound() {
  const on = useSyncExternalStore(subscribe, isSoundEnabled, () => true);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  return { enabled: on, toggle: () => setSoundEnabled(!on), play };
}
