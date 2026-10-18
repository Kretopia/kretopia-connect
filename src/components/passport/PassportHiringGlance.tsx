import { CheckCircle2, Clock, Globe, Handshake, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreditEvidenceStatus } from "@/lib/passport/creditEvidence";
import type { HiringGlance } from "@/lib/passport/hiringGlance";

const EVIDENCE_STYLE: Record<CreditEvidenceStatus, { icon: typeof CheckCircle2; className: string }> = {
  verified: { icon: CheckCircle2, className: "text-[hsl(var(--signal-teal))]" },
  co_signed: { icon: Handshake, className: "text-[hsl(var(--signal-teal))]" },
  publicly_sourced: { icon: Globe, className: "text-muted-foreground" },
  pending: { icon: Clock, className: "text-muted-foreground" },
  self_claimed: { icon: Shield, className: "text-muted-foreground" },
};

interface PassportHiringGlanceProps {
  glance: HiringGlance;
  firstName: string;
  className?: string;
}

/**
 * The answer to "who is this and can I trust their record?" in one block:
 * how long they've worked, how much of it someone else confirmed, what they
 * actually do, and the strongest proof with the basis spelled out. Only facts
 * the Passport holds -- a missing figure is left out, never estimated.
 */
export function PassportHiringGlance({ glance, firstName, className }: PassportHiringGlanceProps) {
  if (glance.total === 0) {
    return (
      <p className={cn("rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground", className)}>
        {firstName} hasn't added any credits yet.
      </p>
    );
  }

  const tiles: { label: string; value: string; sub?: string }[] = [];
  if (glance.sinceYear !== null && glance.yearsActive !== null) {
    tiles.push({
      label: "Since",
      value: String(glance.sinceYear),
      sub: glance.yearsActive === 0 ? "first credit this year" : `${glance.yearsActive} yr${glance.yearsActive === 1 ? "" : "s"} since first credit`,
    });
  }
  tiles.push({ label: "Credits", value: String(glance.total), sub: "on this Passport" });
  tiles.push({
    label: "Confirmed",
    value: String(glance.confirmed),
    sub: glance.confirmed === 0 ? "none yet" : `${Math.round(glance.confirmedShare * 100)}% of record`,
  });

  return (
    <section className={cn("space-y-3", className)} aria-label={`${firstName} at a glance`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">At a glance</p>

      <div className={cn("grid gap-2", tiles.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <div className="text-lg font-black leading-none">{t.value}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</div>
            {t.sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{t.sub}</div>}
          </div>
        ))}
      </div>

      {glance.topRoles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{glance.partial ? "Recently credited as " : "Credited as "}</span>
          {glance.topRoles.map((r, i) => (
            <span key={r.role}>
              {i > 0 && ", "}
              {r.role}
              {r.count > 1 && <span className="text-muted-foreground/80"> ×{r.count}</span>}
            </span>
          ))}
        </p>
      )}

      {glance.proof.length > 0 && (
        <ul className="space-y-1.5">
          {glance.proof.map((p) => {
            const style = EVIDENCE_STYLE[p.evidence];
            const Icon = style.icon;
            return (
              <li key={p.id} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", style.className)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{p.project}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.role}
                    {p.year ? ` · ${p.year}` : ""}
                  </p>
                  <p className={cn("mt-0.5 text-[10px] font-semibold", style.className)}>{p.basis}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Verified = confirmed by a linked platform or Kretopia. Co-signed = collaborators who worked on it vouch for it. Self-declared credits are the creator's own word.
      </p>
    </section>
  );
}

export default PassportHiringGlance;
