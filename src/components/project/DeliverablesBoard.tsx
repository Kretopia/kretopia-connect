import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Calendar, Clock, CheckCircle2, XCircle, Circle, Loader2,
  Sparkles, Inbox, Upload, ExternalLink, Image as ImageIcon, Plus,
  FolderUp, FileText, Music, Film, FileArchive, File as FileIcon, X,
  GripVertical,
} from "lucide-react";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AssigneePicker } from "./board/AssigneePicker";
import { notifyDeliverableAssigned } from "./board/notifyAssignee";

type Status = "pending" | "in_progress" | "submitted" | "approved" | "rejected";

interface MoodboardItem {
  url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  kind?: "image" | "link" | "video" | null;
}

interface SubmissionFile {
  url: string;
  name: string;
  mime: string;
  size?: number;
  thumbnail_url?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
  kind?: "image" | "video" | "audio" | "pdf" | "doc" | "archive" | "file";
}

interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  source: string | null;
  sort_order: number | null;
  created_at: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  moodboard: MoodboardItem[] | null;
  kind: string | null;
  submission_files: SubmissionFile[] | null;
  assignee_id: string | null;
  assignee_name?: string | null;
  assignee_avatar?: string | null;
}

interface DeliverablesBoardProps {
  projectId: string;
  projectTitle?: string;
  currentUserId: string;
  onEmpty?: () => void;
}

const COLUMNS: { key: Status; label: string; icon: typeof Circle; tone: string }[] = [
  { key: "pending",     label: "To Do",       icon: Circle,        tone: "bg-muted text-muted-foreground" },
  { key: "in_progress", label: "In Progress", icon: Loader2,       tone: "bg-primary/10 text-primary" },
  { key: "submitted",   label: "Submitted",   icon: Clock,         tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { key: "approved",    label: "Approved",    icon: CheckCircle2,  tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { key: "rejected",    label: "Changes",     icon: XCircle,       tone: "bg-destructive/10 text-destructive" },
];

const STATUS_KEYS: Status[] = COLUMNS.map((c) => c.key);

const isImageUrl = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u);

const fileKindFromMime = (mime: string, name: string): SubmissionFile["kind"] => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "archive";
  if (/\.(docx?|pages|odt|txt|rtf|md)$/i.test(name) || mime.includes("word") || mime.includes("text")) return "doc";
  return "file";
};

const FileKindIcon = ({ kind }: { kind?: SubmissionFile["kind"] }) => {
  switch (kind) {
    case "image": return <ImageIcon className="h-4 w-4" />;
    case "video": return <Film className="h-4 w-4" />;
    case "audio": return <Music className="h-4 w-4" />;
    case "pdf":
    case "doc":   return <FileText className="h-4 w-4" />;
    case "archive": return <FileArchive className="h-4 w-4" />;
    default: return <FileIcon className="h-4 w-4" />;
  }
};

function coverFor(d: Deliverable): { src: string; isWip: boolean } | null {
  const subs = d.submission_files ?? [];
  const firstWipImg = subs.find((s) => s.kind === "image" && (s.thumbnail_url || s.url));
  if (firstWipImg) return { src: (firstWipImg.thumbnail_url || firstWipImg.url)!, isWip: true };
  if (d.thumbnail_url) return { src: d.thumbnail_url, isWip: true };
  if (d.file_url && isImageUrl(d.file_url)) return { src: d.file_url, isWip: true };
  const refs = d.moodboard ?? [];
  const firstImg = refs.find((r) => r.thumbnail_url || (r.url && isImageUrl(r.url)));
  if (firstImg) return { src: (firstImg.thumbnail_url || firstImg.url)!, isWip: false };
  return null;
}

const initials = (n: string | null | undefined) =>
  (n ?? "?").split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

