import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, Plus, Trash2, ChevronRight, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

interface Shortlist {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  itemCount?: number;
  previewAvatars?: string[];
}

interface CreatorRow {
  id: string;
  creator_user_id: string;
  note: string | null;
  added_at: string;
  profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    job_title: string | null;
  };
}

const Shortlists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lists, setLists] = useState<Shortlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<Shortlist | null>(null);
  const [items, setItems] = useState<CreatorRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadLists();
  }, [user]);

  const loadLists = async () => {
    if (!user) return;
    setLoading(true);
    const { data: rawLists } = await supabase
      .from("talent_shortlists")
      .select("id, name, description, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    const enriched = await Promise.all(
      (rawLists || []).map(async (l) => {
        const { data: itemRows, count } = await supabase
          .from("talent_shortlist_items")
          .select("creator_user_id", { count: "exact" })
          .eq("shortlist_id", l.id)
          .limit(4);
        const creatorIds = (itemRows || []).map((r: any) => r.creator_user_id);
        let avatars: string[] = [];
        if (creatorIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("avatar_url")
            .in("user_id", creatorIds);
          avatars = (profs || []).map((p: any) => p.avatar_url).filter(Boolean);
        }
        return { ...l, itemCount: count ?? 0, previewAvatars: avatars };
      })
    );
    setLists(enriched);
    setLoading(false);
  };

  const openList = async (list: Shortlist) => {
    setActiveList(list);
    setItemsLoading(true);
    const { data: itemRows } = await supabase
      .from("talent_shortlist_items")
      .select("id, creator_user_id, note, added_at")
      .eq("shortlist_id", list.id)
      .order("added_at", { ascending: false });

    const creatorIds = (itemRows || []).map((r: any) => r.creator_user_id);
    let profilesById: Record<string, any> = {};
    if (creatorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, username, avatar_url, job_title")
        .in("user_id", creatorIds);
      (profs || []).forEach((p: any) => (profilesById[p.user_id] = p));
    }
    setItems(
      (itemRows || []).map((r: any) => ({ ...r, profile: profilesById[r.creator_user_id] }))
    );
    setItemsLoading(false);
  };

  const createList = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase
      .from("talent_shortlists")
      .insert({ owner_id: user.id, name: newName.trim() })
      .select("id, name, description, created_at")
      .single();
    if (!error && data) {
      setLists([{ ...data, itemCount: 0, previewAvatars: [] }, ...lists]);
      setNewName("");
      setCreateOpen(false);
      toast({ title: `Created "${data.name}"` });
    }
  };

  const deleteList = async (id: string) => {
    if (!confirm("Delete this shortlist?")) return;
    await supabase.from("talent_shortlists").delete().eq("id", id);
    setLists(lists.filter((l) => l.id !== id));
    if (activeList?.id === id) setActiveList(null);
    toast({ title: "Shortlist deleted" });
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("talent_shortlist_items").delete().eq("id", itemId);
    setItems(items.filter((i) => i.id !== itemId));
  };

  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">Please sign in to manage your shortlists.</p>
      </div>
    );
  }

  if (activeList) {
    return (
      <div className="container max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <SEO title={`${activeList.name} · Shortlist`} />
        <button
          onClick={() => setActiveList(null)}
          className="text-xs text-white/60 hover:text-[hsl(var(--energy))] transition-colors"
        >
          ← All shortlists
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{activeList.name}</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "creator" : "creators"} · Private
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => deleteList(activeList.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        {itemsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            No creators in this list yet. Save creators from their profile.
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="p-3 flex items-center gap-3">
                <Link
                  to={`/profile/${item.profile?.username || item.creator_user_id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={item.profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {(item.profile?.full_name || "?").slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {item.profile?.full_name || "Unknown creator"}
                    </p>
                    {item.profile?.job_title && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.profile.job_title}
                      </p>
                    )}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove from list"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <SEO title="My Shortlists · Kretopia" description="Organize creators you want to hire into private talent lists." />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            My Shortlists
          </h1>
          <p className="text-sm text-muted-foreground">Private lists of creators you want to hire</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create shortlist</DialogTitle>
            </DialogHeader>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Summer campaign DPs"
              onKeyDown={(e) => e.key === "Enter" && createList()}
            />
            <DialogFooter>
              <Button onClick={createList} disabled={!newName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : lists.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <div>
            <p className="font-semibold">No shortlists yet</p>
            <p className="text-sm text-muted-foreground">
              Create lists to organize creators by project, vibe, or vertical.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <Card
              key={list.id}
              className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => openList(list)}
            >
              <div className="flex -space-x-2">
                {(list.previewAvatars || []).slice(0, 3).map((src, i) => (
                  <Avatar key={i} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={src} />
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                ))}
                {(!list.previewAvatars || list.previewAvatars.length === 0) && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{list.name}</p>
                <p className="text-xs text-muted-foreground">
                  {list.itemCount} {list.itemCount === 1 ? "creator" : "creators"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Shortlists;
