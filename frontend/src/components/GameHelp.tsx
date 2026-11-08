"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Target, BookOpen, Lightbulb } from "lucide-react";
import { GAME_RULES } from "@/data/gameRules";
import ToyButton from "@/components/ui/ToyButton";

interface GameHelpProps {
  gameType: string;
}

export default function GameHelp({ gameType }: GameHelpProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rules = GAME_RULES[gameType];

  // Portal requires document to be available (client-side only)
  useEffect(() => { setMounted(true); }, []);

  if (!rules) return null;

  const modal = mounted && open ? createPortal(
    <div
      className="fixed inset-0 bg-ink/40 z-[200] overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-help-title"
          className="chunk bg-cream text-ink w-full max-w-md flex flex-col overflow-hidden animate-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-candy-purple text-white border-b-[3px] border-ink">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{rules.icon}</span>
              <div>
                <h2 id="game-help-title" className="text-lg font-bold">{rules.title}</h2>
                <p className="text-xs text-white/80">How to play</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="btn-toy bg-white text-ink w-8 h-8 rounded-lg flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-5 space-y-5">
            {/* Objective */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-candy-orange" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Objective</h3>
              </div>
              <p className="text-sm text-ink/80 leading-relaxed">{rules.objective}</p>
            </div>

            {/* Rules */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-candy-purple" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Rules</h3>
              </div>
              <ol className="space-y-2">
                {rules.rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink/80 leading-relaxed">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-candy-yellow border-2 border-ink text-ink text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{rule}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            {rules.tips && rules.tips.length > 0 && (
              <div className="bg-candy-green/20 border-2 border-ink rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-ink" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Tips</h3>
                </div>
                <ul className="space-y-1.5 list-disc pl-5">
                  {rules.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-ink/80 leading-relaxed">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t-[3px] border-ink">
            <ToyButton color="green" className="w-full" onClick={() => setOpen(false)}>
              Got it!
            </ToyButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How to play"
        title="How to play"
        className="btn-toy bg-white text-ink w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold leading-none"
      >
        ?
      </button>

      {modal}
    </>
  );
}
