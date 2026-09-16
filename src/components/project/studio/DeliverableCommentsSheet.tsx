import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface DeliverableCommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliverable: { id: string; title: string } | null;
  currentUserId: string;
}

interface CommentRow {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null } | null;
}

export const DeliverableCommentsSheet = ({
  open,
  onOpenChange,
  deliverable,
  currentUserId,
}: DeliverableCommentsSheetProps) => {
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !deliverable?.id) {
      setComments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const { data, error } = await supabase
        .from("deliverable_comments")
        .select("id, content, user_id, created_at")
        .eq("deliverable_id", deliverable.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[DeliverableCommentsSheet] load", error);
        setLoading(false);
        return;
      }
      const userIds = Array.from(new Set((data ?? []).map((c) => c.user_id)));
      const profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        profs?.forEach((p: any) => {
          profileMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
      }
      setComments(
        (data ?? []).map((c) => ({ ...c, profiles: profileMap[c.user_id] ?? null })),
      );
      setLoading(false);
    };

    void load().catch((e) => {
      console.error("[DeliverableCommentsSheet] unexpected", e);
      setLoading(false);
    });

    const channel = supabase
      .channel(`deliverable-comments:${deliverable.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliverable_comments",
          filter: `deliverable_id=eq.${deliverable.id}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [open, deliverable?.id]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !deliverable?.id || sending) return;
    setSending(true);
    const { error } = await supabase.from("deliverable_comments").insert({
      deliverable_id: deliverable.id,
      user_id: currentUserId,
      content,
    });
    setSending(false);
    if (error) {
      toast({ title: "Couldn't post note", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("deliverable_comments").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] flex flex-col p-0 gap-0 rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-[hsl(var(--energy))]" />
            Notes
          </SheetTitle>
          <p className="text-xs text-muted-foreground truncate text-left">
            {deliverable?.title}
          </p>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No notes yet. Drop the first one.
            </div>
          ) : (
            comments.map((c) => {
              const isMine = c.user_id === currentUserId;
              return (
                <div key={c.id} className="flex gap-2.5 group">
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarImage src={c.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] font-bold">
                      {c.profiles?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">
                        {isMine ? "You" : c.profiles?.full_name ?? "Member"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {c.content}
                    </p>
                  </div>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-border/60 shrink-0 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Leave a note…"
              rows={1}
              className="resize-none min-h-[40px] max-h-32 rounded-xl bg-muted/40 border-border/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button
              size="icon"
              className="rounded-xl shrink-0"
              disabled={!draft.trim() || sending}
              onClick={handleSend}
              aria-label="Post note"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
