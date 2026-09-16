import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Pin, Loader2, Send, MessageCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  circleId: string;
  isMember: boolean;
  isAdmin: boolean;
  onOpenChat: () => void;
}

interface Author { full_name: string | null; avatar_url: string | null }
interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  media_url: string | null;
  media_type: string | null;
  reaction_count: number;
  comment_count: number;
  author?: Author;
}
interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: Author;
}

const REACTIONS = ["👍", "❤️", "🔥", "🙌", "💡"];

const hydrateAuthors = async <T extends { user_id: string; author?: Author }>(rows: T[]) => {
  const ids = Array.from(new Set(rows.map(r => r.user_id)));
  if (!ids.length) return rows;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url")
    .in("user_id", ids);
  const map = new Map((data || []).map((p: any) => [p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url } as Author]));
  rows.forEach(r => { r.author = map.get(r.user_id); });
  return rows;
};

export const CircleFeedTab = ({ circleId, isMember, isAdmin, onOpenChat }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [myReactions, setMyReactions] = useState<Record<string, Set<string>>>({}); // postId -> emojis
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crew_feed_posts")
        .select("id, user_id, content, created_at, is_pinned, media_url, media_type, reaction_count, comment_count")
        .eq("circle_id", circleId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data || []) as FeedPost[];
      await hydrateAuthors(rows);
      setPosts(rows);

      if (user && rows.length) {
        const { data: rx } = await supabase
          .from("crew_feed_post_reactions")
          .select("post_id, emoji")
          .eq("user_id", user.id)
          .in("post_id", rows.map(r => r.id));
        const map: Record<string, Set<string>> = {};
        (rx || []).forEach((r: any) => {
          if (!map[r.post_id]) map[r.post_id] = new Set();
          map[r.post_id].add(r.emoji);
        });
        setMyReactions(map);
      }
    } catch (e) {
      console.error("feed load", e);
    } finally {
      setLoading(false);
    }
  }, [circleId, user]);

  useEffect(() => { load().catch(() => null); }, [load]);

  // Realtime: refresh on any change in this crew's feed.
  useEffect(() => {
    if (!circleId) return;
    const channel = supabase
      .channel(`crew-feed-${circleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crew_feed_posts", filter: `circle_id=eq.${circleId}` }, () => {
        load().catch(() => null);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [circleId, load]);

  const post = async () => {
    if (!user || !draft.trim()) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("crew_feed_posts").insert({
        circle_id: circleId,
        user_id: user.id,
        content: draft.trim(),
      });
      if (error) throw error;
      setDraft("");
      toast({ title: "Posted to the Crew" });
      load().catch(() => null);
    } catch (e: any) {
      toast({ title: "Couldn't post", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const toggleReaction = async (postId: string, emoji: string) => {
    if (!user) return;
    const has = myReactions[postId]?.has(emoji);
    // optimistic
    setMyReactions(prev => {
      const next = { ...prev };
      const set = new Set(next[postId] || []);
      has ? set.delete(emoji) : set.add(emoji);
      next[postId] = set;
      return next;
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, reaction_count: Math.max(0, p.reaction_count + (has ? -1 : 1)) } : p));
    try {
      if (has) {
        await supabase.from("crew_feed_post_reactions").delete()
          .eq("post_id", postId).eq("user_id", user.id).eq("emoji", emoji);
      } else {
        await supabase.from("crew_feed_post_reactions").insert({ post_id: postId, user_id: user.id, emoji });
      }
    } catch (e: any) {
      toast({ title: "Reaction failed", description: e.message, variant: "destructive" });
      load().catch(() => null);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from("crew_feed_post_comments")
        .select("id, post_id, user_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as Comment[];
      await hydrateAuthors(rows);
      setComments(prev => ({ ...prev, [postId]: rows }));
    } catch (e) {
      console.error("comments load", e);
    }
  };

  const toggleComments = async (postId: string) => {
    if (openComments === postId) { setOpenComments(null); return; }
    setOpenComments(postId);
    setCommentDraft("");
    if (!comments[postId]) await loadComments(postId);
  };

  const sendComment = async (postId: string) => {
    if (!user || !commentDraft.trim()) return;
    setCommentSending(true);
    try {
      const { error } = await supabase.from("crew_feed_post_comments").insert({
        post_id: postId, user_id: user.id, content: commentDraft.trim(),
      });
      if (error) throw error;
      setCommentDraft("");
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
      loadComments(postId).catch(() => null);
    } catch (e: any) {
      toast({ title: "Couldn't comment", description: e.message, variant: "destructive" });
    } finally {
      setCommentSending(false);
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    try {
      const { error } = await supabase.from("crew_feed_posts").delete().eq("id", postId);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e: any) {
      toast({ title: "Couldn't delete", description: e.message, variant: "destructive" });
    }
  };

  const togglePin = async (postId: string, pinned: boolean) => {
    try {
      const { error } = await supabase.from("crew_feed_posts").update({ is_pinned: !pinned }).eq("id", postId);
      if (error) throw error;
      load().catch(() => null);
    } catch (e: any) {
      toast({ title: "Couldn't pin", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="px-4 space-y-4 pb-8">
      {isMember && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <Textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share something with the Crew…"
            rows={3}
            className="resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
            maxLength={5000}
          />
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">{draft.length}/5000</span>
            <Button size="sm" onClick={post} disabled={!draft.trim() || posting}>
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" />Post</>}
            </Button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>No posts yet. Start the conversation.</p>
          <Button variant="link" onClick={onOpenChat} className="mt-2">Or open the live chat</Button>
        </div>
      ) : (
        posts.map(p => {
          const mine = myReactions[p.id] || new Set();
          const isOpen = openComments === p.id;
          const canManage = isAdmin || p.user_id === user?.id;
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-3">
                {p.is_pinned && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary mb-2">
                    <Pin className="h-3 w-3" /> Pinned
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={p.author?.avatar_url || undefined} />
                    <AvatarFallback>{p.author?.full_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold truncate">{p.author?.full_name || "Member"}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap break-words">{p.content}</p>
                    {p.media_url && p.media_type?.startsWith("image") && (
                      <img src={p.media_url} alt="" className="mt-2 rounded-lg max-h-80 object-cover" loading="lazy" />
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1">
                      {isAdmin && (
                        <button onClick={() => togglePin(p.id, p.is_pinned)} className="p-1 text-muted-foreground hover:text-primary" title={p.is_pinned ? "Unpin" : "Pin"}>
                          <Pin className={cn("h-3.5 w-3.5", p.is_pinned && "fill-primary text-primary")} />
                        </button>
                      )}
                      <button onClick={() => deletePost(p.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Reactions + comment toggle */}
              <div className="flex items-center gap-1 px-3 pb-2 border-t border-border/40 pt-2">
                {REACTIONS.map(emoji => {
                  const active = mine.has(emoji);
                  return (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(p.id, emoji)}
                      disabled={!isMember}
                      className={cn(
                        "px-2 py-1 rounded-full text-sm transition-all",
                        active ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted",
                        !isMember && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {emoji}
                    </button>
                  );
                })}
                {p.reaction_count > 0 && (
                  <span className="text-[11px] text-muted-foreground ml-1">{p.reaction_count}</span>
                )}
                <button
                  onClick={() => toggleComments(p.id)}
                  className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {p.comment_count > 0 ? p.comment_count : "Comment"}
                </button>
              </div>

              {/* Inline comments */}
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2 bg-muted/20">
                  {(comments[p.id] || []).map(c => (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={c.author?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{c.author?.full_name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-xl bg-card border border-border px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold truncate">{c.author?.full_name || "Member"}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {isMember && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(p.id); } }}
                        placeholder="Write a comment…"
                        maxLength={2000}
                        className="h-9 text-sm"
                      />
                      <Button size="sm" onClick={() => sendComment(p.id)} disabled={!commentDraft.trim() || commentSending}>
                        {commentSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
