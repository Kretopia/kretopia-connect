import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThriveMarkProps {
  /** sm = 14px, md = 16px (default), lg = 20px, xl = 24px */
  size?: "sm" | "md" | "lg" | "xl";
  /** Show the soft primary halo behind the icon */
  withHalo?: boolean;
  className?: string;
}

const SIZE = {
  sm: { icon: "h-3.5 w-3.5", halo: "h-6 w-6" },
  md: { icon: "h-4 w-4", halo: "h-7 w-7" },
  lg: { icon: "h-5 w-5", halo: "h-9 w-9" },
  xl: { icon: "h-6 w-6", halo: "h-12 w-12" },
} as const;

/**
 * The single visual mark for Thrive (the platform AI).
 * Use this everywhere Thrive speaks, acts, or asks for approval —
 * Copilot drawer, Approvals Hub, Plan cards, agent FAB, capabilities sheet.
 *
 * Do NOT inline a bare <Sparkles/> for AI-related UI; use ThriveMark so the
 * brand language stays consistent across surfaces.
 */
export const ThriveMark = ({ size = "md", withHalo = false, className }: ThriveMarkProps) => {
  const cfg = SIZE[size];
  if (!withHalo) {
    return <Sparkles className={cn(cfg.icon, "text-primary", className)} aria-hidden />;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary/10 text-primary",
        cfg.halo,
        className,
      )}
      aria-hidden
    >
      <Sparkles className={cfg.icon} />
    </span>
  );
};
