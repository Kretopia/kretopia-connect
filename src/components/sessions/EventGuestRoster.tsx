import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, MapPin, Briefcase, ExternalLink, Loader2, Check, Clock, UserPlus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Guest {
  id: string;
  user_id: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  bio: string | null;
  location: string | null;
  is_host?: boolean;
  is_guest?: boolean;
}

interface MutualInfo {
  count: number;
  names: string[];
}

interface Props {
  eventId: string;
  eventTitle: string;
  hostId: string;
  currentUserId: string | null;
  isParticipant: boolean;
  isHost: boolean;
  participantCount: number;
}

/**
 * Match/Circle-style guest roster on the event page.
 * Visible to: host + RSVP'd participants only.
 * Tap a guest -> profile preview sheet with tagged Connect button.
 */
export const EventGuestRoster = ({
  eventId, eventTitle, hostId, currentUserId, isParticipant, isHost, participantCount,
}: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Guest | null>(null);
  const [connections, setConnections] = useState<Record<string, "none" | "pending" | "accepted" | "declined" | "received">>({});
  const [mutuals, setMutuals] = useState<Record<string, MutualInfo>>({});
  const [acting, setActing] = useState(false);

  const canSee = isHost || isParticipant;

  useEffect(() => {
    if (!canSee) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const { data: parts } = await supabase
          .from("jam_participants")
          .select("id, user_id, guest_name, guest_email, joined_at")
          .eq("jam_id", eventId)
          .in("status", ["going", "interested"]);
        const participantRows = parts || [];
        const userIds = Array.from(new Set([hostId, ...participantRows.map((p) => p.user_id).filter(Boolean)])) as string[];
        const { data: profiles } = await supabase
          .from("public_profiles_safe")
          .select("user_id, full_name, username, avatar_url, role, bio, location")
          .in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        const hostProfile = profileMap.get(hostId);
        const hostGuest: Guest | null = hostProfile ? { ...hostProfile, id: `host:${hostId}`, is_host: true, is_guest: false } : null;
        const list: Guest[] = [
          ...(hostGuest ? [hostGuest] : []),
          ...participantRows.map((p) => {
            const profile = p.user_id ? profileMap.get(p.user_id) : null;
            return {
              id: p.user_id ? `user:${p.user_id}` : `guest:${p.id}`,
              user_id: p.user_id,
              full_name: profile?.full_name || p.guest_name || "Guest",
              username: profile?.username || null,
              avatar_url: profile?.avatar_url || null,
              role: profile?.role || (p.user_id ? null : "Guest RSVP"),
              bio: profile?.bio || null,
              location: profile?.location || null,
              is_host: p.user_id === hostId,
              is_guest: !p.user_id,
            } satisfies Guest;
          }).filter((g) => !g.is_host),
        ];
        setGuests(list);

        // Load connection status for current user vs each guest
        if (currentUserId) {
          const otherIds = userIds.filter((id) => id !== currentUserId);
          if (otherIds.length > 0) {
            const [{ data: out }, { data: inc }] = await Promise.all([
              supabase.from("connections").select("connected_user_id, status").eq("user_id", currentUserId).in("connected_user_id", otherIds),
              supabase.from("connections").select("user_id, status").eq("connected_user_id", currentUserId).in("user_id", otherIds),
            ]);
            const map: Record<string, any> = {};
            out?.forEach((c) => { map[c.connected_user_id] = c.status; });
            inc?.forEach((c) => {
              if (c.status === "accepted") map[c.user_id] = "accepted";
              else if (c.status === "pending" && !map[c.user_id]) map[c.user_id] = "received";
            });
            setConnections(map);

            // "You know 2: Maya, Jordan" — a real trust signal before
            // connecting, not just a bare list of strangers.
            const { data: mutualRows } = await supabase.rpc("get_mutual_connection_counts" as any, {
              p_target_ids: otherIds,
            });
            if (mutualRows) {
              const mMap: Record<string, MutualInfo> = {};
              (mutualRows as { target_id: string; mutual_count: number; sample: { full_name: string }[] | null }[]).forEach((r) => {
                mMap[r.target_id] = { count: r.mutual_count, names: (r.sample || []).map((s) => s.full_name) };
              });
              setMutuals(mMap);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })().catch(() => setLoading(false));
  }, [eventId, hostId, currentUserId, canSee]);

  const handleConnect = async (guest: Guest) => {
    if (!currentUserId) {
      navigate("/auth");
      return;
    }
    if (!guest.user_id) {
      toast({ title: "Guest RSVP", description: "They need to create a profile before you can connect." });
      return;
    }
    if (guest.user_id === currentUserId) return;
    setActing(true);
    try {
      const { error } = await supabase.from("connections").insert({
        user_id: currentUserId,
        connected_user_id: guest.user_id,
        status: "pending",
        context: { source: "event", event_id: eventId, event_title: eventTitle },
      });
      if (error) throw error;
      setConnections((prev) => ({ ...prev, [guest.user_id]: "pending" }));
      toast({ title: "Request sent", description: `Tagged: Met via ${eventTitle}` });
    } catch (e: any) {
      toast({ title: "Couldn't send request", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const mutualHint = (userId: string | null): string | null => {
    if (!userId) return null;
    const info = mutuals[userId];
    if (!info || info.count === 0) return null;
    if (info.names.length === 0) return `You know ${info.count} person going`;
    const shown = info.names.slice(0, 2).join(", ");
    const extra = info.count - Math.min(info.names.length, 2);
    return extra > 0 ? `You know ${shown} +${extra} more` : `You know ${shown}`;
  };

  const openProfile = (g: Guest) => {
    if (!g.user_id) return;
    if (g.username) navigate(`/u/${g.username}`);
    else navigate(`/profile/${g.user_id}`);
  };

  if (!canSee) {
    return (
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight">Who's going</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {participantCount} {participantCount === 1 ? "person" : "people"} so far · RSVP to see the guest list and connect
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold leading-tight">Who's going</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap to preview · connect before you meet
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading guests…
            </div>
          ) : guests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No guests yet — be the first.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {guests.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => setSelected(g)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-accent/40 active:bg-accent/60 transition text-left"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={g.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {g.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">
                          {g.full_name || "Guest"}
                        </p>
                        {g.is_host && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Host</Badge>
                        )}
                        {g.is_guest && (
                          <Badge variant="outline" className="text-[10px] shrink-0">RSVP</Badge>
                        )}
                      </div>
                      {g.role && (
                        <p className="text-xs text-muted-foreground truncate">{g.role}</p>
                      )}
                      {mutualHint(g.user_id) && (
                        <p className="text-[11px] text-primary/80 truncate flex items-center gap-1 mt-0.5">
                          <Users className="h-2.5 w-2.5 shrink-0" /> {mutualHint(g.user_id)}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Profile Preview Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[85vh] flex flex-col">
          {selected && (
            <>
              <SheetHeader className="p-5 pb-3 border-b border-border text-left">
                <SheetTitle className="sr-only">{selected.full_name || "Guest"}</SheetTitle>
                <div className="flex items-start gap-3">
                  <Avatar className="h-16 w-16 shrink-0">
                    <AvatarImage src={selected.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {selected.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg truncate">{selected.full_name || "Guest"}</h3>
                      {selected.is_host && <Badge variant="secondary" className="text-[10px]">Host</Badge>}
                    </div>
                    {selected.role && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Briefcase className="h-3.5 w-3.5" /> {selected.role}
                      </p>
                    )}
                    {selected.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-3 w-3" /> {selected.location}
                      </p>
                    )}
                    {mutualHint(selected.user_id) && (
                      <p className="text-xs text-primary/80 flex items-center gap-1.5 mt-0.5">
                        <Users className="h-3 w-3" /> {mutualHint(selected.user_id)}
                      </p>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {selected.bio && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">About</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.bio}</p>
                  </div>
                )}
                {selected.user_id ? (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => openProfile(selected)}>
                    View full profile <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 p-3">
                    Guest RSVP only — they can claim this RSVP by creating a profile with the same email.
                  </p>
                )}
              </div>

              <div className="border-t border-border p-4 space-y-2">
                {(() => {
                  if (!selected.user_id) return (
                    <Badge variant="outline" className="w-full justify-center py-2.5">Waiting for profile</Badge>
                  );
                  const status = connections[selected.user_id] || "none";
                  if (selected.user_id === currentUserId) return (
                    <Badge variant="outline" className="w-full justify-center py-2.5">This is you</Badge>
                  );
                  if (status === "accepted") {
                    return (
                      <Button variant="gradient" className="w-full" onClick={() => navigate(`/messages?user=${selected.user_id}`)}>
                        <MessageCircle className="h-4 w-4 mr-2" /> Message
                      </Button>
                    );
                  }
                  if (status === "pending") {
                    return (
                      <Button variant="outline" className="w-full" disabled>
                        <Clock className="h-4 w-4 mr-2" /> Request pending
                      </Button>
                    );
                  }
                  if (status === "received") {
                    return (
                      <Button variant="outline" className="w-full" onClick={() => navigate("/messages?tab=requests")}>
                        <Check className="h-4 w-4 mr-2" /> Respond to their request
                      </Button>
                    );
                  }
                  return (
                    <Button variant="gradient" className="w-full" onClick={() => handleConnect(selected)} disabled={acting}>
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <><UserPlus className="h-4 w-4 mr-2" /> Connect · Met via {eventTitle.length > 18 ? eventTitle.slice(0, 18) + "…" : eventTitle}</>
                      )}
                    </Button>
                  );
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
