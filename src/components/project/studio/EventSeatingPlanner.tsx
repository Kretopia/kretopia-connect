import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, Loader2, Plus, Trash2, Users, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";

interface Props { project: any; currentUserId: string; }

interface SeatTable { id: string; name: string; capacity: number; }
interface Layout { id: string; name: string; tables: SeatTable[]; }
interface Assignment {
  id: string; layout_id: string; table_id: string;
  seat_index: number | null; user_id: string | null; guest_email: string | null;
}
interface ProfileLite { user_id: string; full_name: string | null; avatar_url: string | null; role: string | null; }

const newTableId = () => `t_${Math.random().toString(36).slice(2, 8)}`;

function GuestChip({ p, draggableId }: { p: ProfileLite; draggableId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: draggableId });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 rounded-full bg-background/60 border border-border/60 px-2 py-1 cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <Avatar className="h-6 w-6"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{(p.full_name || "?").slice(0,1)}</AvatarFallback></Avatar>
      <span className="text-xs font-medium truncate max-w-[100px]">{p.full_name || "Guest"}</span>
    </div>
  );
}

function TableDrop({ table, occupants, profiles, onRemove }: {
  table: SeatTable;
  occupants: Assignment[];
  profiles: Record<string, ProfileLite>;
  onRemove: (assignmentId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `table:${table.id}` });
  const full = occupants.length >= table.capacity;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border bg-card/40 p-3 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border/60"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-semibold text-sm">{table.name}</p>
          <p className="text-[11px] text-muted-foreground">{occupants.length}/{table.capacity} seats</p>
        </div>
        {full && <Badge variant="outline" className="text-[10px]">Full</Badge>}
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[40px]">
        {occupants.map(a => {
          const p = a.user_id ? profiles[a.user_id] : null;
          return (
            <div key={a.id} className="flex items-center gap-1.5 rounded-full bg-background/70 border border-border/50 pl-1 pr-1.5 py-0.5">
              <Avatar className="h-5 w-5"><AvatarImage src={p?.avatar_url || undefined} /><AvatarFallback>{(p?.full_name || a.guest_email || "?").slice(0,1)}</AvatarFallback></Avatar>
              <span className="text-[11px] truncate max-w-[90px]">{p?.full_name || a.guest_email || "Guest"}</span>
              <button onClick={() => onRemove(a.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {occupants.length === 0 && (
          <p className="text-[11px] text-muted-foreground/70 italic">Drop guests here</p>
        )}
      </div>
    </div>
  );
}

export const EventSeatingPlanner = ({ project, currentUserId }: Props) => {
  const eventId = project?.event_id as string | undefined;
  const isHost = project?.created_by === currentUserId;
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [layout, setLayout] = useState<Layout | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [defaultCap, setDefaultCap] = useState(8);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    // Layout (single per event for v1)
    const { data: layouts } = await (supabase as any)
      .from("event_seating_layouts").select("id, name, tables").eq("event_id", eventId).limit(1);
    let l = layouts?.[0] || null;
    if (!l && isHost) {
      const { data: created } = await (supabase as any).from("event_seating_layouts").insert({
        event_id: eventId, name: "Main Layout", tables: [], created_by: currentUserId,
      }).select("id, name, tables").single();
      l = created;
    }
    setLayout(l ? { id: l.id, name: l.name, tables: Array.isArray(l.tables) ? l.tables : [] } : null);

    if (l) {
      const { data: asg } = await (supabase as any)
        .from("event_seating_assignments").select("*").eq("layout_id", l.id);
      setAssignments(asg || []);
    }

    const { data: parts } = await supabase.from("jam_participants")
      .select("user_id").eq("jam_id", eventId).in("status", ["going", "confirmed", "checked_in"]);
    const ids = (parts || []).map((p: any) => p.user_id).filter(Boolean);
    setGuestIds(ids);
    if (ids.length > 0) {
      const { data: ps } = await supabase.from("profiles")
        .select("user_id, full_name, avatar_url, role").in("user_id", ids);
      const map: Record<string, ProfileLite> = {};
      (ps || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, [eventId]);

  const occupantsByTable = useMemo(() => {
    const m: Record<string, Assignment[]> = {};
    assignments.forEach(a => { (m[a.table_id] ||= []).push(a); });
    return m;
  }, [assignments]);

  const seatedUserIds = useMemo(
    () => new Set(assignments.map(a => a.user_id).filter(Boolean) as string[]),
    [assignments]
  );
  const unseated = useMemo(
    () => guestIds.filter(id => !seatedUserIds.has(id)),
    [guestIds, seatedUserIds]
  );

  const persistTables = async (tables: SeatTable[]) => {
    if (!layout) return;
    setLayout({ ...layout, tables });
    await (supabase as any).from("event_seating_layouts")
      .update({ tables }).eq("id", layout.id);
  };

  const addTable = () => {
    if (!layout) return;
    const next: SeatTable = { id: newTableId(), name: `Table ${layout.tables.length + 1}`, capacity: defaultCap };
    persistTables([...layout.tables, next]);
  };

  const removeTable = async (tid: string) => {
    if (!layout) return;
    await (supabase as any).from("event_seating_assignments").delete().eq("table_id", tid).eq("layout_id", layout.id);
    persistTables(layout.tables.filter(t => t.id !== tid));
    setAssignments(prev => prev.filter(a => a.table_id !== tid));
  };

  const renameTable = (tid: string, name: string) => {
    if (!layout) return;
    persistTables(layout.tables.map(t => t.id === tid ? { ...t, name } : t));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    if (!layout || !e.over) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("table:")) return;
    const tableId = overId.slice(6);
    const table = layout.tables.find(t => t.id === tableId);
    if (!table) return;
    const userId = String(e.active.id).replace(/^guest:/, "");
    const occ = occupantsByTable[tableId] || [];
    if (occ.length >= table.capacity) {
      toast({ title: "Table is full", variant: "destructive" });
      return;
    }
    setSaving(true);
    // remove existing assignment
    await (supabase as any).from("event_seating_assignments").delete()
      .eq("layout_id", layout.id).eq("user_id", userId);
    const { data, error } = await (supabase as any).from("event_seating_assignments").insert({
      event_id: eventId, layout_id: layout.id, table_id: tableId, user_id: userId, seat_index: occ.length,
    }).select("*").single();
    if (!error && data) {
      setAssignments(prev => [...prev.filter(a => a.user_id !== userId), data]);
    } else if (error) {
      toast({ title: "Couldn't seat guest", description: error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const removeAssignment = async (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    await (supabase as any).from("event_seating_assignments").delete().eq("id", id);
  };

  const optimize = async () => {
    if (!layout) return;
    if (layout.tables.length === 0) {
      toast({ title: "Add tables first", variant: "destructive" });
      return;
    }
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-event-seating", {
        body: { event_id: eventId, layout_id: layout.id, seats_per_table: defaultCap },
      });
      if (error) throw error;
      toast({ title: "Smart seating applied", description: `Seated ${(data as any)?.assigned ?? 0} guests across ${(data as any)?.tables ?? 0} tables.` });
      await load();
    } catch (err: any) {
      toast({ title: "Couldn't optimize", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setOptimizing(false);
    }
  };

  if (!eventId || !isHost) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading seating planner…
      </div>
    );
  }

  const activeProfile = activeId ? profiles[activeId.replace(/^guest:/, "")] : null;

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Seating Planner</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Drag guests onto tables, or let Smart Seating cluster them by their match scores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Seats/table
              <Input
                type="number" min={2} max={20}
                value={defaultCap}
                onChange={e => setDefaultCap(Math.max(2, Math.min(20, Number(e.target.value) || 8)))}
                className="h-8 w-14"
              />
            </div>
            <Button size="sm" variant="outline" onClick={addTable}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Table
            </Button>
            <Button size="sm" onClick={optimize} disabled={optimizing}>
              {optimizing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Smart Seating
            </Button>
          </div>
        </div>

        {/* Unseated guests pool */}
        <div className="rounded-xl border border-dashed border-border/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Unseated · {unseated.length}</p>
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          {unseated.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Everyone has a seat.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unseated.map(uid => {
                const p = profiles[uid];
                if (!p) return null;
                return <GuestChip key={uid} p={p} draggableId={`guest:${uid}`} />;
              })}
            </div>
          )}
        </div>

        {/* Tables grid */}
        {layout && layout.tables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">No tables yet. Add one to start seating guests.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {layout?.tables.map(t => (
              <div key={t.id} className="space-y-2">
                <div className="flex items-center gap-1">
                  <Input
                    value={t.name}
                    onChange={e => renameTable(t.id, e.target.value)}
                    onBlur={() => persistTables(layout.tables)}
                    className="h-7 text-xs font-medium"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeTable(t.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <TableDrop
                  table={t}
                  occupants={occupantsByTable[t.id] || []}
                  profiles={profiles}
                  onRemove={removeAssignment}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeProfile ? <GuestChip p={activeProfile} draggableId="overlay" /> : null}
      </DragOverlay>
    </DndContext>
  );
};
