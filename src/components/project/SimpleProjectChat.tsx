import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare, Send, Reply, Pin, PinOff, SmilePlus, X, ChevronDown, Pencil, Trash2, MoreVertical, Paperclip, FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ChatActionChips } from "./chat/ChatActionChips";
import { ChatAttachment } from "./chat/ChatAttachment";
import { VoiceNoteRecorder } from "@/components/messages/VoiceNoteRecorder";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

interface Attachment {
  url: string;
  name: string;
  type: string;
  size?: number;
}

interface Message {
  id: string;
  message: string;
  user_id: string;
  created_at: string;
  reply_to?: string | null;
  is_pinned?: boolean;
  attachments?: Attachment[] | null;
  voice_url?: string | null;
  voice_duration?: number | null;
  voice_transcript?: string | null;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface SimpleProjectChatProps {
  projectId: string;
  messages: Message[];
  currentUserId: string;
  onMessageSent: () => void;
  collaborators?: Collaborator[];
}

const QUICK_EMOJIS = ["👍", "❤", "", "😂", "", "👀", "💯", "🙌"];

export const SimpleProjectChat = ({ projectId, messages, currentUserId, onMessageSent, collaborators = [] }: SimpleProjectChatProps) => {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionSearchResults, setMentionSearchResults] = useState<Collaborator[]>([]);
  const [mentionInviting, setMentionInviting] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify current user's display name from collaborators or messages
  const currentUserName = useMemo(() => {
    const fromCollabs = collaborators.find((c) => c.id === currentUserId)?.full_name;
    if (fromCollabs) return fromCollabs;
    const fromMsg = messages.find((m) => m.user_id === currentUserId)?.profiles?.full_name;
    return fromMsg || "Someone";
  }, [collaborators, messages, currentUserId]);

  // Realtime typing indicator (separate channel from presence to keep payloads tiny)
  const { typingUsers, notifyTyping } = useTypingIndicator(
    projectId ? `chat-typing:${projectId}` : undefined,
    { id: currentUserId, full_name: currentUserName },
  );

