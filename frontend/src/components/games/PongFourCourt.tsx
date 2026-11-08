"use client";
import { SEATS, type Seat } from "@/lib/pongFour";

export const TRAIL_LEN = 5;
const WALL = 10; // wall strip thickness, in court units
const CENTRE_R = 60;

type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };

export interface CourtSize {
  field: number;
  corner: number;
  paddleLen: number;
  paddleW: number;
  inset: number;
  ballR: number;
}

interface PongFourCourtProps {
  size: CourtSize;
  scale: number;
  paddles: Record<Seat, number>;
  alive: Record<Seat, boolean>;
  showWalls: boolean;
  ball: Point;
  trail: Point[];
  squish: boolean;
  countdown: string | null;
  banner: string | null;
}

const PADDLE_COLOR: Record<Seat, string> = {
  B: "bg-candy-blue", T: "bg-candy-pink", L: "bg-candy-purple", R: "bg-candy-orange",
};

export default function PongFourCourt({
  size, scale: s, paddles, alive, showWalls, ball, trail, squish, countdown, banner,
}: PongFourCourtProps) {
  const { field, corner, paddleLen: len, paddleW: w, inset, ballR } = size;

  // Rectangles in court units
  const paddleRect = (seat: Seat, p: number): Rect => {
    const along = p - len / 2;
    if (seat === "B") return { left: along, top: field - inset - w, width: len, height: w };
    if (seat === "T") return { left: along, top: inset, width: len, height: w };
    if (seat === "L") return { left: inset, top: along, width: w, height: len };
    return { left: field - inset - w, top: along, width: w, height: len };
  };
  const wallRect = (seat: Seat): Rect => {
    const span = field - 2 * corner;
    if (seat === "B") return { left: corner, top: field - WALL, width: span, height: WALL };
    if (seat === "T") return { left: corner, top: 0, width: span, height: WALL };
    if (seat === "L") return { left: 0, top: corner, width: WALL, height: span };
    return { left: field - WALL, top: corner, width: WALL, height: span };
  };
  const scaled = (r: Rect): Rect => ({
    left: r.left * s, top: r.top * s, width: r.width * s, height: r.height * s,
  });
  const ballSize = ballR * 2 * s;

  return (
    <div
      className="relative chunk overflow-hidden"
      style={{
        width: field * s, height: field * s, boxSizing: "content-box",
        backgroundImage: "repeating-linear-gradient(90deg, #3ddc84 0 10%, #34c975 10% 20%)",
      }}
    >
      {/* Centre circle */}
      <div className="absolute rounded-full border-[3px] border-dashed border-white/80"
        style={scaled({ left: field / 2 - CENTRE_R, top: field / 2 - CENTRE_R, width: CENTRE_R * 2, height: CENTRE_R * 2 })} />

      {/* Corner blocks */}
      {[[0, 0], [field - corner, 0], [0, field - corner], [field - corner, field - corner]].map(([left, top]) => (
        <div key={`${left},${top}`} className="absolute bg-cream border-2 border-ink"
          style={scaled({ left, top, width: corner, height: corner })} />
      ))}

      {/* Walls on sides with no live player */}
      {showWalls && SEATS.filter(seat => !alive[seat]).map(seat => (
        <div key={`wall-${seat}`} aria-hidden="true" className="absolute border-2 border-ink"
          style={{ ...scaled(wallRect(seat)), backgroundImage: "repeating-linear-gradient(45deg, #8d86a3 0 8px, #d6d1e3 8px 16px)" }} />
      ))}

      {/* Paddles — min 8px thick so they stay visible on small screens */}
      {SEATS.filter(seat => alive[seat]).map(seat => {
        const r = scaled(paddleRect(seat, paddles[seat]));
        const vertical = seat === "L" || seat === "R";
        return (
          <div key={`paddle-${seat}`} className={`absolute rounded-full border-2 border-ink ${PADDLE_COLOR[seat]}`}
            style={vertical ? { ...r, width: Math.max(r.width, 8) } : { ...r, height: Math.max(r.height, 8) }} />
        );
      })}

      {/* Ball trail: oldest is faintest */}
      {trail.map((p, i) => (
        <div key={i} aria-hidden="true" className="absolute rounded-full bg-candy-yellow"
          style={{
            left: (p.x - ballR) * s, top: (p.y - ballR) * s, width: ballSize, height: ballSize,
            opacity: 0.1 + (0.3 * (i + TRAIL_LEN - trail.length)) / (TRAIL_LEN - 1),
          }} />
      ))}

      {/* Ball */}
      <div className="absolute rounded-full bg-candy-yellow border-2 border-ink transition-transform duration-75"
        style={{
          left: (ball.x - ballR) * s, top: (ball.y - ballR) * s, width: ballSize, height: ballSize,
          transform: squish ? "scale(0.8,1.2)" : "none",
        }} />

      {/* Countdown */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={countdown} className="chunk bg-white text-ink font-black text-5xl sm:text-7xl px-6 py-2 animate-pop">
            {countdown}
          </div>
        </div>
      )}

      {/* Banner (e.g. a knockout) */}
      {banner !== null && countdown === null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-live="polite">
          <div key={banner} className="chunk bg-white text-ink font-black text-xl sm:text-3xl px-5 py-2 animate-pop text-center max-w-[80%]">
            {banner}
          </div>
        </div>
      )}
    </div>
  );
}
