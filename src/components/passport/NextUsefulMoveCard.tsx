import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activeHidden, LATER_MS, milestones, nextUsefulMove, type HiddenMoves, type MoveInput, type MoveId } from "@/lib/passport/nextUsefulMove";

/**
 * Pilot (behind FEATURE_PILOT_NEXT_MOVE, off by default): the owner's one next useful move and the three steps it leads through.
 * Private to the owner. "Later" and "Not relevant" are respected without penalty and remembered only in this browser.
 */
const storageKey = (userId: string) => `kretopia:next-move-hidden:${userId}`;
const readHidden = (userId: string): HiddenMoves => {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "{}") as HiddenMoves; } catch { return {}; }
};

const STEPS: Array<{ id: keyof ReturnType<typeof milestones>; label: string }> = [
  { id: "passport_live", label: "Passport Live" },
  { id: "first_proof", label: "First Proof" },
  { id: "co_signed", label: "Co-Signed" },
];

export function NextUsefulMoveCard({ userId, input, onUse }: { userId: string; input: MoveInput; onUse?: (move: MoveId, choice: "open" | "later" | "not_relevant") => void }) {
  const [hidden, setHidden] = useState<HiddenMoves>(() => readHidden(userId));
  const done = milestones(input);
  const move = useMemo(() => nextUsefulMove(input, activeHidden(hidden)), [input, hidden]);

  const putAside = (id: MoveId, choice: "later" | "not_relevant") => {
    const next = { ...hidden, [id]: { until: choice === "later" ? Date.now() + LATER_MS : null } };
    setHidden(next);
    try { localStorage.setItem(storageKey(userId), JSON.stringify(next)); } catch { /* private mode: hidden for this visit only */ }
    onUse?.(id, choice);
  };

  return (
    <section aria-label="Your next move" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <ol className="mb-3 flex flex-wrap gap-2 text-[11px] font-medium" aria-label="Passport steps">
        {STEPS.map((s) => (
          <li key={s.id} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${done[s.id] ? "border-primary/40 text-foreground" : "border-border text-muted-foreground"}`}>
            {done[s.id] && <Check className="h-3 w-3" aria-hidden />}
            {s.label}
            <span className="sr-only">{done[s.id] ? "done" : "not yet"}</span>
          </li>
        ))}
      </ol>
      {move ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{move.label}</h3>
          <p className="text-xs text-muted-foreground">{move.why}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button asChild size="sm" className="gap-1.5" onClick={() => onUse?.(move.id, "open")}>
              <Link to={move.to}>{move.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => putAside(move.id, "later")}>Later</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => putAside(move.id, "not_relevant")}>Not relevant</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing to do here right now.</p>
      )}
    </section>
  );
}
