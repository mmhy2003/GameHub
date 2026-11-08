export const AVATAR_COLORS = ["bg-candy-blue", "bg-candy-pink", "bg-candy-yellow", "bg-candy-green", "bg-candy-purple", "bg-candy-orange"] as const;

export function avatarColor(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export default function Avatar({ name, size = 40, className = "" }: { name: string; size?: number; className?: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden="true"
      className={`chunk-sm rounded-full! shrink-0 inline-flex items-center justify-center font-bold text-ink uppercase select-none ${avatarColor(name)} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {letter}
    </div>
  );
}
