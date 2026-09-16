import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Search } from "lucide-react";

interface Connection {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onCreated: (roomId: string) => void;
}

export const CreateGroupDialog = ({ open, onOpenChange, currentUserId, onCreated }: CreateGroupDialogProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = connections.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.full_name || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!open || !currentUserId) return;
    const load = async () => {
      setLoading(true);
      const [out, inc] = await Promise.all([
        supabase.from("connections").select("connected_user_id").eq("user_id", currentUserId).eq("status", "accepted"),
        supabase.from("connections").select("user_id").eq("connected_user_id", currentUserId).eq("status", "accepted"),
      ]);
      const ids = new Set<string>();
      out.data?.forEach((c) => ids.add(c.connected_user_id));
      inc.data?.forEach((c) => ids.add(c.user_id));
      if (ids.size === 0) {
        setConnections([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .in("user_id", Array.from(ids));
      setConnections(
        (data || []).map((p) => ({
          id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role,
        }))
      );
      setLoading(false);
    };
    load();
  }, [open, currentUserId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || selected.size === 0) {
      toast({ title: "Add a name and pick at least 1 person", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: room, error: roomErr } = await supabase
        .from("spark_rooms")
        .insert({
          title: title.trim(),
          created_by: currentUserId,
          is_private: true,
          circle_type: "group",
          category: "private",
          icon_emoji: "💬",
        })
        .select()
        .single();
      if (roomErr) throw roomErr;

      const memberRows = [
        { room_id: room.id, user_id: currentUserId, role: "owner" },
        ...Array.from(selected).map((uid) => ({ room_id: room.id, user_id: uid, role: "member" })),
      ];
      const { error: memErr } = await supabase.from("spark_room_members").insert(memberRows);
      if (memErr) throw memErr;

      toast({ title: "Group created", description: `${selected.size + 1} members added.` });
      setTitle("");
      setSelected(new Set());
      onCreated(room.id);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't create group", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[92vh] flex flex-col p-0 gap-0 w-[calc(100vw-1rem)]">
        <DialogHeader className="p-4 pb-3 border-b border-border shrink-0 text-left">
          <DialogTitle className="flex items-center gap-2 text-left">
            <Users className="h-5 w-5" /> New Group Chat
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            Bring connections into a private chat. Promote to a Project later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          <div className="space-y-1.5">
            <Label htmlFor="group-title" className="text-xs">Group name</Label>
            <Input
              id="group-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring Campaign Crew"
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Add members ({selected.size})</Label>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or role…"
                className="pl-9"
              />
            </div>
            <div className="rounded-md border border-border overflow-hidden">
              <ScrollArea className="h-[40vh] sm:h-[260px]">
                {loading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading connections…</div>
                ) : connections.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No connections yet. Match with creators in Circle first.
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No matches for "{search}".
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/40 active:bg-accent/60"
                      >
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback>{(c.full_name || "U").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.full_name || "Unknown"}</p>
                          {c.role && <p className="text-xs text-muted-foreground truncate">{c.role}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t border-border shrink-0 flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || !title.trim() || selected.size === 0}
            className="flex-1 sm:flex-initial"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
