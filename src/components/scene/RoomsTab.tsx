import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Plus, Loader2, MessageSquare, Users, Search, Send, ArrowLeft, Flame 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  title: string;
  description: string | null;
  category: string;
  cover_image_url: string | null;
  member_count: number;
  message_count: number;
  created_by: string;
  created_at: string;
  is_active: boolean;
  creator_name?: string;
  creator_avatar?: string;
  is_member?: boolean;
}

interface RoomMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  media_url: string | null;
  sender_name?: string;
  sender_avatar?: string;
}

const ROOM_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "feedback", label: "Feedback" },
  { value: "music", label: "Music" },
  { value: "film", label: "Film" },
  { value: "design", label: "Design" },
  { value: "photo", label: "Photo" },
  { value: "tech", label: "Tech" },
  { value: "collab", label: "Collabs" },
];

export const RoomsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roomsData } = await supabase
        .from("spark_rooms")
        .select("*")
        .eq("is_active", true)
        .order("message_count", { ascending: false });

      if (!roomsData?.length) { setRooms([]); setLoading(false); return; }

      const creatorIds = [...new Set(roomsData.map(r => r.created_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Check membership
      let memberRoomIds = new Set<string>();
      if (user) {
        const { data: memberships } = await supabase
          .from("spark_room_members")
          .select("room_id")
          .eq("user_id", user.id);
        memberRoomIds = new Set(memberships?.map(m => m.room_id) || []);
      }

      setRooms(roomsData.map(r => ({
        ...r,
        creator_name: profileMap.get(r.created_by)?.full_name || "Unknown",
        creator_avatar: profileMap.get(r.created_by)?.avatar_url || undefined,
        is_member: memberRoomIds.has(r.id),
      })));
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const filteredRooms = rooms.filter(r =>
    !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedRoom) {
    return (
      <RoomDetail 
        room={selectedRoom} 
        onBack={() => { setSelectedRoom(null); fetchRooms(); }} 
      />
    );
  }

  return (
    <div>
      {/* Search + Create */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50"
          />
        </div>
        <CreateRoomDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchRooms} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredRooms.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="font-semibold mb-1">No rooms yet</p>
          <p className="text-sm text-muted-foreground mb-4">Start a conversation with the community</p>
          <Button variant="gradient" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Room
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRooms.map(room => (
            <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
          ))}
        </div>
      )}
    </div>
  );
};

const RoomCard = ({ room, onClick }: { room: Room; onClick: () => void }) => {
  const categoryLabel = ROOM_CATEGORIES.find(c => c.value === room.category)?.label || "General";

  return (
    <div
      className="flex gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/5 cursor-pointer transition-all hover:shadow-md"
      onClick={onClick}
    >
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">
        {categoryLabel.split(" ")[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-sm truncate">{room.title}</h3>
          {room.is_member && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Joined</Badge>
          )}
        </div>
        {room.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{room.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {room.member_count}</span>
          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {room.message_count}</span>
          <span>by {room.creator_name}</span>
        </div>
      </div>
    </div>
  );
};

// Room Detail with messages
const RoomDetail = ({ room, onBack }: { room: Room; onBack: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(room.is_member || false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("spark_room_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data?.length) {
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setMessages(data.map(m => ({
        ...m,
        sender_name: profileMap.get(m.user_id)?.full_name || "Unknown",
        sender_avatar: profileMap.get(m.user_id)?.avatar_url || undefined,
      })));
    } else {
      setMessages([]);
    }
    setLoading(false);
  }, [room.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "spark_room_messages",
        filter: `room_id=eq.${room.id}`,
      }, () => { fetchMessages(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room.id, fetchMessages]);

  const joinRoom = async () => {
    if (!user) return;
    await supabase.from("spark_room_members").insert({ room_id: room.id, user_id: user.id });
    setIsMember(true);
    toast({ title: "Joined!", description: `You're now in ${room.title}` });
  };

  const sendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return;
    setSending(true);
    
    // Auto-join if not member
    if (!isMember) {
      await supabase.from("spark_room_members").insert({ room_id: room.id, user_id: user.id });
      setIsMember(true);
    }

    await supabase.from("spark_room_messages").insert({
      room_id: room.id,
      user_id: user.id,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Room header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/50">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{room.title}</h2>
          <p className="text-xs text-muted-foreground">{room.member_count} members</p>
        </div>
        {!isMember && (
          <Button size="sm" variant="gradient" onClick={joinRoom}>Join</Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={cn(
              "flex gap-2",
              msg.user_id === user?.id && "flex-row-reverse"
            )}>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={msg.sender_avatar || ""} />
                <AvatarFallback className="text-[10px]">{msg.sender_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className={cn(
                "max-w-[75%] rounded-xl px-3 py-2",
                msg.user_id === user?.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted"
              )}>
                {msg.user_id !== user?.id && (
                  <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.sender_name}</p>
                )}
                <p className="text-sm">{msg.content}</p>
                <p className={cn(
                  "text-[10px] mt-1 opacity-50",
                  msg.user_id === user?.id ? "text-primary-foreground" : "text-muted-foreground"
                )}>
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message input */}
      <div className="flex gap-2 pt-3 border-t border-border/50">
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          className="flex-1"
        />
        <Button 
          size="icon" 
          onClick={sendMessage} 
          disabled={!newMessage.trim() || sending}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Create Room Dialog
const CreateRoomDialog = ({ 
  open, onOpenChange, onCreated 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onCreated: () => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.from("spark_rooms").insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        created_by: user.id,
      }).select().single();

      if (error) throw error;

      // Auto-join as member
      if (data) {
        await supabase.from("spark_room_members").insert({
          room_id: data.id,
          user_id: user.id,
        });
      }

      toast({ title: "Room created!", description: `${title} is live` });
      setTitle("");
      setDescription("");
      setCategory("general");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast({ title: "Error", description: "Couldn't create room", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="gradient" size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Room
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Input
            placeholder="Room name..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
          />
          <Textarea
            placeholder="What's this room about? (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={300}
            className="min-h-[80px]"
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_CATEGORIES.map(cat => (
                <Button
                  key={cat.value}
                  variant={category === cat.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 rounded-full"
                  onClick={() => setCategory(cat.value)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
          <Button 
            className="w-full" 
            variant="gradient" 
            onClick={handleCreate} 
            disabled={!title.trim() || creating}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Room
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
