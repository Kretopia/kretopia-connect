import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Sparkles,
  Image as ImageIcon,
  StickyNote,
  Trash2,
  Loader2,
  Pin,
  ListChecks,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDeskIntent } from "@/hooks/useDeskIntent";
import { extractProjectFilePath, getProjectFileSignedUrl } from "@/lib/projectFiles";

interface Pin {
  id: string;
  project_id: string;
  created_by: string;
  kind: "sticky" | "image" | "link";
  content: string | null;
  image_url: string | null;
  color: PinColor;
  pos_x: number;
  pos_y: number;
  rotation: number;
  z_index: number;
  generated_by_ai: boolean;
  created_at: string;
  updated_at: string;
}

type PinColor = "yellow" | "pink" | "mint" | "sky" | "lavender" | "peach";
type MoodboardFile = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
};
type SparkIdeasResponse = { ideas?: unknown };

const COLORS: PinColor[] = ["yellow", "pink", "mint", "sky", "lavender", "peach"];

// Hand-tuned warm sticky tones that read on dark canvas + cork.
const COLOR_STYLES: Record<PinColor, { bg: string; ring: string; text: string }> = {
  yellow:   { bg: "bg-[hsl(48_95%_70%)]",  ring: "ring-[hsl(48_85%_55%)]",  text: "text-[hsl(30_50%_20%)]" },
  pink:     { bg: "bg-[hsl(340_85%_82%)]", ring: "ring-[hsl(340_70%_65%)]", text: "text-[hsl(340_55%_25%)]" },
  mint:     { bg: "bg-[hsl(150_60%_75%)]", ring: "ring-[hsl(150_50%_55%)]", text: "text-[hsl(160_50%_20%)]" },
  sky:      { bg: "bg-[hsl(200_85%_78%)]", ring: "ring-[hsl(200_70%_55%)]", text: "text-[hsl(210_60%_22%)]" },
  lavender: { bg: "bg-[hsl(265_75%_82%)]", ring: "ring-[hsl(265_60%_60%)]", text: "text-[hsl(265_50%_25%)]" },
  peach:    { bg: "bg-[hsl(20_90%_78%)]",  ring: "ring-[hsl(20_75%_60%)]",  text: "text-[hsl(15_55%_22%)]" },
};

const BOARD_HEIGHT = 1400;
const BOARD_MIN_WIDTH = 960;
const DRAG_EDGE = 44;
const DRAG_SCROLL_STEP = 22;
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

interface CorkBoardProps {
  projectId: string;
  currentUserId: string;
}

