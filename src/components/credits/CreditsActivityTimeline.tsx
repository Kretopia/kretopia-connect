import { ShieldCheck, Plus, Handshake } from "lucide-react";
import type { MyCredit } from "@/hooks/useMyCredits";
import { DashboardPanel, CreditsEmptyState, CreditsPanelSkeleton } from "./CreditsPrimitives";

/**
 * CreditsActivityTimeline — a derived, read-only history of the caller's own
 * credit record (added / co-signed / verified). No other user's events.
 */
export function CreditsActivityTimeline({
  credits,
  loading,
  index,
}: {
  credits: MyCredit[];
  loading?: boolean;
  index?: number;
}) {
  const events = credits
    .slice()
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 8)
    .map((c) => {
      if (c.verification_status === "verified") {
        return { id: c.id, icon: ShieldCheck, text: `${c.project_name} was verified`, meta: c.role, at: c.created_at };
      }
      if (c.endorsement_count > 0) {
        return {
          id: c.id,
          icon: Handshake,
          text: `${c.endorsement_count} co-sign${c.endorsement_count > 1 ? "s" : ""} on ${c.project_name}`,
          meta: c.role,
          at: c.created_at,
        };
      }
      return { id: c.id, icon: Plus, text: `You added ${c.project_name}`, meta: c.role, at: c.created_at };
    });

  return (
    <DashboardPanel id="activity" eyebrow="04" title="Credit activity" index={index}>
      {loading ? (
        <CreditsPanelSkeleton rows={3} />
      ) : events.length === 0 ? (
        <CreditsEmptyState
          title="No activity yet"
          body="Adding a credit, attaching evidence or receiving a co-sign will show up here with a timestamp."
        />
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {events.map((e) => (
            <li key={`${e.id}-${e.text}`} className="relative">
              <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background">
                <e.icon className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-sm text-foreground">{e.text}</p>
              <p className="text-[11px] text-muted-foreground">
                {e.meta ? `${e.meta} · ` : ""}
                <time dateTime={e.at}>{new Date(e.at).toLocaleDateString()}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}
