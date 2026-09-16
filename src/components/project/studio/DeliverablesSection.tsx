import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, RefreshCw, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { MoodboardThumb } from "./MoodboardThumb";
import { DeliverableCommentsSheet } from "./DeliverableCommentsSheet";

interface DeliverablesSectionProps {
  projectId: string;
  currentUserId: string;
  isOwner: boolean;
}

interface Deliverable {
  id: string;
  title: string;
  status: string;
  thumbnail_url: string | null;
  file_url: string | null;
  submitted_by: string | null;
  updated_at: string;
  comment_count?: number;
}

const STATUS_PILL: Record<
  string,
  { label: string; tone: string }
> = {
  pending: {
    label: "Awaiting review",
    tone: "bg-muted text-muted-foreground ring-border",
  },
  in_review: {
    label: "In review",
    tone: "bg-primary/15 text-primary ring-primary/30",
  },
  approved: {
    label: "Approved",
    tone:
      "bg-[hsl(var(--energy)/0.18)] text-[hsl(var(--energy))] ring-[hsl(var(--energy)/0.4)]",
  },
  changes_requested: {
    label: "Changes requested",
    tone: "bg-destructive/15 text-destructive ring-destructive/30",
  },
};

export const DeliverablesSection = ({
  projectId,
  currentUserId,
  isOwner,
}: DeliverablesSectionProps) => {
  const { toast } = useToast();
  const [items, setItems] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openCommentsFor, setOpenCommentsFor] = useState<Deliverable | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("project_deliverables")
      .select("id, title, status, thumbnail_url, file_url, submitted_by, updated_at")
      .eq("project_id", projectId)
      .neq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(8);
    if (error) {
      console.error("[DeliverablesSection] load", error);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Deliverable[];

    // Hydrate comment counts in a single query
    if (list.length) {
      const ids = list.map((d) => d.id);
      const { data: counts } = await supabase
        .from("deliverable_comments")
        .select("deliverable_id")
        .in("deliverable_id", ids);
      const tally: Record<string, number> = {};
      counts?.forEach((c: any) => {
        tally[c.deliverable_id] = (tally[c.deliverable_id] ?? 0) + 1;
      });
      list.forEach((d) => (d.comment_count = tally[d.id] ?? 0));
    }
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    void load().catch(() => setLoading(false));

    const channel = supabase
      .channel(`deliverables-section:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_deliverables",
          filter: `project_id=eq.${projectId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const updateStatus = async (id: string, status: "approved" | "changes_requested") => {
    setUpdatingId(id);
    const item = items.find((d) => d.id === id);
    const { error } = await supabase
      .from("project_deliverables")
      .update({
        status,
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    setUpdatingId(null);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    if (status === "changes_requested") {
      toast({
        title: "Changes requested",
        description: "Drop a note so they know what's next.",
      });
      return;
    }

    // Approved → nudge to invoice it
    sonnerToast.success("Approved 🎉", {
      description: "Ready to bill it? Draft an invoice for this drop.",
      duration: 8000,
      action: {
        label: "Draft invoice",
        onClick: () => {
          // Switch the Desk to the Finance tab, then dispatch a prefill intent.
          window.dispatchEvent(
            new CustomEvent("thrivedesk:set-tab", { detail: "finance" }),
          );
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("thrivedesk:intent", {
                detail: {
                  tab: "finance",
                  intent: "draft-from-deliverable",
                  payload: { deliverable_id: id, title: item?.title ?? "Deliverable" },
                },
              }),
            );
          }, 60);
        },
      },
    });
  };

  if (!loading && items.length === 0) return null;

  return (
    <>
      <section className="px-4 py-5 space-y-3">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
            For Review
          </p>
          <h2 className="text-lg font-black leading-none tracking-tight">
            The Drops
          </h2>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((d) => {
              const pill = STATUS_PILL[d.status] ?? STATUS_PILL.pending;
              const canReview =
                isOwner && (d.status === "pending" || d.status === "in_review");
              const isUpdating = updatingId === d.id;

              return (
                <article
                  key={d.id}
                  className={cn(
                    "relative overflow-hidden rounded-xl ring-1 ring-border bg-card",
                    "transition-all hover:ring-primary/40",
                    d.status === "approved" &&
                      "ring-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.04)]",
                    d.status === "changes_requested" &&
                      "ring-destructive/30 bg-destructive/[0.03]",
                  )}
                >
                  <div className="flex gap-3 p-3">
                    {/* Thumb */}
                    <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-muted ring-1 ring-border">
                      {d.thumbnail_url || d.file_url ? (
                        <MoodboardThumb
                          storedUrl={(d.thumbnail_url || d.file_url)!}
                          alt={d.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Eye className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold leading-tight line-clamp-2">
                          {d.title}
                        </h3>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1",
                          pill.tone,
                        )}
                      >
                        {pill.label}
                      </span>

                      {/* Action row */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setOpenCommentsFor(d)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {d.comment_count
                            ? `${d.comment_count} note${d.comment_count > 1 ? "s" : ""}`
                            : "Comment"}
                        </button>

                        {canReview && (
                          <div className="ml-auto flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => updateStatus(d.id, "changes_requested")}
                              className="h-7 px-2 text-[11px] gap-1"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              Request changes
                            </Button>
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => updateStatus(d.id, "approved")}
                              className="h-7 px-2.5 text-[11px] gap-1 bg-[hsl(var(--energy))] text-[hsl(var(--background))] hover:bg-[hsl(var(--energy)/0.9)] shadow-[0_0_10px_hsl(var(--energy)/0.35)]"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <DeliverableCommentsSheet
        open={!!openCommentsFor}
        onOpenChange={(open) => !open && setOpenCommentsFor(null)}
        deliverable={openCommentsFor}
        currentUserId={currentUserId}
      />
    </>
  );
};
