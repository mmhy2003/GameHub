"use client";

export interface TetrisPiece { shape: number[][]; x: number; y: number; color: number }

// 1–7 are the seven pieces, 8 is garbage
const BLOCK_COLORS = [
  "",
  "bg-candy-blue",
  "bg-candy-yellow",
  "bg-candy-purple",
  "bg-candy-green",
  "bg-candy-red",
  "bg-candy-orange",
  "bg-candy-pink",
  "bg-slate-400",
];

const BEVEL = "shadow-[inset_3px_3px_0_rgba(255,255,255,.45),inset_-3px_-3px_0_rgba(0,0,0,.25)]";

interface TetrisWellProps {
  board: number[][];
  piece?: TetrisPiece | null;
  cellSize: string;
  dim?: boolean;
}

export default function TetrisWell({ board, piece, cellSize, dim }: TetrisWellProps) {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const cells = board.map(row => [...row]);
  if (piece) {
    piece.shape.forEach((line, r) => line.forEach((v, c) => {
      const y = piece.y + r;
      const x = piece.x + c;
      if (v !== 0 && y >= 0 && y < rows && x >= 0 && x < cols) cells[y][x] = piece.color;
    }));
  }

  return (
    <div
      className={`chunk bg-ink/90 p-1 grid gap-px transition-opacity ${dim ? "opacity-40" : ""}`}
      style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize})`, gridAutoRows: cellSize }}
    >
      {cells.map((row, r) => row.map((cell, c) => (
        <div
          key={`${r}-${c}`}
          className={cell !== 0 ? `rounded-[3px] ${BLOCK_COLORS[cell] ?? BLOCK_COLORS[8]} ${BEVEL}` : "rounded-[2px] bg-white/5"}
        />
      )))}
    </div>
  );
}
