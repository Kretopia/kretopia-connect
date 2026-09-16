/**
 * KretoPresence — Kreto's embodied visual presence. Global rollout component
 * per KRETO_GLOBAL_PRESENCE_SYSTEM.md, built on the Phase A pilot
 * (KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md).
 *
 * Original design, not a reproduction of any external reference. Built
 * entirely from the character rules in Kretopia_Kreto_Evolution_Brief_v1.docx
 * ("Character rules to lock"), deliberately correcting away from the
 * attached "Blinky-style" reference image (which the brief itself flags as
 * unrefined, not a cleared final asset):
 *   - graphite / near-black body material (not the reference's white shell);
 *   - one warm off-white panel accent, not a mostly-white body;
 *   - the real Kretopia K-mark (via KretoMark, never redrawn/approximated);
 *   - one signal-dot cue on the visor (inspired by the wordmark's own accent
 *     dot) instead of the reference's paired crescent eyes -- a deliberately
 *     different, more original identifying feature;
 *   - the Kretopia pink used only as a small, controlled accent on that one
 *     dot, never as a body wash or constant glow.
 *
 * Pure layered SVG + CSS/Framer Motion transforms (opacity/scale/translate
 * only) -- no WebGL, no three.js, no new dependency. Framer Motion is
 * already used throughout Landing and this repo generally.
 *
 * State is entirely caller-driven and never invented here: this component
 * has no internal timers or fake progress (KRETO_STATE_MACHINE_REPORT.md).
 * Every state must correspond to something actually true at the call site --
 * see each integration's own comment for which state(s) it actually passes
 * and why. "attentive" is the one exception: it is real DOM hover/focus on
 * this component's own interactive button, not a caller-supplied claim, so
 * it is tracked internally -- see the interactive branch below.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { KretoMark } from "@/components/brand/KretoMark";
import { cn } from "@/lib/utils";

export type KretoPresenceState =
  | "idle"
  | "attentive"
  | "listening"
  | "processing"
  | "proposal_ready"
  | "success"
  | "caution"
  | "error"
  | "offline";
export type KretoPresenceSize = "micro" | "compact" | "card" | "hero" | "full";

const SIZE_PX: Record<KretoPresenceSize, number> = {
  micro: 24,
  compact: 40,
  card: 72,
  hero: 200,
  // 240-360px range per KRETO_GLOBAL_PRESENCE_SYSTEM.md §3. No surface uses
  // this yet (DEFERRED in KRETO_SURFACE_PLACEMENT_MAP.md) -- reserved for a
  // future, separately-approved Kreto primary-feature empty state, which per
  // §3's own "must be lazy-loaded" rule should reach this via that feature's
  // existing route-level code splitting, not a new lazy boundary in here.
  full: 300,
};

/** State meaning always exists as real text too -- never color/motion alone.
 *  "idle" and "attentive" have no announcement: attentive is a hover/focus
 *  micro-affordance on a control that already carries its own aria-label,
 *  not an app-state change a screen reader user needs telling about. */
const STATE_LABEL: Record<KretoPresenceState, string> = {
  idle: "",
  attentive: "",
  listening: "Kreto is listening",
  processing: "Kreto is working on this",
  proposal_ready: "Kreto has a suggestion ready",
  success: "Kreto completed the action",
  caution: "Kreto needs you to review something before it continues",
  error: "Kreto needs your attention",
  offline: "Kreto is unavailable right now",
};

/** Signal-dot color per state. Pink for "working towards/delivered good
 *  news" states; the existing --warning token (already defined for both
 *  Day and Night, KRETO_STATE_MACHINE_REPORT.md) for "review this" states
 *  the brief explicitly permits amber for; a calm muted grey for
 *  error/offline (never a scary red or a flashing state, per the brief's
 *  own "never imply the robot failed emotionally" rule). */
function signalColor(state: KretoPresenceState): string {
  switch (state) {
    case "caution":
      return "hsl(var(--warning))";
    case "error":
    case "offline":
      return "hsl(var(--muted-foreground))";
    default:
      return "hsl(var(--energy))";
  }
}

/** Which states get a continuous loop vs. a single one-shot acknowledgement
 *  vs. nothing at all -- KRETO_STATE_MACHINE_REPORT.md §"Motion per state".
 *  "loop-listen" is deliberately a calmer, steadier pulse than "loop-fast"
 *  (processing) -- New Room already has its own large pulsing stop-button
 *  while genuinely recording (KRETO_NEW_ROOM_INTEGRATION_REPORT.md), so
 *  Kreto's own cue here reads as "present and picking this up" rather than
 *  competing with it as a second anxious animation. */
type SignalMotion = "loop-slow" | "loop-listen" | "loop-fast" | "once-in" | "once-nod" | "none";
function signalMotion(state: KretoPresenceState): SignalMotion {
  switch (state) {
    case "idle":
    case "attentive":
      return "loop-slow";
    case "listening":
      return "loop-listen";
    case "processing":
      return "loop-fast";
    case "proposal_ready":
      return "once-in";
    case "success":
      return "once-nod";
    case "caution":
    case "error":
    case "offline":
      return "none";
  }
}

