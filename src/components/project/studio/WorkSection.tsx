import { useState, useMemo, useRef } from "react";
import {
  Plus,
  Image as ImageIcon,
  FileText,
  AudioLines,
  Loader2,
  Check,
  Flame,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { enhanceTaskInBackground } from "@/lib/taskEnhancer";

type TaskStatus = "todo" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus | string;
  priority?: string | null;
  attachment_url?: string | null;
  attachment_kind?: string | null;
  assigned_to?: string | null;
}

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface WorkSectionProps {
  tasks: Task[];
  projectId: string;
  currentUserId: string;
  collaborators?: Collaborator[];
  onUpdated: () => void;
}

const attachmentIcon = (url?: string | null, kind?: string | null) => {
  if (!url) return null;
  if (kind === "audio" || /\.(mp3|wav|m4a|ogg|webm)$/i.test(url))
    return <AudioLines className="h-3.5 w-3.5" />;
  if (/\.(jpe?g|png|gif|webp|avif)$/i.test(url))
    return <ImageIcon className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
};

const isBlocking = (t: Task) => {
  const p = (t.priority || "").toLowerCase();
  return p === "blocking" || p === "urgent" || p === "high";
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const SWIPE_THRESHOLD = 70; // px

/**
 * Scroll-native task feed (replaces Kanban).
 * - Blocking tasks pinned at top with flame badge
 * - Swipe right → mark done. Swipe left on a done task → reopen.
 * - Inline assignee picker (Add UserPlus → menu of collaborators).
 * - Completed work auto-collapses into a "Completed (X)" folder.
 */
export const WorkSection = ({
  tasks,
  projectId,
  currentUserId,
  collaborators = [],
  onUpdated,
}: WorkSectionProps) => {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "complete" | "reopen" | "delete"; task: Task }
    | null
  >(null);

  const collabMap = useMemo(() => {
    const m = new Map<string, Collaborator>();
    for (const c of collaborators) m.set(c.id, c);
    return m;
  }, [collaborators]);

  const { blocking, active, done } = useMemo(() => {
    const blocking: Task[] = [];
    const active: Task[] = [];
    const done: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done") done.push(t);
      else if (isBlocking(t)) blocking.push(t);
      else active.push(t);
    }
    return { blocking, active, done };
  }, [tasks]);

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const rawTitle = draft.trim();
    const { data: inserted, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title: rawTitle,
        status: "todo",
        created_by: currentUserId,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't add task", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
    setAdding(false);
    onUpdated();

    // Fire-and-forget AI enhancement (refines title, fills description, due date, priority, assignee)
    if (inserted?.id) {
      enhanceTaskInBackground({
        taskId: inserted.id,
        rawTitle,
        projectId,
        collaborators: collaborators.map((c) => ({ id: c.id, full_name: c.full_name })),
      }).then((res) => {
        if (res.ok && res.patched && Object.keys(res.patched).length > 0) {
          toast({ title: "Polished", description: "Smart fields filled in for you." });
          onUpdated();
        } else if (!res.ok) {
          console.warn("[enhance-task] failed:", res.error);
        }
      });
    }
  };

  const markDone = async (task: Task) => {
    setBusyId(task.id);
    const { error } = await supabase
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", task.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    onUpdated();
  };

  const reopen = async (task: Task) => {
    setBusyId(task.id);
    const { error } = await supabase
      .from("project_tasks")
      .update({ status: "todo" })
      .eq("id", task.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Couldn't reopen", description: error.message, variant: "destructive" });
      return;
    }
    onUpdated();
  };

  const deleteTask = async (task: Task) => {
    setBusyId(task.id);
    const { error } = await supabase
      .from("project_tasks")
      .delete()
      .eq("id", task.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Task deleted" });
    onUpdated();
  };

  const assignTo = async (task: Task, userId: string | null) => {
    setAssigningId(task.id);
    const { error } = await supabase
      .from("project_tasks")
      .update({ assigned_to: userId })
      .eq("id", task.id);
    setAssigningId(null);
    if (error) {
      toast({
        title: "Couldn't assign",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    onUpdated();
  };

  const handleToggleExpand = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  return (
    <>
      <Section
        tasks={tasks}
        blocking={blocking}
        active={active}
        done={done}
        adding={adding}
        setAdding={setAdding}
        draft={draft}
        setDraft={setDraft}
        saving={saving}
        handleAdd={handleAdd}
        folderOpen={folderOpen}
        setFolderOpen={setFolderOpen}
        renderRow={(task, isDone) => (
          <TaskRow
            key={task.id}
            task={task}
            isDone={isDone}
            expanded={expandedId === task.id}
            onToggleExpand={() => handleToggleExpand(task.id)}
            collaborators={collaborators}
            collabMap={collabMap}
            currentUserId={currentUserId}
            busy={busyId === task.id}
            assigning={assigningId === task.id}
            onRequestComplete={() => setConfirm({ kind: "complete", task })}
            onRequestReopen={() => setConfirm({ kind: "reopen", task })}
            onRequestDelete={() => setConfirm({ kind: "delete", task })}
            onAssign={(uid) => assignTo(task, uid)}
          />
        )}
      />

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete"
                ? "Delete this task?"
                : confirm?.kind === "reopen"
                  ? "Reopen this task?"
                  : "Mark this complete?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? "This task will be permanently removed. You can't undo this."
                : confirm?.kind === "reopen"
                  ? "It'll move back to the active list."
                  : "Nice work — this will move to Completed."}
              {confirm && (
                <span className="block mt-2 font-medium text-foreground line-clamp-2">
                  "{confirm.task.title}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirm?.kind === "delete" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              onClick={() => {
                if (!confirm) return;
                const { kind, task } = confirm;
                setConfirm(null);
                if (kind === "complete") markDone(task);
                else if (kind === "reopen") reopen(task);
                else deleteTask(task);
              }}
            >
              {confirm?.kind === "delete"
                ? "Delete"
                : confirm?.kind === "reopen"
                  ? "Reopen"
                  : "Mark complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

interface TaskRowProps {
  task: Task;
  isDone: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  collaborators: Collaborator[];
  collabMap: Map<string, Collaborator>;
  currentUserId: string;
  busy: boolean;
  assigning: boolean;
  onRequestComplete: () => void;
  onRequestReopen: () => void;
  onRequestDelete: () => void;
  onAssign: (userId: string | null) => void;
}

const TaskRow = ({
  task,
  isDone,
  expanded,
  onToggleExpand,
  collaborators,
  collabMap,
  currentUserId,
  busy,
  assigning,
  onRequestComplete,
  onRequestReopen,
  onRequestDelete,
  onAssign,
}: TaskRowProps) => {
  const blocking = isBlocking(task);
  const assignee = task.assigned_to ? collabMap.get(task.assigned_to) : null;
  const [pickerOpen, setPickerOpen] = useState(false);

  const startXRef = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const [released, setReleased] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setReleased(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current == null) return;
    const delta = e.touches[0].clientX - startXRef.current;
    // Right swipe = complete (only when not done). Left swipe = delete (always).
    if (delta > 0 && !isDone) setDx(Math.min(delta, 140));
    else if (delta < 0) setDx(Math.max(delta, -140));
  };
  const onTouchEnd = () => {
    startXRef.current = null;
    setReleased(true);
    if (!isDone && dx > SWIPE_THRESHOLD) {
      setDx(0);
      onRequestComplete();
    } else if (dx < -SWIPE_THRESHOLD) {
      setDx(0);
      onRequestDelete();
    } else {
      setDx(0);
    }
  };

  const showSwipeHint = Math.abs(dx) > 10;
  const swipingRight = dx > 10;
  const swipingLeft = dx < -10;

  return (
    <div className="relative">
      {showSwipeHint && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl flex items-center px-4 text-xs font-bold uppercase tracking-wider",
            swipingRight && "bg-primary/15 text-primary justify-start",
            swipingLeft && "bg-destructive/15 text-destructive justify-end",
          )}
        >
          {swipingRight ? (
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> Delete
            </span>
          )}
        </div>
      )}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: released ? "transform 200ms ease-out" : "none",
        }}
        className={cn(
          "relative w-full rounded-xl bg-card ring-1 ring-border p-3 transition-shadow hover:ring-primary/40",
          blocking && !isDone && "ring-destructive/40 bg-destructive/5",
          isDone && "opacity-60",
        )}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={isDone ? "Reopen task" : "Mark done"}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              isDone ? onRequestReopen() : onRequestComplete();
            }}
            className={cn(
              "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
              isDone
                ? "bg-primary border-primary"
                : blocking
                  ? "border-destructive hover:bg-destructive/10"
                  : "border-muted-foreground/40 hover:border-primary",
            )}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin text-foreground" />
            ) : isDone ? (
              <Check className="h-3 w-3 text-primary-foreground" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              {blocking && !isDone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ring-1 ring-destructive/30">
                  <Flame className="h-2.5 w-2.5" /> Blocking
                </span>
              )}
              <p
                className={cn(
                  "text-sm leading-snug break-words",
                  isDone && "line-through text-muted-foreground",
                )}
              >
                {task.title}
              </p>
            </div>
            {task.attachment_url && (
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                {attachmentIcon(task.attachment_url, task.attachment_kind)}
                attachment
              </span>
            )}
            {expanded && task.description && (
              <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            )}
          </button>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={
                  assignee ? `Assigned to ${assignee.full_name}` : "Assign someone"
                }
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : assignee ? (
                  <Avatar className="h-6 w-6 ring-1 ring-border">
                    <AvatarImage src={assignee.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px] font-semibold">
                      {initials(assignee.full_name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="h-6 w-6 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:text-primary text-muted-foreground transition-colors">
                    <UserPlus className="h-3 w-3" />
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-56 p-1"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Assign to
              </p>
              {collaborators.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                  Invite someone first.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {collaborators.map((c) => {
                    const selected = task.assigned_to === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onAssign(selected ? null : c.id);
                          setPickerOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left",
                          selected && "bg-primary/10",
                        )}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback className="text-[9px] font-semibold">
                            {initials(c.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs flex-1 truncate">
                          {c.id === currentUserId ? "Me" : c.full_name}
                        </span>
                        {selected && (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {task.assigned_to && (
                <button
                  type="button"
                  onClick={() => {
                    onAssign(null);
                    setPickerOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent rounded-md mt-1 border-t border-border pt-2"
                >
                  Unassign
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

interface SectionProps {
  tasks: Task[];
  blocking: Task[];
  active: Task[];
  done: Task[];
  adding: boolean;
  setAdding: (v: boolean) => void;
  draft: string;
  setDraft: (v: string) => void;
  saving: boolean;
  handleAdd: () => void;
  folderOpen: boolean;
  setFolderOpen: (fn: (v: boolean) => boolean) => void;
  renderRow: (task: Task, isDone: boolean) => React.ReactNode;
}

const Section = ({
  tasks,
  blocking,
  active,
  done,
  adding,
  setAdding,
  draft,
  setDraft,
  saving,
  handleAdd,
  folderOpen,
  setFolderOpen,
  renderRow,
}: SectionProps) => {

  const total = tasks.length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  return (
    <section className="px-4 py-5 space-y-3">
      <header className="space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
              Momentum
            </p>
            <h2 className="text-lg font-black leading-none tracking-tight">
              The Work
            </h2>
          </div>
          {total > 0 && (
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              {done.length}<span className="text-muted-foreground/60">/{total}</span>
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[hsl(var(--energy))] shadow-[0_0_8px_hsl(var(--energy)/0.6)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </header>

      {/* Swipe hint — only when there's something to swipe */}
      {tasks.length > 0 && (active.length > 0 || blocking.length > 0) && (
        <p className="text-[10px] text-muted-foreground text-center">
          Tip: swipe right to complete · swipe left to delete
        </p>
      )}

      {/* Blocking — pinned top */}
      {blocking.length > 0 && (
        <div className="space-y-2">
          {blocking.map((t) => (
            <div key={t.id}>{renderRow(t, false)}</div>
          ))}
        </div>
      )}

      {/* Active stream */}
      <div className="space-y-2">
        {active.map((t) => (
          <div key={t.id}>{renderRow(t, false)}</div>
        ))}

        {active.length === 0 && blocking.length === 0 && tasks.length === 0 && !adding && (
          <div className="rounded-2xl bg-card ring-1 ring-border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  Break the project into small wins
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Tasks are the moves that get this project done — anything
                  with a clear "done" you can tick off. Small &amp; specific
                  beats vague every time.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Try one of these
              </p>
              {[
                "Send draft to client",
                "Edit final cut",
                "Confirm shoot date",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setDraft(suggestion);
                    setAdding(true);
                  }}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/40 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-3 w-3 text-primary shrink-0" />
                  {suggestion}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" /> Add first task
            </Button>
          </div>
        )}
        {active.length === 0 && blocking.length === 0 && done.length > 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            All caught up. Nice work.
          </p>
        )}

        {/* Add task — always visible */}
        {adding ? (
          <div className="space-y-1.5 rounded-xl border border-primary/40 p-2.5">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="What's the next thing?"
              className="h-9 text-sm border-0 focus-visible:ring-0 px-1"
            />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : tasks.length === 0 ? null : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add task
          </button>
        )}
      </div>

      {/* Completed folder */}
      {done.length > 0 && (
        <div className="rounded-xl bg-muted/40 ring-1 ring-border overflow-hidden">
          <button
            type="button"
            onClick={() => setFolderOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary" />
              Completed ({done.length})
            </span>
            {folderOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {folderOpen && (
            <div className="p-2 space-y-1.5 border-t border-border/60">
              {done.map((t) => (
                <div key={t.id}>{renderRow(t, true)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
