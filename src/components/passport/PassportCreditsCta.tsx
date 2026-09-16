import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * PassportCreditsCta — the single bridge from the Passport to Credits.
 * Everything that used to sit below the Passport (Stamps, Book Me, Skills,
 * Co-signs, Reviews) now lives in the Credits dashboard; this card is how
 * the owner gets there.
 */
export function PassportCreditsCta({
  verified,
  total,
  cosigns,
}: {
  verified: number;
  total: number;
  cosigns: number;
}) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={() => navigate("/credits")}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, ease: [0.2, 0.65, 0.3, 0.95] }}
      whileHover={reduced ? undefined : { y: -2 }}
      className="group relative mt-3 w-full overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-[hsl(var(--signal-teal))]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--signal-teal))]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120% 120% at 0% 0%, hsl(var(--signal-teal)/0.14), transparent 55%), radial-gradient(120% 120% at 100% 100%, hsl(var(--primary)/0.12), transparent 55%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--signal-teal))]/30 bg-[hsl(var(--signal-teal))]/10 text-[hsl(var(--signal-teal))]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            Your record
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">
            Open your Credits dashboard
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {verified} verified · {total} credits · {cosigns} co-signs — plus Book Me, Skills and Reviews.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[hsl(var(--signal-teal))]" />
      </div>
    </motion.button>
  );
}

export default PassportCreditsCta;
