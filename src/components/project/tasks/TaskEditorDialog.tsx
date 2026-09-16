import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { type Task, STATUSES, PRIORITIES, getInitials } from "./taskUtils";
import { enhanceTaskInBackground } from "@/lib/taskEnhancer";

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface TaskEditorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: Task | null;
  projectId: string;
  defaultStatus?: string;
  collaborators: Collaborator[];
  currentUserId: string;
  onSaved: () => void;
}

const blank = (status: string): Task => ({
  id: "", title: "", description: "", status, due_date: null, assigned_to: null,
  created_at: new Date().toISOString(), priority: "normal", labels: [],
});

export const TaskEditorDialog = ({
  open, onOpenChange, task, projectId, defaultStatus = "todo",
  collaborators, currentUserId, onSaved,
}: TaskEditorDialogProps) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Task>(task ?? blank(defaultStatus));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(task ?? blank(defaultStatus));
  }, [task, defaultStatus, open]);

  const isNew = !task?.id;

  const save = async () => {
    if (!draft.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setBusy(true);
    if (isNew) {
      const { data: inserted, error } = await supabase.from("project_tasks").insert({
        project_id: projectId,
        created_by: currentUserId,
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        status: draft.status,
        due_date: draft.due_date || null,
        assigned_to: draft.assigned_to || null,
        priority: draft.priority || "normal",
      }).select("id").single();
      setBusy(false);
      if (error) return toast({ title: "Couldn't create", description: error.message, variant: "destructive" });
      toast({ title: "Task created" });

      // Background AI enhancement — only fills BLANK fields (respects what the user typed).
      if (inserted?.id) {
        const userHadDescription = !!draft.description?.trim();
        const userHadDueDate = !!draft.due_date;
        const userHadAssignee = !!draft.assigned_to;
        enhanceTaskInBackground({
          taskId: inserted.id,
          rawTitle: draft.title.trim(),
          existingDescription: draft.description?.trim() || null,
          projectId,
          collaborators: collaborators.map((c) => ({ id: c.id, full_name: c.full_name })),
          preserveAssignee: userHadAssignee,
          dryRun: true,
        }).then(async (res) => {
          if (!res.ok || !res.patched) return;
          // Strip patches that would overwrite user-supplied values.
          const safe: Record<string, unknown> = {};
          if (res.patched.description && !userHadDescription) safe.description = res.patched.description;
          if (res.patched.due_date && !userHadDueDate) safe.due_date = res.patched.due_date;
          if (Object.keys(safe).length > 0) {
            await supabase.from("project_tasks").update(safe).eq("id", inserted.id);
            onSaved();
          }
        });
      }
    } else {
      const { error } = await supabase.from("project_tasks").update({
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        status: draft.status,
        due_date: draft.due_date || null,
        assigned_to: draft.assigned_to || null,
        priority: draft.priority || "normal",
      }).eq("id", draft.id);
      setBusy(false);
      if (error) return toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      toast({ title: "Task updated" });
    }
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!task?.id) return;
    if (!confirm("Delete this task?")) return;
    setBusy(true);
    const { error } = await supabase.from("project_tasks").delete().eq("id", task.id);
    setBusy(false);
    if (error) return toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    toast({ title: "Task deleted" });
    onOpenChange(false);
    onSaved();
  };

  const dueValue = draft.due_date ? new Date(draft.due_date).toISOString().slice(0, 10) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "New task" : "Edit task"}</DialogTitle>
          <DialogDescription>{isNew ? "Add a task to the board." : "Update task details."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              autoFocus
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="What needs to be done?"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={3}
              value={draft.description || ""}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Add context, links, acceptance criteria…"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={draft.status} onValueChange={v => setDraft({ ...draft, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={draft.priority || "normal"} onValueChange={v => setDraft({ ...draft, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                value={dueValue}
                onChange={e => setDraft({ ...draft, due_date: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assignee</Label>
              <Select
                value={draft.assigned_to || "unassigned"}
                onValueChange={v => setDraft({ ...draft, assigned_to: v === "unassigned" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {collaborators.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">{getInitials(c.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{c.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            {!isNew ? (
              <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={busy || !draft.title.trim()}>
                {isNew ? "Create" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};