type Point = { x: number; y: number };

interface SnakesBoardArtProps {
  snakes: Record<string, number>;
  ladders: Record<string, number>;
  cellCenter: (cell: number) => Point;
}

const SNAKE_COLORS = [
  { stroke: "stroke-candy-green", fill: "fill-candy-green" },
  { stroke: "stroke-candy-pink", fill: "fill-candy-pink" },
  { stroke: "stroke-candy-purple", fill: "fill-candy-purple" },
  { stroke: "stroke-candy-orange", fill: "fill-candy-orange" },
  { stroke: "stroke-candy-red", fill: "fill-candy-red" },
  { stroke: "stroke-candy-blue", fill: "fill-candy-blue" },
] as const;

const LADDER_BROWN = "#b07a44";
const SEGMENTS = 16;
const BODY_WIDTH = 3.2;

/** Point at t on the cubic Bezier p0 → p3. */
function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function Snake({ head, tail, color, flip }: { head: Point; tail: Point; color: (typeof SNAKE_COLORS)[number]; flip: boolean }) {
  const dx = tail.x - head.x, dy = tail.y - head.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular bend, so each body is an S-curve
  const bend = Math.min(9, len * 0.28) * (flip ? -1 : 1);
  const px = (-dy / len) * bend, py = (dx / len) * bend;
  const c1 = { x: head.x + dx / 3 + px, y: head.y + dy / 3 + py };
  const c2 = { x: head.x + (2 * dx) / 3 - px, y: head.y + (2 * dy) / 3 - py };
  const pts = Array.from({ length: SEGMENTS + 1 }, (_, i) => bezier(head, c1, c2, tail, i / SEGMENTS));
  // Taper from full width at the head to a thin tail
  const width = (i: number) => BODY_WIDTH * (1 - (0.75 * i) / SEGMENTS);
  const segment = (i: number, extra: number, cls: string) => (
    <line
      key={i}
      x1={pts[i].x} y1={pts[i].y} x2={pts[i + 1].x} y2={pts[i + 1].y}
      strokeWidth={width(i) + extra}
      strokeLinecap="round"
      className={cls}
    />
  );
  const segs = Array.from({ length: SEGMENTS }, (_, i) => i);
  // Eyes sit across the body direction, a little behind the snout
  const ex = (-dy / len) * 1.1, ey = (dx / len) * 1.1;
  return (
    <g>
      {segs.map(i => segment(i, 1.2, "stroke-ink"))}
      {segs.map(i => segment(i, 0, color.stroke))}
      <circle cx={head.x} cy={head.y} r={2.6} strokeWidth={0.6} className={`${color.fill} stroke-ink`} />
      {[1, -1].map(s => (
        <g key={s}>
          <circle cx={head.x + s * ex} cy={head.y + s * ey - 0.5} r={0.85} className="fill-white stroke-ink" strokeWidth={0.3} />
          <circle cx={head.x + s * ex} cy={head.y + s * ey - 0.4} r={0.4} className="fill-ink" />
        </g>
      ))}
    </g>
  );
}

function Ladder({ bottom, top }: { bottom: Point; top: Point }) {
  const dx = top.x - bottom.x, dy = top.y - bottom.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 1.8, oy = (dx / len) * 1.8;
  const rungs = Math.max(2, Math.round(len / 6));
  // Ink outlines go underneath (class), brown wood on top (stroke attribute)
  const rail = (s: number, w: number, ink: boolean) => (
    <line
      key={`${s}${ink}`}
      x1={bottom.x + s * ox} y1={bottom.y + s * oy} x2={top.x + s * ox} y2={top.y + s * oy}
      stroke={ink ? undefined : LADDER_BROWN} className={ink ? "stroke-ink" : undefined}
      strokeWidth={w} strokeLinecap="round"
    />
  );
  const rung = (i: number, w: number, ink: boolean) => {
    const t = (i + 0.5) / rungs;
    const cx = bottom.x + dx * t, cy = bottom.y + dy * t;
    return (
      <line
        key={`r${i}${ink}`}
        x1={cx - ox} y1={cy - oy} x2={cx + ox} y2={cy + oy}
        stroke={ink ? undefined : LADDER_BROWN} className={ink ? "stroke-ink" : undefined}
        strokeWidth={w} strokeLinecap="round"
      />
    );
  };
  const steps = Array.from({ length: rungs }, (_, i) => i);
  return (
    <g>
      {steps.map(i => rung(i, 1.3, true))}
      {steps.map(i => rung(i, 0.7, false))}
      {[1, -1].map(s => rail(s, 1.6, true))}
      {[1, -1].map(s => rail(s, 0.9, false))}
    </g>
  );
}

/** Cartoon snakes and wooden ladders drawn over the 10×10 board, in the board's 0–100 percent space. */
export default function SnakesBoardArt({ snakes, ladders, cellCenter }: SnakesBoardArtProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    >
      {Object.entries(ladders).map(([bottom, top]) => (
        <Ladder key={`l${bottom}`} bottom={cellCenter(Number(bottom))} top={cellCenter(top)} />
      ))}
      {Object.entries(snakes).map(([head, tail], i) => (
        <Snake
          key={`s${head}`}
          head={cellCenter(Number(head))}
          tail={cellCenter(tail)}
          color={SNAKE_COLORS[i % SNAKE_COLORS.length]}
          flip={i % 2 === 1}
        />
      ))}
    </svg>
  );
}
