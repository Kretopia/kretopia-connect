import { ShieldCheck, Clock3, FileWarning, Handshake, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { MyCreditsOverview } from "@/hooks/useMyCredits";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";
import { RecordRing } from "./RecordRing";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Props {
  overview: MyCreditsOverview | null;
  /** 0-100 record completeness, drawn as the branded ring. */
  completeness: number;
  /** What the percentage is made of, so the card can say it in words. */
  steps?: { done: number; total: number };
  nextAction: { label: string; onClick: () => void } | null;
  loading?: boolean;
}

/**
 * CreditsOverviewCard — the single summary of the person's own record.
 * Counts come from `my_credits_overview` (auth.uid() scoped) — never from a
 * client-side tally over a public table.
 */
export function CreditsOverviewCard({ overview, completeness, steps, nextAction, loading }: Props) {
  const reduced = useReducedMotion();
  const stats = [
    { icon: ShieldCheck, label: "Verified", value: overview?.verified_credits ?? 0 },
    { icon: Clock3, label: "Pending", value: overview?.pending_credits ?? 0 },
    { icon: FileWarning, label: "Needs evidence", value: overview?.missing_evidence ?? 0 },
    { icon: Handshake, label: "Co-signs", value: overview?.endorsements_received ?? 0 },
  ];

  const totalCredits = overview?.total_credits ?? 0;
  const verifiedCredits = overview?.verified_credits ?? 0;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.5, ease: [0.2, 0.65, 0.3, 0.95] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(110% 90% at 0% 0%, hsl(var(--accent-passport)/0.12), transparent 55%)",
        }}
      />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Your record</p>
          <p className="mt-1 flex items-end gap-2 text-5xl font-bold leading-none tracking-tight text-foreground">
            {loading ? "—" : <AnimatedNumber value={totalCredits} />}
            <span className="pb-1 text-sm font-medium text-muted-foreground">credits</span>
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {loading
              ? "Checking your record…"
              : totalCredits === 0
                ? "Nothing on your record yet"
                : `${verifiedCredits} of ${totalCredits} verified`}
          </p>
          {steps && !loading && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {steps.done} of {steps.total} steps to a complete record
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <RecordRing percent={completeness} steps={steps} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Record complete
          </span>
        </div>
      </div>

      {nextAction && (
        <button
          type="button"
          onClick={nextAction.onClick}
          className={cn(
            "btn-glass btn-glass-primary group relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <span className="relative">{nextAction.label}</span>
          <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      )}

      <dl className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : 0.1 + i * 0.06 }}
            whileHover={reduced ? undefined : { y: -3 }}
            className="group relative overflow-hidden rounded-xl border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:border-[hsl(var(--accent-passport))]/40"
          >
            <dt className="relative flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <s.icon className="h-3.5 w-3.5 text-[hsl(var(--accent-passport))]" aria-hidden />
              {s.label}
            </dt>
            <dd className="relative mt-1 text-2xl font-semibold text-foreground">
              {loading ? "—" : <AnimatedNumber value={s.value} />}
            </dd>
          </motion.div>
        ))}
      </dl>
    </motion.div>
  );
}
