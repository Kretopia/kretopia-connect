import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  Link2,
  ShieldCheck,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { APP_URL } from "@/lib/constants";

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  scope: string;
  can_comment: boolean;
  can_approve: boolean;
  can_download: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectTitle?: string;
}

/**
 * Guest Review Link manager — Studio-styled dialog.
 * Lets owners mint scoped, pass-protected, expiring links to /review/:token
 * so external clients can preview & approve without signing up.
 */
export function ShareReviewLinkDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
}: Props) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // form
  const [label, setLabel] = useState("");
  const [canComment, setCanComment] = useState(true);
  const [canApprove, setCanApprove] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>("14");

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("project_share_links")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setLinks((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) reload().catch(() => {});
  }, [open, projectId]);

  const create = async () => {
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");

      const expires_at =
        expiresInDays && expiresInDays !== "0"
          ? new Date(
              Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000
            ).toISOString()
          : null;

      const { error } = await supabase.from("project_share_links").insert({
        project_id: projectId,
        created_by: userId,
        label: label.trim() || (projectTitle ? `Review · ${projectTitle}` : null),
        scope: "project",
        can_comment: canComment,
        can_approve: canApprove,
        can_download: canDownload,
        expires_at,
      });
      if (error) throw error;
      toast.success("Review link created");
      setLabel("");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create link");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this link? Anyone using it will lose access.")) return;
    const { error } = await supabase
      .from("project_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Link revoked");
      reload();
    }
  };

  const linkUrl = (token: string) => `${APP_URL}/review/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(linkUrl(token));
    toast.success("Link copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[hsl(var(--energy))]" />
            Share for review
          </DialogTitle>
          <DialogDescription>
            Send a private link so a client can review and approve work — no
            account required.
          </DialogDescription>
        </DialogHeader>

        {/* Create form */}
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
          <div>
            <Label htmlFor="label" className="text-xs">
              Label (optional)
            </Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Review · ${projectTitle ?? "Project"}`}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PermRow
              label="Can comment"
              checked={canComment}
              onChange={setCanComment}
            />
            <PermRow
              label="Can approve"
              checked={canApprove}
              onChange={setCanApprove}
            />
            <PermRow
              label="Can download"
              checked={canDownload}
              onChange={setCanDownload}
            />
            <div>
              <Label htmlFor="exp" className="text-xs">
                Expires in (days)
              </Label>
              <Input
                id="exp"
                type="number"
                min={0}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <Button
            onClick={create}
            disabled={creating}
            className="w-full"
            size="sm"
          >
            {creating ? "Creating..." : "Create review link"}
          </Button>
        </div>

        {/* Existing links */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Active links
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No links yet. Create one above to share with a client.
            </p>
          ) : (
            links.map((l) => {
              const expired =
                l.expires_at && new Date(l.expires_at) < new Date();
              const revoked = !!l.revoked_at;
              return (
                <div
                  key={l.id}
                  className="rounded-xl border border-border bg-card p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {l.label ?? "Untitled link"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {linkUrl(l.token)}
                      </p>
                    </div>
                    {revoked ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Revoked
                      </Badge>
                    ) : expired ? (
                      <Badge variant="outline" className="text-[10px]">
                        Expired
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] gap-1"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {l.view_count} view{l.view_count === 1 ? "" : "s"}
                    {l.expires_at && (
                      <span>
                        · expires {new Date(l.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {l.can_comment && (
                      <Badge variant="outline" className="text-[10px]">
                        Comment
                      </Badge>
                    )}
                    {l.can_approve && (
                      <Badge variant="outline" className="text-[10px]">
                        Approve
                      </Badge>
                    )}
                    {l.can_download && (
                      <Badge variant="outline" className="text-[10px]">
                        Download
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8"
                      onClick={() => copyLink(l.token)}
                      disabled={revoked}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => window.open(linkUrl(l.token), "_blank")}
                      disabled={revoked}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {!revoked && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive"
                        onClick={() => revoke(l.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PermRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-2 py-1.5">
      <span className="text-xs">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
