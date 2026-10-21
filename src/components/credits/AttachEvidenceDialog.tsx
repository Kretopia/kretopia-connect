import { useEffect, useMemo, useState } from "react";
import { Link2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { MyCredit } from "@/hooks/useMyCredits";
import { extractThumbnailForStorage, resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Credits that still have no evidence (no url, no primary_media_url). */
  credits: MyCredit[];
  /** When set, only this credit is shown (per-row quick action). */
  focusCreditId?: string | null;
  onAttached: () => void;
}

/** Normalize a pasted link: add https:// when the protocol is missing. */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.includes(".") ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * AttachEvidenceDialog — attach evidence links to one or several credits at
 * once. Each credit missing evidence gets one inline link field; a single
 * confirm writes every filled row, so the whole record can be evidenced in
 * one pass instead of editing credits one by one.
 */
export function AttachEvidenceDialog({ open, onOpenChange, credits, focusCreditId, onAttached }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const targets = useMemo(
    () => (focusCreditId ? credits.filter((c) => c.id === focusCreditId) : credits),
    [credits, focusCreditId],
  );

  useEffect(() => {
    if (open) setUrls({});
  }, [open, focusCreditId]);

  const filled = targets.filter((c) => urls[c.id]?.trim());

  const save = async () => {
    const updates = filled
      .map((c) => ({ credit: c, url: normalizeUrl(urls[c.id] ?? "") }))
      .filter((u): u is { credit: MyCredit; url: string } => Boolean(u.url));
    if (updates.length === 0) {
      toast.error("Paste a valid link for at least one credit.");
      return;
    }
    setSaving(true);
    const results = await Promise.all(
      updates.map(({ credit, url }) =>
        supabase
          .from("credits")
          .update({ url, thumbnail_url: extractThumbnailForStorage(url) })
          .eq("id", credit.id),
      ),
    );
    setSaving(false);
    const failed = results.filter((r) => r.error).length;
    const done = results.length - failed;
    if (done > 0) {
      toast.success(
        done === 1
          ? "Evidence attached to 1 credit."
          : `Evidence attached to ${done} credits.`,
      );
      onAttached();
      onOpenChange(false);
    }
    if (failed > 0) {
      toast.error(
        failed === 1 ? "1 credit couldn't be updated. Try again." : `${failed} credits couldn't be updated. Try again.`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-[hsl(var(--accent-passport))]" aria-hidden />
            Attach evidence
          </DialogTitle>
          <DialogDescription>
            Paste a link that proves each credit — a post, a video, an article, a portfolio page. Fill one or
            several, then confirm once.
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Every credit on your record already has evidence.</p>
        ) : (
          <ul className="space-y-2.5">
            {targets.map((c) => {
              const img = resolveCreditThumbnail(c.thumbnail_url, c.primary_media_url, c.url);
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
                >
                  {img ? (
                    <img src={img} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      {(c.project_name || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.project_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.role, c.year].filter(Boolean).join(" · ")}
                    </p>
                    <div className="relative mt-1.5">
                      <Link2
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        value={urls[c.id] ?? ""}
                        onChange={(e) => setUrls((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="https://…"
                        inputMode="url"
                        aria-label={`Evidence link for ${c.project_name}`}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {targets.length > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={saving || filled.length === 0}
            className={cn(
              "btn-glass btn-glass-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {saving ? (
              <KretopiaSpinner className="h-4 w-4" aria-label="Saving" />
            ) : (
              <Paperclip className="h-4 w-4" aria-hidden />
            )}
            {saving
              ? "Attaching…"
              : filled.length > 1
                ? `Attach evidence to ${filled.length} credits`
                : "Attach evidence"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
