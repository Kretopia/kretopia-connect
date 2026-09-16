import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Copy, ExternalLink, Loader2, Share2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
}

export function PublishRecapDialog({ open, onOpenChange, projectId, projectTitle }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [summary, setSummary] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("recap_published, recap_summary, recap_token")
        .eq("id", projectId)
        .maybeSingle();
      if (!active) return;
      const p = data as any;
      setPublished(!!p?.recap_published);
      setSummary(p?.recap_summary || "");
      setToken(p?.recap_token || null);
      setLoading(false);
    })().catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, projectId]);

  const url = token ? `${window.location.origin}/studio/${token}` : "";

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ recap_published: published, recap_summary: summary || null } as any)
      .eq("id", projectId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: published ? "Recap published" : "Recap unpublished",
      description: published ? "Share the link anywhere." : "The link no longer works.",
    });
    onOpenChange(false);
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            Publish recap
          </DialogTitle>
          <DialogDescription>
            Turn "{projectTitle}" into a public IMDb-style recap. Anyone with the link
            can see the crew, what shipped, and the journey.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="publish-toggle" className="font-semibold">Public recap</Label>
                <p className="text-xs text-muted-foreground">
                  {published ? "Live — anyone with the link can view." : "Off — link won't resolve."}
                </p>
              </div>
              <Switch id="publish-toggle" checked={published} onCheckedChange={setPublished} />
            </div>

            <div>
              <Label htmlFor="summary" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recap summary (optional)
              </Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One paragraph on what this was, what shipped, and why it mattered."
                rows={4}
                className="mt-1.5"
              />
            </div>

            {published && url && (
              <div className="rounded-lg bg-muted/50 p-2.5 flex items-center gap-2">
                <input
                  readOnly
                  value={url}
                  className="flex-1 bg-transparent text-xs font-mono outline-none truncate"
                />
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={copy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
