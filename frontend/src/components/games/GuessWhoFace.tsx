"use client";
import { useId } from "react";

// ─── Character Data (mirrors backend) ────────────────────────────────────────
export const CHARACTERS = [
  { id:  0, name: "Alex",   gender: "male",   hair_color: "brown", hair_style: "short",  skin: "light",  eyes: "brown", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  1, name: "Emma",   gender: "female", hair_color: "blond", hair_style: "long",   skin: "light",  eyes: "blue",  glasses: false, facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id:  2, name: "Marcus", gender: "male",   hair_color: "black", hair_style: "short",  skin: "dark",   eyes: "brown", glasses: false, facial_hair: "beard",    hat: false, earrings: false, freckles: false },
  { id:  3, name: "Sofia",  gender: "female", hair_color: "red",   hair_style: "long",   skin: "medium", eyes: "green", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  4, name: "James",  gender: "male",   hair_color: "gray",  hair_style: "bald",   skin: "light",  eyes: "blue",  glasses: false, facial_hair: "mustache", hat: true,  earrings: false, freckles: false },
  { id:  5, name: "Lily",   gender: "female", hair_color: "black", hair_style: "curly",  skin: "medium", eyes: "brown", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  6, name: "Omar",   gender: "male",   hair_color: "black", hair_style: "short",  skin: "dark",   eyes: "brown", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  7, name: "Claire", gender: "female", hair_color: "blond", hair_style: "short",  skin: "light",  eyes: "blue",  glasses: false, facial_hair: "none",     hat: true,  earrings: false, freckles: false },
  { id:  8, name: "Henri",  gender: "male",   hair_color: "brown", hair_style: "curly",  skin: "medium", eyes: "green", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id:  9, name: "Raya",   gender: "female", hair_color: "brown", hair_style: "long",   skin: "dark",   eyes: "brown", glasses: true,  facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id: 10, name: "Tom",    gender: "male",   hair_color: "blond", hair_style: "short",  skin: "light",  eyes: "blue",  glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 11, name: "Zoe",    gender: "female", hair_color: "red",   hair_style: "curly",  skin: "light",  eyes: "green", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: true  },
  { id: 12, name: "Diego",  gender: "male",   hair_color: "black", hair_style: "short",  skin: "medium", eyes: "brown", glasses: false, facial_hair: "mustache", hat: false, earrings: false, freckles: false },
  { id: 13, name: "Anna",   gender: "female", hair_color: "white", hair_style: "long",   skin: "light",  eyes: "blue",  glasses: true,  facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id: 14, name: "Leo",    gender: "male",   hair_color: "brown", hair_style: "short",  skin: "light",  eyes: "brown", glasses: false, facial_hair: "beard",    hat: true,  earrings: false, freckles: false },
  { id: 15, name: "Nina",   gender: "female", hair_color: "blond", hair_style: "long",   skin: "medium", eyes: "brown", glasses: false, facial_hair: "none",     hat: true,  earrings: false, freckles: false },
  { id: 16, name: "Kai",    gender: "male",   hair_color: "red",   hair_style: "short",  skin: "light",  eyes: "green", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 17, name: "Priya",  gender: "female", hair_color: "black", hair_style: "long",   skin: "dark",   eyes: "brown", glasses: false, facial_hair: "none",     hat: false, earrings: true,  freckles: false },
  { id: 18, name: "Sam",    gender: "male",   hair_color: "gray",  hair_style: "short",  skin: "medium", eyes: "blue",  glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 19, name: "Mia",    gender: "female", hair_color: "brown", hair_style: "curly",  skin: "light",  eyes: "brown", glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: true  },
  { id: 20, name: "Victor", gender: "male",   hair_color: "black", hair_style: "short",  skin: "light",  eyes: "brown", glasses: false, facial_hair: "beard",    hat: false, earrings: false, freckles: false },
  { id: 21, name: "Iris",   gender: "female", hair_color: "blond", hair_style: "short",  skin: "dark",   eyes: "brown", glasses: true,  facial_hair: "none",     hat: true,  earrings: true,  freckles: false },
  { id: 22, name: "Ben",    gender: "male",   hair_color: "blond", hair_style: "bald",   skin: "light",  eyes: "blue",  glasses: false, facial_hair: "none",     hat: false, earrings: false, freckles: false },
  { id: 23, name: "Fatima", gender: "female", hair_color: "black", hair_style: "long",   skin: "dark",   eyes: "green", glasses: true,  facial_hair: "none",     hat: false, earrings: false, freckles: false },
];

export type Character = (typeof CHARACTERS)[number];

export const SKIN_COLORS: Record<string, string> = { light: "#FDDBB4", medium: "#C68642", dark: "#6B3A2A" };
export const HAIR_COLORS: Record<string, string> = { blond: "#FFD96A", brown: "#7B4F2E", black: "#1A1A1A", red: "#E0573B", gray: "#9A9A9A", white: "#F2F2F2" };
export const EYE_COLORS: Record<string, string> = { blue: "#4D96FF", brown: "#7B5230", green: "#2FB36E" };

// Static class maps so Tailwind sees every candy fill.
const CANDY_FILLS = [
  "fill-candy-blue", "fill-candy-pink", "fill-candy-yellow",
  "fill-candy-green", "fill-candy-purple", "fill-candy-orange",
] as const;

const INK = "var(--color-ink)";
const EYE_X = [41, 59] as const;
const EYE_Y = 50;

