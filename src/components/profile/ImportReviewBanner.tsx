import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ExternalLink, Trash2, Check, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PendingCredit {
  id: string;
  project_name: string;
  role: string;
  year: number | null;
  url: string | null;
  source: string | null;
  verification_status: string | null;
  thumbnail_url: string | null;
}

interface ImportReviewBannerProps {
  userId: string;
  onResolved?: () => void;
}

export function ImportReviewBanner({ userId, onResolved }: ImportReviewBannerProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingCredit[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const fetchPending = async () => {
    // Catch both new pending_review imports AND legacy unverified web_verified hallucinations
    const { data } = await supabase
      .from("credits")
      .select("id, project_name, role, year, url, source, verification_status, thumbnail_url")
      .eq("user_id", userId)
      .in("source", ["web_verified"])
      .in("verification_status", ["pending_review", "unverified", "auto_discovered"])
      .order("created_at", { ascending: false })
      .limit(50);
    setPending((data as PendingCredit[]) || []);
  };

  useEffect(() => {
    if (userId) fetchPending();
  }, [userId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = pending.length > 0 && selected.size === pending.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(pending.map((p) => p.id)));
  };

  const keepSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    const results = await Promise.all(
      Array.from(selected).map((id) => supabase.rpc("reject_discovered_credit", { credit_id_param: id }))
    );
    setBusy(false);
    const error = results.find((r) => r.error)?.error;
    if (error) {
      toast({ title: "Failed to keep", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${selected.size} credit${selected.size > 1 ? "s" : ""} kept` });
    setSelected(new Set());
    await fetchPending();
    onResolved?.();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    const { error } = await supabase.from("credits").delete().in("id", Array.from(selected));
    setBusy(false);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${selected.size} credit${selected.size > 1 ? "s" : ""} removed` });
    setSelected(new Set());
    await fetchPending();
    onResolved?.();
  };

  const dismissAll = async () => {
    // Mark all remaining as 'unverified' so they stop showing in the review banner
    setBusy(true);
    await Promise.all(
      pending.map((p) => supabase.rpc("reject_discovered_credit", { credit_id_param: p.id }))
    );
    setBusy(false);
    setOpen(false);
    setPending([]);
    onResolved?.();
  };

  if (pending.length === 0) return null;

  return (
    <>
      <div className="mb-4 rounded-xl border border-energy/40 bg-gradient-to-r from-energy/10 via-primary/5 to-transparent p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <Sparkles className="h-5 w-5 text-energy" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {pending.length} auto-imported credit{pending.length > 1 ? "s" : ""} need your review
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              We pulled these from the web. Confirm what's actually yours — they're hidden from your public profile until you do.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="shrink-0 bg-energy text-energy-foreground hover:bg-energy/90"
          >
            Review
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-energy" />
              Review imported credits
            </DialogTitle>
            <DialogDescription>
              Tick what's yours and Keep, or remove what isn't. Items left as-is stay hidden from your public profile.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between px-1">
            <button
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          </div>

          <ScrollArea className="max-h-[50vh] pr-3">
            <div className="space-y-2">
              {pending.map((c) => (
                <label
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    className="mt-1"
                  />
                  {c.thumbnail_url && (
                    <img
                      src={c.thumbnail_url}
                      alt=""
                      className="h-12 w-12 rounded object-cover shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.project_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.role}
                      {c.year ? ` · ${c.year}` : ""}
                    </p>
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    AI
                  </Badge>
                </label>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissAll}
              disabled={busy}
              className="sm:mr-auto text-muted-foreground"
            >
              Dismiss all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteSelected}
              disabled={busy || selected.size === 0}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button
              size="sm"
              onClick={keepSelected}
              disabled={busy || selected.size === 0}
              className="bg-energy text-energy-foreground hover:bg-energy/90"
            >
              <Check className="h-4 w-4 mr-1" />
              Keep
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
