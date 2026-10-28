import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { ListingLabels } from "./ListingLabels";

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

const COLUMNS = "id, kind, status, title, original_publisher, location, remote_scope, source_published_at, deadline_at, apply_url, excerpt, last_checked_at, source_provider, claimed";

/**
 * Listings a curator approved after they were found outside Kretopia. Only the public view is read. Each card says it is
 * external and unclaimed (or claimed), and "Apply at source" opens the publisher's own page: Kretopia collects nothing.
 * One kind at a time, never mixed: gigs here, events and talent are separate objects.
 */
export function PublishedExternalListings({ kind }: { kind: "gig" | "event" | "talent" }) {
  const [rows, setRows] = useState<PublicListing[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the view is not in the generated types yet
      const { data, error } = await (supabase.from("public_external_listings" as any) as any).select(COLUMNS).eq("kind", kind).order("last_checked_at", { ascending: false, nullsFirst: false }).limit(30);
      if (!live) return;
      if (error) setFailed(true);
      setRows((data ?? []) as PublicListing[]);
    })();
    return () => {
      live = false;
    };
  }, [kind]);

  if (rows === null) return <KretopiaLoader label="Loading sourced listings" size="sm" />;
  if (failed) return <p className="text-sm text-muted-foreground">Sourced listings could not be loaded right now.</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Search className="mb-2 h-4 w-4" aria-hidden />
        Nothing sourced here yet. Listings appear after a curator has reviewed them against their original source.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((l) => (
        <li key={l.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <ListingLabels claimed={l.claimed} lastCheckedAt={l.last_checked_at} sourceName={l.source_provider} />
          <Link to={`/listing/${l.id}`} className="text-sm font-semibold text-foreground hover:underline">
            {l.title}
          </Link>
          <p className="text-xs text-muted-foreground">{[l.original_publisher, l.location, l.remote_scope === "remote" ? "Remote" : null].filter(Boolean).join(" · ")}</p>
          {l.excerpt && <p className="line-clamp-3 text-xs text-muted-foreground">{l.excerpt}</p>}
          {l.apply_url && (
            <Button asChild size="sm" variant="outline" className="mt-auto min-h-11 sm:min-h-0">
              <a href={l.apply_url} target="_blank" rel="noopener noreferrer nofollow">
                Apply at source <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
              </a>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
