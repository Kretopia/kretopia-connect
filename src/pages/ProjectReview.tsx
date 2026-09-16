import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Helmet } from "react-helmet-async";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  RotateCcw,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
} from "lucide-react";
import { toast } from "sonner";
import { FileThumbnail } from "@/components/project/files/FileThumbnail";

interface ResolvedLink {
  id: string;
  project_id: string;
  project_title: string;
  scope: string;
  scope_ref_id: string | null;
  label: string | null;
  can_comment: boolean;
  can_approve: boolean;
  can_download: boolean;
  requires_password: boolean;
}

interface FileRow {
  file_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  signed_url: string | null;
  deliverable_id: string | null;
  deliverable_title: string | null;
  deliverable_status: string | null;
}

const fnUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/redeem-project-share`;

async function callFn(body: any) {
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

function fileIcon(type: string | null) {
  if (!type) return FileText;
  if (type.startsWith("image")) return ImageIcon;
  if (type.startsWith("video")) return VideoIcon;
  if (type.startsWith("audio")) return MusicIcon;
  return FileText;
}

export default function ProjectReview() {
  const { token } = useParams<{ token: string }>();

  const [link, setLink] = useState<ResolvedLink | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");

  // approval modal
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<FileRow | null>(null);
  const [decision, setDecision] = useState<"approved" | "revision_requested">(
    "approved"
  );
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // viewer (lightbox)
  const [viewer, setViewer] = useState<FileRow | null>(null);

  const init = async (pwd?: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const r = await callFn({ action: "resolve", token, password: pwd });
    if (r.status === 401 && r.data?.requires_password) {
      setNeedsPassword(true);
      setLoading(false);
      return;
    }
    if (!r.ok) {
      setError(r.data?.error ?? "not_available");
      setLoading(false);
      return;
    }
    setLink(r.data.link);
    setNeedsPassword(false);

    const f = await callFn({ action: "list_files", token });
    if (f.ok) setFiles(f.data.files ?? []);

    callFn({ action: "log_view", token }).catch(() => {});
    setLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitApproval = async () => {
    if (!signerName.trim()) {
      toast.error("Please add your name to sign off");
      return;
    }
    setSubmitting(true);
    const r = await callFn({
      action: "submit_approval",
      token,
      signer_name: signerName.trim(),
      signer_email: signerEmail.trim() || undefined,
      decision,
      note: note.trim() || undefined,
      file_id: activeFile?.file_id,
      deliverable_id: activeFile?.deliverable_id,
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.data?.error ?? "Could not submit");
      return;
    }
    toast.success(
      decision === "approved" ? "Approval sent" : "Revision requested"
    );
    setApprovalOpen(false);
    setNote("");
    init().catch(() => {});
  };

  // ----- Render states -----

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading review…</p>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[hsl(var(--energy))]" />
            <h1 className="text-lg font-semibold">Password required</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            This review link is password-protected.
          </p>
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button onClick={() => init(password)} className="w-full">
            Continue
          </Button>
        </Card>
      </div>
    );
  }

  if (error) {
    const msg =
      error === "expired"
        ? "This review link has expired."
        : error === "revoked"
          ? "This review link has been revoked."
          : "This link isn't available.";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full p-6 text-center space-y-2">
          <Lock className="h-6 w-6 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">{msg}</h1>
          <p className="text-sm text-muted-foreground">
            Reach out to the person who shared this with you for a new link.
          </p>
        </Card>
      </div>
    );
  }

  if (!link) return null;

  const title = link.label ?? link.project_title ?? "Review";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{`${title} · Review`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[hsl(var(--energy)/0.15)] ring-1 ring-[hsl(var(--energy)/0.35)] flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--energy))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--energy))]">
              Private review
            </p>
            <h1 className="text-base font-semibold truncate">{title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {/* Permissions strip */}
        <div className="flex flex-wrap gap-1">
          {link.can_comment && (
            <Badge variant="outline" className="text-[10px]">
              Can comment
            </Badge>
          )}
          {link.can_approve && (
            <Badge variant="outline" className="text-[10px]">
              Can approve
            </Badge>
          )}
          {link.can_download && (
            <Badge variant="outline" className="text-[10px]">
              Downloads enabled
            </Badge>
          )}
        </div>

        {files.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No files have been shared yet.
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {files.map((f) => {
              const Icon = fileIcon(f.file_type);
              const approved = f.deliverable_status === "approved";
              const revisionAsked =
                f.deliverable_status === "revision_requested";
              return (
                <div
                  key={f.file_id}
                  className="group rounded-xl border border-border bg-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setViewer(f)}
                    className="block aspect-square w-full bg-muted relative"
                  >
                    <FileThumbnail
                      fileUrl={f.signed_url ?? f.file_url}
                      fileType={f.file_type ?? "application/octet-stream"}
                      className="w-full h-full"
                    />
                    {approved && (
                      <Badge className="absolute top-1 left-1 text-[9px] gap-1 bg-emerald-500/90 hover:bg-emerald-500/90">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </Badge>
                    )}
                    {revisionAsked && (
                      <Badge className="absolute top-1 left-1 text-[9px] gap-1 bg-amber-500/90 hover:bg-amber-500/90">
                        <RotateCcw className="h-3 w-3" />
                        Revisions
                      </Badge>
                    )}
                  </button>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-1">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-[11px] font-medium truncate">
                        {f.file_name}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {link.can_approve && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] flex-1"
                          onClick={() => {
                            setActiveFile(f);
                            setDecision("approved");
                            setApprovalOpen(true);
                          }}
                        >
                          Sign off
                        </Button>
                      )}
                      {link.can_download && f.signed_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          asChild
                        >
                          <a
                            href={f.signed_url}
                            download={f.file_name}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground pt-4">
          Powered by Kretopia — private review link
        </p>
      </main>

      {/* Approval dialog */}
      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {decision === "approved" ? "Sign off" : "Request revision"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={decision === "approved" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDecision("approved")}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant={
                  decision === "revision_requested" ? "default" : "outline"
                }
                className="flex-1"
                onClick={() => setDecision("revision_requested")}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Revise
              </Button>
            </div>

            <div>
              <Label className="text-xs">Your name *</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Email (optional)</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="jane@brand.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">
                {decision === "approved" ? "Note (optional)" : "What to change"}
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  decision === "approved"
                    ? "Looks great!"
                    : "Please tweak the color grade in the second clip…"
                }
                className="mt-1"
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              onClick={submitApproval}
              disabled={submitting}
            >
              {submitting
                ? "Submitting…"
                : decision === "approved"
                  ? "Send approval"
                  : "Send revision notes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black">
          {viewer && (
            <div className="flex flex-col">
              <div className="bg-black flex items-center justify-center max-h-[80vh]">
                {viewer.file_type?.startsWith("image") && viewer.signed_url ? (
                  <img
                    src={viewer.signed_url}
                    alt={viewer.file_name}
                    className="max-h-[80vh] w-auto"
                  />
                ) : viewer.file_type?.startsWith("video") &&
                  viewer.signed_url ? (
                  <video
                    src={viewer.signed_url}
                    controls
                    className="max-h-[80vh] w-full"
                  />
                ) : viewer.file_type?.startsWith("audio") &&
                  viewer.signed_url ? (
                  <audio src={viewer.signed_url} controls className="w-full" />
                ) : (
                  <div className="p-6 text-center text-white">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-60" />
                    <p className="text-sm">{viewer.file_name}</p>
                    {viewer.signed_url && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        asChild
                      >
                        <a
                          href={viewer.signed_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-background p-3 flex items-center gap-2">
                <p className="text-sm font-medium truncate flex-1">
                  {viewer.file_name}
                </p>
                {link.can_approve && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveFile(viewer);
                      setDecision("approved");
                      setApprovalOpen(true);
                      setViewer(null);
                    }}
                  >
                    Sign off
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
