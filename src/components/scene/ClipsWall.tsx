import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Loader2, Sparkles, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ClippedPost {
  clip_id: string;
  post_id: string;
  clipped_at: string;
  content: string | null;
  media_urls: any;
  media_type: string | null;
  post_type: string;
  is_ai_generated: boolean;
  created_at: string;
  user_id: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
    role: string | null;
  };
}

export const ClipsWall = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [clips, setClips] = useState<ClippedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClips = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: clipData, error } = await supabase
        .from("feed_clips")
        .select("id, post_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error || !clipData?.length) {
        setClips([]);
        setLoading(false);
        return;
      }

      const postIds = clipData.map(c => c.post_id);
      const { data: posts } = await supabase
        .from("feed_posts")
        .select("*")
        .in("id", postIds);

      if (!posts?.length) {
        setClips([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(posts.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const postMap = new Map(posts.map(p => [p.id, p]));

      const enriched: ClippedPost[] = clipData
        .map(clip => {
          const post = postMap.get(clip.post_id);
          if (!post) return null;
          return {
            clip_id: clip.id,
            post_id: clip.post_id,
            clipped_at: clip.created_at,
            content: post.content,
            media_urls: post.media_urls,
            media_type: post.media_type,
            post_type: post.post_type || "text",
            is_ai_generated: !!(post as any).is_ai_generated,
            created_at: post.created_at,
            user_id: post.user_id,
            profile: profileMap.get(post.user_id) || { full_name: "Unknown", avatar_url: null, role: null },
          };
        })
        .filter(Boolean) as ClippedPost[];

      setClips(enriched);
    } catch {
      toast({ title: "Error loading clips", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleUnclip = async (clipId: string) => {
    await supabase.from("feed_clips").delete().eq("id", clipId);
    setClips(prev => prev.filter(c => c.clip_id !== clipId));
    toast({ title: "Removed from clips" });
  };

  if (!user) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground">Sign in to see your saved posts</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Bookmark className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No clips yet</h3>
        <p className="text-sm text-muted-foreground">
          Tap the clip icon on any post to save it here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{clips.length} saved post{clips.length !== 1 ? "s" : ""}</p>
      {clips.map(clip => (
        <Card key={clip.clip_id} className="p-3 border-border/50">
          <div className="flex gap-2.5">
            <Avatar
              className="h-8 w-8 shrink-0 cursor-pointer"
              onClick={() => navigate(`/profile/${clip.user_id}`)}
            >
              <AvatarImage src={clip.profile?.avatar_url || ""} />
              <AvatarFallback className="text-xs">
                {clip.profile?.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="text-sm font-medium truncate cursor-pointer hover:underline"
                  onClick={() => navigate(`/profile/${clip.user_id}`)}
                >
                  {clip.profile?.full_name}
                </span>
                {clip.is_ai_generated && (
                  <Badge variant="secondary" className="text-[9px] gap-0.5 py-0 px-1.5 bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="h-2 w-2" /> AI
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                  {formatDistanceToNow(new Date(clip.created_at), { addSuffix: true })}
                </span>
              </div>

              {clip.content && (
                <p className="text-sm text-foreground/90 mb-2 line-clamp-3">{clip.content}</p>
              )}

              {clip.media_urls?.[0] && clip.media_type === "image" && (
                <img
                  src={clip.media_urls[0]}
                  alt="Clipped media"
                  className="rounded-lg w-full max-h-48 object-cover mb-2"
                />
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  Saved {formatDistanceToNow(new Date(clip.clipped_at), { addSuffix: true })}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleUnclip(clip.clip_id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
