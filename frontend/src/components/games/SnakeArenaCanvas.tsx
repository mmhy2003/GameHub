"use client";
import { useEffect, useRef } from "react";
import { SEATS, SEAT_INFO, cameraFor, clock, type Seat, type SnakeView } from "@/lib/snakeArena";

const INK = "#2b2240";
const FLOOR = "#fff6e5";
const OUTSIDE = "#ffd6d6";   // red tint past the world edge
const VIEW = 600;            // world units across the canvas
const GRID = 60;
const MINI = 110;            // minimap size in CSS px
const FOOD_COLORS = SEATS.map(s => SEAT_INFO[s].hex);

interface SnakeArenaCanvasProps {
  size: number;              // CSS px, square
  world: number;
  headR: number;
  snakes: Partial<Record<Seat, SnakeView>>;
  food: number[];            // flat [x, y, value, ...]
  names: Record<Seat, string>;
  mySeat: Seat | null;
  timeLeft: number;
  leaders: Seat[];           // longest first
  countdown: string | null;
  banner: string | null;
}

export default function SnakeArenaCanvas({
  size, world, headR, snakes, food, names, mySeat, timeLeft, leaders, countdown, banner,
}: SnakeArenaCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    const cam = cameraFor(snakes, mySeat, leaders, world);
    const k = (size / VIEW) * dpr;
    const pad = 2 * headR;
    const x0 = cam.x - VIEW / 2 - pad, x1 = cam.x + VIEW / 2 + pad;
    const y0 = cam.y - VIEW / 2 - pad, y1 = cam.y + VIEW / 2 + pad;
    const inView = (x: number, y: number) => x > x0 && x < x1 && y > y0 && y < y1;
    const dot = (x: number, y: number, r: number, fill: string) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
    };

    // Outside the world: red tint
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = OUTSIDE;
    ctx.fillRect(0, 0, px, px);

    // World space, centred on the camera
    ctx.setTransform(k, 0, 0, k, px / 2 - cam.x * k, px / 2 - cam.y * k);
    ctx.fillStyle = FLOOR;
    ctx.fillRect(0, 0, world, world);
    ctx.strokeStyle = "rgba(43, 34, 64, 0.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let g = GRID; g < world; g += GRID) {
      if (g > x0 && g < x1) { ctx.moveTo(g, Math.max(0, y0)); ctx.lineTo(g, Math.min(world, y1)); }
      if (g > y0 && g < y1) { ctx.moveTo(Math.max(0, x0), g); ctx.lineTo(Math.min(world, x1), g); }
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, world, world);

    // Pellets; the colour comes from the position so it does not flicker when others are eaten
    ctx.lineWidth = 1.5;
    for (let i = 0; i + 2 < food.length; i += 3) {
      const x = food[i], y = food[i + 1];
      if (!inView(x, y)) continue;
      dot(x, y, food[i + 2] > 1 ? 7 : 4, FOOD_COLORS[Math.abs(x * 7 + y) % FOOD_COLORS.length]);
    }

    // Snakes, yours on top: body from the tail, then the head with eyes and a name tag
    const order: Seat[] = mySeat ? [...SEATS.filter(s => s !== mySeat), mySeat] : SEATS;
    for (const seat of order) {
      const sn = snakes[seat];
      if (!sn?.alive || sn.pts.length < 2) continue;
      const p = sn.pts, hex = SEAT_INFO[seat].hex;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      if (sn.boost) { ctx.shadowColor = hex; ctx.shadowBlur = 18; }
      for (let i = p.length - 2; i >= 2; i -= 2) {
        if (inView(p[i], p[i + 1])) dot(p[i], p[i + 1], headR * 0.9, hex);
      }
      dot(p[0], p[1], headR, hex);
      ctx.shadowBlur = 0;
      const c = Math.cos(sn.angle), s = Math.sin(sn.angle);
      ctx.lineWidth = 1;
      for (const side of [-1, 1]) {
        const ex = p[0] + c * 4 - s * side * 5, ey = p[1] + s * 4 + c * side * 5;
        dot(ex, ey, 3.5, "#fff");
        ctx.beginPath(); ctx.arc(ex + c * 1.3, ey + s * 1.3, 1.8, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      }
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = INK;
      ctx.fillText(seat === mySeat ? "you" : names[seat], p[0], p[1] - headR - 8);
    }

    // Minimap (screen space): the world, your view, every snake's head
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = Math.min(MINI, size * 0.25), mx = size - m - 8, my = size - m - 8, ms = m / world;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff";
    ctx.fillRect(mx, my, m, m);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, m, m);
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + (cam.x - VIEW / 2) * ms, my + (cam.y - VIEW / 2) * ms, VIEW * ms, VIEW * ms);
    for (const seat of order) {
      const sn = snakes[seat];
      if (!sn?.alive || sn.pts.length < 2) continue;
      dot(mx + sn.pts[0] * ms, my + sn.pts[1] * ms, seat === mySeat ? 4.5 : 3, SEAT_INFO[seat].hex);
    }
  }, [size, world, headR, snakes, food, names, mySeat, leaders]);

  const me = mySeat ? snakes[mySeat] : undefined;
  return (
    <div className="relative chunk overflow-hidden" style={{ width: size, height: size, boxSizing: "content-box" }}>
      <canvas ref={ref} role="img" aria-label="Snake arena" className="block" style={{ width: size, height: size }} />

      {/* HUD: timer, the Longest board, your length */}
      <div className="absolute top-2 left-2 chunk-sm bg-white px-2 py-0.5 text-sm font-black text-ink pointer-events-none">⏱ {clock(timeLeft)}</div>
      <div className="absolute top-2 right-2 chunk-sm bg-white px-2 py-1 text-xs font-bold text-ink pointer-events-none min-w-[110px]">
        <div className="text-[11px] font-black uppercase tracking-wide text-ink/60">Longest</div>
        {leaders.slice(0, 3).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-3 text-right">{i + 1}</span>
            <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0 ${SEAT_INFO[s].color}`} />
            <span className="truncate max-w-[80px]">{s === mySeat ? "You" : names[s]}</span>
            <span className="ml-auto pl-1">{snakes[s]?.len ?? 0}</span>
          </div>
        ))}
      </div>
      {me && (
        <div className="absolute bottom-2 left-2 chunk-sm bg-white px-2 py-0.5 text-sm font-black text-ink pointer-events-none">📏 {me.len}</div>
      )}

      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={countdown} className="chunk bg-white text-ink font-black text-5xl sm:text-7xl px-6 py-2 animate-pop">{countdown}</div>
        </div>
      )}
      {banner !== null && countdown === null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div className="chunk bg-white text-ink font-black text-xl sm:text-3xl px-5 py-2 animate-pop text-center max-w-[80%]">{banner}</div>
        </div>
      )}
    </div>
  );
}
