"use client";
import type React from "react";
import { play } from "@/lib/sound";

export type ToyColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange" | "white";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: ToyColor; size?: "sm" | "md" | "lg" };

const COLOR_CLASSES: Record<ToyColor, string> = {
  yellow: "bg-candy-yellow",
  pink: "bg-candy-pink",
  blue: "bg-candy-blue",
  green: "bg-candy-green",
  purple: "bg-candy-purple",
  orange: "bg-candy-orange",
  white: "bg-white",
};
const SIZE_CLASSES = {
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
} as const;

export default function ToyButton({ color = "yellow", size = "md", className = "", onClick, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      {...rest}
      onClick={e => { play("click"); onClick?.(e); }}
      className={`btn-toy font-bold text-ink rounded-xl inline-flex items-center justify-center gap-2 ${COLOR_CLASSES[color]} ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