/** Round cartoon portrait drawn from a character's traits (hair, skin, eyes, glasses, hat, facial hair…). */
export default function GuessWhoFace({ character: c, size }: { character: Character; size?: number }) {
  const clipId = useId();
  const skin = SKIN_COLORS[c.skin];
  const hair = HAIR_COLORS[c.hair_color];
  const eye = EYE_COLORS[c.eyes];
  const bg = CANDY_FILLS[c.id % CANDY_FILLS.length];
  const shirt = CANDY_FILLS[(c.id + 3) % CANDY_FILLS.length];
  const hatFill = CANDY_FILLS[(c.id + 1) % CANDY_FILLS.length];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={size ? "block" : "block w-full h-auto"}
      role="img"
      aria-label={c.name}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="47" className={bg} />

      <g clipPath={`url(#${clipId})`} stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {/* Hair – back layer */}
        {c.hair_style === "long" && <rect x="22" y="26" width="56" height="62" rx="24" fill={hair} />}
        {c.hair_style === "curly" && (
          <g fill={hair}>
            {[[26, 50], [74, 50], [24, 62], [76, 62], [28, 38], [72, 38]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="8" />
            ))}
          </g>
        )}

        {/* Neck and shoulders */}
        <rect x="43" y="68" width="14" height="14" fill={skin} />
        <path d="M14 104 Q16 80 50 80 Q84 80 86 104 Z" className={shirt} />

        {/* Ears and earrings */}
        <circle cx="27" cy="52" r="6" fill={skin} />
        <circle cx="73" cy="52" r="6" fill={skin} />
        {c.earrings && (
          <g className="fill-candy-yellow" strokeWidth="1.5">
            <circle cx="26" cy="61" r="3" />
            <circle cx="74" cy="61" r="3" />
          </g>
        )}

        {/* Head */}
        <ellipse cx="50" cy="50" rx="23" ry="26" fill={skin} />

        {/* Beard sits under the mouth */}
        {c.facial_hair === "beard" && (
          <path d="M27 52 Q28 80 50 80 Q72 80 73 52 Q70 66 60 66 Q50 62 40 66 Q30 66 27 52 Z" fill={hair} strokeWidth="1.5" />
        )}

        {/* Cheeks and freckles */}
        <g stroke="none" className="fill-candy-pink" opacity="0.35">
          <circle cx="36" cy="60" r="4" />
          <circle cx="64" cy="60" r="4" />
        </g>
        {c.freckles && (
          <g stroke="none" fill="#A0522D">
            {[[38, 56], [42, 58], [36, 59], [62, 56], [58, 58], [64, 59]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />
            ))}
          </g>
        )}

        {/* Eyes */}
        {EYE_X.map(x => (
          <g key={x}>
            <circle cx={x} cy={EYE_Y} r="5" fill="white" strokeWidth="1.5" />
            <circle cx={x} cy={EYE_Y + 0.5} r="2.8" fill={eye} stroke="none" />
            <circle cx={x} cy={EYE_Y + 0.5} r="1.2" fill={INK} stroke="none" />
          </g>
        ))}
        {c.gender === "female" && (
          <g strokeWidth="1.5">
            <path d="M36 47 L33 45" />
            <path d="M64 47 L67 45" />
          </g>
        )}
        {/* Eyebrows */}
        {c.hair_style !== "bald" && (
          <g stroke={hair === HAIR_COLORS.white || hair === HAIR_COLORS.blond ? INK : hair} strokeWidth="2.5">
            <path d="M36 42 Q41 39 46 42" fill="none" />
            <path d="M54 42 Q59 39 64 42" fill="none" />
          </g>
        )}

        {/* Glasses */}
        {c.glasses && (
          <g fill="white" fillOpacity="0.25">
            <circle cx={EYE_X[0]} cy={EYE_Y} r="7.5" />
            <circle cx={EYE_X[1]} cy={EYE_Y} r="7.5" />
            <path d="M48.5 50 Q50 48 51.5 50" fill="none" />
            <path d="M33.5 49 L27 47" fill="none" />
            <path d="M66.5 49 L73 47" fill="none" />
          </g>
        )}

        {/* Nose and mouth */}
        <path d="M50 54 Q47 59 50.5 60" fill="none" strokeWidth="1.5" />
        {c.facial_hair === "mustache" && (
          <path d="M40 65 Q44 59 50 62.5 Q56 59 60 65 Q55 66 50 64.5 Q45 66 40 65 Z" fill={hair} strokeWidth="1.5" />
        )}
        <path d="M43 67 Q50 73 57 67" fill="none" />

        {/* Hair – front layer */}
        {(c.hair_style === "short" || c.hair_style === "long") && (
          <path d="M26 48 Q24 21 50 21 Q76 21 74 48 Q68 33 52 32 Q38 32 34 38 Q30 42 26 48 Z" fill={hair} />
        )}
        {c.hair_style === "long" && (
          <path d="M26 48 Q25 60 28 70 L33 70 Q30 58 31 44 Z M74 48 Q75 60 72 70 L67 70 Q70 58 69 44 Z" fill={hair} />
        )}
        {c.hair_style === "curly" && (
          <g fill={hair}>
            {[[30, 36], [38, 27], [50, 23], [62, 27], [70, 36], [44, 32], [56, 32]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="8" />
            ))}
          </g>
        )}
        {c.hair_style === "bald" && !c.hat && (
          <ellipse cx="42" cy="31" rx="5" ry="2.5" fill="white" opacity="0.5" stroke="none" />
        )}

        {/* Beanie */}
        {c.hat && (
          <g className={hatFill}>
            <path d="M25 40 Q25 14 50 14 Q75 14 75 40 Z" />
            <rect x="23" y="35" width="54" height="9" rx="4.5" />
            <circle cx="50" cy="13" r="5" />
          </g>
        )}
      </g>

      <circle cx="50" cy="50" r="47" fill="none" stroke={INK} strokeWidth="2" />
    </svg>
  );
}
