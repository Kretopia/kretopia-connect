import { useEffect, useState, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Users,
  Ticket,
  ScanLine,
  Share2,
  Pencil,
  Copy,
  MoreVertical,
  Sparkles,
  Eye,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  Loader2,
  ImageIcon,
  MapPin,
  Download,
} from "lucide-react";
import { CreateSessionDialog } from "@/components/sessions/CreateSessionDialog";
import { EditEventDialog } from "@/components/sessions/EditEventDialog";
import { EventCheckInDialog } from "@/components/sessions/EventCheckInDialog";
import { EventShareKit } from "@/components/sessions/EventShareKit";
import { EventHostToolsDialog } from "@/components/sessions/EventHostToolsDialog";
import { EventGuestRoster } from "@/components/sessions/EventGuestRoster";
import { ScoutEventDialog } from "@/components/sessions/ScoutEventDialog";
import { InviteByEmailDialog } from "@/components/sessions/InviteByEmailDialog";
import { BlastComposerDialog } from "@/components/meetup/BlastComposerDialog";
import { EventAnalyticsDialog } from "@/components/sessions/EventAnalyticsDialog";
import { EventResponsesDialog } from "@/components/sessions/EventResponsesDialog";
import { Mail, UserPlus, MessageCircle, Scan, BarChart3, FileQuestion } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface BackstageEvent {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  start_time: string;
  end_time?: string | null;
  max_participants: number;
  cover_image_url?: string | null;
  status?: string | null;
  is_ticketed?: boolean | null;
  ticket_price?: number | null;
  ticket_currency?: string | null;
  is_public?: boolean | null;
  total_views?: number | null;
  group_chat_enabled?: boolean | null;
  group_chat_room_id?: string | null;
  participant_count: number;
  checked_in_count: number;
}

const formatRange = (start: string, end?: string | null) => {
  const s = new Date(start);
  const datePart = format(s, "EEE, MMM d");
  const timePart = format(s, "h:mm a");
  if (end) {
    const e = new Date(end);
    if (e.toDateString() === s.toDateString()) {
      return `${datePart} · ${timePart} – ${format(e, "h:mm a")}`;
    }
  }
  return `${datePart} · ${timePart}`;
};

