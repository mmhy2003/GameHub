"use client";
import { useSound } from "@/lib/sound";

export default function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Mute sounds" : "Unmute sounds"}
      title={enabled ? "Mute sounds" : "Unmute sounds"}
      className="btn-toy bg-white w-9 h-9 rounded-xl flex items-center justify-center text-lg leading-none"
    >
      {enabled ? "🔊" : "🔇"}
    </button>
  );
}