interface KretoPresenceProps {
  state?: KretoPresenceState;
  size?: KretoPresenceSize;
  /** Provide together with onClick to make this a real, accessible control.
   *  Omit both to keep it decorative (aria-hidden) -- the default. */
  label?: string;
  onClick?: () => void;
  className?: string;
}

export const KretoPresence = ({
  state = "idle",
  size = "card",
  label,
  onClick,
  className,
}: KretoPresenceProps) => {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const px = SIZE_PX[size];
  // "micro" (24px) is too small for any legible badge; everything else gets
  // one, sized so its footprint stays proportionate at each presence size.
  const showMark = size !== "micro";
  const isInteractive = !!onClick;

  // "attentive" is real DOM hover/focus on this control, never a caller
  // claim -- and it only ever displaces "idle": hovering a control that is
  // genuinely processing/erroring/etc. must keep showing that real state,
  // never paper over it with a cosmetic hover look.
  const effectiveState: KretoPresenceState =
    isInteractive && state === "idle" && hovered ? "attentive" : state;
  const stateLabel = STATE_LABEL[effectiveState];
  // "calm stable stance" (caution) and "static/quiet" (error/offline) per
  // KRETO_GLOBAL_PRESENCE_SYSTEM.md §2 -- no breathing, no motion at all.
  const isCalm = effectiveState === "caution" || effectiveState === "error" || effectiveState === "offline";
  const motionState = signalMotion(effectiveState);

  const bodyAnimate =
    reducedMotion || isCalm
      ? undefined
      : effectiveState === "attentive"
        ? { rotate: [0, -3, 0], scale: [1, 1.03, 1] }
        : { y: [0, -4, 0], scale: [1, 1.015, 1] };
  const bodyTransition =
    effectiveState === "attentive"
      ? { duration: 0.4, ease: "easeOut" as const }
      : { duration: 11, repeat: Infinity, ease: "easeInOut" as const };

  const signalAnimate = reducedMotion
    ? undefined
    : motionState === "loop-fast"
      ? { opacity: [0.55, 1, 0.55], scale: [0.92, 1.08, 0.92] }
      : motionState === "loop-listen"
        ? { opacity: [0.65, 1, 0.65], scale: [0.97, 1.03, 0.97] }
        : motionState === "loop-slow"
          ? { opacity: [0.75, 1, 0.75] }
          : motionState === "once-in"
            ? { opacity: [0, 1], scale: [0.8, 1] }
            : motionState === "once-nod"
              ? { scale: [1, 1.18, 1] }
              : undefined;
  const signalTransition =
    motionState === "loop-fast"
      ? { duration: 1.3, repeat: Infinity, ease: "easeInOut" as const }
      : motionState === "loop-listen"
        ? { duration: 2, repeat: Infinity, ease: "easeInOut" as const }
        : motionState === "loop-slow"
          ? { duration: 6, repeat: Infinity, ease: "easeInOut" as const }
          : { duration: 0.45, ease: "easeOut" as const };

  const visual = (
    <motion.div
      className="relative"
      style={{ width: px, height: px }}
      animate={bodyAnimate}
      transition={bodyTransition}
    >
      <svg viewBox="0 0 100 100" width={px} height={px} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="kreto-presence-plate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--secondary))" />
            <stop offset="100%" stopColor="hsl(var(--k-midnight))" />
          </linearGradient>
          <radialGradient id="kreto-presence-signal" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor={signalColor(effectiveState)} stopOpacity="1" />
            <stop offset="100%" stopColor={signalColor(effectiveState)} stopOpacity="0.45" />
          </radialGradient>
        </defs>

        {/* Graphite / near-black plate -- the body material the brief's own
            "Character rules to lock" calls for, replacing the reference's
            white shell. */}
        <rect x="9" y="7" width="82" height="86" rx="26" fill="url(#kreto-presence-plate)" />
        <rect x="9" y="7" width="82" height="86" rx="26" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.4" />

        {/* One warm off-white panel accent -- selective, not a body wash. */}
        <path
          d="M 68 68 Q 86 70 84 88 Q 70 92 60 84 Q 62 72 68 68 Z"
          fill="rgba(255,255,255,0.07)"
        />

        {/* The one signal-dot cue, inspired by the wordmark's accent dot --
            deliberately singular, not the reference's paired crescent eyes. */}
        <motion.circle
          cx="50"
          cy="42"
          r="9"
          fill="url(#kreto-presence-signal)"
          animate={signalAnimate}
          transition={signalTransition}
        />
        <circle cx="50" cy="42" r="9" fill="none" stroke={signalColor(effectiveState)} strokeOpacity="0.5" strokeWidth="1" />
      </svg>

      {showMark && (
        <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 opacity-90">
          <KretoMark
            variant="bare"
            size={size === "hero" || size === "full" ? "sm" : "xs"}
            className={size === "compact" ? "scale-75" : undefined}
          />
        </div>
      )}
    </motion.div>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={label || "Open Kreto"}
        className={cn(
          "inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy))] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          className,
        )}
      >
        {visual}
        {stateLabel && <span className="sr-only">{stateLabel}</span>}
      </button>
    );
  }

  return (
    <div className={cn("inline-flex", className)} aria-hidden="true">
      {visual}
      {stateLabel && <span className="sr-only">{stateLabel}</span>}
    </div>
  );
};

export default KretoPresence;
