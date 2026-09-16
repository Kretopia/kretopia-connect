import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { KretoMark } from "@/components/brand/KretoMark";
import { cn } from "@/lib/utils";

/**
 * Passport's dedicated Kreto entry point — deliberately not the generic
 * KretoTip whisper card used on Today/Discover/Match/Stages. Those surfaces
 * already work well and stay untouched; Passport gets its own framing
 * ("Your Executive Producer", violet --accent-passport styling, entrance
 * animation) so it reads as integrated to this specific surface rather than
 * a rotating tip that happens to be here. Same underlying mechanism though —
 * the existing `thrive-copilot:open` event and Copilot drawer, zero new
 * backend/event plumbing.
 */

const AUDIT_PROMPT = "Audit my Creative Passport. Give me the three highest-leverage things to improve, in order.";

interface PassportKretoEntryProps {
  className?: string;
}

export function PassportKretoEntry({ className }: PassportKretoEntryProps) {
  const open = (prompt?: string) => {
    window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: prompt ? { prompt } : {} }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[hsl(var(--accent-passport))]/25 bg-gradient-to-br from-[hsl(var(--accent-passport))]/10 via-card to-card p-4 sm:p-5",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[hsl(var(--accent-passport))]/20 blur-3xl"
      />

      <div className="relative flex items-center gap-3 sm:gap-4">
        <KretoMark size="md" />

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(var(--accent-passport))] mb-1">
            Your Executive Producer
          </p>
          <p className="text-sm sm:text-[15px] text-foreground/90 leading-snug">
            Kreto knows your whole Passport. Want the three highest-leverage things to fix, in order?
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => open(AUDIT_PROMPT)}
              className="group inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent-passport))] px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 hover:scale-[1.02] transition-all"
            >
              <Sparkles className="h-3 w-3" />
              Audit my Passport
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => open()}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
            >
              Or just chat
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default PassportKretoEntry;
