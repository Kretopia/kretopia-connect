import { CircleHelp, Check, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FIT_LABEL, type CriterionResult, type CriterionStatus, type EvidenceBasis, type Evaluation, type Fit } from "@/lib/matching/evaluate";
import { cn } from "@/lib/utils";

const STATUS: Record<CriterionStatus, { icon: LucideIcon; word: string; tone: string }> = {
  met: { icon: Check, word: "Met", tone: "text-emerald-700 dark:text-emerald-300" },
  not_met: { icon: X, word: "Not met", tone: "text-destructive" },
  unknown: { icon: CircleHelp, word: "Not on Kretopia", tone: "text-muted-foreground" },
};

const BASIS: Record<EvidenceBasis, string> = { demonstrated: "From their work", stated: "From their profile" };

const FIT_TONE: Record<Fit, string> = {
  meets_all: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  partial: "border-border bg-muted/50 text-foreground",
  unclear: "border-dashed border-border bg-transparent text-muted-foreground",
  weak: "border-destructive/30 bg-destructive/5 text-destructive",
};

/** The fit level in words (never a percentage). The word is the signal; colour only supports it. */
export function FitBadge({ fit, className }: { fit: Fit; className?: string }) {
  return <Badge variant="outline" className={cn("h-6 px-2 text-xs font-semibold", FIT_TONE[fit], className)}>{FIT_LABEL[fit]}</Badge>;
}

function Row({ result }: { result: CriterionResult }) {
  const { icon: Icon, word, tone } = STATUS[result.status];
  return (
    <li className="flex gap-2.5 py-2">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {result.criterion.label}
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{result.criterion.importance === "required" ? "Required" : "Preferred"}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          <span className={cn("font-semibold", tone)}>{word}</span>
          {result.basis && <span> · {BASIS[result.basis]}</span>}
          <span> · {result.evidence}</span>
        </p>
        {result.consequence && <p className="mt-0.5 text-xs text-muted-foreground">{result.consequence}</p>}
      </div>
    </li>
  );
}

/**
 * How one profile was checked against the company's criteria, criterion by criterion: what was found and where it came
 * from, what could not be checked and what that means, and how much of the list could be checked at all.
 */
export function MatchEvidence({ evaluation }: { evaluation: Evaluation }) {
  const { summary, results } = evaluation;
  return (
    <section aria-label={`How ${evaluation.facts.fullName} was checked`} className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Checked {summary.coverage.checked} of {summary.coverage.total} {summary.coverage.total === 1 ? "criterion" : "criteria"}. Based on what is on Kretopia, not on what may be true elsewhere.
      </p>
      <ul className="divide-y divide-border/60">{results.map((r) => <Row key={r.criterion.id} result={r} />)}</ul>
    </section>
  );
}

export default MatchEvidence;
