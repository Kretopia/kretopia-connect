import { type StatusResult, calculateStatusFromCredits } from "@/lib/statusEngine";
import { ThriveStatusCard } from "@/components/ThriveStatusCard";

interface LevelBadgeProps {
  level: number;
  xp: number;
}

/**
 * LevelBadge now renders the unified ThriveStatus card.
 * The level/xp props are kept for backward compat but status
 * is derived from a default empty metrics set (callers should
 * migrate to passing StatusResult directly).
 */
export function LevelBadge({ level, xp }: LevelBadgeProps) {
  // Legacy: create a rough status from xp as credit count proxy
  const estimatedCredits = Math.floor(xp / 10);
  const status = calculateStatusFromCredits(
    Array.from({ length: estimatedCredits }, () => ({ verification_status: "manual" }))
  );

  return <ThriveStatusCard status={status} />;
}
