import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { ListingLabels } from "./ListingLabels";
import { sourceLinkRel } from "../../../supabase/functions/_shared/discovery/labels";

export interface PublicListing {
  id: string;
  kind: string;
  status: string;
  title: string;
  original_publisher: string | null;
  location: string | null;
  remote_scope: string | null;
  source_published_at: string | null;
  deadline_at: string | null;
  apply_url: string | null;
  excerpt: string | null;
  last_checked_at: string | null;
  source_provider: string | null;
  claimed: boolean;
}

export const PUBLIC_LISTING_COLUMNS = "id, kind, status, title, original_publisher, location, remote_scope, source_published_at, deadline_at, apply_url, excerpt, last_checked_at, source_provider, claimed";

type Kind = "gig" | "event" | "talent";

/** What each kind of listing says: the button that leaves for the original page, and the empty state. A person is not "applied to". */
const COPY: Record<Kind, { cta: string; empty: string; failed: string }> = {
  gig: { cta: "Apply at source", empty: "Nothing sourced here yet. Listings appear after a curator has reviewed them against their original source.", failed: "Sourced listings could not be loaded right now." },
  event: { cta: "Open at source", empty: "No sourced events yet. Events appear after a curator has reviewed them against their original source.", failed: "Sourced events could not be loaded right now." },
  talent: { cta: "View at source", empty: "No sourced creatives yet. They appear after a curator has reviewed them against their original source.", failed: "Sourced creatives could not be loaded right now." },
};

const PILL = "rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

/**
 * Listings a curator approved after they were found outside Kretopia. Only the public view is read. Each card says it is
 * external and unclaimed (or claimed), and the button opens the publisher's own page: Kretopia collects nothing and sends nothing.
 * One kind at a time, never mixed: gigs, events and talent are separate objects.
 * A signed-in member also sees "Kept" on the gigs they marked interested in the Match deck.
 */
export function PublishedExternalListings({ kind }: { kind: Kind }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PublicListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [kept, setKept] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the view is not in the generated types yet
        const { data, error } = await (supabase.from("public_external_listings" as any) as any).select(PUBLIC_LISTING_COLUMNS).eq("kind", kind).order("last_checked_at", { ascending: false, nullsFirst: false }).limit(30);
        if (!live) return;
        if (error) setFailed(true);
        setRows((data ?? []) as PublicListing[]);
      } catch {
        if (!live) return;
        setFailed(true);
        setRows([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [kind]);

  // Which of these gigs the member kept in the deck. A failed read just means no chip.
  useEffect(() => {
    if (kind !== "gig" || !user?.id || !rows?.length) return;
    let live = true;
    (async () => {
      try {
        const { data } = await supabase.from("swipes").select("target_id").eq("user_id", user.id).eq("target_type", "opportunity").eq("direction", "right").in("target_id", rows.map((r) => r.id));
        if (live) setKept(new Set((data ?? []).map((s: { target_id: string }) => s.target_id)));
      } catch {
        /* no chip */
      }
    })();
    return () => {
      live = false;
    };
  }, [kind, user?.id, rows]);

  const copy = COPY[kind];
  if (rows === null) return <KretopiaLoader label="Loading sourced listings" size="sm" />;
  if (failed) return <p className="text-sm text-muted-foreground">{copy.failed}</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Search className="mb-2 h-4 w-4" aria-hidden />
        {copy.empty}
      </div>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((l) => (
        <li key={l.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <ListingLabels claimed={l.claimed} lastCheckedAt={l.last_checked_at} sourceName={l.source_provider} />
            {kept.has(l.id) && <span className={PILL}>Kept</span>}
          </div>
          <Link to={`/listing/${l.id}`} className="text-sm font-semibold text-foreground hover:underline">
            {l.title}
          </Link>
          <p className="text-xs text-muted-foreground">{[l.original_publisher, l.location, l.remote_scope === "remote" ? "Remote" : null].filter(Boolean).join(" · ")}</p>
          {l.excerpt && <p className="line-clamp-3 text-xs text-muted-foreground">{l.excerpt}</p>}
          {l.apply_url && (
            <Button asChild size="sm" variant="outline" className="mt-auto min-h-11 sm:min-h-0">
              <a href={l.apply_url} target="_blank" rel={sourceLinkRel(l.source_provider)}>
                {copy.cta} <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
              </a>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
