/**
 * KretoAvatar — the single visual representation of Kreto,
 * Kretopia's Executive Producer. Use everywhere Kreto appears
 * (landing, FAB, agent drawer, proactive cards, doc-engine headers).
 *
 * Visual: silhouette portrait + animated sunset halo.
 * NOT a robot, NOT a sparkle icon, NOT a chatbot bubble.
 */
import { motion } from "framer-motion";
import kretoSrc from "@/assets/kreto-avatar.png";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, { box: string; halo: string; ring: string }> = {
  xs: { box: "h-7 w-7",   halo: "h-9 w-9",     ring: "inset-[-3px]" },
  sm: { box: "h-10 w-10", halo: "h-14 w-14",   ring: "inset-[-5px]" },
  md: { box: "h-16 w-16", halo: "h-24 w-24",   ring: "inset-[-10px]" },
  lg: { box: "h-32 w-32", halo: "h-48 w-48",   ring: "inset-[-20px]" },
  xl: { box: "h-64 w-64", halo: "h-[22rem] w-[22rem]", ring: "inset-[-40px]" },
};

/** "idle" is the default ambient breathing loop. The others each read as a
 *  visibly distinct kind of "active" so Kreto's own identity can stand in
 *  for the generic Loader2/Volume2/red-dot icons used for these moments
 *  elsewhere:
 *   - "thinking": fast, bright pulse + a spinning gradient rim (a loading
 *     spinner folded into the avatar itself).
 *   - "listening": a slower radar-style ripple — the halo expands and fades
 *     outward, reading as "capturing/receiving" rather than "computing."
 *   - "speaking": a quick double-pulse, evoking speech rhythm rather than a
 *     single smooth breath.
 *   - "recording": the one state that switches the halo/rim to red instead
 *     of the brand sunset gradient — "your mic is live" is a safety-relevant
 *     signal, not a branding moment, so color (not just motion) must stay
 *     unambiguous. Snap-and-fade "ping" rhythm, distinct from every pink
 *     state above so it can never be mistaken for one at a glance. */
type AvatarState = "idle" | "thinking" | "listening" | "speaking" | "recording";

const HALO_ANIMATE: Record<AvatarState, { scale: number[]; opacity: number[] }> = {
  idle:      { scale: [1, 1.08, 1],          opacity: [0.45, 0.70, 0.45] },
  thinking:  { scale: [1, 1.22, 1],          opacity: [0.55, 0.95, 0.55] },
  listening: { scale: [1, 1.35, 1],          opacity: [0.60, 0.08, 0.60] },
  speaking:  { scale: [1, 1.10, 1, 1.16, 1], opacity: [0.55, 0.85, 0.60, 0.90, 0.55] },
  recording: { scale: [1, 1, 1.65],          opacity: [0.85, 0.85, 0] },
};
const HALO_DURATION: Record<AvatarState, number> = { idle: 4, thinking: 1.1, listening: 1.6, speaking: 0.9, recording: 1.2 };
const HALO_STATIC_OPACITY: Record<AvatarState, number> = { idle: 0.5, thinking: 0.75, listening: 0.65, speaking: 0.7, recording: 0.8 };
const HALO_COLOR: Record<AvatarState, string> = {
  idle: "var(--kretopia-sunset, hsl(327 100% 59%))",
  thinking: "var(--kretopia-sunset, hsl(327 100% 59%))",
  listening: "var(--kretopia-sunset, hsl(327 100% 59%))",
  speaking: "var(--kretopia-sunset, hsl(327 100% 59%))",
  recording: "hsl(var(--destructive))",
};

interface KretoAvatarProps {
  size?: Size;
  animated?: boolean;
  state?: AvatarState;
  className?: string;
}

export const KretoAvatar = ({
  size = "md",
  animated = true,
  state = "idle",
  className,
}: KretoAvatarProps) => {
  const s = SIZE[size];
  const thinking = state === "thinking";
  const color = HALO_COLOR[state];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Outer breathing halo — sunset gradient (red for "recording", the one
          state where color itself carries meaning). Shape/speed changes per
          state so the same avatar reads as idle, thinking, listening,
          speaking, or recording. */}
      {animated ? (
        <motion.span
          aria-hidden
          className={cn("absolute rounded-full blur-2xl", s.halo)}
          style={{ background: color }}
          animate={HALO_ANIMATE[state]}
          transition={{
            duration: HALO_DURATION[state],
            repeat: Infinity,
            ease: state === "recording" ? "easeOut" : "easeInOut",
          }}
        />
      ) : (
        <span
          aria-hidden
          className={cn("absolute rounded-full blur-2xl", s.halo)}
          style={{ background: color, opacity: HALO_STATIC_OPACITY[state] }}
        />
      )}

      {/* Avatar disc rim — static gradient normally; a spinning conic-gradient
          arc while thinking, so the rim itself becomes the loading indicator
          instead of a separate generic spinner living next to the avatar.
          Tinted red (not spinning) for "recording", matching the halo. */}
      {thinking && animated ? (
        <motion.span
          aria-hidden
          className={cn("absolute rounded-full", s.ring)}
          style={{
            background: `conic-gradient(from 0deg, rgba(255,255,255,0) 0%, ${color} 75%, ${color} 100%)`,
            padding: "2px",
            WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
      ) : (
        <span
          aria-hidden
          className={cn("absolute rounded-full", s.ring)}
          style={{
            background: color,
            padding: "2px",
            WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            opacity: thinking ? 0.85 : 1,
          }}
        />
      )}

      <span className={cn("relative rounded-full overflow-hidden bg-[#0B0B10] ring-1 ring-white/10", s.box)}>
        <img
          src={kretoSrc}
          alt="Kreto, your Executive Producer"
          width={256}
          height={256}
          loading="lazy"
          className="h-full w-full object-cover object-top scale-110"
          draggable={false}
        />
      </span>
    </div>
  );
};

export default KretoAvatar;
