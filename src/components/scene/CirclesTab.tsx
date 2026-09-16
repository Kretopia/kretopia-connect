import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, MessageSquare, Users, Search, Send, ArrowLeft,
  Share2, Lock, Globe, Reply, Check, Settings, Pin, Crown,
  DollarSign, Calendar,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CircleCard, type CircleData } from "@/components/circle/CircleCard";
import { CircleMessageBubble, type CircleMessage } from "@/components/circle/CircleMessageBubble";
import { CircleAdminPanel } from "@/components/circle/CircleAdminPanel";
import { useNavigate } from "react-router-dom";

const CIRCLE_CATEGORIES = [
  { value: "general", label: "General", emoji: "" },
  { value: "music", label: "Music", emoji: "" },
  { value: "film", label: "Film & Video", emoji: "" },
  { value: "design", label: "Design", emoji: "" },
  { value: "photo", label: "Photography", emoji: "" },
  { value: "tech", label: "Creative Tech", emoji: "" },
  { value: "business", label: "Creator Biz", emoji: "" },
  { value: "collab", label: "Collabs", emoji: "" },
  { value: "feedback", label: "Feedback", emoji: "" },
  { value: "podcast", label: "Podcasters", emoji: "🎙" },
  { value: "writing", label: "Writers", emoji: "✍" },
  { value: "events", label: "Events & Culture", emoji: "" },
];

const REACTION_EMOJIS = ["", "❤", "🙌", "💯", "😂", ""];

