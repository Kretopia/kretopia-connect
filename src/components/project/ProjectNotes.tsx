import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Plus, Trash2, FileText, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeskIntent, dispatchDeskIntent, navigateDeskTab } from "@/hooks/useDeskIntent";

interface Note {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

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

  const handleNew = useCallback((prefill?: { title?: string; content?: string }) => {
    setSelectedNote(null);
    setTitle(prefill?.title ?? "");
    setContent(prefill?.content ?? "");
    setIsComposing(true);
  }, []);

  // Intent listener: from NextStepBar ("create-brief") or chat ("note-from-chat")
  useDeskIntent("notes", useCallback((intent, payload) => {
    if (intent === "create-brief") {
      handleNew({ title: "Project Brief", content: BRIEF_TEMPLATE });
    } else if (intent === "note-from-chat" && payload?.text) {
      handleNew({ title: payload.title || "Note from chat", content: payload.text });
    }
  }, [handleNew]));

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Note title is required");
      return;
    }

    setSaving(true);
    try {
      if (selectedNote) {
        const { error } = await supabase
          .from("project_notes")
          .update({ title, content, updated_at: new Date().toISOString() })
          .eq("id", selectedNote.id);

        if (error) throw error;
        toast.success("Note updated");
      } else {
        const { data, error } = await supabase
          .from("project_notes")
          .insert({ project_id: projectId, title, content })
          .select()
          .single();

        if (error) throw error;
        setSelectedNote(data as Note);
        setIsComposing(false);
        toast.success("Note created");
      }
      fetchNotes();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;

    try {
      const { error } = await supabase
        .from("project_notes")
        .delete()
        .eq("id", selectedNote.id);

      if (error) throw error;
      toast.success("Note deleted");
      handleNew();
      fetchNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
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

  if (loading) {
    return <div className="p-4">Loading notes...</div>;
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
                onClick={() => {
                  setSelectedNote(note);
                  setTitle(note.title);
                  setContent(note.content || "");
                  setIsComposing(false);
                }}
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
                setSelectedNote(null);
                setIsComposing(false);
                setTitle("");
                setContent("");
              }}
            >
              ← All Notes
            </Button>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Input
              placeholder="Note title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold w-full sm:flex-1"
            />
            <div className="flex gap-2 shrink-0">
              {selectedNote && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <Textarea
            placeholder="Start writing your note... Use - bullets to convert into tasks."
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
    </div>
  );
}