const EventBackstage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<BackstageEvent[]>([]);
  const [tab, setTab] = useState<"upcoming" | "past" | "drafts">("upcoming");

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [checkinFor, setCheckinFor] = useState<BackstageEvent | null>(null);
  const [shareFor, setShareFor] = useState<BackstageEvent | null>(null);
  const [rosterFor, setRosterFor] = useState<BackstageEvent | null>(null);
  const [messageFor, setMessageFor] = useState<BackstageEvent | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [emailBlastFor, setEmailBlastFor] = useState<BackstageEvent | null>(null);
  const [inviteFor, setInviteFor] = useState<BackstageEvent | null>(null);
  const [hostToolsFor, setHostToolsFor] = useState<BackstageEvent | null>(null);
  const [responsesFor, setResponsesFor] = useState<BackstageEvent | null>(null);
  const [analyticsFor, setAnalyticsFor] = useState<BackstageEvent | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/events/backstage");
  }, [user, authLoading, navigate]);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("creative_jams")
        .select("*")
        .eq("created_by", user.id)
        .order("start_time", { ascending: false });
      if (error) throw error;

      const ids = (rows || []).map((r: any) => r.id);
      const counts: Record<string, number> = {};
      const checkins: Record<string, number> = {};
      if (ids.length) {
        const { data: parts } = await supabase
          .from("jam_participants")
          .select("jam_id, status, checked_in_at")
          .in("jam_id", ids);
        parts?.forEach((p: any) => {
          if (p.status === "going" || p.status === "interested") {
            counts[p.jam_id] = (counts[p.jam_id] || 0) + 1;
          }
          if (p.checked_in_at) {
            checkins[p.jam_id] = (checkins[p.jam_id] || 0) + 1;
          }
        });
      }

      setEvents(
        (rows || []).map((r: any) => ({
          ...r,
          participant_count: counts[r.id] || 0,
          checked_in_count: checkins[r.id] || 0,
        }))
      );
    } catch (e) {
      console.error("[backstage] fetch failed", e);
      toast({ title: "Couldn't load your events", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchEvents().catch((e) => console.error(e));
  }, [fetchEvents]);

  const { upcoming, past, drafts } = useMemo(() => {
    const now = Date.now();
    const upcoming: BackstageEvent[] = [];
    const past: BackstageEvent[] = [];
    const drafts: BackstageEvent[] = [];
    events.forEach((e) => {
      if (e.status === "draft") {
        drafts.push(e);
        return;
      }
      const t = new Date(e.end_time || e.start_time).getTime();
      if (t >= now && e.status !== "completed" && e.status !== "cancelled") upcoming.push(e);
      else past.push(e);
    });
    upcoming.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    past.sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
    drafts.sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
    return { upcoming, past, drafts };
  }, [events]);

  const totalRsvps = useMemo(
    () => events.reduce((sum, e) => sum + (e.participant_count || 0), 0),
    [events]
  );
  const totalCheckins = useMemo(
    () => events.reduce((sum, e) => sum + (e.checked_in_count || 0), 0),
    [events]
  );

  const handleDuplicate = async (ev: BackstageEvent) => {
    if (!user) return;
    try {
      const { data: full, error: fetchErr } = await supabase
        .from("creative_jams")
        .select("*")
        .eq("id", ev.id)
        .single();
      if (fetchErr) throw fetchErr;

      // Push start by 7 days, preserve duration
      const start = new Date(full.start_time);
      const newStart = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      let newEnd: string | null = null;
      if (full.end_time) {
        const dur = new Date(full.end_time).getTime() - start.getTime();
        newEnd = new Date(newStart.getTime() + dur).toISOString();
      }

      const {
        id, created_at, updated_at, total_views, group_chat_room_id,
        ...rest
      } = full as any;

      const { data: inserted, error: insErr } = await supabase
        .from("creative_jams")
        .insert({
          ...rest,
          title: `${full.title} (Copy)`,
          start_time: newStart.toISOString(),
          end_time: newEnd,
          status: "draft",
          group_chat_enabled: false,
          group_chat_room_id: null,
          created_by: user.id,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      toast({
        title: "Duplicated",
        description: "Saved as a draft — edit the details and publish when ready.",
      });
      setTab("drafts");
      fetchEvents();
      if (inserted?.id) setEditId(inserted.id);
    } catch (e: any) {
      console.error("[backstage] duplicate failed", e);
      toast({ title: "Couldn't duplicate", description: e.message, variant: "destructive" });
    }
  };

  const handleConvertToGroup = async (ev: BackstageEvent) => {
    if (!user) return;
    setConvertingId(ev.id);
    try {
      // 1. Ensure spark_room exists for this event
      let roomId = ev.group_chat_room_id || null;
      if (!roomId) {
        const { data: room, error: roomErr } = await supabase
          .from("spark_rooms")
          .insert({
            title: ev.title,
            created_by: user.id,
            is_private: true,
            circle_type: "group",
            category: "event",
            icon_emoji: "🎟️",
            description: `Group chat for "${ev.title}".`,
          })
          .select()
          .single();
        if (roomErr || !room) throw roomErr || new Error("Couldn't create group");
        roomId = room.id;
        await supabase.from("spark_room_members").insert({ room_id: roomId, user_id: user.id, role: "owner" });
        await supabase.from("creative_jams")
          .update({ group_chat_enabled: true, group_chat_room_id: roomId })
          .eq("id", ev.id);
      } else {
        await supabase.from("creative_jams").update({ group_chat_enabled: true }).eq("id", ev.id);
      }

      // 2. Pull all RSVPs (going + interested) + host
      const { data: parts } = await supabase
        .from("jam_participants")
        .select("user_id")
        .eq("jam_id", ev.id)
        .in("status", ["going", "interested"]);
      const rsvpIds = Array.from(new Set([user.id, ...(parts || []).map((p: any) => p.user_id).filter(Boolean)]));

      // 3. Skip those already in
      const { data: existing } = await supabase
        .from("spark_room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .in("user_id", rsvpIds);
      const existingIds = new Set((existing || []).map((m: any) => m.user_id));
      const toAdd = rsvpIds.filter((id) => !existingIds.has(id));

      if (toAdd.length > 0) {
        const memberRows = toAdd.map((uid) => ({
          room_id: roomId!,
          user_id: uid,
          role: uid === user.id ? "owner" : "member",
        }));
        const { error: insErr } = await supabase.from("spark_room_members").insert(memberRows);
        if (insErr && !insErr.message.includes("duplicate")) throw insErr;

        // 4. Notify guests
        const notifyIds = toAdd.filter((id) => id !== user.id);
        if (notifyIds.length > 0) {
          const notifs = notifyIds.map((uid) => ({
            user_id: uid,
            title: `You've been added to the group chat for "${ev.title}"`,
            message: "Tap to say hi and keep the conversation going.",
            type: "event_update",
            action_url: `/messages/${roomId}`,
          }));
          try { await supabase.from("notifications").insert(notifs); } catch { /* non-blocking */ }
        }
      }

      toast({
        title: "Group is ready",
        description: toAdd.length > 0
          ? `Added ${toAdd.length} guest${toAdd.length === 1 ? "" : "s"}. Opening the chat…`
          : "Everyone was already in. Opening the chat…",
      });
      fetchEvents();
      navigate(`/messages/${roomId}`);
    } catch (e: any) {
      console.error("[backstage] convert-to-group failed", e);
      toast({ title: "Couldn't create the group", description: e.message, variant: "destructive" });
    } finally {
      setConvertingId(null);
    }
  };

  const handlePublishDraft = async (ev: BackstageEvent) => {
    try {
      const { error } = await supabase
        .from("creative_jams")
        .update({ status: "upcoming" })
        .eq("id", ev.id);
      if (error) throw error;
      toast({ title: "Published", description: "Your event is live." });
      fetchEvents();
    } catch (e: any) {
      toast({ title: "Couldn't publish", description: e.message, variant: "destructive" });
    }
  };

  const handleSendMessage = async () => {
    if (!messageFor || !messageText.trim() || !user) return;
    setSendingMessage(true);
    try {
      // Notify all RSVPs via in-app notifications (works without an email domain).
      const { data: parts } = await supabase
        .from("jam_participants")
        .select("user_id")
        .eq("jam_id", messageFor.id)
        .in("status", ["going", "interested"]);

      const recipients = (parts || []).map((p: any) => p.user_id).filter(Boolean);
      if (recipients.length === 0) {
        toast({ title: "No guests yet", description: "Once people RSVP you can message them." });
        setSendingMessage(false);
        return;
      }

      const rows = recipients.map((rid) => ({
        user_id: rid,
        title: `Update from "${messageFor.title}"`,
        message: messageText.trim(),
        type: "event_update",
        action_url: `/event/${messageFor.id}`,
      }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;

      toast({
        title: `Sent to ${recipients.length} guest${recipients.length === 1 ? "" : "s"}`,
        description: "They'll see it in their notifications.",
      });
      setMessageFor(null);
      setMessageText("");
    } catch (e: any) {
      console.error("[backstage] message failed", e);
      toast({ title: "Couldn't send", description: e.message, variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleExportCsv = async (ev: BackstageEvent) => {
    try {
      const { data: parts, error } = await supabase
        .from("jam_participants")
        .select("user_id, guest_name, guest_email, status, checked_in_at, joined_at")
        .eq("jam_id", ev.id);
      if (error) throw error;
      if (!parts || parts.length === 0) {
        toast({ title: "No guests yet", description: "Once people RSVP you can export the list." });
        return;
      }

      const userIds = Array.from(new Set(parts.map((p: any) => p.user_id).filter(Boolean)));
      const profileMap: Record<string, { name: string; email: string; username: string }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, username")
          .in("user_id", userIds);
        (profs || []).forEach((p: any) => {
          profileMap[p.user_id] = {
            name: p.full_name || "",
            email: p.email || "",
            username: p.username || "",
          };
        });
      }

      const escape = (v: any) => {
        const s = (v ?? "").toString().replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };
      const header = ["Name", "Email", "Username", "Status", "RSVP'd at", "Checked in at"];
      const rows = parts.map((p: any) => {
        const prof = p.user_id ? profileMap[p.user_id] : null;
        return [
          prof?.name || p.guest_name || "Guest",
          prof?.email || p.guest_email || "",
          prof?.username || "",
          p.status || "",
          p.joined_at ? new Date(p.joined_at).toISOString() : "",
          p.checked_in_at ? new Date(p.checked_in_at).toISOString() : "",
        ].map(escape).join(",");
      });
      const csv = [header.join(","), ...rows].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTitle = ev.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
      a.href = url;
      a.download = `${safeTitle}-guests-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: `Exported ${parts.length} guest${parts.length === 1 ? "" : "s"}`,
        description: "CSV downloaded — open it in Sheets or Excel.",
      });
    } catch (e: any) {
      console.error("[backstage] export failed", e);
      toast({ title: "Couldn't export", description: e.message, variant: "destructive" });
    }
  };

  const renderRow = (ev: BackstageEvent, kind: "upcoming" | "past" | "drafts") => {
    const isDraft = kind === "drafts";
    const isPast = kind === "past";
    const fillPct = ev.max_participants
      ? Math.min(100, Math.round((ev.participant_count / ev.max_participants) * 100))
      : 0;
    return (
      <Card key={ev.id} className="overflow-hidden hover:border-primary/40 transition-colors">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            {/* Cover */}
            <button
              onClick={() => navigate(`/event/${ev.id}`)}
              className="relative w-full sm:w-40 h-32 sm:h-auto shrink-0 bg-muted overflow-hidden group"
              aria-label="Open event"
            >
              {ev.cover_image_url ? (
                <img
                  src={ev.cover_image_url}
                  alt={ev.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              {isDraft && (
                <Badge className="absolute top-2 left-2" variant="secondary">
                  Draft
                </Badge>
              )}
              {ev.is_ticketed && !isDraft && (
                <Badge className="absolute top-2 left-2" variant="default">
                  <Ticket className="h-3 w-3 mr-1" /> Ticketed
                </Badge>
              )}
            </button>

            {/* Body */}
            <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base leading-tight truncate">
                    {ev.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {formatRange(ev.start_time, ev.end_time)}
                    {!isPast && (
                      <span className="text-muted-foreground/60">
                        · {formatDistanceToNow(new Date(ev.start_time), { addSuffix: true })}
                      </span>
                    )}
                  </p>
                  {ev.venue_name && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{ev.venue_name}</span>
                    </p>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => navigate(`/event/${ev.id}`)}>
                      <Eye className="h-4 w-4 mr-2" /> View public page
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditId(ev.id)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRosterFor(ev)}>
                      <Users className="h-4 w-4 mr-2" /> Guest list
                    </DropdownMenuItem>
                    {!isDraft && !isPast && (
                      <DropdownMenuItem onClick={() => setCheckinFor(ev)}>
                        <ScanLine className="h-4 w-4 mr-2" /> Check-in scanner
                      </DropdownMenuItem>
                    )}
                    {!isDraft && (
                      <DropdownMenuItem onClick={() => setShareFor(ev)}>
                        <Share2 className="h-4 w-4 mr-2" /> Share kit
                      </DropdownMenuItem>
                    )}
                    {!isDraft && (
                      <DropdownMenuItem onClick={() => setInviteFor(ev)}>
                        <UserPlus className="h-4 w-4 mr-2" /> Invite by email
                      </DropdownMenuItem>
                    )}
                    {!isDraft && (
                      <DropdownMenuItem onClick={() => setEmailBlastFor(ev)}>
                        <Mail className="h-4 w-4 mr-2" /> Email guests (blast)
                      </DropdownMenuItem>
                    )}
                    {!isDraft && (
                      <DropdownMenuItem
                        onClick={() => {
                          setMessageFor(ev);
                          setMessageText("");
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" /> In-app notification
                      </DropdownMenuItem>
                    )}
                    {!isDraft && (
                      <DropdownMenuItem onClick={() => setHostToolsFor(ev)}>
                        <Sparkles className="h-4 w-4 mr-2" /> Host tools (Q&amp;A · Match · Seating)
                      </DropdownMenuItem>
                    )}
                    {!isDraft && (
                      <DropdownMenuItem onClick={() => setResponsesFor(ev)}>
                        <FileQuestion className="h-4 w-4 mr-2" /> Guest responses (Q&amp;A)
                      </DropdownMenuItem>
                    )}
                    {!isDraft && (
                      <DropdownMenuItem onClick={() => setAnalyticsFor(ev)}>
                        <BarChart3 className="h-4 w-4 mr-2" /> Analytics
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleExportCsv(ev)}>
                      <Download className="h-4 w-4 mr-2" /> Export guest list (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDuplicate(ev)}>
                      <Copy className="h-4 w-4 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    {isDraft && (
                      <DropdownMenuItem onClick={() => handlePublishDraft(ev)}>
                        <Sparkles className="h-4 w-4 mr-2" /> Publish
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{ev.participant_count}</span>
                  <span className="text-muted-foreground">
                    / {ev.max_participants || "∞"}
                  </span>
                </div>
                {ev.checked_in_count > 0 && (
                  <div className="flex items-center gap-1.5">
                    <ScanLine className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{ev.checked_in_count}</span>
                    <span className="text-muted-foreground">checked in</span>
                  </div>
                )}
                {(ev.total_views || 0) > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{ev.total_views}</span>
                    <span className="text-muted-foreground">views</span>
                  </div>
                )}
              </div>

              {/* Capacity bar */}
              {ev.max_participants > 0 && !isDraft && (
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              )}

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {isDraft ? (
                  <>
                    <Button size="sm" variant="gradient" onClick={() => handlePublishDraft(ev)}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Publish
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditId(ev.id)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                  </>
                ) : isPast ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setRosterFor(ev)}>
                      <Users className="h-3.5 w-3.5 mr-1.5" /> Guest list
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConvertToGroup(ev)}
                      disabled={convertingId === ev.id}
                    >
                      {convertingId === ev.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Turn into a group
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicate(ev)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Run it again
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="lime" onClick={() => setInviteFor(ev)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEmailBlastFor(ev)}>
                      <Mail className="h-3.5 w-3.5 mr-1.5" /> Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShareFor(ev)}>
                      <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCheckinFor(ev)}>
                      <ScanLine className="h-3.5 w-3.5 mr-1.5" /> Check-in
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConvertToGroup(ev)}
                      disabled={convertingId === ev.id}
                    >
                      {convertingId === ev.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Turn into a group
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmpty = (label: string, sub: string, showCreate = true) => (
    <Card>
      <CardContent className="py-14 text-center">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">{sub}</p>
        {showCreate && (
          <Button variant="gradient" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Host an event
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <Helmet>
        <title>Backstage · Host Dashboard | Kretopia</title>
        <meta
          name="description"
          content="Manage your events, guests, check-ins, and promo from one backstage dashboard."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/95 border-b">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => navigate(-1)}
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                  Backstage
                </h1>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                  Your host & promoter dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ScoutEventDialog
                trigger={
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                    <Scan className="h-4 w-4" /> <span className="hidden xs:inline">Scout</span>
                  </Button>
                }
              />
              <Button
                variant="gradient"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Host</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-4 pb-32 space-y-5">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatTile
              icon={<Calendar className="h-4 w-4" />}
              label="Upcoming"
              value={loading ? "—" : upcoming.length}
            />
            <StatTile
              icon={<Users className="h-4 w-4" />}
              label="Total RSVPs"
              value={loading ? "—" : totalRsvps}
            />
            <StatTile
              icon={<ScanLine className="h-4 w-4" />}
              label="Check-ins"
              value={loading ? "—" : totalCheckins}
            />
            <StatTile
              icon={<TrendingUp className="h-4 w-4" />}
              label="Events hosted"
              value={loading ? "—" : events.length}
            />
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="upcoming" className="flex-1">
                Upcoming{!loading && upcoming.length ? ` (${upcoming.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="past" className="flex-1">
                Past{!loading && past.length ? ` (${past.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="drafts" className="flex-1">
                Drafts{!loading && drafts.length ? ` (${drafts.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-4 space-y-3">
              {loading ? (
                <SkeletonRows />
              ) : upcoming.length === 0 ? (
                renderEmpty(
                  "Nothing on stage yet",
                  "Your community is waiting — host your next gathering."
                )
              ) : (
                upcoming.map((e) => renderRow(e, "upcoming"))
              )}
            </TabsContent>

            <TabsContent value="past" className="mt-4 space-y-3">
              {loading ? (
                <SkeletonRows />
              ) : past.length === 0 ? (
                renderEmpty(
                  "No past events",
                  "When you wrap an event it'll show up here so you can recap or rerun it.",
                  false
                )
              ) : (
                past.map((e) => renderRow(e, "past"))
              )}
            </TabsContent>

            <TabsContent value="drafts" className="mt-4 space-y-3">
              {loading ? (
                <SkeletonRows />
              ) : drafts.length === 0 ? (
                renderEmpty(
                  "No drafts saved",
                  "Duplicate a past event or start a new one to save a draft.",
                  false
                )
              ) : (
                drafts.map((e) => renderRow(e, "drafts"))
              )}
            </TabsContent>
          </Tabs>

          {/* Promoter / affiliates teaser */}
          <Card className="border-dashed">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Promoter & affiliate rewards</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Guests who share your event get attribution automatically. Promoter
                  payouts & leaderboards are coming next — track every share from each
                  event's share kit.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => navigate("/spotlight")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Learn
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create */}
      <CreateSessionDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={fetchEvents}
      />

      {/* Edit */}
      {editId && (
        <EditEventDialog
          eventId={editId}
          open={!!editId}
          onOpenChange={(o) => !o && setEditId(null)}
          onUpdated={fetchEvents}
        />
      )}

      {/* Check-in */}
      {checkinFor && (
        <EventCheckInDialog
          eventId={checkinFor.id}
          eventTitle={checkinFor.title}
          open={!!checkinFor}
          onOpenChange={(o) => !o && setCheckinFor(null)}
        />
      )}

      {/* Host tools (RSVP questions, Matchmaker, Seating) */}
      {hostToolsFor && (
        <EventHostToolsDialog
          eventId={hostToolsFor.id}
          eventTitle={hostToolsFor.title}
          open={!!hostToolsFor}
          onOpenChange={(o) => !o && setHostToolsFor(null)}
        />
      )}
      {responsesFor && (
        <EventResponsesDialog
          eventId={responsesFor.id}
          eventTitle={responsesFor.title}
          open={!!responsesFor}
          onOpenChange={(o) => !o && setResponsesFor(null)}
        />
      )}
      {shareFor && (
        <EventShareKit
          event={shareFor as any}
          attendeeCount={shareFor.participant_count}
          open={!!shareFor}
          onOpenChange={(o) => !o && setShareFor(null)}
        />
      )}

      {/* Guest roster */}
      <Dialog open={!!rosterFor} onOpenChange={(o) => !o && setRosterFor(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guest list — {rosterFor?.title}</DialogTitle>
            <DialogDescription>
              Everyone who's RSVP'd. Tap a guest to view their profile.
            </DialogDescription>
          </DialogHeader>
          {rosterFor && user && (
            <EventGuestRoster
              eventId={rosterFor.id}
              eventTitle={rosterFor.title}
              hostId={user.id}
              currentUserId={user.id}
              isParticipant={true}
              isHost={true}
              participantCount={rosterFor.participant_count}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Message guests */}
      <Dialog
        open={!!messageFor}
        onOpenChange={(o) => {
          if (!o) {
            setMessageFor(null);
            setMessageText("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message guests</DialogTitle>
            <DialogDescription>
              Send a quick update to everyone RSVP'd to{" "}
              <span className="font-medium text-foreground">{messageFor?.title}</span>.
              They'll see it in their notifications and can tap through to the event.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="e.g. Doors open at 7pm sharp — bring your ID and a friend!"
            rows={5}
            maxLength={500}
          />
          <p className="text-[11px] text-muted-foreground -mt-2">
            {messageText.length}/500
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setMessageFor(null);
                setMessageText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="gradient"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email blast (rich composer with templates) */}
      {emailBlastFor && (
        <BlastComposerDialog
          open={!!emailBlastFor}
          onOpenChange={(o) => !o && setEmailBlastFor(null)}
          eventId={emailBlastFor.id}
          eventTitle={emailBlastFor.title}
        />
      )}

      {/* Analytics dashboard */}
      {analyticsFor && (
        <EventAnalyticsDialog
          open={!!analyticsFor}
          onOpenChange={(o) => !o && setAnalyticsFor(null)}
          eventId={analyticsFor.id}
          eventTitle={analyticsFor.title}
          capacity={(analyticsFor as any).capacity ?? (analyticsFor as any).max_attendees ?? null}
          currency={(analyticsFor as any).ticket_currency ?? "USD"}
        />
      )}

      {/* Invite by email (CSV / paste) */}
      {inviteFor && (
        <InviteByEmailDialog
          open={!!inviteFor}
          onOpenChange={(o) => !o && setInviteFor(null)}
          eventId={inviteFor.id}
          eventTitle={inviteFor.title}
        />
      )}
    </>
  );
};

const StatTile = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) => (
  <Card>
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] sm:text-xs mb-1">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold leading-none">{value}</p>
    </CardContent>
  </Card>
);

const SkeletonRows = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Card key={i}>
        <CardContent className="p-4 flex gap-4 animate-pulse">
          <div className="h-24 w-32 rounded-lg bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default EventBackstage;
