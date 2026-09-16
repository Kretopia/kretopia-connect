import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ArticleComment {
  id: string;
  article_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string | null;
  author_avatar_url: string | null;
}

/**
 * Likes + comments for one Magazine article. Requires the
 * magazine_article_likes / magazine_article_comments tables (see the
 * 2026-09-09 migration) -- both denormalize their count onto
 * magazine_articles itself via a trigger, so `likeCount`/`commentCount`
 * here start from the article row and only drift from the hook's own
 * optimistic update between actions, never from a client-side recount.
 */
export function useMagazineArticleEngagement(
  articleId: string,
  initialLikeCount: number,
  initialCommentCount: number,
) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  // Has the current user already liked this article?
  useEffect(() => {
    if (!user) { setLiked(false); return; }
    let cancelled = false;
    supabase
      .from("magazine_article_likes")
      .select("id")
      .eq("article_id", articleId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLiked(!!data);
      });
    return () => { cancelled = true; };
  }, [articleId, user]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    const { data, error } = await supabase
      .from("magazine_article_comments")
      .select("id, article_id, user_id, content, created_at")
      .eq("article_id", articleId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      // No FK from magazine_article_comments to profiles for PostgREST to
      // embed through -- same two-step fetch-then-map CircleFeedTab's
      // hydrateAuthors() uses for crew_feed_post_comments.
      const ids = Array.from(new Set(data.map((c) => c.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids)
        : { data: [] as { user_id: string; full_name: string | null; avatar_url: string | null }[] };
      const byId = new Map((profiles || []).map((p) => [p.user_id, p]));
      setComments(
        data.map((c) => ({
          ...c,
          author_name: byId.get(c.user_id)?.full_name ?? null,
          author_avatar_url: byId.get(c.user_id)?.avatar_url ?? null,
        })),
      );
    }
    setCommentsLoading(false);
  }, [articleId]);

  const toggleLike = useCallback(async () => {
    if (!user) {
      toast.error("Sign in to like this story");
      return;
    }
    // Optimistic — a like is low-stakes enough that instant feedback matters
    // more than waiting on the round trip; rolled back on failure below.
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    const { error } = wasLiked
      ? await supabase.from("magazine_article_likes").delete().eq("article_id", articleId).eq("user_id", user.id)
      : await supabase.from("magazine_article_likes").insert({ article_id: articleId, user_id: user.id });
    if (error) {
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
      toast.error("Couldn't update your like");
    }
  }, [articleId, liked, user]);

  const addComment = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      if (!user) {
        toast.error("Sign in to comment");
        return false;
      }
      setPosting(true);
      const { data, error } = await supabase
        .from("magazine_article_comments")
        .insert({ article_id: articleId, user_id: user.id, content: trimmed })
        .select("id, article_id, user_id, content, created_at")
        .single();
      setPosting(false);
      if (error || !data) {
        toast.error("Couldn't post your comment");
        return false;
      }
      // Refetch rather than append-with-guessed-name: user.user_metadata
      // isn't guaranteed to match profiles.full_name/avatar_url, and a
      // comment list is short enough that the extra round trip is cheap.
      await loadComments();
      setCommentCount((c) => c + 1);
      return true;
    },
    [articleId, user, loadComments],
  );

  return { liked, likeCount, commentCount, comments, commentsLoading, posting, loadComments, toggleLike, addComment };
}
