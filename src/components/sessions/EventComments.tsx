import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send, Trash2, MessageSquare, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { sendPushNotification } from "@/lib/pushNotifications";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profile: { full_name: string; avatar_url: string | null } | null;
}

interface EventCommentsProps {
  eventId: string;
  isCreator: boolean;
  creatorId?: string;
  eventTitle?: string;
  /** RSVP'd (going/interested) — hosts can always comment regardless of this. */
  isParticipant: boolean;
}

export const EventComments = ({ eventId, isCreator, creatorId, eventTitle, isParticipant }: EventCommentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canComment = isCreator || isParticipant;

  useEffect(() => {
    loadComments();

    const channel = supabase
      .channel(`event-comments-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_comments',
        filter: `event_id=eq.${eventId}`,
      }, () => loadComments())
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'event_comments',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        setComments(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('event_comments' as any)
      .select('id, user_id, content, image_url, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) { console.error(error); setLoading(false); return; }

    const items = data as any[] || [];
    if (items.length > 0) {
      const userIds = [...new Set(items.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setComments(items.map((c: any) => ({ ...c, profile: profileMap.get(c.user_id) || null })));
    } else {
      setComments([]);
    }
    setLoading(false);
  };

  const handlePickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setAttachedImage(file);
    setAttachedPreview(URL.createObjectURL(file));
  };

  const clearAttachedImage = () => {
    if (attachedPreview) URL.revokeObjectURL(attachedPreview);
    setAttachedImage(null);
    setAttachedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if ((!newComment.trim() && !attachedImage) || !user || !canComment) return;
    setSending(true);
    const commentContent = newComment.trim();

    try {
      let imageUrl: string | null = null;
      if (attachedImage) {
        const ext = attachedImage.name.split(".").pop() || "jpg";
        const path = `${user.id}/comments/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("portfolio").upload(path, attachedImage);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
        imageUrl = publicUrl;
      }

      const { data: inserted, error } = await supabase
        .from('event_comments' as any)
        .insert({ event_id: eventId, user_id: user.id, content: commentContent, image_url: imageUrl })
        .select('id')
        .single();
      if (error) throw error;

      setNewComment("");
      clearAttachedImage();

      // The in-app notification row for the host + other commenters is
      // created server-side (notify_event_comment is SECURITY DEFINER) —
      // a direct client insert for someone else's user_id is rejected by
      // RLS, which used to make this silently no-op. See
      // 20260905120000_notify_event_comment_rpc.sql.
      const commentId = (inserted as any)?.id as string | undefined;
      if (commentId) {
        supabase.rpc('notify_event_comment' as any, { _comment_id: commentId })
          .then(({ error: notifyErr }) => {
            if (notifyErr) console.error('[EventComments] notify_event_comment failed:', notifyErr);
          });
      }

      // Get commenter's name for the push (browser) leg only — the in-app
      // row is handled by the RPC above, so skipInApp avoids a duplicate,
      // pointless RLS-rejected insert attempt here.
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      const commenterName = profile?.full_name || 'Someone';
      const preview = commentContent
        ? (commentContent.length > 80 ? commentContent.slice(0, 80) + '…' : commentContent)
        : '📷 Shared a photo';
      const title = eventTitle || 'an event';

      // Notify event creator (if commenter is not the creator)
      if (creatorId && creatorId !== user.id) {
        sendPushNotification({
          userId: creatorId,
          title: `New comment on ${title}`,
          body: `${commenterName}: ${preview}`,
          type: 'general',
          link: `/event/${eventId}`,
          skipInApp: true,
        });
      }

      // Notify other unique commenters (excluding current user and creator)
      const otherCommenters = [...new Set(
        comments
          .map(c => c.user_id)
          .filter(id => id !== user.id && id !== creatorId)
      )];
      for (const userId of otherCommenters) {
        sendPushNotification({
          userId,
          title: `New comment on ${title}`,
          body: `${commenterName}: ${preview}`,
          type: 'general',
          link: `/event/${eventId}`,
          skipInApp: true,
        });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to post comment", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    // A delete that RLS filters out entirely matches zero rows rather than
    // raising an error, so without .select() this would silently "succeed"
    // from the client's point of view — the comment reappearing on the next
    // reload with no visible failure. Requesting the deleted row back makes
    // a denied delete distinguishable from a real one.
    const { data, error } = await supabase
      .from('event_comments' as any)
      .delete()
      .eq('id', commentId)
      .select('id');

    if (error || !data || data.length === 0) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Comments</h3>
          {comments.length > 0 && <span className="text-xs text-muted-foreground">· {comments.length}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <MessageSquare className="h-8 w-8 mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No comments yet</p>
            <p className="text-xs text-muted-foreground">Start the buzz! Ask questions, share excitement.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar
                  className="h-8 w-8 shrink-0 cursor-pointer"
                  onClick={() => navigate(`/profile/${comment.user_id}`)}
                >
                  <AvatarImage src={comment.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {comment.profile?.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/profile/${comment.user_id}`)}
                    >
                      {comment.profile?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                    {(isCreator || comment.user_id === user?.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete comment"
                        className="h-6 w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(comment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {comment.content && <p className="text-sm text-foreground mt-0.5">{comment.content}</p>}
                  {comment.image_url && (
                    <img
                      src={comment.image_url}
                      alt=""
                      loading="lazy"
                      className="mt-2 max-h-56 rounded-lg border border-border object-cover"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {user && canComment ? (
          <div className="pt-3 border-t border-border/60">
            {attachedPreview && (
              <div className="relative inline-block mb-2">
                <img src={attachedPreview} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                <button
                  type="button"
                  onClick={clearAttachedImage}
                  aria-label="Remove image"
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickImage(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="Attach a photo"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={sending || (!newComment.trim() && !attachedImage)}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        ) : user ? (
          <div className="pt-3 border-t border-border/60 text-center">
            <p className="text-sm text-muted-foreground">RSVP to join the conversation</p>
          </div>
        ) : (
          <div className="pt-3 border-t border-border/60 text-center">
            <p className="text-sm text-muted-foreground">Sign up to join the conversation</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
