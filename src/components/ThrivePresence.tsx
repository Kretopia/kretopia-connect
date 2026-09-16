/**
 * ThrivePresence — visual identity for the Thrive agent.
 *
 * Thrive is a presence, not a chatbot. No robot, no ✨, no speech bubble.
 * A breathing dot inside an orbiting signal ring. Teal at rest, lime
 * when Thrive has something to say (active state).
 *
 * Use this wherever Thrive "speaks" or is referenced as a being:
 *   - Agent header / FAB
 *   - "Thrive noticed something" cards
 *   - Empty states where Thrive is offering help
 *
 * Do NOT use for generic AI labels, status toasts, or success ticks.
 */
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Tone = "rest" | "active" | "thinking";

const SIZE: Record<Size, { box: string; dot: string; ring: string }> = {
  xs: { box: "h-4 w-4", dot: "h-1.5 w-1.5", ring: "border" },
  sm: { box: "h-6 w-6", dot: "h-2 w-2", ring: "border" },
  md: { box: "h-9 w-9", dot: "h-2.5 w-2.5", ring: "border" },
  lg: { box: "h-12 w-12", dot: "h-3 w-3", ring: "border-2" },
  xl: { box: "h-20 w-20", dot: "h-4 w-4", ring: "border-2" },
};

interface ThrivePresenceProps {
  size?: Size;
  tone?: Tone;
  className?: string;
  label?: string; // accessible label, defaults to "Kreto"
}

export const ThrivePresence = ({
  size = "md",
  tone = "rest",
  className,
  label = "Kreto",
}: ThrivePresenceProps) => {
  const s = SIZE[size];

  const dotColor =
    tone === "active"
      ? "bg-energy shadow-glow-lime"
      : tone === "thinking"
      ? "bg-primary"
      : "bg-primary";

  const ringColor =
    tone === "active"
      ? "border-energy/50"
      : tone === "thinking"
      ? "border-primary/40"
      : "border-primary/30";

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        s.box,
        className,
      )}
    >
      {/* Outer signal ring — slow rotate */}
      <span
        className={cn(
          "absolute inset-0 rounded-full",
          s.ring,
          ringColor,
          tone === "thinking" ? "animate-[spin_3s_linear_infinite]" : "",
        )}
        style={
          tone !== "thinking"
            ? {
                borderStyle: "solid",
                maskImage:
                  "conic-gradient(from 0deg, black 0%, black 60%, transparent 65%, transparent 100%)",
                WebkitMaskImage:
                  "conic-gradient(from 0deg, black 0%, black 60%, transparent 65%, transparent 100%)",
              }
            : undefined
        }
      />

      {/* Inner pulse halo (active only) */}
      {tone === "active" && (
        <span className="absolute inset-1 rounded-full bg-energy/15 animate-pulse" />
      )}

      {/* Breathing dot — the core */}
      <span
        className={cn(
          "relative rounded-full",
          s.dot,
          dotColor,
          "animate-[pulse-subtle_2s_ease-in-out_infinite]",
        )}
      />
    </span>
  );
};

export default ThrivePresence;
