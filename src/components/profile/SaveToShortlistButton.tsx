import { useState, useEffect } from "react";
import { Bookmark, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SaveToShortlistButtonProps {
  creatorUserId: string;
  variant?: "icon" | "full";
}

interface Shortlist {
  id: string;
  name: string;
  color: string | null;
}

export const SaveToShortlistButton = ({ creatorUserId, variant = "icon" }: SaveToShortlistButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isSaved = memberOf.size > 0;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: lists } = await supabase
      .from("talent_shortlists")
      .select("id, name, color")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    const { data: items } = await supabase
      .from("talent_shortlist_items")
      .select("shortlist_id")
      .eq("creator_user_id", creatorUserId);
    setShortlists(lists || []);
    setMemberOf(new Set((items || []).map((i: any) => i.shortlist_id)));
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, user, creatorUserId]);

  // Quick check on mount so the button reflects saved state
  useEffect(() => {
    if (!user) return;
    supabase
      .from("talent_shortlist_items")
      .select("shortlist_id")
      .eq("creator_user_id", creatorUserId)
      .then(({ data }) => {
        if (data) setMemberOf(new Set(data.map((i: any) => i.shortlist_id)));
      });
  }, [user, creatorUserId]);

  const toggleMembership = async (listId: string) => {
    if (!user) return;
    if (memberOf.has(listId)) {
      await supabase
        .from("talent_shortlist_items")
        .delete()
        .eq("shortlist_id", listId)
        .eq("creator_user_id", creatorUserId);
      const next = new Set(memberOf);
      next.delete(listId);
      setMemberOf(next);
      toast({ title: "Removed from list" });
    } else {
      await supabase
        .from("talent_shortlist_items")
        .insert({ shortlist_id: listId, creator_user_id: creatorUserId });
      const next = new Set(memberOf);
      next.add(listId);
      setMemberOf(next);
      toast({ title: "Saved to list" });
    }
  };

  const createList = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("talent_shortlists")
      .insert({ owner_id: user.id, name: newName.trim() })
      .select("id, name, color")
      .single();
    if (!error && data) {
      // Auto-add creator to the new list
      await supabase
        .from("talent_shortlist_items")
        .insert({ shortlist_id: data.id, creator_user_id: creatorUserId });
      setShortlists([data, ...shortlists]);
      setMemberOf(new Set([...memberOf, data.id]));
      setNewName("");
      toast({ title: `Created "${data.name}" and saved` });
    } else if (error) {
      toast({ title: "Could not create list", description: error.message, variant: "destructive" });
    }
    setCreating(false);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            aria-label="Save to shortlist"
          >
            <Bookmark className={cn("h-3.5 w-3.5", isSaved && "fill-primary text-primary")} />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 h-9">
            <Bookmark className={cn("h-3.5 w-3.5", isSaved && "fill-primary text-primary")} />
            {isSaved ? "Saved" : "Save"}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="end">
        <div>
          <p className="text-xs font-semibold">Save to shortlist</p>
          <p className="text-[11px] text-muted-foreground">Private — only you can see your lists</p>
        </div>

        <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : shortlists.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No lists yet — create one below</p>
          ) : (
            shortlists.map((list) => {
              const checked = memberOf.has(list.id);
              return (
                <button
                  key={list.id}
                  onClick={() => toggleMembership(list.id)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left"
                >
                  <span className="text-sm truncate">{list.name}</span>
                  {checked && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <Separator />

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New list name"
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && createList()}
          />
          <Button
            size="sm"
            className="h-8 px-2"
            onClick={createList}
            disabled={!newName.trim() || creating}
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
