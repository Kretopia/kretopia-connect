import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { OutlineCtaButton } from "@/components/ui/glass-cta";
import { askKreto, type Proposal } from "./radar.logic";

/**
 * What Kreto can do with what is on the Radar right now. Each button is tied
 * to something visible above it (a person, an event, a gig) and only opens
 * Kreto; it never claims anything is done.
 */
export function RadarProposals({ proposals }: { proposals: Proposal[] }) {
  return (
    <aside aria-label="Kreto proposes" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 sm:flex-nowrap sm:p-4">
      <KretoCharacter variant="publicist" size={52} floatAmplitude={0} lazy className="shrink-0" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Kreto proposes</p>
        <p className="text-xs text-muted-foreground">I'll draft it, you review it. Nothing goes out without you.</p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
        {proposals.map((p) => (
          <OutlineCtaButton key={p.id} size="sm" onClick={() => askKreto(p.prompt)} className="min-h-11 max-w-full">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--energy))]">{p.kicker}</span>
            <span className="truncate">{p.label}</span>
          </OutlineCtaButton>
        ))}
      </div>
    </aside>
  );
}

export default RadarProposals;