export function CorkBoard({ projectId, currentUserId }: CorkBoardProps) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [sparking, setSparking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Drag state — drag starts from the pin/header handle, not the editable body.
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    pointerId: number;
    el: HTMLElement;
    width: number;
    height: number;
    latestX: number;
    latestY: number;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, force] = useState(0);

  // Initial fetch + realtime
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("project_pins")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        console.error(error);
      } else {
        const rows = (data || []) as Pin[];
        setPins(rows);
        }
      setLoading(false);
    })().catch((e) => console.warn("[corkboard] load failed", e));

    const channel = supabase
      .channel(`pins:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_pins", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setPins((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Pin;
              if (prev.some((p) => p.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Pin;
              
              return prev.map((p) => (p.id === row.id ? { ...p, ...row } : p));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id: string };
              return prev.filter((p) => p.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Listen for cross-tab intents
  useDeskIntent(
    "notes",
    useCallback(
      (intent) => {
        if (intent === "create-brief" || intent === "add-sticky") void addSticky();
        if (intent === "spark-ideas") void sparkIdeas();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [projectId],
    ),
  );

  // ---- Pin creation ----
  const nextPosition = useCallback(() => {
    // Stagger so new pins don't all stack
    const n = pins.length;
    const x = 24 + (n % 4) * 180 + Math.random() * 30;
    const y = 24 + Math.floor(n / 4) * 200 + Math.random() * 30;
    return { x, y };
  }, [pins.length]);

  const addSticky = useCallback(
    async (preset?: { content?: string; color?: PinColor; aiGenerated?: boolean }) => {
      setAdding(true);
      try {
        const { x, y } = nextPosition();
        const color = preset?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)];
        const rotation = (Math.random() - 0.5) * 8;
        const { data, error } = await supabase
          .from("project_pins")
          .insert({
            project_id: projectId,
            created_by: currentUserId,
            kind: "sticky",
            content: preset?.content ?? "",
            color,
            pos_x: x,
            pos_y: y,
            rotation,
            z_index: pins.length + 1,
            generated_by_ai: preset?.aiGenerated ?? false,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setPins((p) => [...p.filter((q) => q.id !== data.id), data as Pin]);
      } catch (e: unknown) {
        toast.error(errorMessage(e, "Couldn't add sticky"));
      } finally {
        setAdding(false);
      }
    },
    [projectId, currentUserId, nextPosition, pins.length],
  );

  const addImagePin = useCallback(
    async (file: File) => {
      setAdding(true);
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${projectId}/pins/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { x, y } = nextPosition();
        const { data, error } = await supabase
          .from("project_pins")
          .insert({
            project_id: projectId,
            created_by: currentUserId,
            kind: "image",
            image_url: path,
            content: file.name,
            color: "yellow",
            pos_x: x,
            pos_y: y,
            rotation: (Math.random() - 0.5) * 6,
            z_index: pins.length + 1,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setPins((p) => [...p.filter((q) => q.id !== data.id), data as Pin]);
      } catch (e: unknown) {
        toast.error(errorMessage(e, "Couldn't pin image"));
      } finally {
        setAdding(false);
      }
    },
    [projectId, currentUserId, nextPosition, pins.length],
  );

  // Pull existing brief moodboard images into the Pad as image pins so the
  // board doubles as a unified moodboard + sticky-note space.
  const importMoodboard = useCallback(async () => {
    setAdding(true);
    try {
      const { data: files, error: filesErr } = await supabase
        .from("project_files")
        .select("id, file_name, file_url, file_type")
        .eq("project_id", projectId);
      if (filesErr) throw filesErr;
      const images = ((files || []) as MoodboardFile[]).filter((f) =>
        (f.file_type || "").startsWith("image/"),
      );
      if (!images.length) {
        toast.message("No moodboard images yet", {
          description: "Add references in the Brief first.",
        });
        return;
      }
      const existingPaths = new Set(
        pins
          .filter((p) => p.kind === "image" && p.image_url)
          .map((p) => extractProjectFilePath(p.image_url!)),
      );
      const fresh = images.filter((f) => !existingPaths.has(extractProjectFilePath(f.file_url)));
      if (!fresh.length) {
        toast.message("Moodboard already on the board");
        return;
      }
      const baseLen = pins.length;
      const rows = fresh.map((f, i) => {
        const x = 24 + ((baseLen + i) % 4) * 180 + Math.random() * 30;
        const y = 24 + Math.floor((baseLen + i) / 4) * 200 + Math.random() * 30;
        return {
          project_id: projectId,
          created_by: currentUserId,
          kind: "image" as const,
          image_url: f.file_url,
          content: f.file_name,
          color: "yellow" as PinColor,
          pos_x: x,
          pos_y: y,
          rotation: (Math.random() - 0.5) * 6,
          z_index: baseLen + i + 1,
        };
      });
      const { data: inserted, error: insErr } = await supabase
        .from("project_pins")
        .insert(rows)
        .select();
      if (insErr) throw insErr;
      if (inserted) {
        setPins((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...(inserted as Pin[]).filter((p) => !ids.has(p.id))];
        });
        toast.success(
          `${inserted.length} reference${inserted.length === 1 ? "" : "s"} pinned`,
        );
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Couldn't import moodboard"));
    } finally {
      setAdding(false);
    }
  }, [projectId, currentUserId, pins]);

  const sparkIdeas = useCallback(async () => {
    setSparking(true);
    try {
      const { data, error } = await supabase.functions.invoke("spark-ideas", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      const ideasRaw = (data as SparkIdeasResponse | null)?.ideas;
      const ideas: string[] = Array.isArray(ideasRaw)
        ? ideasRaw.filter((idea): idea is string => typeof idea === "string")
        : [];
      if (!ideas.length) {
        toast.message("No ideas this round", {
          description: "Add more to your brief and try again.",
        });
        return;
      }
      // Insert all in batch
      const rows = ideas.map((content, i) => {
        const x = 24 + ((pins.length + i) % 4) * 180 + Math.random() * 30;
        const y = 24 + Math.floor((pins.length + i) / 4) * 200 + Math.random() * 30;
        return {
          project_id: projectId,
          created_by: currentUserId,
          kind: "sticky" as const,
          content,
          color: COLORS[(pins.length + i) % COLORS.length],
          pos_x: x,
          pos_y: y,
          rotation: (Math.random() - 0.5) * 10,
          z_index: pins.length + i + 1,
          generated_by_ai: true,
        };
      });
      const { data: inserted, error: insErr } = await supabase
        .from("project_pins")
        .insert(rows)
        .select();
      if (insErr) throw insErr;
      if (inserted) {
        setPins((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...(inserted as Pin[]).filter((p) => !ids.has(p.id))];
        });
        toast.success(`${inserted.length} idea${inserted.length === 1 ? "" : "s"} pinned`);
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Spark Ideas failed"));
    } finally {
      setSparking(false);
    }
  }, [projectId, currentUserId, pins.length]);

  // ---- Update / delete ----
  const updatePin = useCallback(async (id: string, patch: Partial<Pin>) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("project_pins").update(patch).eq("id", id);
    if (error) console.warn("[corkboard] update failed", error);
  }, []);

  const deletePin = useCallback(async (id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("project_pins").delete().eq("id", id);
    if (error) toast.error("Couldn't delete pin");
  }, []);

  // ---- Convert sticky → task ----
  const convertToTask = useCallback(async (pin: Pin) => {
    const title = (pin.content || "").trim();
    if (!title) {
      toast.error("Add some text first");
      return;
    }
    const { error } = await supabase.from("project_tasks").insert({
      project_id: projectId,
      title: title.slice(0, 200),
      status: "todo",
      created_by: currentUserId,
    } as never);
    if (error) {
      toast.error("Couldn't create task");
      return;
    }
    toast.success("Pinned to your tasks");
  }, [projectId, currentUserId]);

  // ---- Drag handlers ----

  const beginDrag = (pin: Pin, clientX: number, clientY: number, pointerId: number, el: HTMLElement) => {
    const surface = surfaceRef.current?.getBoundingClientRect();
    if (!surface) return;
    const card = el.getBoundingClientRect();
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* noop */
    }
    dragRef.current = {
      id: pin.id,
      pointerId,
      el,
      offsetX: clientX - surface.left - pin.pos_x,
      offsetY: clientY - surface.top - pin.pos_y,
      width: card.width,
      height: card.height,
      latestX: pin.pos_x,
      latestY: pin.pos_y,
    };
    setDraggingId(pin.id);
    // Haptic on supported devices
    if ("vibrate" in navigator) navigator.vibrate?.(15);
  };

  const onPinPointerDown = (e: React.PointerEvent, pin: Pin) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-pin-no-drag]")) return;
    if (!target.closest("[data-pin-drag-handle]")) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    beginDrag(pin, e.clientX, e.clientY, e.pointerId, el);
  };

  const onPinPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const surface = surfaceRef.current;
    const board = boardRef.current;
    if (!surface) return;
    if (board) {
      const boardRect = board.getBoundingClientRect();
      if (e.clientX > boardRect.right - DRAG_EDGE) {
        board.scrollLeft += DRAG_SCROLL_STEP;
      } else if (e.clientX < boardRect.left + DRAG_EDGE) {
        board.scrollLeft -= DRAG_SCROLL_STEP;
      }
    }
    const rect = surface.getBoundingClientRect();
    // Clamp against the full canvas and the actual card size. The previous
    // 100%-wide surface collapsed to the mobile viewport, creating a right-side
    // "wall" for everyone on narrow screens.
    const maxX = Math.max(0, surface.scrollWidth - dragRef.current.width);
    const maxY = Math.max(0, BOARD_HEIGHT - dragRef.current.height);
    const x = Math.max(0, Math.min(maxX, e.clientX - rect.left - dragRef.current.offsetX));
    const y = Math.max(0, Math.min(maxY, e.clientY - rect.top - dragRef.current.offsetY));
    const id = dragRef.current.id;
    dragRef.current.latestX = x;
    dragRef.current.latestY = y;
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, pos_x: x, pos_y: y } : p)));
    force((n) => n + 1);
  };

  const onPinPointerUp = () => {
    if (!dragRef.current) return;
    const id = dragRef.current.id;
    const finalPos = { pos_x: dragRef.current.latestX, pos_y: dragRef.current.latestY };
    try {
      dragRef.current.el.releasePointerCapture?.(dragRef.current.pointerId);
    } catch {
      /* noop */
    }
    dragRef.current = null;
    setDraggingId(null);
    void updatePin(id, finalPos);
  };

  const onPinPointerCancel = () => {
    if (dragRef.current) {
      try {
        dragRef.current.el.releasePointerCapture?.(dragRef.current.pointerId);
      } catch {
        /* noop */
      }
      dragRef.current = null;
      setDraggingId(null);
    }
  };

  const sortedPins = useMemo(
    () => [...pins].sort((a, b) => a.z_index - b.z_index),
    [pins],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2 bg-background/95 border-b border-border">
        <Button
          size="sm"
          variant="default"
          onClick={() => addSticky()}
          disabled={adding}
          className="gap-1.5 h-8"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />}
          <span className="text-xs font-semibold">Sticky</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={adding}
          className="gap-1.5 h-8"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Image</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={importMoodboard}
          disabled={adding}
          className="gap-1.5 h-8"
          title="Bring your brief moodboard onto the board"
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold hidden sm:inline">Moodboard</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={sparkIdeas}
          disabled={sparking}
          className="gap-1.5 h-8 text-primary hover:bg-primary/10 ml-auto"
        >
          {sparking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span className="text-xs font-semibold hidden sm:inline">Spark Ideas</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void addImagePin(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      </div>

      {/* Subtle hint row */}
      {!loading && pins.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border/60 bg-background/80">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 text-center">
            Tap note to edit · drag from the red pin/top edge
          </p>
        </div>
      )}

      {/* Board */}
      <div
        ref={boardRef}
        className={cn(
          "relative flex-1 overflow-auto select-none",
          // Hybrid look: dark canvas + subtle cork texture overlay
          "bg-[hsl(var(--background))]",
          "[background-image:radial-gradient(hsl(30_30%_45%/0.08)_1px,transparent_1px),radial-gradient(hsl(30_25%_30%/0.05)_1.5px,transparent_1.5px)]",
          "[background-size:24px_24px,40px_40px]",
          "[background-position:0_0,12px_12px]",
          
        )}
        style={{ minHeight: 600 }}
        onPointerMove={onPinPointerMove}
        onPointerUp={onPinPointerUp}
        onPointerCancel={onPinPointerCancel}
        onPointerLeave={onPinPointerCancel}
      >
        <div
          ref={surfaceRef}
          style={{ position: "relative", width: `max(100%, ${BOARD_MIN_WIDTH}px)`, height: BOARD_HEIGHT }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading board…
            </div>
          )}

          {!loading && pins.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Pin className="h-7 w-7" />
              </div>
              <p className="text-base font-bold">Your studio cork board</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                Pin sticky notes, drop reference images, spark ideas with AI.
                Move cards from the red pin or top edge.
              </p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => addSticky()} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> First sticky
                </Button>
                <Button size="sm" variant="outline" onClick={sparkIdeas} disabled={sparking} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Spark ideas
                </Button>
              </div>
            </div>
          )}

          {sortedPins.map((pin) => (
            <PinCard
              key={pin.id}
              pin={pin}
              dragging={draggingId === pin.id}
              
              onPointerDown={(e) => onPinPointerDown(e, pin)}
              onChange={(content) => updatePin(pin.id, { content })}
              onColorChange={(color) => updatePin(pin.id, { color })}
              onDelete={() => deletePin(pin.id)}
              onConvertToTask={() => convertToTask(pin)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PinCardProps {
  pin: Pin;
  dragging?: boolean;
  
  onPointerDown: (e: React.PointerEvent) => void;
  onChange: (content: string) => void;
  onColorChange: (color: PinColor) => void;
  onDelete: () => void;
  onConvertToTask: () => void;
}

function PinCard({ pin, dragging = false, onPointerDown, onChange, onColorChange, onDelete, onConvertToTask }: PinCardProps) {
  const styles = COLOR_STYLES[pin.color];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pin.content || "");
  const [showOpts, setShowOpts] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(pin.image_url || "");

  useEffect(() => setDraft(pin.content || ""), [pin.content]);
  useEffect(() => {
    let active = true;
    if (pin.kind !== "image" || !pin.image_url) return;
    if (pin.image_url.startsWith("http") && !pin.image_url.includes("project-files")) {
      setDisplayUrl(pin.image_url);
      return;
    }
    getProjectFileSignedUrl(pin.image_url, { expiresIn: 60 * 60 * 24 * 7 })
      .then((url) => {
        if (active && url) setDisplayUrl(url);
      })
      .catch((e) => console.warn("[corkboard] image signed URL failed", e));
    return () => {
      active = false;
    };
  }, [pin.kind, pin.image_url]);

  const commit = () => {
    setEditing(false);
    if (draft !== (pin.content || "")) onChange(draft);
  };

  if (pin.kind === "image" && pin.image_url) {
    return (
      <div
        className={cn(
          "absolute touch-pan-y cursor-grab active:cursor-grabbing transition-transform duration-150 will-change-transform",
          dragging && "z-50",
        )}
        style={{
          left: pin.pos_x,
          top: pin.pos_y,
          transform: `rotate(${pin.rotation}deg) scale(${dragging ? 1.06 : 1})`,
          zIndex: dragging ? 9999 : pin.z_index,
          filter: dragging ? "drop-shadow(0 18px 24px hsl(0 0% 0% / 0.45))" : undefined,
        }}
        onPointerDown={onPointerDown}
      >
        <div className="relative bg-card p-2 pt-4 shadow-xl ring-1 ring-border rounded-sm">
          <div
            data-pin-drag-handle
            className={cn(
              "absolute inset-x-0 top-0 h-6 cursor-grab touch-none active:cursor-grabbing rounded-t-sm",
              
            )}
            aria-hidden
          />
          <img
            src={displayUrl || pin.image_url}
            alt={pin.content || "pinned"}
            className="block w-40 h-40 object-cover rounded-sm pointer-events-none"
            draggable={false}
          />
          <div
            data-pin-drag-handle
            className={cn(
              "absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-[hsl(0_75%_55%)] ring-2 ring-[hsl(0_60%_35%)] shadow-md cursor-grab touch-none active:cursor-grabbing",
            )}
          />
          <button
            data-pin-no-drag
            onClick={onDelete}
            className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100"
            aria-label="Delete pin"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // Sticky note
  return (
    <div
      className={cn(
        "absolute group touch-pan-y cursor-grab active:cursor-grabbing",
        "transition-transform duration-150 will-change-transform",
        dragging && "z-50",
      )}
      style={{
        left: pin.pos_x,
        top: pin.pos_y,
        transform: `rotate(${dragging ? 0 : pin.rotation}deg) scale(${dragging ? 1.06 : 1})`,
        zIndex: dragging ? 9999 : pin.z_index,
        filter: dragging ? "drop-shadow(0 18px 24px hsl(0 0% 0% / 0.45))" : undefined,
      }}
      onPointerDown={onPointerDown}
    >
      <div
        className={cn(
          "relative w-44 min-h-[10rem] p-3 pt-5 shadow-xl ring-1",
          styles.bg,
          styles.ring,
          styles.text,
        )}
        style={{
          boxShadow: "0 10px 24px -10px hsl(0 0% 0% / 0.55), 0 2px 4px hsl(0 0% 0% / 0.2)",
        }}
      >
        {/* Pushpin */}
        <div
          data-pin-drag-handle
          className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-[hsl(0_75%_55%)] ring-2 ring-[hsl(0_60%_35%)] shadow-md",
            
          )}
        />
        <div
          data-pin-drag-handle
          className={cn(
            "absolute inset-x-0 top-0 h-8 cursor-grab touch-none active:cursor-grabbing",
            
          )}
          aria-hidden
        />

        {pin.generated_by_ai && (
          <div className="absolute top-1 right-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider opacity-70">
            <Sparkles className="h-2.5 w-2.5" />
            Spark
          </div>
        )}

        {editing ? (
          <textarea
            data-pin-no-drag
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
              if (e.key === "Escape") {
                setDraft(pin.content || "");
                setEditing(false);
              }
            }}
            className={cn(
              "w-full h-32 resize-none bg-transparent outline-none text-sm font-medium leading-snug",
              styles.text,
            )}
            placeholder="Type an idea…"
          />
        ) : (
          <button
            data-pin-no-drag
            onClick={() => setEditing(true)}
            className={cn("w-full text-left text-sm font-medium leading-snug min-h-[6rem] whitespace-pre-wrap", styles.text)}
          >
            {pin.content?.trim() || (
              <span className="opacity-50 italic">Tap to write…</span>
            )}
          </button>
        )}

        {/* Bottom controls */}
        <div
          data-pin-no-drag
          className="mt-2 flex items-center justify-between gap-1"
        >
          <button
            onClick={() => setShowOpts((s) => !s)}
            className={cn(
              "h-4 w-4 rounded-full ring-1 ring-black/20",
              COLOR_STYLES[pin.color].bg,
            )}
            aria-label="Change color"
          />
          {showOpts && (
            <div
              data-pin-no-drag
              className="absolute -bottom-8 left-2 flex items-center gap-1 bg-background border border-border rounded-full px-2 py-1 shadow-lg z-10"
            >
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onColorChange(c);
                    setShowOpts(false);
                  }}
                  className={cn(
                    "h-4 w-4 rounded-full ring-1 ring-black/20 hover:scale-110 transition",
                    COLOR_STYLES[c].bg,
                  )}
                  aria-label={c}
                />
              ))}
            </div>
          )}
          <button
            data-pin-no-drag
            onClick={onConvertToTask}
            className="opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Make a task from this sticky"
            title="Make a task"
          >
            <ListChecks className="h-3.5 w-3.5" />
          </button>
          <button
            data-pin-no-drag
            onClick={onDelete}
            className="opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Delete sticky"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
