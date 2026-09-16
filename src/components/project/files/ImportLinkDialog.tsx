import { useState } from "react";
import { Link2, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ImportLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  folderId: string | null;
  onImported: () => void;
}

interface Preview {
  title: string;
  thumbnail: string | null;
  provider: string;
  url: string;
}

/**
 * Frictionless content import — paste any link (Drive, Dropbox, Notion, Figma,
 * YouTube, Vimeo, Loom, Behance, etc.) and save it into the Vault as a "linked"
 * file. We fetch OG metadata server-side for a thumbnail + title preview.
 */
export const ImportLinkDialog = ({
  open,
  onOpenChange,
  projectId,
  folderId,
  onImported,
}: ImportLinkDialogProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setUrl("");
    setPreview(null);
    setLoading(false);
    setSaving(false);
  };

  const fetchPreview = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-link-metadata", {
        body: { url: trimmed },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreview(data as Preview);
    } catch (e: any) {
      toast({
        title: "Couldn't read that link",
        description: e?.message || "Try pasting the full URL.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("project_files").insert({
        project_id: projectId,
        user_id: user.id,
        file_name: preview.title,
        file_url: preview.url,
        file_type: "link",
        folder_id: folderId,
        is_link: true,
        link_provider: preview.provider,
        link_thumbnail_url: preview.thumbnail,
      });
      if (error) throw error;
      toast({ title: "Link added", description: `${preview.provider} • ${preview.title}` });
      reset();
      onOpenChange(false);
      onImported();
    } catch (e: any) {
      toast({
        title: "Couldn't save link",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Import a link
          </DialogTitle>
          <DialogDescription>
            Drop a Google Drive, Dropbox, Notion, Figma, YouTube or any link — we'll
            keep it in your Vault as a reference (no re-upload).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchPreview();
              }}
              disabled={loading || saving}
            />
            <Button
              variant="outline"
              onClick={fetchPreview}
              disabled={!url.trim() || loading || saving}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
            </Button>
          </div>

          {preview && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {preview.thumbnail ? (
                <div className="aspect-video w-full bg-muted">
                  <img
                    src={preview.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : null}
              <div className="p-3 space-y-1.5">
                <Badge variant="secondary" className="rounded-full text-[10px] gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {preview.provider}
                </Badge>
                <p className="text-sm font-semibold line-clamp-2">{preview.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {preview.url}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!preview || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Add to Vault
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
