import { ShieldCheck, Clock3, FileWarning, Handshake, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { MyCreditsOverview } from "@/hooks/useMyCredits";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Props {
  overview: MyCreditsOverview | null;
  completeness: number;
  nextAction: { label: string; onClick: () => void } | null;
  loading?: boolean;
}

/**
 * CreditsOverviewCard — the single summary of the person's own record.
 * Counts come from `my_credits_overview` (auth.uid() scoped) — never from a
 * client-side tally over a public table.
 */
export function CreditsOverviewCard({ overview, completeness, nextAction, loading }: Props) {
  const reduced = useReducedMotion();
  const stats = [
    { icon: ShieldCheck, label: "Verified", value: overview?.verified_credits ?? 0 },
    { icon: Clock3, label: "Pending", value: overview?.pending_credits ?? 0 },
    { icon: FileWarning, label: "Needs evidence", value: overview?.missing_evidence ?? 0 },
    { icon: Handshake, label: "Co-signs", value: overview?.endorsements_received ?? 0 },
  ];

  const ring = Math.max(0, Math.min(100, completeness));

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

      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Your record</p>
          <p className="mt-1 flex items-end gap-2 text-5xl font-bold leading-none tracking-tight text-foreground">
            {loading ? "—" : <AnimatedNumber value={overview?.total_credits ?? 0} />}
            <span className="pb-1 text-sm font-medium text-muted-foreground">credits</span>
          </p>
        </div>

        {/* Completeness ring */}
        <div className="relative h-[86px] w-[86px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--accent-passport))"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - ring / 100) }}
              transition={{ duration: reduced ? 0 : 1.1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold leading-none text-foreground">
              <AnimatedNumber value={ring} />%
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Complete
            </span>
          </div>
        </div>
      </div>

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
    </motion.div>
  );
}
