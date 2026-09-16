import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, Loader2, Plus, Sparkles, X } from "lucide-react";

type Preview = {
  url: string;
  title?: string | null;
  thumbnail?: string | null;
  provider?: string | null;
  status: "pending" | "ok" | "error";
  error?: string;
};

interface Props {
  userId: string;
  existingLinks?: string[] | null;
  onIngested?: (newLinks: string[]) => void;
  trigger?: React.ReactNode;
}

/**
 * Zero-friction social ingest — paste IG / TikTok / YouTube / portfolio URLs
 * (one per line), we resolve oEmbed/OG, preview thumbnails, then append the
 * raw URLs to profiles.portfolio_links (deduped). No re-uploading required.
 */
export function SocialFeedIngest({ userId, existingLinks, onIngested, trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  const parseUrls = (text: string): string[] => {
    const set = new Set<string>();
    text.split(/[\s,]+/).forEach((tok) => {
      const t = tok.trim();
      if (!t) return;
      try {
        const u = new URL(t);
        if (/^https?:$/.test(u.protocol)) set.add(u.toString());
      } catch { /* ignore */ }
    });
    return Array.from(set);
  };

  const resolve = async () => {
    const urls = parseUrls(raw);
    if (!urls.length) {
      toast({ title: "Paste at least one link", description: "Instagram, TikTok, YouTube, Behance — anything with a public URL." });
      return;
    }
    const existing = new Set(existingLinks || []);
    const fresh = urls.filter((u) => !existing.has(u));
    if (!fresh.length) {
      toast({ title: "Already in your passport", description: "All those links are already saved." });
      return;
    }
    setResolving(true);
    setPreviews(fresh.map((url) => ({ url, status: "pending" })));
    const results: Preview[] = await Promise.all(
      fresh.map(async (url) => {
        try {
          const { data, error } = await supabase.functions.invoke("fetch-link-metadata", { body: { url } });
          if (error) throw new Error(error.message);
          return {
            url,
            title: data?.title ?? null,
            thumbnail: data?.thumbnail ?? null,
            provider: data?.provider ?? null,
            status: "ok" as const,
          };
        } catch (e: any) {
          return { url, status: "error" as const, error: e?.message || "Couldn't preview" };
        }
      }),
    );
    setPreviews(results);
    setResolving(false);
  };

  const remove = (url: string) => setPreviews((p) => p.filter((x) => x.url !== url));

  const save = async () => {
    const toAdd = previews.filter((p) => p.status === "ok").map((p) => p.url);
    if (!toAdd.length) {
      toast({ title: "Nothing to save", variant: "destructive" });
      return;
    }
    setSaving(true);
    const merged = Array.from(new Set([...(existingLinks || []), ...toAdd]));
    const { error } = await supabase
      .from("profiles")
      .update({ portfolio_links: merged } as any)
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Added ${toAdd.length} link${toAdd.length === 1 ? "" : "s"}` });
    onIngested?.(toAdd);
    setRaw("");
    setPreviews([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full">
            <Instagram className="h-4 w-4 mr-2" />
            Pull from Instagram / TikTok
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Ingest from your feeds
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste links from Instagram posts, TikToks, YouTube, Behance, your site — one per line.
            We grab the thumbnail and add them to your passport. No re-uploading.
          </p>

          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"https://instagram.com/p/...\nhttps://tiktok.com/@you/video/...\nhttps://youtu.be/..."}
            rows={5}
            className="font-mono text-xs"
          />

          <Button onClick={resolve} disabled={resolving || !raw.trim()} className="w-full" variant="secondary">
            {resolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {resolving ? "Reading links…" : "Preview links"}
          </Button>

          {previews.length > 0 && (
            <div className="space-y-2">
              {previews.map((p) => (
                <div
                  key={p.url}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
                >
                  <div className="h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                    {p.status === "pending" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : p.thumbnail ? (
                      <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Instagram className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {p.provider && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">{p.provider}</Badge>
                      )}
                      {p.status === "error" && (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Couldn't read</Badge>
                      )}
                    </div>
                    <div className="text-xs font-medium truncate">{p.title || p.url}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{p.url}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.url)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <Button onClick={save} disabled={saving || previews.every((p) => p.status !== "ok")} className="w-full">
                {saving ? "Saving…" : `Add ${previews.filter((p) => p.status === "ok").length} to passport`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
