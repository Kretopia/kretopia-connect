import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Link2, Paperclip, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { MyCredit } from "@/hooks/useMyCredits";
import { extractThumbnailForStorage, resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useReducedMotion } from "@/hooks/useReducedMotion";
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
  const reduced = useReducedMotion();

  const targets = useMemo(
    () => (focusCreditId ? credits.filter((c) => c.id === focusCreditId) : credits),
    [credits, focusCreditId],
  );

  useEffect(() => {
    if (open) setUrls({});
  }, [open, focusCreditId]);

  const filled = targets.filter((c) => normalizeUrl(urls[c.id] ?? ""));

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
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Branded header */}
        <div className="relative overflow-hidden border-b border-border px-5 pb-4 pt-5 sm:px-6">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(120% 100% at 0% 0%, hsl(var(--accent-passport)/0.14), transparent 60%)",
            }}
          />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--accent-passport))]/30 bg-[hsl(var(--accent-passport))]/10">
                <Paperclip className="h-4.5 w-4.5 text-[hsl(var(--accent-passport))]" aria-hidden />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight">Attach evidence.</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs leading-snug">
                  A link that proves each credit — a post, a video, an article. Fill one or several, confirm once.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {targets.length > 0 && (
            <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-[hsl(var(--accent-passport))]" aria-hidden />
              {targets.length} credit{targets.length > 1 ? "s" : ""} need{targets.length === 1 ? "s" : ""} proof
            </p>
          )}
        </div>

        {/* Credit rows */}
        <div className="max-h-[46vh] overflow-y-auto px-5 py-4 sm:px-6">
          {targets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Every credit on your record already has evidence.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {targets.map((c, i) => {
                const raw = urls[c.id] ?? "";
                const valid = Boolean(normalizeUrl(raw));
                const img = resolveCreditThumbnail(c.thumbnail_url, c.primary_media_url, c.url);
                return (
                  <motion.li
                    key={c.id}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.05 }}
                    className={cn(
                      "rounded-xl border bg-muted/30 p-3 transition-colors",
                      valid ? "border-emerald-400/30" : "border-border",
                    )}
                  >
                    <div className="flex items-center gap-3">
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
                      </div>
                      {valid && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Link ready" />
                      )}
                    </div>
                    <div className="relative mt-2.5">
                      <Link2
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <input
                        type="url"
                        value={raw}
                        onChange={(e) => setUrls((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="https://…"
                        inputMode="url"
                        aria-label={`Evidence link for ${c.project_name}`}
                        className={cn(
                          "h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs text-foreground",
                          "placeholder:text-muted-foreground/60",
                          "focus:border-[hsl(var(--accent-passport))]/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent-passport))]/20",
                        )}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {targets.length > 0 && (
          <div className="border-t border-border px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={save}
              disabled={saving || filled.length === 0}
              className={cn(
                "btn-glass btn-glass-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
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
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {filled.length > 0
                ? `${filled.length} of ${targets.length} ready — the rest stay untouched.`
                : "Only the credits you fill in are updated."}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
