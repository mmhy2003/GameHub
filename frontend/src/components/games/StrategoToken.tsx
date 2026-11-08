// Rank labels mirror RANK_INFO in backend/games/stratego.py (0 = Flag, 11 = Bomb, 1-10 = soldiers)
export const RANK_LABELS: Record<number, { name: string; short: string }> = {
  0: { name: "Flag", short: "F" },
  11: { name: "Bomb", short: "B" },
  1: { name: "Spy", short: "Spy" },
  2: { name: "Scout", short: "Sct" },
  3: { name: "Miner", short: "Min" },
  4: { name: "Sergeant", short: "Sgt" },
  5: { name: "Lieutenant", short: "Lt" },
  6: { name: "Captain", short: "Cap" },
  7: { name: "Major", short: "Maj" },
  8: { name: "Colonel", short: "Col" },
  9: { name: "General", short: "Gen" },
  10: { name: "Marshal", short: "Mar" },
};

export function rankIcon(rank: number): string {
  if (rank === 0) return "🚩";
  if (rank === 11) return "💣";
  if (rank === 1) return "🕵️";
  if (rank === 2) return "🏃";
  if (rank === 3) return "⛏️";
  if (rank >= 4 && rank <= 6) return "🪖";
  if (rank >= 7 && rank <= 9) return "⭐";
  if (rank === 10) return "👑";
  return "❔";
}

interface StrategoTokenProps {
  owner: "A" | "B";
  rank: number;           // -1 = hidden enemy piece
  mine: boolean;
  revealed: boolean;      // the opponent has seen this piece
  selected?: boolean;
  small?: boolean;
}

export default function StrategoToken({ owner, rank, mine, revealed, selected = false, small = false }: StrategoTokenProps) {
  const hidden = rank === -1;
  const label = hidden ? "Hidden piece" : (RANK_LABELS[rank]?.name ?? `Rank ${rank}`);
  const size = small ? "w-7 h-7" : "w-[84%] aspect-square";
  // An outline, not ring-4: Tailwind rings are box-shadows and .chunk-sm's sticker shadow would hide them
  const ring = selected ? "outline-4 outline-candy-yellow -translate-y-0.5" : "";

  if (hidden) {
    return (
      <div
        aria-label={`Player ${owner}: ${label}`}
        className={`chunk-sm rounded-lg! bg-toy-stripes relative overflow-hidden shrink-0 ${size} ${ring}`}
      >
        {/* Red tint, then narrow white stripes so the back still reads as striped at token size */}
        <div className="absolute inset-0 bg-candy-red/65" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_5px,rgb(255_255_255/0.35)_5px_10px)]" />
      </div>
    );
  }

  return (
    <div
      aria-label={`Player ${owner}: ${label}`}
      title={label}
      className={`chunk-sm rounded-lg! relative flex flex-col items-center justify-center leading-none text-white shrink-0 transition-transform
        ${mine ? "bg-candy-blue" : "bg-candy-red"} ${size} ${ring}`}
    >
      <span className={small ? "text-xs" : "text-base sm:text-xl"}>{rankIcon(rank)}</span>
      <span className={`font-black ${small ? "text-[7px]" : "text-[8px] sm:text-[10px]"}`}>{RANK_LABELS[rank]?.short ?? rank}</span>
      {mine && revealed && !small && (
        <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-white rounded-full border border-ink leading-none p-px" title="Seen by the enemy">👁️</span>
      )}
    </div>
  );
}
