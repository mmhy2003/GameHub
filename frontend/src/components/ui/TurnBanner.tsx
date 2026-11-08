import type React from "react";

type Tone = "mine" | "wait" | "good" | "bad" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  mine: "bg-candy-green text-ink animate-wiggle",
  wait: "bg-white text-ink",
  good: "bg-candy-yellow text-ink",
  bad: "bg-candy-red text-white",
  info: "bg-candy-blue text-white",
};

export default function TurnBanner({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div role="status" className={`inline-block rounded-full! chunk-sm px-5 py-2 font-bold text-center ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  );
}
