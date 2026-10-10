import { Link } from "react-router-dom";
import { ArrowRight, Radio } from "lucide-react";

import type { LiveStage } from "./radar.queries";

/**
 * Stages that are live right now, each one a link that joins it. Shown only
 * when there is at least one: a "live" banner with nothing live would be noise.
 */
export function RadarLive({ stages, total }: { stages: LiveStage[]; total: number }) {
  if (stages.length === 0) return null;
  return (
    <section
      aria-label="Live now"
      className="rounded-2xl border border-[hsl(var(--energy)/0.35)] bg-[hsl(var(--energy)/0.06)] p-3 sm:p-4"
    >
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground">
        <span className="relative inline-flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--energy))] opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--energy))]" />
        </span>
        Live now{total > stages.length ? ` · ${total} Stages` : ""}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {stages.slice(0, 2).map((s) => (
          <li key={s.id}>
            <Link
              to={`/circle?tab=stages&join=${s.id}`}
              className="group flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:border-[hsl(var(--energy)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.6)]"
            >
              <Radio className="h-4 w-4 shrink-0 text-[hsl(var(--energy))]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{s.title || "Live Stage"}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {[s.vibe_tag, typeof s.participant_count === "number" ? `${s.participant_count} in the room` : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground">
                Join <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RadarLive;
