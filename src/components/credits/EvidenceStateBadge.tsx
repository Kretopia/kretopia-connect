import { BadgeCheck, Link2, Search, ShieldCheck, UserCheck, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVIDENCE_STATE_DESCRIPTION, EVIDENCE_STATE_LABEL, type EvidenceState } from "@/lib/creditEvidence";

const ICON: Record<EvidenceState, LucideIcon> = {
  claimed: UserCheck,
  publicly_sourced: Search,
  evidence_backed: Link2,
  co_signed: BadgeCheck,
  organization_confirmed: ShieldCheck,
  pending_review: Clock,
};

/** Restrained, accent-gated by tier — only "organization_confirmed" gets the full energy-token fill. */
const TONE: Record<EvidenceState, string> = {
  claimed: "text-muted-foreground bg-muted/30 border-border",
  publicly_sourced: "text-muted-foreground bg-muted/30 border-border",
  evidence_backed: "text-foreground bg-[hsl(var(--energy)/0.1)] border-[hsl(var(--energy)/0.25)]",
  co_signed: "text-foreground bg-[hsl(var(--energy)/0.15)] border-[hsl(var(--energy)/0.35)]",
  organization_confirmed: "text-foreground bg-[hsl(var(--energy))] border-[hsl(var(--energy))]",
  pending_review: "text-muted-foreground bg-muted/30 border-border border-dashed",
};

interface EvidenceStateBadgeProps {
  state: EvidenceState;
  size?: "sm" | "md";
  className?: string;
  /** Native title tooltip. Defaults to the state's real description — pass "" to suppress. */
  title?: string;
  /** Icon-only, no label text — for tight spaces like poster card corners. */
  iconOnly?: boolean;
}

export function EvidenceStateBadge({ state, size = "sm", className, title, iconOnly }: EvidenceStateBadgeProps) {
  const Icon = ICON[state];
  return (
    <span
      title={title ?? EVIDENCE_STATE_DESCRIPTION[state]}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        iconOnly ? "p-1" : size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        TONE[state],
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {!iconOnly && EVIDENCE_STATE_LABEL[state]}
      {iconOnly && <span className="sr-only">{EVIDENCE_STATE_LABEL[state]}</span>}
    </span>
  );
}

export default EvidenceStateBadge;
