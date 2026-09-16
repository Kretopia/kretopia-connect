import { useEffect, useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { Loader2, ShieldAlert, ArrowLeft, ExternalLink, CheckCircle2, XCircle, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";

const responseSchema = z.object({
  owner_response: z
    .string()
    .trim()
    .min(20, "Please provide a meaningful response (at least 20 characters)")
    .max(2000, "Response must be under 2000 characters"),
});

interface DisputeRow {
  id: string;
  credit_id: string;
  current_owner_id: string;
  challenger_id: string;
  challenger_role: string | null;
  challenger_evidence: string | null;
  source_url: string | null;
  evidence_urls: string[] | null;
  status: string;
  owner_response: string | null;
  owner_responded_at: string | null;
  created_at: string;
}

interface CreditRow {
  id: string;
  project_name: string;
  role: string;
  url: string | null;
  thumbnail_url: string | null;
  year: number | null;
}

interface ChallengerProfile {
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

const DisputeManage = () => {
  const { disputeId } = useParams<{ disputeId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [dispute, setDispute] = useState<DisputeRow | null>(null);
  const [credit, setCredit] = useState<CreditRow | null>(null);
  const [challenger, setChallenger] = useState<ChallengerProfile | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<{ path: string; signed: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [response, setResponse] = useState("");

  useEffect(() => {
    if (!disputeId || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: d, error } = await supabase
        .from("credit_claim_disputes")
        .select("*")
        .eq("id", disputeId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !d) {
        setLoading(false);
        return;
      }
      setDispute(d as DisputeRow);
      setResponse((d as DisputeRow).owner_response || "");

      const [{ data: c }, { data: prof }] = await Promise.all([
        supabase
          .from("credits")
          .select("id, project_name, role, url, thumbnail_url, year")
          .eq("id", d.credit_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, avatar_url, username")
          .eq("user_id", d.challenger_id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setCredit(c as CreditRow | null);
      setChallenger(prof as ChallengerProfile | null);

      // Sign evidence URLs (1 hour expiry)
      if (d.evidence_urls?.length) {
        const signed = await Promise.all(
          d.evidence_urls.map(async (path: string) => {
            const { data } = await supabase.storage
              .from("dispute-evidence")
              .createSignedUrl(path, 3600);
            return { path, signed: data?.signedUrl || null };
          }),
        );
        if (!cancelled) setEvidenceUrls(signed);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [disputeId, user?.id]);

  const saveResponse = async () => {
    if (!dispute) return;
    const parsed = responseSchema.safeParse({ owner_response: response });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("credit_claim_disputes")
        .update({
          owner_response: parsed.data.owner_response,
          owner_responded_at: new Date().toISOString(),
        })
        .eq("id", dispute.id);
      if (error) throw error;
      toast.success("Response saved — our trust team will review");
      setDispute({ ...dispute, owner_response: parsed.data.owner_response, owner_responded_at: new Date().toISOString() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save response");
    } finally {
      setSubmitting(false);
    }
  };

  const transferCredit = async () => {
    if (!dispute || !credit) return;
    if (!confirm("Transfer this credit to the challenger? This action removes it from your profile.")) return;
    setTransferring(true);
    try {
      // Reassign credit ownership
      const { error: updErr } = await supabase
        .from("credits")
        .update({ user_id: dispute.challenger_id })
        .eq("id", credit.id);
      if (updErr) throw updErr;

      // Mark dispute resolved
      const { error: dispErr } = await supabase
        .from("credit_claim_disputes")
        .update({
          status: "transferred",
          resolution_note: "Transferred by current owner",
          resolved_at: new Date().toISOString(),
          resolved_by: user!.id,
        })
        .eq("id", dispute.id);
      if (dispErr) throw dispErr;

      toast.success("Credit transferred — challenger has been notified");
      navigate("/profile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't transfer credit");
    } finally {
      setTransferring(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!dispute || !credit) {
    return (
      <div className="container max-w-md py-16 text-center">
        <h1 className="text-xl font-bold mb-2">Dispute not found</h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const isOwner = user?.id === dispute.current_owner_id;
  const isChallenger = user?.id === dispute.challenger_id;
  const isResolved = ["approved", "rejected", "transferred"].includes(dispute.status);

  if (!isOwner && !isChallenger) {
    return (
      <div className="container max-w-md py-16 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Not authorized</h1>
        <p className="text-sm text-muted-foreground mb-4">You can only view disputes that involve you.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Manage dispute — Kretopia</title>
      </Helmet>

      <div className="container max-w-2xl py-6 px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">
            {isOwner ? "Credit dispute filed against you" : "Your dispute"}
          </h1>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <Badge variant={isResolved ? "secondary" : "default"} className="text-xs capitalize">
            {dispute.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Filed {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Disputed credit */}
        <Card className="p-4 mb-4">
          <div className="flex gap-3">
            {credit.thumbnail_url && (
              <img
                src={credit.thumbnail_url}
                alt={credit.project_name}
                className="w-20 h-28 object-cover rounded-md flex-shrink-0 bg-muted"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate">{credit.project_name}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge variant="secondary" className="text-xs">{credit.role}</Badge>
                {credit.year && <Badge variant="outline" className="text-xs">{credit.year}</Badge>}
              </div>
              {credit.url && (
                <a
                  href={credit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  Open source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </Card>

        {/* Challenger claim */}
        <Card className="p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={challenger?.avatar_url || undefined} />
              <AvatarFallback>{challenger?.full_name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {challenger?.full_name || "Challenger"}
              </div>
              <div className="text-xs text-muted-foreground">
                Claims role: <span className="font-medium text-foreground">{dispute.challenger_role}</span>
              </div>
            </div>
          </div>
          {dispute.challenger_evidence && (
            <div className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">
              {dispute.challenger_evidence}
            </div>
          )}
          {evidenceUrls.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Supporting evidence</div>
              <ul className="space-y-1">
                {evidenceUrls.map((e, i) => (
                  <li key={i}>
                    {e.signed ? (
                      <a
                        href={e.signed}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        {e.path.split("/").pop()}
                        <Download className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Evidence file (unavailable)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Owner actions */}
        {isOwner && !isResolved && (
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Your response</h3>
              <p className="text-xs text-muted-foreground">
                Explain why this credit is yours. Our trust team uses both sides to decide.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="response">Defense statement *</Label>
              <Textarea
                id="response"
                placeholder="Describe your involvement, attach links to source material, name collaborators, etc."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={6}
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground">{response.length} / 2000</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={saveResponse} disabled={submitting} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {dispute.owner_response ? "Update response" : "Submit response"}
              </Button>
              <Button
                variant="outline"
                onClick={transferCredit}
                disabled={transferring}
                className="flex-1"
              >
                {transferring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Transfer to challenger
              </Button>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-[11px] text-muted-foreground">
              You have 7 days to respond before our trust team reviews independently.
              Transferring is permanent and removes the credit from your profile.
            </div>
          </Card>
        )}

        {/* Owner response display (already responded or resolved) */}
        {dispute.owner_response && (
          <Card className="p-4 mt-4">
            <h3 className="font-semibold text-sm mb-2">
              {isOwner ? "Your response" : "Owner's response"}
            </h3>
            <div className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">
              {dispute.owner_response}
            </div>
            {dispute.owner_responded_at && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Submitted {formatDistanceToNow(new Date(dispute.owner_responded_at), { addSuffix: true })}
              </p>
            )}
          </Card>
        )}

        {/* Resolved state */}
        {isResolved && (
          <Card className="p-4 mt-4 text-center">
            {dispute.status === "transferred" || dispute.status === "approved" ? (
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
            ) : (
              <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            )}
            <p className="text-sm font-medium capitalize">Dispute {dispute.status}</p>
          </Card>
        )}
      </div>
    </>
  );
};

export default DisputeManage;
