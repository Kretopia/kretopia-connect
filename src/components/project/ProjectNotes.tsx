import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Plus, Trash2, FileText, CheckSquare, AlertTriangle } from "lucide-react";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeskIntent, dispatchDeskIntent, navigateDeskTab } from "@/hooks/useDeskIntent";
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
import { clearDraft, draftKey } from "@/lib/draftStorage";
import { useDraftRecovery } from "@/hooks/useDraftRecovery";
import { createNote, deleteNote, saveNote, type NoteRow, type NotesClient } from "@/lib/noteSave";

type Note = NoteRow;

interface ProjectNotesProps {
  projectId: string;
}

const BRIEF_TEMPLATE = `## 🎯 Project Goal
What are we trying to achieve?

## 📦 Deliverables
-
-
-

## 🎨 Creative Direction
Mood, references, style notes.

## 📅 Timeline
Key dates and milestones.

## ✅ Success Criteria
How will we know this is done?

## 💬 Notes
Anything else worth capturing.
`;

const notesClient = supabase as unknown as NotesClient;
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function ProjectNotes({ projectId }: ProjectNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const isMobileView = useIsMobile();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [convertingLine, setConvertingLine] = useState<string | null>(null);
  // Work-continuity state: what the person can truthfully be told about their text.
  const [conflict, setConflict] = useState<Note | null>(null);
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Set when the person starts a note from a template/intent: the old "new note" draft must not replace it.
  const [freshStartKey, setFreshStartKey] = useState<string | null>(null);

  // ── Unsaved-edit safety net ────────────────────────────────────────────────
  const noteKey = selectedNote ? draftKey("note", projectId, selectedNote.id) : draftKey("note", projectId, "new");
  const savedValue = useMemo(
    () => (selectedNote ? { title: selectedNote.title, content: selectedNote.content ?? "" } : { title: "", content: "" }),
    [selectedNote],
  );
  const draft = useDraftRecovery({
    key: noteKey,
    saved: savedValue,
    value: { title, content },
    base: selectedNote?.updated_at ?? null,
    skipRestore: freshStartKey === noteKey,
    onRestore: (v) => {
      setTitle(v.title);
      setContent(v.content);
    },
  });

  // If this device could not keep a copy, do not let the tab close on unsaved text without a warning.
  useEffect(() => {
    if (draft.status !== "not-kept") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.status]);

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("project_notes")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const typedData = data as Note[];
      setNotes(typedData || []);

      if (typedData && typedData.length > 0 && !selectedNote) {
        setSelectedNote(typedData[0]);
        setTitle(typedData[0].title);
        setContent(typedData[0].content || "");
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const resetFeedback = () => {
    setConflict(null);
    setSaveProblem(null);
    setLastSavedAt(null);
  };

  const openNote = (note: Note) => {
    draft.flush(); // what was typed in the note we are leaving is kept on this device
    resetFeedback();
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content || "");
    setIsComposing(false);
  };

  const handleNew = useCallback(
    (prefill?: { title?: string; content?: string }) => {
      draft.flush();
      setFreshStartKey(prefill ? draftKey("note", projectId, "new") : null);
      setConflict(null);
      setSaveProblem(null);
      setLastSavedAt(null);
      setSelectedNote(null);
      setTitle(prefill?.title ?? "");
      setContent(prefill?.content ?? "");
      setIsComposing(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.flush],
  );

  // Intent listener: from NextStepBar ("create-brief") or chat ("note-from-chat")
  useDeskIntent("notes", useCallback((intent, payload) => {
    if (intent === "create-brief") {
      handleNew({ title: "Project Brief", content: BRIEF_TEMPLATE });
    } else if (intent === "note-from-chat" && payload?.text) {
      handleNew({ title: payload.title || "Note from chat", content: payload.text });
    }
  }, [handleNew]));

  const applySaved = (row: Note) => {
    setSelectedNote(row);
    setNotes((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
    draft.markSaved();
    setConflict(null);
    setSaveProblem(null);
    setLastSavedAt(Date.now());
  };

  const handleSave = async (overwriteFrom?: Note) => {
    if (!title.trim()) {
      toast.error("Note title is required");
      return;
    }

    setSaving(true);
    setSaveProblem(null);
    try {
      if (selectedNote) {
        // Compare-and-set: only writes if nobody changed the note since it was opened here
        // (or since the version the person chose to overwrite).
        const basis = overwriteFrom ?? selectedNote;
        const out = await saveNote(notesClient, basis, { title, content });
        switch (out.status) {
          case "saved":
            applySaved(out.row);
            toast.success("Note saved");
            break;
          case "conflict":
            setConflict(out.latest);
            break;
          case "gone":
            setSaveProblem("This note was deleted, or you no longer have access to it. Your text is kept on this device.");
            break;
          case "denied":
            setSaveProblem("You can't edit this note. Your text is kept on this device.");
            break;
          case "error":
            setSaveProblem(`Couldn't save (${out.message}). Your text is kept on this device.`);
            break;
        }
      } else {
        const out = await createNote(notesClient, projectId, { title, content });
        if (out.status === "created") {
          draft.markSaved(); // clears the "new note" draft before the key switches to the saved note
          setSelectedNote(out.row);
          setNotes((prev) => [out.row, ...prev]);
          setIsComposing(false);
          setLastSavedAt(Date.now());
          toast.success("Note created");
        } else {
          setSaveProblem(`Couldn't create the note (${out.message}). Your text is kept on this device.`);
        }
      }
    } catch (error) {
      console.error("Error saving note:", error);
      setSaveProblem("Couldn't reach the server. Your text is kept on this device.");
    } finally {
      setSaving(false);
    }
  };

  // Conflict resolution: nothing is ever overwritten silently.
  const keepMine = () => conflict && handleSave(conflict);

  const adoptTheirs = () => {
    if (!conflict) return;
    draft.discard();
    setSelectedNote(conflict);
    setNotes((prev) => prev.map((n) => (n.id === conflict.id ? conflict : n)));
    setTitle(conflict.title);
    setContent(conflict.content || "");
    setConflict(null);
  };

  const saveMineAsCopy = async () => {
    if (!conflict) return;
    const out = await createNote(notesClient, projectId, {
      title: `${title.trim() || "Untitled"} (my version)`,
      content,
    });
    if (out.status !== "created") {
      setSaveProblem(`Couldn't save your version as a new note (${out.message}). It is still kept on this device.`);
      return;
    }
    toast.success("Your version was saved as a new note");
    setNotes((prev) => [out.row, ...prev]);
    adoptTheirs();
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    setConfirmDeleteOpen(false);
    const out = await deleteNote(notesClient, selectedNote.id);
    if (out.status === "error") {
      toast.error(`Couldn't delete the note (${out.message})`);
      return;
    }
    if (out.status === "gone") {
      toast.error("This note was already deleted, or you no longer have access to it");
      fetchNotes();
      return;
    }
    const removed = out.row;
    const deletedKey = noteKey;
    setNotes((prev) => prev.filter((n) => n.id !== removed.id));
    handleNew();
    clearDraft(deletedKey); // the deleted note leaves nothing behind on this device
    toast.success(`"${removed.title}" deleted`, {
      duration: 10000,
      action: {
        label: "Undo",
        onClick: async () => {
          const back = await createNote(notesClient, projectId, { title: removed.title, content: removed.content ?? "" });
          if (back.status === "created") {
            setNotes((prev) => [back.row, ...prev]);
            openNote(back.row);
            toast.success("Note restored");
          } else {
            toast.error(`Couldn't restore the note (${back.message})`);
          }
        },
      },
    });
  };

  // Convert a single bullet line into a task
  const convertLineToTask = async (line: string) => {
    const cleaned = line.replace(/^[-*•\s\[\]xX]+/, "").trim();
    if (!cleaned) return;
    setConvertingLine(line);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("project_tasks").insert({
        project_id: projectId,
        title: cleaned.slice(0, 200),
        status: "todo",
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Task created", {
        description: cleaned.slice(0, 60),
        action: { label: "Open Tasks", onClick: () => navigateDeskTab("tasks") },
      });
    } catch (e: any) {
      toast.error(e.message || "Couldn't create task");
    } finally {
      setConvertingLine(null);
    }
  };

  // Find bullet lines in current content
  const bulletLines = content
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => /^\s*[-*•]\s+\S/.test(l));

  // One truthful line about the state of the text; never "saved" for something only held locally.
  const statusLine = saving
    ? { text: "Saving…", tone: "muted" as const }
    : saveProblem
      ? { text: saveProblem, tone: "bad" as const }
      : draft.status === "not-kept"
        ? { text: "Unsaved changes. This device could not keep a copy, so save before you leave.", tone: "bad" as const }
        : draft.status === "kept-on-device"
          ? { text: "Unsaved changes, kept on this device", tone: "muted" as const }
          : draft.status === "dirty"
            ? { text: "Unsaved changes", tone: "muted" as const }
            : lastSavedAt
              ? { text: `Saved at ${clock(lastSavedAt)}`, tone: "muted" as const }
              : null;

  if (loading) {
    return <KretopiaLoader size="sm" label="Loading notes..." className="p-4" />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Notes List — hide on mobile when viewing or composing a note */}
      {(!(selectedNote || isComposing) || !isMobileView) ? (
        <Card className={cn(
          "p-4 flex flex-col gap-2 shrink-0",
          "w-full md:w-64",
          (selectedNote || isComposing) && "hidden md:flex"
        )}>
          <Button onClick={() => handleNew()} className="w-full mb-2">
            <Plus className="h-4 w-4 mr-2" /> New Note
          </Button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => openNote(note)}
                className={`w-full p-3 text-left rounded-lg border transition-colors ${
                  selectedNote?.id === note.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{note.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}

            {notes.length === 0 && (
              <div className="text-center py-8 px-2">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm font-medium">No notes yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Quick scratch, links, and decisions for the team.
                </p>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {/* Note Editor */}
      {(selectedNote || isComposing || !isMobileView) && (
        <Card className="flex-1 p-4 md:p-6 flex flex-col gap-4 min-h-0">
          {isMobileView && (selectedNote || isComposing) && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start -ml-2 mb-1"
              onClick={() => {
                draft.flush();
                resetFeedback();
                setSelectedNote(null);
                setIsComposing(false);
                setTitle("");
                setContent("");
              }}
            >
              ← All Notes
            </Button>
          )}

          {draft.restoredAt && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span>Restored your unsaved edits from {clock(draft.restoredAt)}.</span>
              <Button variant="ghost" size="sm" onClick={draft.discard}>
                Discard them
              </Button>
            </div>
          )}

          {conflict && (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Someone else changed this note at {clock(Date.parse(conflict.updated_at))}.
              </p>
              <p className="mt-1 text-muted-foreground">
                Nothing was overwritten. Your version is still here and kept on this device.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={keepMine} disabled={saving}>
                  Keep mine (replace theirs)
                </Button>
                <Button size="sm" variant="outline" onClick={adoptTheirs}>
                  Use theirs (drop mine)
                </Button>
                <Button size="sm" variant="outline" onClick={saveMineAsCopy}>
                  Save mine as a new note, then use theirs
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Input
              placeholder="Note title"
              aria-label="Note title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold w-full sm:flex-1"
            />
            <div className="flex gap-2 shrink-0">
              {selectedNote && (
                <Button
                  variant="destructive"
                  size="sm"
                  aria-label="Delete note"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => handleSave()} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <p
            role="status"
            aria-live="polite"
            className={cn("min-h-4 text-xs", statusLine?.tone === "bad" ? "text-destructive" : "text-muted-foreground")}
          >
            {statusLine?.text ?? ""}
          </p>

          <Textarea
            placeholder="Start writing your note... Use - bullets to convert into tasks."
            aria-label="Note content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-h-[300px] md:min-h-[400px] resize-none font-mono text-sm"
          />

          {/* Convert-to-task panel */}
          {bulletLines.length > 0 && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Quick convert to tasks
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {bulletLines.slice(0, 12).map((line, i) => {
                  const text = line.replace(/^\s*[-*•]\s+/, "");
                  return (
                    <Button
                      key={`${i}-${line}`}
                      size="sm"
                      variant="outline"
                      disabled={convertingLine === line}
                      onClick={() => convertLineToTask(line)}
                      className="h-7 text-xs gap-1.5 max-w-full"
                      title={text}
                    >
                      <Plus className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[200px]">{text}</span>
                    </Button>
                  );
                })}
                {bulletLines.length > 12 && (
                  <span className="text-xs text-muted-foreground self-center">
                    +{bulletLines.length - 12} more
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{selectedNote?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The note disappears for everyone on this project. You can undo for a few seconds right after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep note</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete note</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