  useEffect(() => {
    // Scroll the messages container only — avoid scrollIntoView which can
    // steal focus from the parent window (e.g. the Lovable preview iframe
    // capturing focus while editing in the outer chat).
    const el = messagesEndRef.current;
    if (!el) return;
    const container = el.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  // Fetch reactions
  useEffect(() => {
    const fetchReactions = async () => {
      const messageIds = messages.map(m => m.id);
      if (messageIds.length === 0) return;
      const { data } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);
      setReactions(data || []);
    };
    fetchReactions();

    // Subscribe to reaction changes
    const channel = supabase
      .channel(`reactions:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        fetchReactions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messages, projectId]);

  const pinnedMessages = useMemo(() => messages.filter(m => m.is_pinned), [messages]);

  const filteredCollaborators = useMemo(() => {
    if (!mentionQuery) return collaborators;
    return collaborators.filter(c =>
      c.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [collaborators, mentionQuery]);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const mentionEmail = useMemo(() => {
    const q = mentionQuery.trim();
    return EMAIL_RE.test(q) ? q.toLowerCase() : null;
  }, [mentionQuery]);

  // Debounced search for non-collaborator users when query is 2+ chars
  useEffect(() => {
    const q = mentionQuery.trim();
    if (!showMentions || q.length < 2 || mentionEmail) {
      setMentionSearchResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const collabIds = new Set(collaborators.map(c => c.id));
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url")
        .ilike("full_name", `%${q}%`)
        .limit(8);
      if (cancelled) return;
      const results = (data || [])
        .filter((p: any) => p.user_id && !collabIds.has(p.user_id))
        .map((p: any) => ({ id: p.user_id, full_name: p.full_name || "Someone", avatar_url: p.avatar_url }));
      setMentionSearchResults(results);
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [mentionQuery, showMentions, mentionEmail, collaborators]);

  // Flat list driving keyboard nav. Order: existing collaborators → new users → email invite row.
  const mentionItems = useMemo(() => {
    const items: Array<
      | { kind: "collab"; collab: Collaborator }
      | { kind: "invite-user"; collab: Collaborator }
      | { kind: "invite-email"; email: string }
    > = [];
    filteredCollaborators.forEach(c => items.push({ kind: "collab", collab: c }));
    mentionSearchResults.forEach(c => items.push({ kind: "invite-user", collab: c }));
    if (mentionEmail) items.push({ kind: "invite-email", email: mentionEmail });
    return items;
  }, [filteredCollaborators, mentionSearchResults, mentionEmail]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);

    // Broadcast that we're typing (throttled inside the hook)
    if (val.trim().length > 0) notifyTyping();

    // Check for @mention trigger
    const lastAtIndex = val.lastIndexOf("@");
    if (lastAtIndex !== -1 && (lastAtIndex === 0 || val[lastAtIndex - 1] === " ")) {
      const query = val.slice(lastAtIndex + 1);
      // Allow spaces only when typing what looks like an email won't include them.
      // Accept up to 40 chars without space for name lookups.
      if (!query.includes(" ") && query.length <= 60) {
        setShowMentions(true);
        setMentionQuery(query);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (collab: Collaborator) => {
    const lastAtIndex = newMessage.lastIndexOf("@");
    const before = newMessage.slice(0, lastAtIndex);
    setNewMessage(`${before}@${collab.full_name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const inviteExistingUserToProject = async (collab: Collaborator) => {
    setMentionInviting(true);
    try {
      // Insert pending row. If it already exists (unique constraint), surface a friendly message.
      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId,
        user_id: collab.id,
        invited_by: currentUserId,
        role: "collaborator",
        status: "pending",
      });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;

      // Notify the invitee in-app
      const { data: project } = await supabase
        .from("projects")
        .select("title")
        .eq("id", projectId)
        .maybeSingle();
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUserId)
        .maybeSingle();
      await supabase.from("notifications").insert({
        user_id: collab.id,
        type: "project_invitation",
        title: "You've been added to a Studio",
        message: `${inviterProfile?.full_name || "A teammate"} mentioned you in "${project?.title || "a Studio"}".`,
        action_url: `/accept-invite/${projectId}`,
        metadata: { project_id: projectId, invited_by: currentUserId },
      }).then(() => {}, () => {});

      toast({ title: `${collab.full_name} invited`, description: "They'll see the invite in their inbox." });
      insertMention(collab);
    } catch (e: any) {
      toast({ title: "Couldn't add to studio", description: e.message, variant: "destructive" });
    } finally {
      setMentionInviting(false);
    }
  };

  const inviteByEmailFromMention = async (email: string) => {
    setMentionInviting(true);
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("title")
        .eq("id", projectId)
        .maybeSingle();
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUserId)
        .maybeSingle();

      // Insert pending email-invite row (idempotent)
      await supabase.from("project_collaborators").insert({
        project_id: projectId,
        email,
        invited_by: currentUserId,
        role: "collaborator",
        status: "pending",
      }).then(() => {}, () => {});

      const { error } = await supabase.functions.invoke("send-project-invitation", {
        body: {
          email,
          projectId,
          projectTitle: project?.title || "your Studio",
          inviterName: inviterProfile?.full_name || "A teammate",
        },
      });
      if (error) throw error;

      toast({ title: `Invite sent to ${email}`, description: "They'll get a one-tap link to join." });

      // Replace the @email mention text with @Display so the message reads naturally
      const lastAtIndex = newMessage.lastIndexOf("@");
      const before = newMessage.slice(0, lastAtIndex);
      const label = email.split("@")[0];
      setNewMessage(`${before}@${label} `);
      setShowMentions(false);
      inputRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Couldn't send invite", description: e.message, variant: "destructive" });
    } finally {
      setMentionInviting(false);
    }
  };

