import { scoutEvidence } from "@/lib/scoutEvidence";

/**
 * The Scout list as plain text for Kreto.
 *
 * "Shortlist for me" used to send a generic prompt ("shortlist the
 * opportunities here"), but Kreto cannot see the page, so it had nothing real
 * to shortlist. This turns the gigs the user is looking at into a compact,
 * numbered list that is appended to the prompt, so the answer is about those
 * gigs and nothing else.
 */
export interface ScoutedGigSummary {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  compensation: string | null;
  fit_reason: string | null;
  source_name?: string | null;
  source?: string | null;
}

const MAX_GIGS = 12;
const MAX_FIELD = 140;

const clip = (value: string | null | undefined, max = MAX_FIELD) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** Returns "" when there is nothing to show, so callers can skip the section. */
export function summarizeScoutedGigs(gigs: ScoutedGigSummary[]): string {
  if (!gigs.length) return "";
  const lines = gigs.slice(0, MAX_GIGS).map((g, i) => {
    const where = [clip(g.location, 60), g.remote ? "remote" : ""].filter(Boolean).join(", ");
    const head = `${i + 1}. ${clip(g.title, 100)}${g.company ? ` at ${clip(g.company, 60)}` : ""}${where ? ` (${where})` : ""}`;
    const parts = [
      head,
      g.compensation ? `pay: ${clip(g.compensation, 60)}` : "pay not listed",
      g.source_name || g.source ? `via ${clip(g.source_name || g.source, 40)}` : "",
    ].filter(Boolean);
    const reason = clip(scoutEvidence({ fit_reason: g.fit_reason, compensation: g.compensation, source: g.source })?.lines.join(" · "), 160);
    return reason ? `${parts.join(" · ")} — ${reason}` : parts.join(" · ");
  });
  const more = gigs.length > MAX_GIGS ? `\n(+${gigs.length - MAX_GIGS} more not listed)` : "";
  return `Gigs currently on my Scout list:\n${lines.join("\n")}${more}`;
}
