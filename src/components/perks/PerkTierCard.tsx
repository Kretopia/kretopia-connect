import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, Lock } from "lucide-react";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { getAllTiers } from "@/lib/statusEngine";

export type PerkTier = ReturnType<typeof getAllTiers>[number];

/** current = the viewer's tier; unlocked = below it; next = the one to aim for; locked = further up. */
export type PerkTierState = "current" | "unlocked" | "next" | "locked";

interface PerkTierCardProps {
  tier: PerkTier;
  icon: LucideIcon;
  state: PerkTierState;
  /** The viewer's real verified-credit count; drives the progress line. */
  verifiedCredits: number;
  /** Primary action, only offered on the "next" tier. */
  onAction?: () => void;
}

const STATE_BADGE: Record<PerkTierState, string> = {
  current: "Your status",
  unlocked: "Unlocked",
  next: "Next up",
  locked: "Locked",
};

/** What the tier asks for beyond credits, said exactly as the engine gates it. */
function extraRequirement(gate: PerkTier["gate"]): string | null {
  if (gate.awards && gate.press) {
    return gate.awardsOrPress
      ? `plus ${gate.awards} awards or ${gate.press} press features`
      : `plus ${gate.awards} awards and ${gate.press} press features`;
  }
  return null;
}

/**
 * One rung of the ThriveStatus ladder. Reading order: which tier, what it
 * takes, what it gives, who provides it, what to do next. Every number is the
 * engine's own gate or the viewer's own verified-credit count -- no partner,
 * discount or value is implied that the data doesn't have.
 */
export function PerkTierCard({ tier, icon: Icon, state, verifiedCredits, onAction }: PerkTierCardProps) {
  const reached = state === "current" || state === "unlocked";
  const name = tier.socialProofLabel ?? tier.label;
  const needed = tier.gate.credits;
  const remaining = Math.max(0, needed - verifiedCredits);
  const pct = needed > 0 ? Math.min(100, Math.round((verifiedCredits / needed) * 100)) : 100;
  const extra = extraRequirement(tier.gate);
  const showProgress = state === "next" || state === "locked";

  return (
    <article
      aria-label={`${name} tier, ${STATE_BADGE[state].toLowerCase()}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border p-5",
        "motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 active:scale-[0.99]",
        state === "current" ? "border-transparent shadow-glow" : "border-border bg-card hover:border-foreground/25",
      )}
      style={
        state === "current"
          ? { background: "linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, var(--k-text-gradient) border-box" }
          : undefined
      }
    >
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60", tier.gradient)}
      />

      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-gradient-to-br",
            reached ? cn(tier.gradient, "border-foreground/20") : "border-border from-muted/40 to-muted/10",
          )}
        >
          <Icon className={cn("h-5 w-5", reached ? tier.color : "text-muted-foreground")} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{tier.label}</p>
          <h3 className="mt-0.5 text-lg font-black leading-tight tracking-tight text-foreground">{name}</h3>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            state === "current" && "border-foreground bg-foreground text-background",
            state === "unlocked" && "border-border bg-muted text-foreground",
            state === "next" && "border-foreground/40 text-foreground",
            state === "locked" && "border-border text-muted-foreground",
          )}
        >
          {state === "locked" && <Lock className="h-3 w-3" aria-hidden />}
          {state === "unlocked" && <Check className="h-3 w-3" aria-hidden />}
          {STATE_BADGE[state]}
        </span>
      </div>

      <div className="relative mt-4">
        {needed === 0 ? (
          <p className="text-sm font-semibold text-foreground">Starts here — included with your Passport</p>
        ) : (
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black leading-none tracking-tight tabular-nums text-foreground">{needed}</span>
            <span className="text-sm text-muted-foreground">{reached ? "verified credits — reached" : "verified credits to unlock"}</span>
          </p>
        )}
        {extra && <p className="mt-1 text-xs text-muted-foreground">{extra}</p>}

        {showProgress && needed > 0 && (
          <div className="mt-3">
            <div
              role="progressbar"
              aria-label={`Verified credits toward ${name}`}
              aria-valuemin={0}
              aria-valuemax={needed}
              aria-valuenow={Math.min(verifiedCredits, needed)}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundImage: "var(--k-text-gradient)" }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {remaining > 0
                ? `${remaining} more verified credit${remaining === 1 ? "" : "s"} — you have ${verifiedCredits}`
                : "Credits requirement met"}
            </p>
          </div>
        )}
      </div>

      <ul className="relative mt-4 space-y-2">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-sm">
            {reached ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
            ) : (
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={reached ? "text-foreground" : "text-foreground/70"}>{perk}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-auto flex flex-col gap-3 pt-5">
        {state === "next" && onAction && (
          <Button className="h-11 w-full gap-2" onClick={onAction}>
            Add a verified credit
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
        <p className="flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <img src={kMarkAsset.url} alt="" aria-hidden draggable={false} className="h-3.5 w-3.5 select-none object-contain" />
          Provided by Kretopia
        </p>
      </div>
    </article>
  );
}

export default PerkTierCard;
