import type { ReactNode } from "react";
import { MatchBrand } from "./MatchBrand";
import { HoloCard } from "@/components/passport/HoloCard";
import { KretoScene } from "@/components/brand/KretoScene";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { CARD_PORTRAIT_DECK } from "@/components/cards/cardTokens";

/** The same portrait footprint as a profile, including the action rail. */
export function MatchStateCard({ title, description, busy = false, children }: {
  title: string; description?: string; busy?: boolean; children?: ReactNode;
}) {
  return <div className={`${CARD_PORTRAIT_DECK} k-match-stage`} aria-busy={busy}>
    <div className="mb-4 h-9" />
    <HoloCard className="k-match-card" glow={false}>
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <MatchBrand /><span className="text-xs font-semibold text-muted-foreground">MATCH</span>
        </header>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <KretoScene scene="talent-search" size="thumb" className="h-full w-full" />
        </div>
        <div className="space-y-4 border-t border-border p-6 text-center" aria-live="polite">
          {busy ? <KretopiaSpinner className="mx-auto h-9 w-9" /> : null}
          <h3 className="k-gradient-text text-2xl font-bold leading-tight">{title}</h3>
          {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
        </div>
        <footer className="flex justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>People. Possibilities.</span><span>Kretopia Passport</span></footer>
      </article>
    </HoloCard>
    <div className="h-20" />
  </div>;
}