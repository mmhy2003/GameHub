"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X, Target, BookOpen, Lightbulb } from "lucide-react";
import { GAME_RULES } from "@/data/gameRules";

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
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-md flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{rules.icon}</span>
              <div>
                <h2 className="text-lg font-black text-white">{rules.title}</h2>
                <p className="text-xs text-slate-500">How to play</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-white hover:bg-slate-800 rounded-full p-1.5 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-5 space-y-5">
            {/* Objective */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-amber-400" />
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Objective</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{rules.objective}</p>
            </div>

            {/* Rules */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-indigo-400" />
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Rules</h3>
              </div>
              <ul className="space-y-2">
                {rules.rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                    <span className="text-slate-600 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tips */}
            {rules.tips && rules.tips.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={14} className="text-green-400" />
                  <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest">Tips</h3>
                </div>
                <ul className="space-y-1.5">
                  {rules.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-slate-400 leading-relaxed pl-2 border-l-2 border-green-800">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
            >
              Got it!
            </button>
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
        onClick={() => setOpen(true)}
        title="How to play"
        className="flex items-center gap-1.5 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl px-2.5 py-1.5 text-xs transition-all shadow-lg backdrop-blur-sm"
      >
        <HelpCircle size={14} />
        <span>How to play</span>
      </button>

      {modal}
    </>
  );
}
