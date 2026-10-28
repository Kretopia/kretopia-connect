import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Option {
  method: "source_domain" | "admin_review";
  domain?: string;
  file_url?: string;
  line?: string;
}

const REASONS: Record<string, string> = {
  invalid_or_used: "This link is invalid, expired or already used. Ask the curator for a new one.",
  invalid_link: "This link is not valid.",
  proof_not_found: "The proof file could not be read yet. Check the address and try again.",
  proof_mismatch: "The proof file does not contain the expected line.",
  domain_not_available: "This listing has no website of its own to verify. Ask for an admin review.",
  already_claimed: "Someone else has already verified this listing.",
};

/**
 * Claiming a discovered listing. The link only lets you START a verification: it is an invitation, not proof that you
 * publish this listing. You become its manager only after proving control of the publisher's own website, or after a
 * curator reviews it. Nothing is sent to an email address you type, and the link leaves the address bar once used.
 */
export default function ClaimListing() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const { toast } = useToast();
  const [listing, setListing] = useState<{ title: string; original_publisher: string | null } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("external-claim", { body });
    let payload = data as { ok?: boolean; code?: string; message?: string; [k: string]: unknown } | null;
    if (error) {
      try {
        payload = await (error as unknown as { context: Response }).context.json();
      } catch {
        payload = { ok: false, code: "unavailable" };
      }
    }
    return payload ?? { ok: false, code: "unavailable" };
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await call({ action: "preview", listing_id: id });
      if (live) setListing(r.ok ? (r.listing as { title: string; original_publisher: string | null }) : null);
    })();
    return () => {
      live = false;
    };
  }, [id]);

  const start = async () => {
    setBusy(true);
    setMessage(null);
    const r = await call({ action: "redeem", listing_id: id, token });
    if (!r.ok) {
      setMessage(REASONS[String(r.code)] ?? r.message ?? "This link could not be used.");
      setBusy(false);
      return;
    }
    // The link is spent: take it out of the address bar so it cannot leak through history or a shared screen.
    window.history.replaceState(null, "", `/claim-listing/${id}`);
    const cid = String(r.claim_id);
    setClaimId(cid);
    const s = await call({ action: "start", claim_id: cid });
    setOptions(((s.options as Option[]) ?? []).filter(Boolean));
    setBusy(false);
  };

  const verifyDomain = async () => {
    setBusy(true);
    setMessage(null);
    const r = await call({ action: "verify_domain", claim_id: claimId });
    if (r.ok) setVerified(true);
    else setMessage(REASONS[String(r.code)] ?? r.message ?? "Could not verify.");
    setBusy(false);
  };

  const askReview = async () => {
    setBusy(true);
    const r = await call({ action: "request_review", claim_id: claimId });
    if (r.ok) setWaiting(true);
    else setMessage(r.message ?? "Could not send the request.");
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    const edits: Record<string, unknown> = {};
    if (description.trim()) edits.description_full = description.trim();
    if (deadline) edits.deadline_at = new Date(`${deadline}T23:59:59Z`).toISOString();
    const r = await call({ action: "owner_update", listing_id: id, edits });
    toast(r.ok ? { title: "Saved" } : { title: "Could not save", description: r.message, variant: "destructive" });
    setBusy(false);
  };

  const domain = options.find((o) => o.method === "source_domain");

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Claim a listing | Kretopia" description="Verify that you publish a listing." noindex />
      <Helmet>
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <FeaturePageHeader eyebrow="Claim" title="Is this your listing?" subtitle="Verify that you publish it, then manage it. A claim link is an invitation to verify, not proof of ownership." compact />
      <StudioFeatureShell>
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-5">
          {listing === undefined && <KretopiaLoader label="Loading listing" size="sm" />}
          {listing === null && <p className="text-sm text-muted-foreground">This listing is not available to claim.</p>}
          {listing && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Listing</p>
                <p className="text-base font-semibold text-foreground">{listing.title}</p>
                {listing.original_publisher && <p className="text-xs text-muted-foreground">{listing.original_publisher}</p>}
              </div>

              {!claimId && !verified && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Starting a verification does not make you the owner. You will be asked to prove control of the publisher's own website, or to request a review by a Kretopia curator.</p>
                  <Button onClick={start} disabled={busy} className="min-h-11">
                    {busy ? <KretopiaSpinner className="mr-2 h-4 w-4" /> : null}Start verification
                  </Button>
                </div>
              )}

              {claimId && !verified && !waiting && (
                <div className="space-y-4">
                  {domain && (
                    <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
                      <p className="text-sm font-medium text-foreground">Prove control of {domain.domain}</p>
                      <p className="text-xs text-muted-foreground">Publish a plain text file at this address with this single line, then verify:</p>
                      <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{domain.file_url}</code>
                      <code className="block break-all rounded bg-muted px-2 py-1 text-xs" data-testid="proof-line">{domain.line}</code>
                      <Button onClick={verifyDomain} disabled={busy} className="min-h-11">I have added it, verify</Button>
                    </div>
                  )}
                  <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-sm font-medium text-foreground">Ask for a review</p>
                    <p className="text-xs text-muted-foreground">A curator checks that you publish this listing. You become its manager only if they approve.</p>
                    <Button variant="outline" onClick={askReview} disabled={busy} className="min-h-11">Request a review</Button>
                  </div>
                </div>
              )}

              {waiting && <p className="text-sm text-muted-foreground" role="status">Review requested. You are not the owner of this listing until a curator approves it.</p>}

              {verified && (
                <div className="space-y-3" data-testid="owner-controls">
                  <p className="text-sm font-medium text-foreground" role="status">Verified. You can manage this listing.</p>
                  <div className="space-y-1">
                    <Label htmlFor="desc">Description (yours, as the publisher)</Label>
                    <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={20000} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">Applications through Kretopia stay off until a curator reviews and enables them. Applications at your own site are unchanged.</p>
                  <Button onClick={save} disabled={busy} className="min-h-11">Save</Button>
                </div>
              )}

              {message && <p className="text-sm text-destructive" role="alert">{message}</p>}
            </>
          )}
        </div>
      </StudioFeatureShell>
    </div>
  );
}
