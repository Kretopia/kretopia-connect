import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import { Send, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface Props {
  roomId: string;
  currentUserId: string;
  /** When true, shows a compact "open in messages" link instead of the inline chat (post-event). */
  archived?: boolean;
}

interface Msg {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name?: string | null; avatar_url?: string | null };
}

/**
 * Lightweight inline chat for an event page.
 * - Reads/writes spark_room_messages for the event's group chat room.
 * - Shows a simple thread + composer (no media, no replies — keep focused).
 * - When `archived` is true, shows a CTA to continue in the Messages inbox.
 */
export const EventInlineChat = ({ roomId, currentUserId, archived = false }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hydrate = async (rows: any[]): Promise<Msg[]> => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (!ids.length) return rows as Msg[];
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", ids);
    const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
    return rows.map((r) => ({ ...r, profile: map.get(r.user_id) }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Ensure membership so RLS lets us read & post (idempotent — duplicate ignored)
      await supabase
        .from("spark_room_members")
        .insert({ room_id: roomId, user_id: currentUserId, role: "member" })
        .then(() => {}, () => {});

      const { data } = await supabase
        .from("spark_room_messages")
        .select("id, user_id, content, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      const hydrated = await hydrate(data || []);
      setMessages(hydrated);
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    })().catch(() => setLoading(false));

    if (archived) return; // no realtime when archived

    const ch = supabase
      .channel(`event-chat-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "spark_room_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const m = payload.new as any;
          const [hydrated] = await hydrate([m]);
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, hydrated]));
          requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [roomId, archived, currentUserId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase
      .from("spark_room_messages")
      .insert({ room_id: roomId, user_id: currentUserId, content: text, message_type: "text" });
    setSending(false);
    if (error) {
      toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
  };

  if (archived) {
    return (
      <Card className="mb-6">
        <CardContent className="p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">Event chat moved to Messages</p>
            <p className="text-xs text-muted-foreground">Keep the conversation going with everyone you met.</p>
          </div>
          <Button onClick={() => navigate(`/messages/${roomId}`)} variant="outline" className="shrink-0">
            Open chat <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 overflow-hidden border-energy/30">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-energy/5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
            <p className="font-semibold text-sm">Event chat</p>
          </div>
          <button
            onClick={() => navigate(`/messages/${roomId}`)}
            className="text-xs text-muted-foreground hover:text-energy inline-flex items-center gap-1"
          >
            Full screen <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        <div ref={scrollRef} className="h-[340px] overflow-y-auto">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="text-3xl mb-2">👋</div>
                <p className="font-semibold text-sm mb-1">The room's quiet — break the ice</p>
                <p className="text-xs text-muted-foreground">
                  Drop a hello, share what you're bringing, or ask who's coming through.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.user_id === currentUserId;
                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={m.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(m.profile?.full_name || "?").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && (
                        <p className="text-[11px] text-muted-foreground mb-0.5 px-1">
                          {m.profile?.full_name || "Guest"}
                        </p>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          mine ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {m.content}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <Input
            placeholder="Message the group…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending}
          />
          <Button onClick={send} disabled={!draft.trim() || sending} size="icon">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
