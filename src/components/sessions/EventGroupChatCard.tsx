import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Loader2, ArrowRight, UserPlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Props {
  eventId: string;
  eventTitle: string;
  isHost: boolean;
  isParticipant: boolean;
  hostId: string;
  groupChatEnabled: boolean;
  groupChatRoomId: string | null;
  onChange?: (next: { enabled: boolean; roomId: string | null }) => void;
}

/**
 * Host-controlled Group Chat for an event.
 * - Host toggles ON/OFF
 * - When ON: opt-in "Join group chat" for RSVPs
 * - Deep-link into Messages
 */
export const EventGroupChatCard = ({
  eventId, eventTitle, isHost, isParticipant, hostId,
  groupChatEnabled, groupChatRoomId, onChange,
}: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!groupChatRoomId) { setIsMember(false); setMemberCount(0); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: mine }, { count }] = await Promise.all([
        supabase.from("spark_room_members").select("id").eq("room_id", groupChatRoomId).eq("user_id", user.id).maybeSingle(),
        supabase.from("spark_room_members").select("id", { count: "exact", head: true }).eq("room_id", groupChatRoomId),
      ]);
      setIsMember(!!mine);
      setMemberCount(count || 0);
    })().catch(() => {});
  }, [groupChatRoomId]);

  const ensureRoom = async (): Promise<string | null> => {
    if (groupChatRoomId) {
      // Room already exists — just flip the enabled flag back on
      await supabase.from("creative_jams").update({ group_chat_enabled: true }).eq("id", eventId);
      onChange?.({ enabled: true, roomId: groupChatRoomId });
      return groupChatRoomId;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: room, error } = await supabase
      .from("spark_rooms")
      .insert({
        title: eventTitle,
        created_by: hostId,
        is_private: true,
        circle_type: "group",
        category: "event",
        icon_emoji: "🎟️",
        description: `Group chat for the event "${eventTitle}".`,
      })
      .select()
      .single();
    if (error || !room) throw error || new Error("Could not create chat");
    // Add host as owner
    await supabase.from("spark_room_members").insert({ room_id: room.id, user_id: hostId, role: "owner" });
    // Link to event
    await supabase.from("creative_jams").update({ group_chat_enabled: true, group_chat_room_id: room.id }).eq("id", eventId);
    onChange?.({ enabled: true, roomId: room.id });
    return room.id;
  };

  const handleToggle = async (next: boolean) => {
    if (!isHost) return;
    setBusy(true);
    try {
      if (next) {
        await ensureRoom();
        toast({ title: "Group chat is on", description: "RSVPs can now opt in to join." });
      } else {
        await supabase.from("creative_jams").update({ group_chat_enabled: false }).eq("id", eventId);
        onChange?.({ enabled: false, roomId: groupChatRoomId });
        toast({ title: "Group chat paused", description: "History is kept. Turn it back on anytime." });
      }
    } catch (e: any) {
      toast({ title: "Couldn't update chat", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!groupChatRoomId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("spark_room_members")
        .insert({ room_id: groupChatRoomId, user_id: user.id, role: "member" });
      if (error && !error.message.includes("duplicate")) throw error;
      setIsMember(true);
      setMemberCount((c) => c + 1);
      toast({ title: "You're in", description: "Opening the group chat…" });
      navigate(`/messages/${groupChatRoomId}`);
    } catch (e: any) {
      toast({ title: "Couldn't join chat", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleAddAllRsvps = async () => {
    if (!isHost || !groupChatRoomId) return;
    setBusy(true);
    try {
      // 1. Get all RSVPs (going + interested)
      const { data: parts, error: pErr } = await supabase
        .from("jam_participants")
        .select("user_id")
        .eq("jam_id", eventId)
        .in("status", ["going", "interested"]);
      if (pErr) throw pErr;

      const rsvpIds = Array.from(new Set([hostId, ...(parts || []).map((p: any) => p.user_id).filter(Boolean)]));
      if (rsvpIds.length === 0) {
        toast({ title: "No guests yet", description: "Once people RSVP you can add them." });
        return;
      }

      // 2. Find who's already in the chat
      const { data: existing } = await supabase
        .from("spark_room_members")
        .select("user_id")
        .eq("room_id", groupChatRoomId)
        .in("user_id", rsvpIds);
      const existingIds = new Set((existing || []).map((m: any) => m.user_id));
      const toAdd = rsvpIds.filter((id) => !existingIds.has(id));

      if (toAdd.length === 0) {
        toast({ title: "Everyone's already in", description: "All RSVPs are members of the chat." });
        return;
      }

      // 3. Add as members
      const memberRows = toAdd.map((uid) => ({
        room_id: groupChatRoomId,
        user_id: uid,
        role: uid === hostId ? "owner" : "member",
      }));
      const { error: insErr } = await supabase.from("spark_room_members").insert(memberRows);
      if (insErr && !insErr.message.includes("duplicate")) throw insErr;

      // 4. Notify everyone (except host) so they know
      const notifyIds = toAdd.filter((id) => id !== hostId);
      if (notifyIds.length > 0) {
        const notifs = notifyIds.map((uid) => ({
          user_id: uid,
          title: `You've been added to the chat for "${eventTitle}"`,
          message: "Tap to say hi to the host and other guests.",
          type: "event_update",
          action_url: `/messages/${groupChatRoomId}`,
        }));
        try { await supabase.from("notifications").insert(notifs); } catch { /* non-blocking */ }
      }

      setMemberCount((c) => c + toAdd.length);
      setIsMember(true);
      toast({
        title: `Added ${toAdd.length} guest${toAdd.length === 1 ? "" : "s"}`,
        description: "They've been notified.",
      });
    } catch (e: any) {
      toast({ title: "Couldn't add guests", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openChat = () => groupChatRoomId && navigate(`/messages/${groupChatRoomId}`);

  // Hidden entirely from non-hosts when chat is off
  if (!isHost && !groupChatEnabled) return null;

  return (
    <Card className={`mb-6 transition-colors ${groupChatEnabled ? "border-energy/40" : ""}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${groupChatEnabled ? "bg-energy/15" : "bg-primary/10"}`}>
              <MessageCircle className={`h-5 w-5 ${groupChatEnabled ? "text-energy" : "text-primary"}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight flex items-center gap-2">
                Group chat
                {groupChatEnabled && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-energy">Live</span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isHost
                  ? (groupChatEnabled ? "Chat is live below — RSVPs can jump in." : "Turn on to give your guests a private chat.")
                  : (groupChatEnabled ? `${memberCount} in the chat — scroll down to say hi` : "Waiting on the host to open the chat")}
              </p>
            </div>
          </div>

          {isHost && (
            <div className="flex items-center gap-2 shrink-0">
              {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch checked={groupChatEnabled} onCheckedChange={handleToggle} disabled={busy} />
            </div>
          )}
        </div>

        {/* Host: bulk-add all RSVPs */}
        {isHost && groupChatEnabled && groupChatRoomId && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 flex items-center gap-3">
            <UserPlus2 className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">Add all RSVPs to the chat</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pulls every "going" guest in and notifies them. Safe to re-run.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddAllRsvps} disabled={busy} className="shrink-0">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add all"}
            </Button>
          </div>
        )}

        {/* Status hint — chat renders inline below this card */}
        {groupChatEnabled && !isHost && !isParticipant && (
          <p className="text-xs text-muted-foreground text-center">RSVP to join the group chat.</p>
        )}
      </CardContent>
    </Card>
  );
};
