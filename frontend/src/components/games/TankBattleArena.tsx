"use client";
import { SEATS, SEAT_INFO, type Burst, type Seat, type ShellView, type TankView } from "@/lib/tankBattle";

const INK = "#2b2240";
const STEEL = "#8d86a3";
const BLINK_CSS = "@keyframes tank-blink { 50% { opacity: 0.25; } }";

export interface ArenaSize { field: number; tile: number; tankR: number; shellR: number }

interface TankBattleArenaProps {
  size: ArenaSize;
  scale: number;
  map: string[];
  tanks: Partial<Record<Seat, TankView>>;
  shells: ShellView[];
  bursts: Burst[];
  mySeat: Seat | null;
  countdown: string | null;
  banner: string | null;
}

export default function TankBattleArena({
  size, scale: s, map, tanks, shells, bursts, mySeat, countdown, banner,
}: TankBattleArenaProps) {
  const { field, tile, tankR, shellR } = size;
  const k = tankR / 15; // the tank drawing is made for radius 15
  const me = mySeat ? tanks[mySeat] : undefined;
  const tagBelow = !!me && me.y - tankR - 6 < 12;

  return (
    <div className="relative chunk overflow-hidden" style={{ width: field * s, height: field * s, boxSizing: "content-box" }}>
      <svg viewBox={`0 0 ${field} ${field}`} width={field * s} height={field * s} className="block" aria-hidden="true">
        <defs><style>{BLINK_CSS}</style></defs>
        <rect width={field} height={field} fill="#f4dca8" />

        {/* Steel blocks and crates */}
        {map.flatMap((row, r) => [...row].map((cell, c) => {
          const x = c * tile, y = r * tile;
          if (cell === "S") return (
            <g key={`${r},${c}`}>
              <rect x={x + 1} y={y + 1} width={tile - 2} height={tile - 2} rx={4} fill={STEEL} stroke={INK} strokeWidth={2} />
              <rect x={x + 7} y={y + 7} width={tile - 14} height={6} rx={2} fill="#d6d1e3" />
            </g>
          );
          if (cell === "C") return (
            <g key={`${r},${c}`}>
              <rect x={x + 2} y={y + 2} width={tile - 4} height={tile - 4} rx={3} fill="#c98a4b" stroke={INK} strokeWidth={2} />
              <path d={`M${x + 8} ${y + 8}L${x + tile - 8} ${y + tile - 8}M${x + tile - 8} ${y + 8}L${x + 8} ${y + tile - 8}`}
                stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
            </g>
          );
          return null;
        }))}

        {/* Tanks: treads, body, barrel, turret; wrecks are grey; a hit tank blinks */}
        {SEATS.map(seat => {
          const t = tanks[seat];
          if (!t) return null;
          const fill = t.alive ? SEAT_INFO[seat].hex : STEEL;
          return (
            <g key={seat} transform={`translate(${t.x} ${t.y}) rotate(${t.angle}) scale(${k})`}
              opacity={t.alive ? 1 : 0.85}
              style={t.blink ? { animation: "tank-blink 0.2s steps(1) infinite" } : undefined}>
              <rect x={-15} y={-15} width={30} height={7} rx={2} fill={INK} />
              <rect x={-15} y={8} width={30} height={7} rx={2} fill={INK} />
              <rect x={-12} y={-10} width={24} height={20} rx={4} fill={fill} stroke={INK} strokeWidth={2} />
              <rect x={0} y={-3} width={21} height={6} rx={2} fill={INK} />
              <circle r={7} fill={fill} stroke={INK} strokeWidth={2} />
            </g>
          );
        })}

        {/* Shells, ringed in the owner's colour */}
        {shells.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={shellR} fill={INK} stroke={SEAT_INFO[b.owner]?.hex ?? INK} strokeWidth={2} />
        ))}

        {/* "▼ you" over your own tank (below it near the top edge) */}
        {me?.alive && (
          <text x={me.x} y={tagBelow ? me.y + tankR + 16 : me.y - tankR - 6} textAnchor="middle"
            fontSize={12} fontWeight={900} fill={INK}>{tagBelow ? "▲ you" : "▼ you"}</text>
        )}
      </svg>

      {/* 💥 bursts (HTML so animate-pop scales around the centre) */}
      {bursts.map(b => (
        <div key={b.id} aria-hidden="true" className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: b.x * s, top: b.y * s }}>
          <div className="animate-pop text-2xl sm:text-3xl">💥</div>
        </div>
      ))}

      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={countdown} className="chunk bg-white text-ink font-black text-5xl sm:text-7xl px-6 py-2 animate-pop">{countdown}</div>
        </div>
      )}
      {banner !== null && countdown === null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={banner} className="chunk bg-white text-ink font-black text-xl sm:text-3xl px-5 py-2 animate-pop text-center max-w-[80%]">{banner}</div>
        </div>
      )}
    </div>
  );
}