export const CirclesTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<CircleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCircle, setSelectedCircle] = useState<CircleData | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCircles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roomsData } = await supabase
        .from("spark_rooms")
        .select("*")
        .eq("is_active", true)
        .order("member_count", { ascending: false });

      if (!roomsData?.length) { setCircles([]); setLoading(false); return; }

      const creatorIds = [...new Set(roomsData.map(r => r.created_by))];
      const [profilesRes, membershipsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", creatorIds),
        user ? supabase.from("spark_room_members").select("room_id, role").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const memberMap = new Map((membershipsRes.data as any[])?.map(m => [m.room_id, m.role]) || []);

      setCircles(roomsData.map(r => ({
        ...r,
        icon_emoji: r.icon_emoji || "",
        is_private: r.is_private || false,
        is_paid: r.is_paid || false,
        price_monthly: r.price_monthly || 0,
        currency: r.currency || "USD",
        circle_type: r.circle_type || "community",
        invite_code: r.invite_code || null,
        rules: r.rules || null,
        cover_url: r.cover_url || null,
        creator_name: profileMap.get(r.created_by)?.full_name || "Unknown",
        creator_avatar: profileMap.get(r.created_by)?.avatar_url || undefined,
        is_member: memberMap.has(r.id),
        user_role: memberMap.get(r.id) || undefined,
      })));
    } catch (err) {
      console.error("Error fetching circles:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCircles(); }, [fetchCircles]);

  const filteredCircles = circles.filter(c =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedCircle) {
    return (
      <CircleDetail 
        circle={selectedCircle} 
        onBack={() => { setSelectedCircle(null); fetchCircles(); }} 
        onOpenFullPage={() => navigate(`/circle/${selectedCircle.id}`)}
      />
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search circles..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-muted/50" />
        </div>
        <CreateCircleDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchCircles} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filteredCircles.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="font-semibold mb-1">No circles yet</p>
          <p className="text-sm text-muted-foreground mb-4">Start a conversation with the community</p>
          <Button variant="gradient" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" /> Create Circle</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCircles.map(circle => (
            <CircleCard key={circle.id} circle={circle} onClick={() => setSelectedCircle(circle)} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Circle Detail with rich messaging, pinning, admin controls ───
const CircleDetail = ({ circle, onBack, onOpenFullPage }: { circle: CircleData; onBack: () => void; onOpenFullPage?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(circle.is_member || false);
  const [replyTo, setReplyTo] = useState<CircleMessage | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [userRole, setUserRole] = useState(circle.user_role || "member");
  const [circleEvents, setCircleEvents] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === "admin" || circle.created_by === user?.id;
  const isMod = isAdmin || userRole === "moderator";

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("spark_room_messages")
      .select("*")
      .eq("room_id", circle.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data?.length) {
      const userIds = [...new Set(data.map(m => m.user_id))];
      const replyIds = data.filter(m => m.reply_to_id).map(m => m.reply_to_id);

      const [profilesRes, reactionsRes, repliesRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds),
        supabase.from("spark_message_reactions").select("*").in("message_id", data.map(m => m.id)),
        replyIds.length > 0
          ? supabase.from("spark_room_messages").select("id, content, user_id").in("id", replyIds)
          : Promise.resolve({ data: [] }),
        supabase.from("spark_room_members").select("user_id, role").eq("room_id", circle.id).in("user_id", userIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const roleMap = new Map((membersRes.data as any[])?.map(m => [m.user_id, m.role]) || []);

      const reactionsMap = new Map<string, Record<string, string[]>>();
      reactionsRes.data?.forEach((r: any) => {
        if (!reactionsMap.has(r.message_id)) reactionsMap.set(r.message_id, {});
        const map = reactionsMap.get(r.message_id)!;
        if (!map[r.emoji]) map[r.emoji] = [];
        map[r.emoji].push(r.user_id);
      });

      const replyMap = new Map(
        (repliesRes.data || []).map((r: any) => [r.id, {
          content: r.content?.substring(0, 60) || "",
          sender_name: profileMap.get(r.user_id)?.full_name || "Unknown",
        }])
      );

      setMessages(data.map(m => ({
        ...m,
        message_type: m.message_type || "text",
        reply_to_id: m.reply_to_id || null,
        poll_data: m.poll_data || null,
        media_type: m.media_type || null,
        is_pinned: m.is_pinned || false,
        sender_name: profileMap.get(m.user_id)?.full_name || "Unknown",
        sender_avatar: profileMap.get(m.user_id)?.avatar_url || undefined,
        sender_role: roleMap.get(m.user_id) || "member",
        reactions: reactionsMap.get(m.id) || {},
        reply_preview: m.reply_to_id ? (replyMap.get(m.reply_to_id) || null) : null,
      })));
    } else {
      setMessages([]);
    }
    setLoading(false);
  }, [circle.id]);

  // Fetch events linked to this circle
  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("creative_jams")
        .select("id, title, start_time, status")
        .eq("circle_id", circle.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(3);
      setCircleEvents(data || []);
    };
    fetchEvents();
  }, [circle.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`circle-${circle.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spark_room_messages", filter: `room_id=eq.${circle.id}` }, () => fetchMessages())
      .on("postgres_changes", { event: "*", schema: "public", table: "spark_message_reactions" }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [circle.id, fetchMessages]);

  // Check for successful paid circle join from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinedCircleId = params.get('joined');
    const sessionId = params.get('session_id');
    if (joinedCircleId === circle.id && sessionId) {
      // Verify payment and grant membership
      const verifyPayment = async () => {
        try {
          const { error } = await supabase.functions.invoke('verify-circle-payment', {
            body: { circleId: circle.id, sessionId },
          });
          if (!error) {
            setIsMember(true);
            setUserRole("member");
            toast({ title: "Welcome!", description: `You're now a member of ${circle.title}` });
            // Clean up URL params
            window.history.replaceState({}, '', window.location.pathname + '?tab=circles');
          }
        } catch (err) {
          console.error("Error verifying circle payment:", err);
        }
      };
      verifyPayment();
    }
  }, [circle.id]);

  const joinCircle = async () => {
    if (!user) return;
    // For paid circles, redirect to Stripe checkout via KrePay
    if (circle.is_paid && circle.price_monthly > 0) {
      try {
        toast({ title: "Redirecting to payment...", description: `$${circle.price_monthly}/mo for ${circle.title}` });
        const { data, error } = await supabase.functions.invoke('join-paid-circle', {
          body: { circleId: circle.id },
        });
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, '_blank');
        }
      } catch (err: any) {
        const msg = err?.message || "Payment failed";
        toast({
          title: "Payment Error",
          description: msg.includes("KrePay") ? msg : "Could not start payment. Please try again.",
          variant: "destructive",
        });
      }
      return;
    }
    await supabase.from("spark_room_members").insert({ room_id: circle.id, user_id: user.id });
    // Send a system-style welcome message in the circle
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const memberName = profile?.full_name || "A new member";
    await supabase.from("spark_room_messages").insert({
      room_id: circle.id,
      user_id: user.id,
      content: `${memberName} just joined the circle! Welcome aboard!`,
      message_type: "system",
    });
    // Send auto-welcome DM if the circle has one configured
    try {
      const { data: roomData } = await supabase
        .from("spark_rooms")
        .select("welcome_message, created_by")
        .eq("id", circle.id)
        .single();
      if (roomData?.welcome_message && roomData.created_by !== user.id) {
        await supabase.from("messages").insert({
          sender_id: roomData.created_by,
          receiver_id: user.id,
          content: roomData.welcome_message,
        });
      }
    } catch (e) {
      console.error("Welcome DM failed:", e);
    }
    setIsMember(true);
    setUserRole("member");
    toast({ title: "Welcome!", description: `You're now in ${circle.title}` });
  };

  const sendMessage = async () => {
    if (!user || !newMessage.trim() || sending || !isMember) return;
    setSending(true);
    await supabase.from("spark_room_messages").insert({
      room_id: circle.id,
      user_id: user.id,
      content: newMessage.trim(),
      reply_to_id: replyTo?.id || null,
      message_type: "text",
    });
    setNewMessage("");
    setReplyTo(null);
    setSending(false);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    if (!isMember) {
      toast({ title: "Join required", description: "You must join this circle first", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `circles/${circle.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) { toast({ title: "Upload failed", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    const mediaType = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
    await supabase.from("spark_room_messages").insert({
      room_id: circle.id, user_id: user.id, content: "",
      media_url: urlData.publicUrl, media_type: mediaType, message_type: "media",
    });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === messageId);
    const hasReacted = msg?.reactions?.[emoji]?.includes(user.id);
    if (hasReacted) {
      await supabase.from("spark_message_reactions").delete()
        .eq("message_id", messageId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      await supabase.from("spark_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
    setShowReactions(null);
  };

  const pinMessage = async (messageId: string, pin: boolean) => {
    await supabase.from("spark_room_messages")
      .update({ is_pinned: pin, pinned_by: pin ? user?.id : null })
      .eq("id", messageId);
    fetchMessages();
    toast({ title: pin ? "Message pinned" : "Message unpinned" });
  };

  const shareCircle = async () => {
    const url = `https://www.kretopia.com/circle?tab=circles&circle=${circle.invite_code || circle.id}`;
    const shareText = `Join "${circle.title}" on Kretopia — where creatives connect, collaborate, and grow together \n\n${url}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (navigator.share) {
        await navigator.share({ title: circle.title, text: shareText, url });
      } else {
        toast({ title: "Link copied!", description: "Share it with others" });
      }
    } catch {
      toast({ title: "Link copied!", description: "Share it with others" });
    }
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border/50">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
          {circle.icon_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm truncate">{circle.title}</h2>
            {circle.is_private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
            {circle.is_paid && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/50 text-amber-600">
                <DollarSign className="h-2.5 w-2.5" />{circle.price_monthly}/mo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{circle.member_count} members</p>
        </div>
        <div className="flex items-center gap-1">
          {pinnedMessages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPinned(!showPinned)}>
              <Pin className="h-4 w-4 text-amber-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={shareCircle}>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAdmin(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {onOpenFullPage && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={onOpenFullPage}>
              Full View
            </Button>
          )}
          {!isMember && (
            <Button size="sm" variant="gradient" onClick={joinCircle}>
              {circle.is_paid ? `$${circle.price_monthly}/mo` : "Join"}
            </Button>
          )}
        </div>
      </div>

      {/* Upcoming events banner */}
      {circleEvents.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-2 px-1 border-b border-border/30">
          {circleEvents.map(event => (
            <button
              key={event.id}
              onClick={() => navigate(`/events/${event.id}`)}
              className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-1.5 shrink-0 hover:bg-primary/10 transition-colors"
            >
              <Calendar className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium truncate max-w-[120px]">{event.title}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(event.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 p-2 space-y-1 max-h-32 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold flex items-center gap-1 text-amber-700">
              <Pin className="h-3 w-3" /> Pinned ({pinnedMessages.length})
            </p>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowPinned(false)}>
              <span className="text-xs">✕</span>
            </Button>
          </div>
          {pinnedMessages.map(pm => (
            <div key={pm.id} className="text-xs text-muted-foreground truncate">
              <span className="font-medium text-foreground">{pm.sender_name}:</span> {pm.content}
            </div>
          ))}
        </div>
      )}

      {/* Circle rules (if any) */}
      {circle.rules && isMember && messages.length === 0 && (
        <Card className="mx-1 mt-2 p-3 border-primary/10 bg-primary/5">
          <p className="text-xs font-semibold mb-1">Circle Rules</p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">{circle.rules}</p>
        </Card>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => (
            <CircleMessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.user_id === user?.id}
              userId={user?.id}
              onReply={setReplyTo}
              onReact={(id) => setShowReactions(showReactions === id ? null : id)}
              onToggleReaction={toggleReaction}
              showReactions={showReactions}
              isAdmin={isMod}
              onPin={isMod ? pinMessage : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border/30 bg-muted/30">
          <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground truncate flex-1">
            Replying to <span className="font-medium text-foreground">{replyTo.sender_name}</span>: {replyTo.content?.substring(0, 50)}
          </p>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyTo(null)}>
            <span className="text-xs">✕</span>
          </Button>
        </div>
      )}

      {/* Input area - only for members */}
      {isMember ? <div className="flex gap-2 pt-3 border-t border-border/50">
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleMediaUpload} />
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()}>
          <Plus className="h-4 w-4" />
        </Button>
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          className="flex-1 h-9"
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={!newMessage.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div> : (
        <div className="flex items-center justify-center py-3 border-t border-border/50">
          <Button size="sm" variant="gradient" onClick={joinCircle}>
            {circle.is_paid ? `Join • $${circle.price_monthly}/mo` : "Join to chat"}
          </Button>
        </div>
      )}

      {/* Admin Panel */}
      {showAdmin && <CircleAdminPanel circle={circle} onClose={() => setShowAdmin(false)} />}
    </div>
  );
};

// ─── Create Crew Dialog ───
export const CreateCircleDialog = ({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [rules, setRules] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedCat = CIRCLE_CATEGORIES.find(c => c.value === category);

  const handleCoverUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `crew-covers/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      setCoverUrl(data.publicUrl);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.from("spark_rooms").insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        icon_emoji: selectedCat?.emoji || "",
        is_private: isPrivate || isPaid,
        is_paid: isPaid,
        price_monthly: isPaid ? parseFloat(price) || 0 : 0,
        rules: rules.trim() || null,
        cover_url: coverUrl,
        created_by: user.id,
      }).select().single();

      if (error) throw error;
      if (data) {
        await supabase.from("spark_room_members").insert({ room_id: data.id, user_id: user.id, role: "admin" });
        await supabase.from("circle_channels").insert({
          circle_id: data.id,
          name: "general",
          channel_type: "text",
          icon_emoji: "",
          position: 0,
          is_default: true,
          created_by: user.id,
        } as any);
      }
      toast({ title: "Crew created!", description: `${title} is live` });
      setTitle(""); setDescription(""); setCategory("general"); setIsPrivate(false); setIsPaid(false); setPrice(""); setRules(""); setCoverUrl(null);
      onOpenChange(false);
      onCreated();
    } catch {
      toast({ title: "Error", description: "Couldn't create Crew", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create a Crew</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Cover upload */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cover image</p>
            <label className="block relative h-28 w-full rounded-xl overflow-hidden border-2 border-dashed border-border/60 hover:border-primary/40 cursor-pointer transition-colors group">
              {coverUrl ? (
                <>
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                    Change cover
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
                  {uploadingCover ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      <span className="text-xs">Add a cover</span>
                    </>
                  )}
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }}
                disabled={uploadingCover}
              />
            </label>
          </div>

          <Input placeholder="Crew name..." value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
          <Textarea placeholder="What's this Crew about? (optional)" value={description} onChange={e => setDescription(e.target.value)} maxLength={300} className="min-h-[80px]" />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CIRCLE_CATEGORIES.map(cat => (
                <Button key={cat.value} variant={category === cat.value ? "default" : "outline"} size="sm" className="text-xs h-7 rounded-full gap-1" onClick={() => setCategory(cat.value)}>
                  {cat.emoji} {cat.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant={isPrivate ? "default" : "outline"} size="sm" className="gap-1.5 text-xs h-7 rounded-full" onClick={() => setIsPrivate(!isPrivate)}>
              {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {isPrivate ? "Private" : "Public"}
            </Button>
            <Button variant={isPaid ? "default" : "outline"} size="sm" className="gap-1.5 text-xs h-7 rounded-full" onClick={() => setIsPaid(!isPaid)}>
              <DollarSign className="h-3 w-3" />
              {isPaid ? "Paid" : "Free"}
            </Button>
          </div>

          {isPaid && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Monthly price (USD)"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="h-8"
                min="1"
              />
              <span className="text-xs text-muted-foreground">/mo</span>
            </div>
          )}

          <Textarea
            placeholder="Crew rules or guidelines (optional)"
            value={rules}
            onChange={e => setRules(e.target.value)}
            maxLength={500}
            className="min-h-[60px]"
          />

          <Button className="w-full" variant="gradient" onClick={handleCreate} disabled={!title.trim() || creating || (isPaid && !price)}>
            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isPaid ? `Create paid Crew • $${price || '0'}/mo` : "Create Crew"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
