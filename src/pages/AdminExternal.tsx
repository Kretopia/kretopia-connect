import { useCallback, useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ListingLabels } from "@/components/external/ListingLabels";

interface Item {
  id: string;
  kind: string;
  status: string;
  title: string;
  original_publisher: string | null;
  source_url: string | null;
  source_type: string;
  flagged_instructions: boolean;
  possible_duplicates: { id: string; reasons: string[] }[];
  extraction_issues: { code: string; message: string }[];
  last_checked_at: string | null;
}
interface Claim {
  id: string;
  listing_id: string;
  status: string;
}

/**
 * The curator's queue for discovered listings: import, review against the source, publish, and COPY a claim link. Nothing
 * on this page sends a message, an invitation or an application; the claim link is shown to nobody but copied to your
 * clipboard, and it is not stored.
 */
export default function AdminExternal() {
  const { isAdmin, loading } = useUserRole();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("external-import", { body });
    let payload = data as { ok?: boolean; message?: string; code?: string; [k: string]: unknown } | null;
    if (error) {
      try {
        payload = await (error as unknown as { context: Response }).context.json();
      } catch {
        payload = { ok: false, code: "unavailable" };
      }
    }
    return payload ?? { ok: false, code: "unavailable" };
  }, []);

  const load = useCallback(async () => {
    const r = await call({ action: "list_review" });
    setItems(r.ok ? ((r.listings as Item[]) ?? []) : []);
    setClaims(r.ok ? ((r.claims as Claim[]) ?? []) : []);
  }, [call]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const r = await call(body);
    toast(r.ok ? { title: ok } : { title: "Not done", description: r.message ?? String(r.code ?? ""), variant: "destructive" });
    setBusy(false);
    if (r.ok) void load();
    return r;
  };

  const copyLink = async (listingId: string) => {
    setBusy(true);
    const r = await call({ action: "claim_link", listing_id: listingId });
    if (r.ok && typeof r.link === "string") {
      await navigator.clipboard.writeText(r.link);
      toast({ title: "Claim link copied", description: "It was not sent to anyone. It expires and works once." });
    } else {
      toast({ title: "No link created", description: r.message ?? "Only an approved, unclaimed listing can be offered for claiming.", variant: "destructive" });
    }
    setBusy(false);
  };

  if (loading) return <div className="min-h-screen bg-background p-8"><KretopiaLoader label="Loading" /></div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="Discovered listings | Kretopia" description="Admins only." noindex />
        <FeaturePageHeader eyebrow="Admin" title="Admins only." subtitle="Reviewing discovered listings is limited to Kretopia curators." compact />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Discovered listings | Kretopia" description="Review listings found outside Kretopia." noindex />
      <FeaturePageHeader eyebrow="Admin" title="Discovered listings." subtitle="Import, review against the source, publish, and copy a claim link. Nothing here sends a message or applies anywhere." compact />
      <StudioFeatureShell>
        <div className="space-y-6">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-label="Import">
            <h2 className="text-sm font-semibold text-foreground">Import</h2>
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Address of an approved source" placeholder="https://remoteok.com/remote-jobs/…" value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1" />
              <Button disabled={busy || !url.trim()} className="min-h-11" onClick={async () => { const r = await run({ action: "ingest", input: { type: "url", url: url.trim() } }, "Draft created"); if (r.ok) setUrl(""); }}>Import address</Button>
            </div>
            <p className="text-xs text-muted-foreground">Only approved sources are fetched. For anything else, paste the text: it stays a private draft until a source corroborates it.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="t">Title</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="p">Publisher</Label><Input id="p" value={publisher} onChange={(e) => setPublisher(e.target.value)} /></div>
            </div>
            <Textarea aria-label="Pasted text" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste the listing text" />
            <Button variant="outline" disabled={busy || title.trim().length < 3 || text.trim().length < 20} className="min-h-11" onClick={async () => { const r = await run({ action: "ingest", input: { type: "text", text, fields: { title: title.trim(), original_publisher: publisher.trim() || null } } }, "Private draft created"); if (r.ok) { setText(""); setTitle(""); setPublisher(""); } }}>Create private draft</Button>
          </section>

          <section className="space-y-3" aria-label="Review queue">
            <h2 className="text-sm font-semibold text-foreground">Review queue</h2>
            {items === null && <KretopiaLoader label="Loading queue" size="sm" />}
            {items?.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
            {items?.map((l) => (
              <div key={l.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{l.title}</p>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{l.status.replace("_", " ")}</span>
                </div>
                <ListingLabels claimed={l.status === "claimed"} lastCheckedAt={l.last_checked_at} sourceName={l.source_type} />
                <p className="text-xs text-muted-foreground">{[l.original_publisher, l.source_url].filter(Boolean).join(" · ")}</p>
                {l.flagged_instructions && <p className="text-xs text-destructive">The source contains instruction-like text. Read it before anything is published.</p>}
                {l.possible_duplicates?.length > 0 && <p className="text-xs text-muted-foreground">Possible duplicate of {l.possible_duplicates.map((d) => d.id.slice(0, 8)).join(", ")}: {l.possible_duplicates[0].reasons.join("; ")}. Advice only, nothing was merged.</p>}
                {l.extraction_issues?.length > 0 && <p className="text-xs text-muted-foreground">Left unknown: {l.extraction_issues.map((i) => i.message).join(" ")}</p>}
                <div className="flex flex-wrap gap-2">
                  {(l.status === "in_review" || l.status === "draft") && <Button size="sm" className="min-h-11 sm:min-h-0" disabled={busy} onClick={() => run({ action: "review", listing_id: l.id, decision: "approve" }, "Published")}>Approve and publish</Button>}
                  {(l.status === "in_review" || l.status === "draft") && <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" disabled={busy} onClick={() => run({ action: "review", listing_id: l.id, decision: "reject" }, "Rejected")}>Reject</Button>}
                  {l.status === "published" && <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" disabled={busy} onClick={() => copyLink(l.id)}>Copy claim link</Button>}
                  {(l.status === "published" || l.status === "claimed") && <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-0" disabled={busy} onClick={() => run({ action: "review", listing_id: l.id, decision: "expire" }, "Expired")}>Mark expired</Button>}
                  {(l.status === "published" || l.status === "claimed") && <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-0" disabled={busy} onClick={() => run({ action: "review", listing_id: l.id, decision: "remove" }, "Removed")}>Remove</Button>}
                </div>
              </div>
            ))}
          </section>

          {claims.length > 0 && (
            <section className="space-y-3" aria-label="Claims to decide">
              <h2 className="text-sm font-semibold text-foreground">Claims to decide</h2>
              {claims.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Claim on listing {c.listing_id.slice(0, 8)} · {c.status}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="min-h-11 sm:min-h-0" disabled={busy} onClick={() => run({ action: "decide_claim", claim_id: c.id, decision: "approve" }, "Claim verified")}>Verify claimant</Button>
                    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" disabled={busy} onClick={() => run({ action: "decide_claim", claim_id: c.id, decision: "reject" }, "Claim declined")}>Decline</Button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </StudioFeatureShell>
    </div>
  );
}