// ============================================================
// Sortable Card
// ============================================================
const SortableCard = ({
  d,
  projectId,
  onOpen,
  onAssign,
  isDragOverlay = false,
}: {
  d: Deliverable;
  projectId: string;
  onOpen: () => void;
  onAssign: (deliverableId: string, userId: string | null, name: string | null, avatar: string | null) => void;
  isDragOverlay?: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: d.id, data: { type: "card", status: d.status } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isDragOverlay ? 0.4 : 1,
  };

  const cover = coverFor(d);
  const refCount = d.moodboard?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-md border bg-card overflow-hidden transition-shadow",
        isDragOverlay && "shadow-2xl ring-2 ring-primary/40 cursor-grabbing rotate-1",
        !isDragOverlay && "hover:border-primary/40 hover:shadow-sm",
      )}
    >
      {/* Drag handle row */}
      <div className="flex items-stretch">
        <button
          type="button"
          aria-label="Drag card"
          {...attributes}
          {...listeners}
          className="px-1.5 py-2 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 text-left min-w-0"
        >
          {cover && (
            <div className="relative aspect-video bg-muted -mr-px">
              <img
                src={cover.src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              {cover.isWip && (
                <Badge className="absolute top-1.5 left-1.5 text-[9px] py-0 h-4 bg-emerald-600 hover:bg-emerald-600 text-white border-0">
                  WIP
                </Badge>
              )}
              {!cover.isWip && refCount > 1 && (
                <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[9px] py-0 h-4 gap-0.5">
                  <ImageIcon className="h-2.5 w-2.5" /> {refCount}
                </Badge>
              )}
            </div>
          )}
          <div className="p-2.5 pr-3">
            <p className="text-sm font-medium line-clamp-2">{d.title}</p>
            {d.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{d.description}</p>
            )}
            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {d.due_date ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <Calendar className="h-3 w-3" />
                    {new Date(d.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                ) : null}
                {!cover && refCount > 0 && (
                  <Badge variant="outline" className="text-[9px] py-0 h-4 gap-0.5">
                    <ImageIcon className="h-2.5 w-2.5" /> {refCount}
                  </Badge>
                )}
                {d.source && d.source !== "manual" && (
                  <Badge variant="outline" className="text-[9px] py-0 h-4 truncate">{d.source}</Badge>
                )}
              </div>
            </div>
          </div>
        </button>
        {/* Assignee — sits outside the open-card button so picker click doesn't open dialog */}
        <div className="absolute top-2 right-2">
          <AssigneePicker
            projectId={projectId}
            value={d.assignee_id}
            onChange={(uid, person) =>
              onAssign(d.id, uid, person?.display_name ?? null, person?.avatar_url ?? null)
            }
            size="compact"
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Droppable Column
// ============================================================
const Column = ({
  col,
  list,
  projectId,
  onOpen,
  onAssign,
  onAddInline,
  addingHere,
  setAddingHere,
  newCardTitle,
  setNewCardTitle,
  onCommitInline,
  isOwnerOrCollab,
}: {
  col: typeof COLUMNS[number];
  list: Deliverable[];
  projectId: string;
  onOpen: (d: Deliverable) => void;
  onAssign: (deliverableId: string, userId: string | null, name: string | null, avatar: string | null) => void;
  onAddInline: (status: Status) => void;
  addingHere: boolean;
  setAddingHere: (s: Status | null) => void;
  newCardTitle: string;
  setNewCardTitle: (t: string) => void;
  onCommitInline: (status: Status) => void;
  isOwnerOrCollab: boolean;
}) => {
  const Icon = col.icon;
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}`, data: { type: "column", status: col.key } });

  return (
    <div className="w-[78vw] max-w-[260px] sm:w-72 sm:max-w-none shrink-0">
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-semibold">{col.label}</span>
          <Badge variant="secondary" className="text-xs">{list.length}</Badge>
        </div>
        {isOwnerOrCollab && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddInline(col.key)}
            aria-label={`Add card to ${col.label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "space-y-2 min-h-[120px] p-1.5 rounded-lg bg-muted/30 transition-colors relative",
          isOver && "bg-primary/10 ring-2 ring-primary/30",
        )}
      >
        <SortableContext items={list.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {list.map((d) => (
            <SortableCard
              key={d.id}
              d={d}
              projectId={projectId}
              onOpen={() => onOpen(d)}
              onAssign={onAssign}
            />
          ))}
        </SortableContext>

        {addingHere && (
          <div className="rounded-md border bg-card p-2 space-y-1.5">
            <Input
              autoFocus
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommitInline(col.key); }
                if (e.key === "Escape") { setAddingHere(null); setNewCardTitle(""); }
              }}
              placeholder="What's the deliverable?"
              className="h-8 text-xs"
              maxLength={200}
            />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={() => onCommitInline(col.key)} disabled={!newCardTitle.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingHere(null); setNewCardTitle(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {list.length === 0 && !addingHere && (
          <p className="text-xs text-muted-foreground text-center py-4">—</p>
        )}
      </div>
    </div>
  );
};

