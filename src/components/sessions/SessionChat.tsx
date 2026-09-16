import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Trash2, MessageCircle, Megaphone, Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { validateMessage, sanitizeInput } from "@/lib/errorHandling";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  is_announcement?: boolean;
  profile: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface SessionChatProps {
  sessionId: string;
  isCreator: boolean;
}

export const SessionChat = ({ sessionId, isCreator }: SessionChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<Message | null>(null);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Subscribe to realtime messages
    const channel = supabase
      .channel(`session-chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the new message with profile
            fetchNewMessage(payload.new.id);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => 
              prev.map(m => m.id === payload.new.id 
                ? { ...m, ...payload.new } 
                : m
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('session_messages')
      .select('id, user_id, content, created_at, is_deleted, is_announcement')
      .eq('session_id', sessionId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
    } else if (data && data.length > 0) {
      // Fetch profiles separately
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profilesMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );

      const formattedMessages = data.map(m => ({
        ...m,
        profile: profilesMap.get(m.user_id) || null
      }));
      setMessages(formattedMessages);
    } else {
      setMessages([]);
    }

    setLoading(false);
  };

  const fetchNewMessage = async (messageId: string) => {
    const { data } = await supabase
      .from('session_messages')
      .select('id, user_id, content, created_at, is_deleted, is_announcement')
      .eq('id', messageId)
      .single();

    if (data && !data.is_deleted) {
      // Fetch profile separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .eq('user_id', data.user_id)
        .single();

      const formattedMessage = {
        ...data,
        profile: profileData || null
      };
      setMessages(prev => {
        // Check if message already exists
        if (prev.some(m => m.id === formattedMessage.id)) {
          return prev;
        }
        return [...prev, formattedMessage];
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    // Validate message
    const validationErrors = validateMessage(newMessage);
    if (validationErrors.length > 0) {
      toast({
        title: "Invalid message",
        description: validationErrors[0].message,
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    const sanitizedContent = sanitizeInput(newMessage);

    const { error } = await supabase
      .from('session_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        content: sanitizedContent,
        is_announcement: broadcastMode && isCreator,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } else {
      setNewMessage("");
      if (broadcastMode) {
        toast({ title: "📣 Announcement sent", description: "Pinned to the top of the chat." });
      }
    }

    setSending(false);
  };

  const handleDeleteMessage = async (message: Message) => {
    // Soft delete the message
    const { error } = await supabase
      .from('session_messages')
      .update({
        is_deleted: true,
        deleted_by: user?.id,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', message.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    } else {
      setMessages(prev => prev.filter(m => m.id !== message.id));
      toast({ title: "Message deleted" });
    }
    
    setDeleteMessage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const announcements = messages.filter(m => m.is_announcement).slice(-3);
  const regularMessages = messages.filter(m => !m.is_announcement);

  return (
    <>
      <div className="flex flex-col h-full min-h-0">
        {announcements.length > 0 && (
          <div className="px-4 sm:px-6 pt-3 space-y-2 shrink-0">
            {announcements.map(a => (
              <div key={a.id} className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Pin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">Host announcement</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm break-words">{a.content}</p>
              </div>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6" ref={scrollRef}>
          {regularMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageCircle className="h-12 w-12 mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-1">No messages yet</h3>
              <p className="text-sm text-muted-foreground text-center">
                Start the conversation!<br />
                Coordinate with others, ask what to bring, etc.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {regularMessages.map((message) => {
                const isOwn = message.user_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={message.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {message.profile?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex-1 ${isOwn ? 'text-right' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {!isOwn && (
                          <span className="text-sm font-medium">
                            {message.profile?.full_name || 'Unknown'}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                        {(isCreator || isOwn) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteMessage(message)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div
                        className={`inline-block max-w-[80%] rounded-2xl px-4 py-2 ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t shrink-0 space-y-2">
          {isCreator && (
            <button
              type="button"
              onClick={() => setBroadcastMode(v => !v)}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                broadcastMode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              <Megaphone className="h-3 w-3" />
              {broadcastMode ? "Broadcasting as host" : "Send as announcement"}
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={broadcastMode ? "Write an announcement to all attendees…" : "Type a message..."}
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!deleteMessage} onOpenChange={() => setDeleteMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be removed from the chat for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMessage && handleDeleteMessage(deleteMessage)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
