import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { MatchBrand } from "./MatchBrand";
import { MatchWaitingScene } from "./MatchWaitingScene";
import { MATCH_WAIT_STEPS, MATCH_WAIT_TIPS, useRotation } from "./matchWaiting";
import { HoloCard } from "@/components/passport/HoloCard";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { CARD_PORTRAIT_DECK } from "@/components/cards/cardTokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const CSS = `
@keyframes k-mw-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
@keyframes k-mw-tip { 0% { opacity: 0; transform: translateY(4px); } 12%, 88% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-4px); } }
.k-mw-bar { position: relative; height: 3px; overflow: hidden; border-radius: 9999px; background: hsl(var(--border)); }
.k-mw-bar > span { position: absolute; inset: 0 auto 0 0; width: 38%; border-radius: inherit; background: linear-gradient(90deg, var(--k-g-1), var(--k-g-2), var(--k-g-3), var(--k-g-4)); animation: k-mw-bar 1.7s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
.k-mw-tip { animation: k-mw-tip 4.2s ease-in-out both; }
@media (prefers-reduced-motion: reduce) { .k-mw-bar > span, .k-mw-tip { animation: none !important; } .k-mw-bar > span { width: 100%; opacity: 0.5; } }
`;

/**
 * The Match deck's one card for every moment that is not a profile: a deck on its way, a sign-in, a retry, a deck with no one in it.
 * It is a full Kretopia card, not a picture: the brand and its gradient, the Match scene (Kreto in rings of the logo's colours with
 * Passports travelling around it), a message in the card's own voice and, while something loads, three steps coming together with a
 * line of true tips under them, so a short wait reads as the deck being prepared. It keeps the same footprint as a profile and its
 * action rail, so nothing jumps when the first person arrives.
 */
export function MatchStateCard({ title, description, busy = false, children }: {
  title?: string; description?: string; busy?: boolean; children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const tip = useRotation(MATCH_WAIT_TIPS.length, 4200, reduced);
  const step = useRotation(MATCH_WAIT_STEPS.length, 1900, reduced || !busy);
  return <div className={`${CARD_PORTRAIT_DECK} k-match-stage`} aria-busy={busy}>
    <style>{CSS}</style>
    <div className="mb-2 h-7" />
    <HoloCard className="k-match-card" glow={false}>
      <article aria-label={title ?? "Kretopia Match"} className="relative flex h-full min-h-[34rem] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        {/* The logo's gradient as a hairline along the top edge. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px" style={{ background: "linear-gradient(90deg, var(--k-g-1), var(--k-g-2) 35%, var(--k-g-3) 65%, var(--k-g-4))" }} />
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <MatchBrand />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "linear-gradient(135deg, var(--k-g-2), var(--k-g-3))" }} />
            Match
          </span>
        </header>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-5 py-6">
          <MatchWaitingScene busy={busy} />

          <div className="w-full space-y-2 text-center" aria-live="polite">
            {title ? <h3 className="k-gradient-text text-xl font-bold leading-tight">{title}</h3> : <h3 className="k-gradient-text text-xl font-bold leading-tight">Your creative universe</h3>}
            {description ? <p className="mx-auto max-w-[22rem] text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>

          {busy ? (
            <div className="w-full max-w-[20rem] space-y-3" data-match-progress>
              <div className="k-mw-bar" aria-hidden><span /></div>
              <ol className="space-y-1.5 text-left text-xs">
                {MATCH_WAIT_STEPS.map((label, i) => {
                  const done = i < step;
                  const current = i === step;
                  return (
                    <li key={label} className={cn("flex items-center gap-2 transition-colors", current ? "font-semibold text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60")}>
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {done ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : current ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-border" aria-hidden />}
                      </span>
                      {label}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {children ? <div className="flex flex-wrap items-center justify-center gap-2">{children}</div> : null}

          {/* One true thing at a time, never an instruction, never a promise of someone in particular. */}
          <p key={tip} className={cn("min-h-[2.5rem] max-w-[22rem] text-center text-xs leading-relaxed text-muted-foreground", !reduced && "k-mw-tip")} data-match-tip>
            {MATCH_WAIT_TIPS[tip]}
          </p>
        </div>

        <footer className="flex justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground"><span>People. Possibilities.</span><span>Kretopia Passport</span></footer>
      </article>
    </HoloCard>
    <div className="mt-2 h-12" />
  </div>;
}
