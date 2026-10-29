import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ExternalLink, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { ListingLabels } from "@/components/external/ListingLabels";
import type { Budget } from "../../supabase/functions/_shared/discovery/extract";
import { canonicalFor, eventJsonLd, externalJobPosting, robotsFor, type ListingSeoInput } from "../../supabase/functions/_shared/discovery/seo";
import { sourceLinkRel } from "../../supabase/functions/_shared/discovery/labels";

interface Row {
  id: string;
  kind: "gig" | "event" | "talent";
  status: string;
  title: string;
  original_publisher: string | null;
  location: string | null;
  remote_scope: string | null;
  source_published_at: string | null;
  deadline_at: string | null;
  deadline_tz: string | null;
  budget: Budget | null;
  apply_url: string | null;
  excerpt: string | null;
  description_full: string | null;
  starts_at: string | null;
  ends_at: string | null;
  verification_status: string;
  last_checked_at: string | null;
  source_provider: string | null;
  source_url: string | null;
  applications_enabled: boolean;
  claimed: boolean;
}

const COLUMNS = "id, kind, status, title, original_publisher, location, remote_scope, source_published_at, deadline_at, deadline_tz, budget, apply_url, excerpt, description_full, starts_at, ends_at, verification_status, last_checked_at, source_provider, source_url, applications_enabled, claimed";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null);

/**
 * A discovered listing's public page. It says what the record says and no more: where it came from, when it was last
 * checked, whether anyone has claimed it, and where to apply (the publisher's own page). Search engines are told to
 * index it only when there is enough permitted content, a real publisher and a destination; JobPosting appears only
 * for a gig its verified owner published here.
 */
export default function ExternalListing() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the view is not in the generated types yet
      const { data } = await (supabase.from("public_external_listings" as any) as any).select(COLUMNS).eq("id", id).maybeSingle();
      if (live) setRow((data as Row | null) ?? null);
    })();
    return () => {
      live = false;
    };
  }, [id]);

  // Only a signed-in person looking at a CLAIMED listing is asked whether it is theirs: the server answers about the caller alone.
  // A failed or refused answer simply shows no link.
  const claimed = row?.claimed === true;
  useEffect(() => {
    if (!user?.id || !claimed) {
      setOwner(false);
      return;
    }
    let live = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("external-claim", { body: { action: "status", listing_id: id } });
        if (live) setOwner((data as { owner?: boolean } | null)?.owner === true);
      } catch {
        if (live) setOwner(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [user?.id, claimed, id]);

  const report = async () => {
    if (!user) {
      toast({ title: "Sign in to report a listing" });
      return;
    }
    const { error } = await supabase.functions.invoke("external-claim", { body: { action: "dispute", listing_id: id, reason: "Reported from the listing page" } });
    toast(error ? { title: "Could not send the report", variant: "destructive" } : { title: "Reported", description: "The listing is hidden until a curator has looked at it." });
  };

  if (row === undefined) return <div className="min-h-screen bg-background p-8"><KretopiaLoader label="Loading listing" /></div>;

  const ownUrl = `https://www.kretopia.com/listing/${id}`;
  if (row === null) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="Listing not available | Kretopia" description="This listing is not available." noindex />
        <FeaturePageHeader eyebrow="Listing" title="Not available." subtitle="This listing was removed, has expired, or was never published." compact />
      </div>
    );
  }

  const now = new Date();
  const input: ListingSeoInput = { ...row, visibility: "public", flagged_instructions: false, url: ownUrl };
  const robots = robotsFor(input, now);
  const jsonLd = row.kind === "gig" ? externalJobPosting(input, now) : row.kind === "event" ? eventJsonLd(input, now) : null;
  const body = row.description_full ?? row.excerpt;
  const pay = row.budget ? `${row.budget.currency} ${[row.budget.min, row.budget.max].filter((x): x is number => x !== null).map((x) => x.toLocaleString("en-US")).join(" – ")}${row.budget.period ? ` / ${row.budget.period}` : ""}` : null;

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${row.title} | Kretopia`} description={(body ?? row.title).slice(0, 155)} type="article" url={ownUrl} noindex={robots === "noindex, nofollow"} />
      <Helmet>
        <link rel="canonical" href={canonicalFor({ ...input, source_url: row.source_url })} />
        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
      </Helmet>
      <FeaturePageHeader eyebrow={row.kind === "event" ? "Event" : row.kind === "talent" ? "Creative" : "Gig"} title={row.title} subtitle={[row.original_publisher, row.location].filter(Boolean).join(" · ") || "Found outside Kretopia"} compact />
      <StudioFeatureShell>
        <article className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card p-5">
          <ListingLabels claimed={row.claimed} lastCheckedAt={row.last_checked_at} sourceName={row.source_provider} />
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {row.source_published_at && (<div><dt className="text-xs text-muted-foreground">Posted at the source</dt><dd>{when(row.source_published_at)}</dd></div>)}
            {row.deadline_at && (<div><dt className="text-xs text-muted-foreground">Listed until</dt><dd>{when(row.deadline_at)}{row.deadline_tz ? ` (${row.deadline_tz})` : ""}</dd></div>)}
            {row.starts_at && (<div><dt className="text-xs text-muted-foreground">Starts</dt><dd>{when(row.starts_at)}</dd></div>)}
            {row.remote_scope && (<div><dt className="text-xs text-muted-foreground">Where</dt><dd className="capitalize">{row.remote_scope}</dd></div>)}
            {pay && (<div><dt className="text-xs text-muted-foreground">Pay stated at the source</dt><dd>{pay}</dd></div>)}
          </dl>
          {body && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{body}</p>}
          {!row.claimed && (
            <p className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
              Found outside Kretopia. Kretopia is not the publisher, does not verify this listing and does not collect applications for it. This is a short summary: the full listing is at the source.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {row.apply_url && (
              <Button asChild className="min-h-11">
                <a href={row.apply_url} target="_blank" rel={sourceLinkRel(row.source_provider)}>
                  Apply at source <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            )}
            {owner && (
              <Button asChild variant="outline" className="min-h-11">
                <Link to={`/claim-listing/${id}`}>Manage this listing</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-0" onClick={report}>
              <Flag className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Report a problem or an ownership dispute
            </Button>
          </div>
        </article>
      </StudioFeatureShell>
    </div>
  );
}
