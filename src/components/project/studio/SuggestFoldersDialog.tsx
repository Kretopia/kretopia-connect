import { useEffect, useState } from "react";
import { Sparkles, Folder, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Suggestion {
  name: string;
  color: string;
  reason: string;
  projects: { id: string; title: string }[];
}

interface Props {
  userId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApplied: () => void;
}

export const SuggestFoldersDialog = ({ userId, open, onOpenChange, onApplied }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  const fetchSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-studio-folders", {
        body: {},
      });
      if (error) throw error;
      const list: Suggestion[] = data?.suggestions || [];
      setSuggestions(list);
      const init: Record<number, boolean> = {};
      list.forEach((_, i) => (init[i] = true));
      setAccepted(init);
      setExcluded({});
      if (list.length === 0) {
        toast({
          title: "Nothing to group yet",
          description: data?.reason || "Add more unfiled projects and try again.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Kreto couldn't suggest folders",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && suggestions.length === 0 && !loading) fetchSuggestions();
    if (!open) {
      setSuggestions([]);
      setAccepted({});
      setExcluded({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const apply = async () => {
    const picks = suggestions
      .map((s, i) => ({ ...s, _i: i }))
      .filter((s) => accepted[s._i]);
    if (picks.length === 0) {
      onOpenChange(false);
      return;
    }
    setApplying(true);
    try {
      // 1) Look up existing folders to reuse by name
      const { data: existing } = await supabase
        .from("studio_folders")
        .select("id, name")
        .eq("user_id", userId);
      const byName = new Map(
        (existing || []).map((f) => [f.name.trim().toLowerCase(), f.id]),
      );

      // 2) Create folders that don't exist
      const toCreate = picks.filter((p) => !byName.has(p.name.trim().toLowerCase()));
      if (toCreate.length > 0) {
        const { data: created, error } = await supabase
          .from("studio_folders")
          .insert(
            toCreate.map((p, idx) => ({
              user_id: userId,
              name: p.name,
              color: p.color,
              sort_order: (existing?.length || 0) + idx,
            })),
          )
          .select("id, name");
        if (error) throw error;
        (created || []).forEach((c) => byName.set(c.name.trim().toLowerCase(), c.id));
      }

      // 3) Move projects
      const moves: { id: string; folderId: string }[] = [];
      for (const p of picks) {
        const folderId = byName.get(p.name.trim().toLowerCase());
        if (!folderId) continue;
        for (const proj of p.projects) {
          if (excluded[`${p._i}:${proj.id}`]) continue;
          moves.push({ id: proj.id, folderId });
        }
      }

      // Update in parallel batches
      const client = supabase as any;
      const moveOne = async (m: { id: string; folderId: string }) => {
        await client
          .from("projects")
          .update({ studio_folder_id: m.folderId })
          .eq("id", m.id)
          .eq("created_by", userId);
      };
      await Promise.all(moves.map(moveOne));

      toast({
        title: "Organized ✨",
        description: `${moves.length} project${moves.length === 1 ? "" : "s"} moved into ${picks.length} folder${picks.length === 1 ? "" : "s"}.`,
      });
      onApplied();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Couldn't apply",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
            Kreto suggests folders
          </DialogTitle>
          <DialogDescription>
            Based on your projects, here's how I'd group them. Untick anything you don't want.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-xs">Reading your studios…</p>
          </div>
        )}

        {!loading && suggestions.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nothing to group right now. Add a few more projects and try again.
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((s, i) => {
              const on = accepted[i];
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    on ? "border-foreground/30 bg-card" : "border-border bg-muted/30 opacity-60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) =>
                        setAccepted((a) => ({ ...a, [i]: Boolean(v) }))
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-[hsl(var(--signal-teal))]" />
                        <Input
                          value={s.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSuggestions((arr) =>
                              arr.map((x, idx) => (idx === i ? { ...x, name: v } : x)),
                            );
                          }}
                          className="h-7 text-sm font-semibold border-0 px-1 focus-visible:ring-1 bg-transparent"
                        />
                      </div>
                      {s.reason && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">
                          {s.reason}
                        </p>
                      )}
                      <div className="mt-2 ml-5 space-y-1">
                        {s.projects.map((p) => {
                          const key = `${i}:${p.id}`;
                          const off = excluded[key];
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                setExcluded((e) => ({ ...e, [key]: !off }))
                              }
                              className={cn(
                                "w-full flex items-center justify-between text-left text-xs rounded-md px-2 py-1.5 transition-colors",
                                off
                                  ? "bg-muted/40 text-muted-foreground line-through"
                                  : "bg-muted/60 hover:bg-muted",
                              )}
                            >
                              <span className="truncate">{p.title}</span>
                              {off ? (
                                <X className="h-3 w-3 shrink-0" />
                              ) : (
                                <Check className="h-3 w-3 shrink-0 text-[hsl(var(--energy))]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSuggestions}
            disabled={loading || applying}
          >
            Re-suggest
          </Button>
          <Button
            size="sm"
            onClick={apply}
            disabled={loading || applying || suggestions.length === 0}
            className="gap-1.5"
          >
            {applying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
