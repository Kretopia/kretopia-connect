import { useEffect, useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { Loader2, ShieldAlert, Upload, X, ExternalLink, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

const disputeSchema = z.object({
  challenger_role: z
    .string()
    .trim()
    .min(2, "Tell us your role on this project")
    .max(100, "Role must be under 100 characters"),
  challenger_evidence: z
    .string()
    .trim()
    .min(20, "Please describe your involvement (at least 20 characters)")
    .max(2000, "Description must be under 2000 characters"),
});

interface CreditRow {
  id: string;
  user_id: string;
  project_name: string;
  role: string;
  url: string | null;
  thumbnail_url: string | null;
  year: number | null;
  description: string | null;
  platform: string | null;
}

interface OwnerProfile {
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

const DisputeCredit = () => {
  const { creditId } = useParams<{ creditId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [credit, setCredit] = useState<CreditRow | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingDispute, setExistingDispute] = useState(false);

  const [role, setRole] = useState("");
  const [evidence, setEvidence] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!creditId) return;
    let cancelled = false;
    (async () => {
      const { data: c, error } = await supabase
        .from("credits")
        .select("id, user_id, project_name, role, url, thumbnail_url, year, description, platform")
        .eq("id", creditId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !c) {
        setLoading(false);
        return;
      }
      setCredit(c as CreditRow);

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, username")
        .eq("user_id", c.user_id)
        .maybeSingle();
      if (!cancelled) setOwner(prof as OwnerProfile | null);

      if (user?.id) {
        const { data: prior } = await supabase
          .from("credit_claim_disputes")
          .select("id")
          .eq("credit_id", creditId)
          .eq("challenger_id", user.id)
          .in("status", ["pending", "approved"])
          .maybeSingle();
        if (!cancelled) setExistingDispute(!!prior);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [creditId, user?.id]);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next: File[] = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        toast.error(`Up to ${MAX_FILES} files only`);
        break;
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: max 10MB`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!user?.id || !credit) return;
    if (user.id === credit.user_id) {
      toast.error("You can't dispute your own credit");
      return;
    }

    const parsed = disputeSchema.safeParse({ challenger_role: role, challenger_evidence: evidence });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const evidence_urls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${credit.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(path, file);
        if (upErr) throw upErr;
        evidence_urls.push(path);
      }

      const { error: insErr } = await supabase.from("credit_claim_disputes").insert({
        credit_id: credit.id,
        current_owner_id: credit.user_id,
        challenger_id: user.id,
        challenger_role: parsed.data.challenger_role,
        challenger_evidence: parsed.data.challenger_evidence,
        source_url: credit.url,
        evidence_urls,
        status: "pending",
      });
      if (insErr) throw insErr;

      setSubmitted(true);
      toast.success("Dispute submitted — the current owner will be notified");
    } catch (err) {
      console.error("[dispute] submit error:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't submit dispute");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-16 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Sign in to dispute a credit</h1>
        <p className="text-sm text-muted-foreground mb-4">
          You need an account so we can verify your identity and notify the current owner.
        </p>
        <Button asChild>
          <Link to={`/auth?redirect=/dispute/${creditId}`}>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!credit) {
    return (
      <div className="container max-w-md py-16 text-center">
        <h1 className="text-xl font-bold mb-2">Credit not found</h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container max-w-md py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Dispute filed</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We've notified the current owner. They have 7 days to respond before our team reviews it.
        </p>
        <Button asChild>
          <Link to="/profile">Go to my profile</Link>
        </Button>
      </div>
    );
  }

  const isOwn = user.id === credit.user_id;

  return (
    <>
      <Helmet>
        <title>Dispute credit — Kretopia</title>
        <meta name="description" content="Challenge a credit you believe belongs to you. Upload evidence and submit your claim for review." />
      </Helmet>

      <div className="container max-w-2xl py-6 px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Dispute this credit</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          If this work is yours, file a dispute. The current owner has 7 days to respond, then our trust team reviews.
        </p>

        {/* Disputed credit card */}
        <Card className="p-4 mb-6">
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
                {credit.platform && <Badge variant="outline" className="text-xs">{credit.platform}</Badge>}
              </div>
              {credit.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{credit.description}</p>
              )}
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
          {owner && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
              <span>Currently claimed by</span>
              <Link
                to={owner.username ? `/${owner.username}` : `/profile/${credit.user_id}`}
                className="font-medium text-foreground hover:underline"
              >
                {owner.full_name || "another user"}
              </Link>
            </div>
          )}
        </Card>

        {isOwn ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            This is your own credit — nothing to dispute.
          </Card>
        ) : existingDispute ? (
          <Card className="p-4 text-center">
            <p className="text-sm font-medium mb-1">You've already filed a dispute on this credit.</p>
            <p className="text-xs text-muted-foreground">We'll email you once the owner or our team responds.</p>
          </Card>
        ) : (
          <Card className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="role">Your role on this project *</Label>
              <Input
                id="role"
                placeholder="e.g. Director, Lead Producer, Editor"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evidence">Describe your involvement *</Label>
              <Textarea
                id="evidence"
                placeholder="What did you contribute? Include dates, collaborators, or anything that proves this is your work."
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={5}
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground">{evidence.length} / 2000</p>
            </div>

            <div className="space-y-1.5">
              <Label>Supporting evidence (optional)</Label>
              <p className="text-[11px] text-muted-foreground">
                Screenshots, contracts, on-set photos, or PDFs. Up to {MAX_FILES} files, 10MB each.
              </p>
              <label className="flex items-center justify-center gap-2 border border-dashed rounded-lg py-6 cursor-pointer hover:bg-muted/50 transition">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Upload files</span>
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul className="space-y-1.5 mt-2">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-muted text-xs"
                    >
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground flex-shrink-0">
                        {(f.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="p-1 hover:bg-background rounded"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-[11px] text-muted-foreground">
              By submitting, you confirm this information is accurate. False or malicious disputes
              may result in account suspension.
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit dispute
            </Button>
          </Card>
        )}
      </div>
    </>
  );
};

export default DisputeCredit;
