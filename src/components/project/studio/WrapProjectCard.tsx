import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Sparkles, Loader2, Share2 } from "lucide-react";
import { PublishRecapDialog } from "./PublishRecapDialog";

interface WrapProjectCardProps {
  project: {
    id: string;
    title: string;
    status?: string | null;
    created_by: string;
  };
  tasks: Array<{ id: string; status?: string | null }>;
  collaborators: Array<{ id: string; full_name?: string | null }>;
  currentUserId: string;
  isOwner: boolean;
  onUpdated: () => void;
}

/**
 * Project close-out CTA. Visible to the owner once there's signal
 * the project has produced real work (approved deliverables OR
 * any completed task). One tap → confirm → mark complete + ping
 * collaborators to leave a review/credit.
 */
export function WrapProjectCard({
  project,
  tasks,
  collaborators,
  currentUserId,
  isOwner,
  onUpdated,
}: WrapProjectCardProps) {
  const [approvedCount, setApprovedCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      const { count } = await supabase
        .from("project_deliverables")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("status", "approved");
      if (active) setApprovedCount(count ?? 0);
    })().catch((e) => console.warn("[wrap-card] count failed", e));
    return () => {
      active = false;
    };
  }, [project.id]);

  const completedTaskCount = useMemo(
    () => tasks.filter((t) => t.status === "done" || t.status === "completed").length,
    [tasks],
  );

  const hasProgress = approvedCount > 0 || completedTaskCount >= 3;
  const alreadyDone =
    project.status === "completed" || project.status === "archived";

  // After wrap → show a "Publish recap" card instead of hiding
  if (!isOwner) return null;
  if (alreadyDone) {
    return (
      <section className="px-4 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/30 p-5 space-y-3">
          <div className="relative flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Wrapped 🎉
              </p>
              <p className="text-sm font-bold leading-tight mt-0.5">
                Turn this Studio into a public recap
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                IMDb-style page with the crew, what shipped, and the journey. Share anywhere.
              </p>
            </div>
          </div>
          <Button onClick={() => setPublishOpen(true)} className="w-full gap-2" size="sm">
            <Share2 className="h-4 w-4" />
            Publish recap
          </Button>
        </div>
        <PublishRecapDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          projectId={project.id}
          projectTitle={project.title}
        />
      </section>
    );
  }
  // Used to return null here — inside the "Wrap the project" disclosure
  // that now collapses this by default, a null render looked like a
  // broken, empty expand instead of an explained one.
  if (!hasProgress) {
    return (
      <section className="px-4 py-5">
        <div className="rounded-2xl border border-dashed border-border/60 p-4 text-center space-y-1.5">
          <CheckCircle2 className="h-5 w-5 mx-auto text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">Not ready to wrap yet</p>
          <p className="text-xs text-muted-foreground leading-snug">
            {completedTaskCount} task{completedTaskCount === 1 ? "" : "s"} done, {approvedCount}{" "}
            deliverable{approvedCount === 1 ? "" : "s"} approved — wrap unlocks once you've
            approved a deliverable or finished 3 tasks.
          </p>
        </div>
      </section>
    );
  }

  const handleWrap = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: "completed" })
        .eq("id", project.id);
      if (error) throw error;

      // Notify each collaborator (excluding owner) — fire-and-forget per row
      const others = collaborators.filter((c) => c.id !== currentUserId);
      await Promise.all(
        others.map((c) =>
          supabase
            .from("notifications")
            .insert({
              user_id: c.id,
              title: "Project wrapped 🎉",
              message: `${project.title} just wrapped. Add a credit and leave a review.`,
              type: "project",
              category: "project",
              priority: "normal",
              link: `/desk/${project.id}`,
              action_url: `/desk/${project.id}`,
              action_text: "Open project",
            })
            .then(({ error: e }) => {
              if (e) console.warn("[wrap-card] notify failed", e);
            }),
        ),
      );

      toast({ title: "Wrapped 🎉", description: "Now add it to your credits." });
      setOpen(false);
      onUpdated();
    } catch (e: any) {
      toast({
        title: "Couldn't wrap project",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="px-4 py-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/30 p-5 space-y-3">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/30 blur-3xl opacity-50"
        />
        <div className="relative flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Ready to wrap?
            </p>
            <p className="text-sm font-bold leading-tight mt-0.5">
              {approvedCount > 0
                ? `${approvedCount} deliverable${approvedCount === 1 ? "" : "s"} approved`
                : `${completedTaskCount} tasks done`}{" "}
              · close it out cleanly
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Marks the project complete, pings collaborators, and unlocks the
              Add Credit step.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setOpen(true)}
          className="relative w-full gap-2"
          size="sm"
        >
          <CheckCircle2 className="h-4 w-4" />
          Wrap project
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wrap “{project.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Marks the project as complete and notifies{" "}
              {collaborators.filter((c) => c.id !== currentUserId).length || "no"}{" "}
              collaborator
              {collaborators.filter((c) => c.id !== currentUserId).length === 1
                ? ""
                : "s"}{" "}
              to add the credit. You can always re-open it later from settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWrap} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Wrap it up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