// minimal cn helper inline (avoid extra import path noise)
function cn(...c: Array<string | false | null | undefined>) { return c.filter(Boolean).join(" "); }

// ============================================================
// Main board
// ============================================================
export const DeliverablesBoard = ({ projectId, projectTitle, currentUserId, onEmpty }: DeliverablesBoardProps) => {
  const { toast } = useToast();
  const [items, setItems] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Deliverable | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [newRefUrl, setNewRefUrl] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<Status | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const wipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_deliverables")
      .select("id,project_id,title,description,status,due_date,source,sort_order,created_at,submitted_by,reviewed_by,review_note,file_url,thumbnail_url,moodboard,kind,submission_files,assignee_id")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Couldn't load deliverables", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const rows = (data ?? []).map((r: any) => ({
      ...r,
      moodboard: Array.isArray(r.moodboard) ? r.moodboard as MoodboardItem[] : [],
      submission_files: Array.isArray(r.submission_files) ? r.submission_files as SubmissionFile[] : [],
    })) as Deliverable[];

    // Hydrate assignee profile (display name + avatar) for cards
    const assigneeIds = Array.from(new Set(rows.map((r) => r.assignee_id).filter(Boolean) as string[]));
    if (assigneeIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", assigneeIds);
      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      rows.forEach((r) => {
        if (r.assignee_id && profMap.has(r.assignee_id)) {
          const p = profMap.get(r.assignee_id)!;
          r.assignee_name = p.display_name ?? null;
          r.assignee_avatar = p.avatar_url ?? null;
        }
      });
    }

    setItems(rows);
    if (!rows.length) onEmpty?.();
    setLoading(false);
  }, [projectId, toast, onEmpty]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`deliverables-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_deliverables", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, load]);

  // Refresh selected when items reload
  useEffect(() => {
    if (!selected) return;
    const fresh = items.find((i) => i.id === selected.id);
    if (fresh) setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const grouped = useMemo(() => {
    const g: Record<Status, Deliverable[]> = {
      pending: [], in_progress: [], submitted: [], approved: [], rejected: [],
    };
    for (const d of items) {
      const s = (STATUS_KEYS.includes(d.status as Status) ? d.status : "pending") as Status;
      g[s].push(d);
    }
    return g;
  }, [items]);

  // ---------------- Drag & drop ----------------
  const findContainer = (id: string): Status | null => {
    if (id.startsWith("col:")) return id.slice(4) as Status;
    const item = items.find((d) => d.id === id);
    return (item?.status as Status) ?? null;
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    const fromStatus = findContainer(activeIdStr);
    const toStatus = findContainer(overIdStr);
    if (!fromStatus || !toStatus) return;

    const moving = items.find((d) => d.id === activeIdStr);
    if (!moving) return;

    // Build the new ordered list per column from current state, then mutate
    const next: Deliverable[] = [...items];

    if (fromStatus === toStatus) {
      // Reorder within column
      const colItems = next.filter((d) => d.status === fromStatus);
      const oldIdx = colItems.findIndex((d) => d.id === activeIdStr);
      const newIdx = colItems.findIndex((d) => d.id === overIdStr);
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(colItems, oldIdx, newIdx);
      // Apply new sort_order to reordered list
      const updates = reordered.map((d, i) => ({ id: d.id, sort_order: i }));
      // Optimistic
      setItems((prev) => {
        const map = new Map(updates.map((u) => [u.id, u.sort_order]));
        return prev
          .map((d) => map.has(d.id) ? { ...d, sort_order: map.get(d.id)! } : d)
          .sort((a, b) => {
            if (a.status !== b.status) return 0;
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
          });
      });
      // Persist (parallel)
      await Promise.all(
        updates.map((u) =>
          supabase.from("project_deliverables").update({ sort_order: u.sort_order }).eq("id", u.id),
        ),
      ).catch(() => {});
    } else {
      // Move to different column
      const targetCol = next.filter((d) => d.status === toStatus && d.id !== activeIdStr);
      // Insert position: if dropped on a card, insert before/after; if on column, append
      let insertIdx = targetCol.length;
      if (!overIdStr.startsWith("col:")) {
        insertIdx = targetCol.findIndex((d) => d.id === overIdStr);
        if (insertIdx < 0) insertIdx = targetCol.length;
      }
      const newColList = [...targetCol];
      newColList.splice(insertIdx, 0, { ...moving, status: toStatus });

      // Status-side effects
      const patch: Record<string, unknown> = { status: toStatus };
      if (toStatus === "approved" || toStatus === "rejected") {
        patch.reviewed_by = currentUserId;
        patch.reviewed_at = new Date().toISOString();
      }
      if (toStatus === "submitted" && !moving.submitted_by) {
        patch.submitted_by = currentUserId;
      }

      // Optimistic
      setItems((prev) =>
        prev.map((d) => (d.id === activeIdStr ? { ...d, status: toStatus, sort_order: insertIdx } : d)),
      );

      await supabase.from("project_deliverables").update(patch).eq("id", activeIdStr).then(({ error }) => {
        if (error) toast({ title: "Move failed", description: error.message, variant: "destructive" });
      });

      // Re-number sort_order in target column
      await Promise.all(
        newColList.map((d, i) =>
          supabase.from("project_deliverables").update({ sort_order: i }).eq("id", d.id),
        ),
      ).catch(() => {});

      if (toStatus === "approved") {
        toast({ title: "Approved ✓", description: moving.title });
      }
    }
  };

  // ---------------- Inline add ----------------
  const commitInline = async (status: Status) => {
    const title = newCardTitle.trim();
    if (!title) return;
    const colItems = grouped[status];
    const sortOrder = colItems.length;
    const { error } = await supabase.from("project_deliverables").insert({
      project_id: projectId,
      title: title.slice(0, 200),
      status,
      version: 1,
      source: "manual",
      kind: "other",
      sort_order: sortOrder,
      submitted_by: currentUserId,
      moodboard: [],
    } as never);
    if (error) {
      toast({ title: "Couldn't add card", description: error.message, variant: "destructive" });
      return;
    }
    setNewCardTitle("");
    setAddingTo(null);
  };

  // ---------------- Assignee ----------------
  const handleAssign = async (
    deliverableId: string,
    userId: string | null,
    name: string | null,
    avatar: string | null,
  ) => {
    // Optimistic
    setItems((prev) =>
      prev.map((d) =>
        d.id === deliverableId ? { ...d, assignee_id: userId, assignee_name: name, assignee_avatar: avatar } : d,
      ),
    );
    const { error } = await supabase
      .from("project_deliverables")
      .update({ assignee_id: userId })
      .eq("id", deliverableId);
    if (error) {
      toast({ title: "Couldn't assign", description: error.message, variant: "destructive" });
      load();
      return;
    }
    if (userId) {
      const d = items.find((x) => x.id === deliverableId);
      await notifyDeliverableAssigned({
        projectId,
        projectTitle: projectTitle ?? "your project",
        deliverableId,
        deliverableTitle: d?.title ?? "Deliverable",
        assigneeId: userId,
        actorId: currentUserId,
      });
      toast({ title: name ? `Assigned to ${name}` : "Assigned" });
    }
  };

  // ---------------- Inline due date ----------------
  const handleDueDateChange = async (deliverableId: string, due: string | null) => {
    setItems((prev) => prev.map((d) => (d.id === deliverableId ? { ...d, due_date: due } : d)));
    const { error } = await supabase
      .from("project_deliverables")
      .update({ due_date: due })
      .eq("id", deliverableId);
    if (error) {
      toast({ title: "Couldn't update date", description: error.message, variant: "destructive" });
      load();
    }
  };

  // ---------------- WIP upload (unchanged behavior) ----------------
  const uploadWipFiles = async (files: FileList | File[]) => {
    if (!selected) return;
    const list = Array.from(files);
    if (!list.length) return;
    const MAX = 200 * 1024 * 1024;
    const tooBig = list.find((f) => f.size > MAX);
    if (tooBig) {
      toast({ title: "File too large", description: `${tooBig.name} is over 200 MB. Compress or split it first.`, variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: list.length });
    const newSubs: SubmissionFile[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${projectId}/deliverables/${selected.id}/${Date.now()}-${i}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("project-files").upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;
        const signed = await getProjectFileSignedUrl(path, { expiresIn: 60 * 60 * 24 * 7 });
        if (!signed) throw new Error(`Couldn't get URL for ${file.name}`);
        const kind = fileKindFromMime(file.type, file.name);
        newSubs.push({
          url: signed,
          name: file.name,
          mime: file.type || `application/${ext}`,
          size: file.size,
          thumbnail_url: kind === "image" ? signed : null,
          uploaded_by: currentUserId,
          uploaded_at: new Date().toISOString(),
          kind,
        });
        setUploadProgress({ done: i + 1, total: list.length });
      }

      const merged: SubmissionFile[] = [...(selected.submission_files ?? []), ...newSubs];
      const heroImg = merged.find((s) => s.kind === "image");
      const hero = heroImg ?? merged[0];

      const { error: updErr } = await supabase
        .from("project_deliverables")
        .update({
          submission_files: merged as unknown as never,
          file_url: hero?.url ?? null,
          thumbnail_url: heroImg?.url ?? null,
          status: "submitted",
          submitted_by: currentUserId,
        })
        .eq("id", selected.id);
      if (updErr) throw updErr;
      toast({
        title: list.length === 1 ? "Submitted for review" : `Submitted ${list.length} files for review`,
        description: "The client will see your upload on the board.",
      });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (wipInputRef.current) wipInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const removeSubmission = async (idx: number) => {
    if (!selected) return;
    const next = (selected.submission_files ?? []).filter((_, i) => i !== idx);
    const heroImg = next.find((s) => s.kind === "image");
    const hero = heroImg ?? next[0];
    const { error } = await supabase
      .from("project_deliverables")
      .update({
        submission_files: next as unknown as never,
        file_url: hero?.url ?? null,
        thumbnail_url: heroImg?.url ?? null,
      })
      .eq("id", selected.id);
    if (error) toast({ title: "Couldn't remove", description: error.message, variant: "destructive" });
  };

  const addReference = async () => {
    if (!selected || !newRefUrl.trim()) return;
    const url = newRefUrl.trim();
    const isImg = isImageUrl(url);
    const next: MoodboardItem[] = [
      ...(selected.moodboard ?? []),
      { url, thumbnail_url: isImg ? url : null, kind: isImg ? "image" : "link", caption: null },
    ];
    const { error } = await supabase
      .from("project_deliverables")
      .update({ moodboard: next as unknown as never })
      .eq("id", selected.id);
    if (error) {
      toast({ title: "Couldn't add reference", description: error.message, variant: "destructive" });
      return;
    }
    setNewRefUrl("");
  };

  const removeReference = async (idx: number) => {
    if (!selected) return;
    const next = (selected.moodboard ?? []).filter((_, i) => i !== idx);
    const { error } = await supabase
      .from("project_deliverables")
      .update({ moodboard: next as unknown as never })
      .eq("id", selected.id);
    if (error) toast({ title: "Couldn't remove", description: error.message, variant: "destructive" });
  };

  const reviewAdvance = async (to: Status) => {
    if (!selected) return;
    setUpdating(true);
    const patch: Record<string, unknown> = { status: to };
    if (to === "approved" || to === "rejected") {
      patch.reviewed_by = currentUserId;
      patch.reviewed_at = new Date().toISOString();
      if (reviewNote.trim()) patch.review_note = reviewNote.trim();
    }
    const { error } = await supabase
      .from("project_deliverables")
      .update(patch)
      .eq("id", selected.id);
    setUpdating(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: to === "approved" ? "Approved ✓" : to === "rejected" ? "Marked for changes" : "Updated",
    });
    if (to === "approved") setSelected(null);
    setReviewNote("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No deliverables yet</p>
            <p className="text-sm text-muted-foreground">
              Use <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Add a Brief</span> above to import them from a doc, sheet, voice memo, or just type them in.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddingTo("pending")} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add a card manually
          </Button>
          {addingTo === "pending" && (
            <div className="max-w-sm mx-auto pt-2 space-y-1.5">
              <Input
                autoFocus
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitInline("pending"); }}
                placeholder="Deliverable title"
                className="h-8 text-xs"
              />
              <div className="flex gap-1.5 justify-center">
                <Button size="sm" className="h-7 text-xs" onClick={() => commitInline("pending")} disabled={!newCardTitle.trim()}>Add</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingTo(null); setNewCardTitle(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const activeCard = activeId ? items.find((d) => d.id === activeId) ?? null : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <ScrollArea className="w-full">
          <div className="flex gap-2.5 sm:gap-3 pb-4 min-w-max px-0.5">
            {COLUMNS.map((col) => (
              <Column
                key={col.key}
                col={col}
                list={grouped[col.key]}
                projectId={projectId}
                onOpen={(d) => { setSelected(d); setReviewNote(d.review_note ?? ""); }}
                onAssign={handleAssign}
                onAddInline={(s) => { setAddingTo(s); setNewCardTitle(""); }}
                addingHere={addingTo === col.key}
                setAddingHere={setAddingTo}
                newCardTitle={newCardTitle}
                setNewCardTitle={setNewCardTitle}
                onCommitInline={commitInline}
                isOwnerOrCollab={true}
              />
            ))}
          </div>
        </ScrollArea>

        <DragOverlay>
          {activeCard ? (
            <div className="w-[78vw] max-w-[260px] sm:w-72">
              <SortableCard
                d={activeCard}
                projectId={projectId}
                onOpen={() => {}}
                onAssign={() => {}}
                isDragOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setNewRefUrl(""); } }}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                {selected.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
                )}

                {/* Quick edit row: assignee + due date + status */}
                <div className="flex flex-wrap gap-2 items-center">
                  <AssigneePicker
                    projectId={projectId}
                    value={selected.assignee_id}
                    onChange={(uid, person) =>
                      handleAssign(selected.id, uid, person?.display_name ?? null, person?.avatar_url ?? null)
                    }
                    size="full"
                  />
                  <div className="inline-flex items-center gap-1 rounded-md border bg-card pl-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="date"
                      value={selected.due_date ?? ""}
                      onChange={(e) => handleDueDateChange(selected.id, e.target.value || null)}
                      className="h-8 text-xs border-0 px-1 w-auto focus-visible:ring-0"
                    />
                  </div>
                  <Badge variant="secondary">{COLUMNS.find((c) => c.key === selected.status)?.label ?? selected.status}</Badge>
                  {selected.source && selected.source !== "manual" && (
                    <Badge variant="outline">via {selected.source}</Badge>
                  )}
                </div>

                {/* Submitted work */}
                {(selected.submission_files?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Submitted work ({selected.submission_files!.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selected.submission_files!.map((s, idx) => (
                        <div key={idx} className="relative group rounded-lg border overflow-hidden bg-muted">
                          {s.kind === "image" ? (
                            <a href={s.url} target="_blank" rel="noreferrer" className="block aspect-square">
                              <img src={s.thumbnail_url || s.url} alt={s.name} loading="lazy" className="h-full w-full object-cover" />
                            </a>
                          ) : s.kind === "video" ? (
                            <video src={s.url} controls preload="metadata" className="w-full aspect-square object-cover bg-black" />
                          ) : s.kind === "audio" ? (
                            <div className="aspect-square flex flex-col items-center justify-center p-2 gap-2">
                              <Music className="h-6 w-6 text-muted-foreground" />
                              <audio src={s.url} controls className="w-full" />
                            </div>
                          ) : (
                            <a href={s.url} target="_blank" rel="noreferrer" className="aspect-square flex flex-col items-center justify-center p-3 text-center gap-1.5 hover:bg-accent">
                              <FileKindIcon kind={s.kind} />
                              <span className="text-[10px] text-muted-foreground line-clamp-2 break-all">{s.name}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-1.5 py-1 truncate">
                            {s.name}
                          </div>
                          {selected.status !== "approved" && (
                            <button
                              onClick={() => removeSubmission(idx)}
                              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 border opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                              aria-label="Remove file"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy single submitted file */}
                {(selected.submission_files?.length ?? 0) === 0 && (selected.file_url || selected.thumbnail_url) && (
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Submitted work
                    </p>
                    {selected.thumbnail_url ? (
                      <a href={selected.file_url ?? selected.thumbnail_url ?? "#"} target="_blank" rel="noreferrer">
                        <img src={selected.thumbnail_url} alt="Submitted work" className="w-full max-h-96 object-contain rounded-lg border bg-muted" />
                      </a>
                    ) : selected.file_url ? (
                      <a href={selected.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                        <ExternalLink className="h-4 w-4" /> Open submitted file
                      </a>
                    ) : null}
                  </div>
                )}

                {/* Moodboard */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Moodboard & references {selected.moodboard?.length ? `(${selected.moodboard.length})` : ""}
                    </p>
                  </div>

                  {selected.moodboard && selected.moodboard.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selected.moodboard.map((r, idx) => (
                        <div key={idx} className="relative group rounded-lg border overflow-hidden bg-muted aspect-square">
                          {r.thumbnail_url || (r.url && isImageUrl(r.url)) ? (
                            <a href={r.url} target="_blank" rel="noreferrer" className="block h-full w-full">
                              <img
                                src={r.thumbnail_url || r.url}
                                alt={r.caption ?? "reference"}
                                loading="lazy"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  img.style.display = "none";
                                  const fb = img.parentElement?.querySelector("[data-fb]") as HTMLElement | null;
                                  if (fb) fb.style.display = "flex";
                                }}
                              />
                              <div data-fb className="absolute inset-0 hidden flex-col items-center justify-center text-[10px] text-muted-foreground p-2 text-center break-all">
                                <ExternalLink className="h-4 w-4 mb-1" />
                                {(() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return r.url; } })()}
                              </div>
                            </a>
                          ) : (
                            <a href={r.url} target="_blank" rel="noreferrer" className="h-full w-full p-2 flex flex-col items-center justify-center text-[10px] text-muted-foreground text-center break-all">
                              <ExternalLink className="h-4 w-4 mb-1" />
                              {(() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return r.url; } })()}
                            </a>
                          )}
                          {r.caption && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-1.5 py-1 truncate">
                              {r.caption}
                            </div>
                          )}
                          <button
                            onClick={() => removeReference(idx)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 border opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                            aria-label="Remove reference"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No references yet — add inspiration links or images below.</p>
                  )}

                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Paste image URL, Pinterest, IG, Behance link…"
                      value={newRefUrl}
                      onChange={(e) => setNewRefUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReference(); } }}
                      className="h-8 text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={addReference} disabled={!newRefUrl.trim()} className="h-8 gap-1">
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </div>

                {/* WIP upload */}
                {selected.status !== "approved" && (
                  <div
                    className="rounded-lg border-2 border-dashed p-4 text-center space-y-3"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      if (e.dataTransfer.files?.length) uploadWipFiles(e.dataTransfer.files);
                    }}
                  >
                    <p className="text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      Submit work for review
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Drop images, video, audio, PDFs, or project files. One file or a whole folder — your call.
                      Moves the card to <strong>Submitted</strong> so the client can approve.
                    </p>

                    <input
                      ref={wipInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.length) uploadWipFiles(e.target.files); }}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      // @ts-expect-error non-standard but widely supported
                      webkitdirectory=""
                      directory=""
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.length) uploadWipFiles(e.target.files); }}
                    />

                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button size="sm" variant="outline" onClick={() => wipInputRef.current?.click()} disabled={uploading} className="gap-1.5">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploading ? "Uploading…" : "Choose files"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => folderInputRef.current?.click()} disabled={uploading} className="gap-1.5">
                        <FolderUp className="h-3.5 w-3.5" />
                        Upload folder
                      </Button>
                    </div>

                    {uploadProgress && (
                      <p className="text-[11px] text-muted-foreground">
                        Uploading {uploadProgress.done} / {uploadProgress.total}…
                      </p>
                    )}
                  </div>
                )}

                {/* Review controls */}
                {(selected.status === "submitted" || selected.status === "in_progress") && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Review note (optional)</label>
                    <Textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="What needs changing? Or just 'looks great'."
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-end">
                  {selected.status === "submitted" && (
                    <>
                      <Button variant="outline" onClick={() => reviewAdvance("rejected")} disabled={updating} className="gap-1">
                        <XCircle className="h-4 w-4" /> Request changes
                      </Button>
                      <Button onClick={() => reviewAdvance("approved")} disabled={updating} className="gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground text-center pt-2">
                  Tip: drag the card on the board to move it between columns.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeliverablesBoard;