  const pickMentionItem = (item: typeof mentionItems[number]) => {
    if (item.kind === "collab") return insertMention(item.collab);
    if (item.kind === "invite-user") return inviteExistingUserToProject(item.collab);
    if (item.kind === "invite-email") return inviteByEmailFromMention(item.email);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && mentionItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(i => Math.min(i + 1, mentionItems.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMentionItem(mentionItems[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || sending) return;
    setSending(true);
    try {
      const insertData: any = {
        project_id: projectId,
        user_id: currentUserId,
        message: newMessage.trim() || (pendingAttachments.length ? `📎 ${pendingAttachments.length} attachment${pendingAttachments.length > 1 ? "s" : ""}` : ""),
        attachments: pendingAttachments,
      };
      if (replyTo) {
        insertData.reply_to = replyTo.id;
      }

      const { error } = await supabase.from('project_messages').insert(insertData);
      if (error) throw error;

      // Send notifications (in-app + push + email) — detect @mentions
      try {
        const { sendPushNotification } = await import('@/lib/pushNotifications');
        const [{ data: senderProfile }, { data: project }, { data: collabData }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('user_id', currentUserId).single(),
          supabase.from('projects').select('created_by, title').eq('id', projectId).single(),
          supabase.from('project_collaborators').select('user_id').eq('project_id', projectId).neq('user_id', currentUserId),
        ]);

        const usersToNotify = new Set<string>();
        collabData?.forEach(c => usersToNotify.add(c.user_id));
        if (project?.created_by && project.created_by !== currentUserId) usersToNotify.add(project.created_by);

        const mentionedUsers = collaborators.filter(c => newMessage.includes(`@${c.full_name}`));
        const senderName = senderProfile?.full_name || 'Someone';
        const projectTitle = project?.title || 'Project';
        const preview = newMessage.trim().length > 50 ? newMessage.trim().substring(0, 50) + '...' : newMessage.trim();
        const link = `/desk/${projectId}?tab=messages`;

        await Promise.all(
          Array.from(usersToNotify).map((userId) => {
            const isMentioned = mentionedUsers.some(m => m.id === userId);
            return sendPushNotification({
              userId,
              title: isMentioned ? `${senderName} mentioned you` : `New message in ${projectTitle}`,
              body: `${senderName}: ${preview}`,
              type: 'message',
              link,
              data: { projectId, mentioned: isMentioned },
              skipInApp: true, // DB trigger trg_notify_project_message creates the in-app notification
            });
          })
        );
      } catch (notifError) {
        console.error('Error sending notifications:', notifError);
      }

      setNewMessage("");
      setReplyTo(null);
      setPendingAttachments([]);
      onMessageSent();
    } catch (error: any) {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendVoiceNote = async (url: string, duration: number) => {
    try {
      const { data: inserted, error } = await supabase
        .from("project_messages")
        .insert({
          project_id: projectId,
          user_id: currentUserId,
          message: "🎙️ Voice note",
          voice_url: url,
          voice_duration: duration,
          attachments: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      onMessageSent();

      // Fire-and-forget transcription
      if (inserted?.id) {
        supabase.functions
          .invoke("transcribe-voice-note", {
            body: { message_id: inserted.id, audio_url: url, table: "project_messages" },
          })
          .catch((err) => console.error("[transcribe-voice-note] failed:", err));
      }
    } catch (e: any) {
      toast({ title: "Failed to send voice note", description: e.message, variant: "destructive" });
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
  };

  const togglePin = async (messageId: string, currentPinned: boolean) => {
    const { error } = await supabase.from('project_messages').update({ is_pinned: !currentPinned }).eq('id', messageId);
    if (error) {
      toast({ title: "Failed to pin message", variant: "destructive" });
    } else {
      onMessageSent();
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editText.trim()) return;
    const { error } = await supabase.from('project_messages').update({ message: editText.trim() }).eq('id', editingMessage.id);
    if (error) {
      toast({ title: "Failed to edit message", variant: "destructive" });
    } else {
      setEditingMessage(null);
      setEditText("");
      onMessageSent();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from('project_messages').delete().eq('id', messageId);
    if (error) {
      toast({ title: "Failed to delete message", variant: "destructive" });
    } else {
      onMessageSent();
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingFiles(true);
    try {
      // Verify auth before attempting uploads
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ title: "Not signed in", description: "Please sign in again to upload files.", variant: "destructive" });
        return;
      }
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          toast({ title: `${file.name} is too large`, description: "Max 25MB per file", variant: "destructive" });
          continue;
        }
        const nameParts = file.name.split(".");
        const ext = nameParts.length > 1 ? nameParts.pop() : "bin";
        const safeExt = (ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
        const path = `${projectId}/chat/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
        console.log("[chat-upload] uploading", { path, size: file.size, type: file.type, userId: session.user.id });
        const { data: upData, error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) {
          console.error("[chat-upload] failed", { path, error: upErr, name: (upErr as any)?.name, statusCode: (upErr as any)?.statusCode, status: (upErr as any)?.status });
          const detail = (upErr as any)?.message || (upErr as any)?.error || JSON.stringify(upErr);
          toast({ title: `Upload failed: ${file.name}`, description: String(detail).slice(0, 200), variant: "destructive" });
          continue;
        }
        console.log("[chat-upload] success", upData);
        uploaded.push({ url: path, name: file.name, type: file.type || "application/octet-stream", size: file.size });
      }
      if (uploaded.length === 0 && files.length > 0) {
        toast({ title: "No files uploaded", description: "Check console for details.", variant: "destructive" });
      }
      setPendingAttachments(prev => [...prev, ...uploaded]);
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getReplyMessage = (replyToId: string | null | undefined) => {
    if (!replyToId) return null;
    return messages.find(m => m.id === replyToId);
  };

  const getReactionsForMessage = (messageId: string) => {
    const msgReactions = reactions.filter(r => r.message_id === messageId);
    const grouped: Record<string, { emoji: string; count: number; users: string[]; hasOwn: boolean }> = {};
    msgReactions.forEach(r => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasOwn: false };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].users.push(r.user_id);
      if (r.user_id === currentUserId) grouped[r.emoji].hasOwn = true;
    });
    return Object.values(grouped);
  };

  // Render @mentions in message text
  const renderMessageText = (text: string) => {
    const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
    return parts.map((part, i) => {
      const isMention = collaborators.some(c => part === `@${c.full_name}`);
      if (isMention) {
        const mentionsMe = part === `@${currentUserName}`;
        return (
          <span
            key={i}
            className={cn(
              "font-semibold rounded px-1",
              mentionsMe
                ? "bg-[hsl(var(--energy)/0.18)] text-[hsl(var(--energy))] ring-1 ring-[hsl(var(--energy)/0.4)]"
                : "text-primary",
            )}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Quick check: does this message @ me?
  const messageMentionsMe = (text: string) =>
    !!currentUserName && text.includes(`@${currentUserName}`);

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach((msg) => {
    const dateStr = new Date(msg.created_at).toLocaleDateString();
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup?.date === dateStr) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: dateStr, messages: [msg] });
    }
  });

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full touch-pan-y">
        {/* Pinned Messages Banner */}
        {pinnedMessages.length > 0 && (
          <div className="border-b border-border bg-accent/30 px-4 py-2 shrink-0">
            <button
              onClick={() => setShowPinned(!showPinned)}
              className="flex items-center gap-2 text-xs font-medium text-foreground w-full"
            >
              <Pin className="h-3.5 w-3.5 text-primary" />
              <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
              <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showPinned && "rotate-180")} />
            </button>
            {showPinned && (
              <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                {pinnedMessages.map(pm => (
                  <div key={pm.id} className="text-xs text-muted-foreground bg-background/60 rounded-md px-3 py-2 flex items-start gap-2">
                    <span className="font-medium text-foreground shrink-0">{pm.profiles?.full_name || 'Unknown'}:</span>
                    <span className="truncate">{pm.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Start the conversation</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Share ideas, updates, and files with your team. Use @mentions to tag teammates.
              </p>
            </div>
          ) : (
            <div className="space-y-6 py-4 px-2">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground font-medium">{group.date}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-1">
                    {group.messages.map((msg) => {
                      const isOwn = msg.user_id === currentUserId;
                      const replyMsg = getReplyMessage(msg.reply_to);
                      const msgReactions = getReactionsForMessage(msg.id);
                      const isHovered = hoveredMessage === msg.id;
                      const mentionsMe = !isOwn && messageMentionsMe(msg.message);

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "group relative px-2 py-1.5 rounded-lg transition-colors",
                            isHovered && "bg-accent/30",
                            mentionsMe && "border-l-2 border-[hsl(var(--energy))] bg-[hsl(var(--energy)/0.06)] pl-3",
                          )}
                          onMouseEnter={() => setHoveredMessage(msg.id)}
                          onMouseLeave={() => setHoveredMessage(null)}
                        >
                          {mentionsMe && (
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--energy))] mb-1 ml-11">
                              Mentioned you
                            </p>
                          )}
                          {/* Reply context */}
                          {replyMsg && (
                            <div className={cn("flex items-center gap-2 mb-1 ml-11 text-xs text-muted-foreground")}>
                              <Reply className="h-3 w-3 rotate-180" />
                              <span className="font-medium">{replyMsg.profiles?.full_name || 'Unknown'}</span>
                              <span className="truncate max-w-[200px]">{replyMsg.message}</span>
                            </div>
                          )}

                          <div className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                              <AvatarImage src={msg.profiles?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">{msg.profiles?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">{isOwn ? 'You' : msg.profiles?.full_name || 'Unknown'}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                </span>
                                {msg.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                              </div>
                              {editingMessage?.id === msg.id ? (
                                <div className="flex gap-2 mt-0.5">
                                  <Input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleEditMessage(); if (e.key === 'Escape') { setEditingMessage(null); setEditText(""); } }}
                                    className="h-8 text-sm"
                                    autoFocus
                                  />
                                  <Button size="sm" onClick={handleEditMessage} className="h-8 px-2 text-xs">Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingMessage(null); setEditText(""); }} className="h-8 px-2 text-xs">Cancel</Button>
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed mt-0.5">
                                  {renderMessageText(msg.message)}
                                </p>
                              )}

                              {/* Voice note */}
                              {msg.voice_url && (
                                <div className="mt-2 space-y-1 max-w-[280px]">
                                  <audio src={msg.voice_url} controls className="h-9 w-full" />
                                  {msg.voice_transcript === null || msg.voice_transcript === undefined ? (
                                    <p className="text-[11px] text-muted-foreground italic">Transcribing…</p>
                                  ) : msg.voice_transcript ? (
                                    <details className="text-xs text-muted-foreground">
                                      <summary className="cursor-pointer hover:text-foreground">Show transcript</summary>
                                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{msg.voice_transcript}</p>
                                    </details>
                                  ) : null}
                                </div>
                              )}

                              {/* Attachments */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {msg.attachments.map((att, i) => (
                                    <ChatAttachment key={i} url={att.url} name={att.name} type={att.type} />
                                  ))}
                                </div>
                              )}

                              {/* Reactions display */}
                              {msgReactions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {msgReactions.map(r => (
                                    <button
                                      key={r.emoji}
                                      onClick={() => toggleReaction(msg.id, r.emoji)}
                                      className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                                        r.hasOwn
                                          ? "bg-primary/10 border-primary/30 text-primary"
                                          : "bg-muted/50 border-border hover:bg-accent"
                                      )}
                                    >
                                      <span>{r.emoji}</span>
                                      <span className="font-medium">{r.count}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Contextual action chips (approve/contract/invoice/task/upload) */}
                              <ChatActionChips
                                message={msg.message}
                                hasAttachments={!!msg.attachments && msg.attachments.length > 0}
                              />
                            </div>

                            {/* Hover action bar */}
                            {isHovered && (
                              <div className="absolute right-2 -top-3 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-sm px-1 py-0.5 z-10">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="p-1 hover:bg-accent rounded transition-colors">
                                      <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-2" side="top" align="center">
                                    <div className="flex gap-1">
                                      {QUICK_EMOJIS.map(emoji => (
                                        <button
                                          key={emoji}
                                          onClick={() => toggleReaction(msg.id, emoji)}
                                          className="hover:bg-accent p-1.5 rounded transition-transform hover:scale-125 text-lg"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="p-1 hover:bg-accent rounded transition-colors">
                                      <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><p className="text-xs">Reply</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => togglePin(msg.id, !!msg.is_pinned)} className="p-1 hover:bg-accent rounded transition-colors">
                                      {msg.is_pinned
                                        ? <PinOff className="h-3.5 w-3.5 text-primary" />
                                        : <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                                      }
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><p className="text-xs">{msg.is_pinned ? 'Unpin' : 'Pin'}</p></TooltipContent>
                                </Tooltip>
                                {isOwn && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="p-1 hover:bg-accent rounded transition-colors">
                                        <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="top">
                                      <DropdownMenuItem onClick={() => { setEditingMessage(msg); setEditText(msg.message); }}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMessage(msg.id)}>
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Live typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 pt-1.5 pb-0.5 shrink-0 bg-background">
            <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-[hsl(var(--energy))] animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1 w-1 rounded-full bg-[hsl(var(--energy))] animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1 w-1 rounded-full bg-[hsl(var(--energy))] animate-bounce" />
              </span>
              <span className="font-medium">
                {typingUsers.length === 1
                  ? `${typingUsers[0].full_name.split(" ")[0]} is typing…`
                  : typingUsers.length === 2
                    ? `${typingUsers[0].full_name.split(" ")[0]} & ${typingUsers[1].full_name.split(" ")[0]} are typing…`
                    : `${typingUsers.length} people are typing…`}
              </span>
            </div>
          </div>
        )}

        {/* Reply Preview */}
        {replyTo && (
          <div className="border-t border-border bg-accent/30 px-4 py-2 flex items-center gap-3 shrink-0">
            <Reply className="h-4 w-4 text-primary shrink-0 rotate-180" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">{replyTo.profiles?.full_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.message}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-accent rounded-md">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Message Input */}
        <div className="border-t border-border p-3 mt-auto shrink-0 bg-background">
          {/* Pending attachments preview */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg border border-border bg-muted/40 text-xs">
                  {att.type?.startsWith("image/") ? <ImageIcon className="h-3 w-3 text-muted-foreground" /> : <FileIcon className="h-3 w-3 text-muted-foreground" />}
                  <span className="truncate max-w-[140px]">{att.name}</span>
                  <button onClick={() => setPendingAttachments(p => p.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-accent rounded">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            {/* @Mention autocomplete — in-studio members + invite-from-search */}
            {showMentions && (mentionItems.length > 0 || mentionInviting) && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-20 max-h-72 overflow-y-auto">
                {mentionItems.map((item, i) => {
                  const isActive = i === mentionIndex;
                  if (item.kind === "collab") {
                    return (
                      <button
                        key={`c-${item.collab.id}`}
                        onClick={() => pickMentionItem(item)}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                          isActive && "bg-accent",
                        )}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={item.collab.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">{item.collab.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium flex-1 truncate">{item.collab.full_name}</span>
                        <span className="text-[10px] text-muted-foreground">In studio</span>
                      </button>
                    );
                  }
                  if (item.kind === "invite-user") {
                    return (
                      <button
                        key={`u-${item.collab.id}`}
                        onClick={() => pickMentionItem(item)}
                        disabled={mentionInviting}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-t border-border/50",
                          isActive && "bg-accent",
                        )}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={item.collab.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">{item.collab.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium flex-1 truncate">{item.collab.full_name}</span>
                        <span className="text-[10px] font-bold text-primary">+ Add to studio</span>
                      </button>
                    );
                  }
                  // invite-email
                  return (
                    <button
                      key="invite-email"
                      onClick={() => pickMentionItem(item)}
                      disabled={mentionInviting}
                      className={cn(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-t border-border/50",
                        isActive && "bg-accent",
                      )}
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">@</div>
                      <span className="flex-1 truncate">
                        <span className="font-medium">Invite</span>{" "}
                        <span className="text-muted-foreground">{item.email}</span>
                      </span>
                      <span className="text-[10px] font-bold text-primary">+ Email invite</span>
                    </button>
                  );
                })}
                {mentionInviting && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-t border-border/50">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Inviting…
                  </div>
                )}
                {mentionItems.length === 0 && mentionQuery.length >= 2 && !mentionEmail && !mentionInviting && (
                  <div className="px-3 py-3 text-xs text-muted-foreground">
                    No one named "{mentionQuery}" — type a full email to invite by mail.
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles}
                aria-label="Attach files"
              >
                {uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <VoiceNoteRecorder onSend={handleSendVoiceNote} disabled={sending} />
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  placeholder={replyTo ? "Reply..." : "Type a message... Use @ to mention"}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  className="pr-10 rounded-xl bg-muted/50 border-border/50"
                />
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={sending || (!newMessage.trim() && pendingAttachments.length === 0)}
                size="icon"
                className="rounded-xl shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
