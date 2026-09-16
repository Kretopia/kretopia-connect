import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import {
  Users, Mic, Video, Loader2, ArrowLeft, Radio, Check, UserPlus, Bookmark, PlayCircle, StopCircle, Share2, CalendarPlus, Sparkles, Pencil,
} from "lucide-react";
import { format as fmt } from "date-fns";
import { SEO } from "@/components/SEO";
import { buildGoogleCalendarUrl, downloadIcs as downloadCalendarIcs } from "@/lib/calendarLinks";
import { APP_URL } from "@/lib/constants";
import { trackDeckEvent } from "@/lib/deckMetrics";
import { SpeedSessionCreateDialog } from "@/components/circle/SpeedSessionCreateDialog";
import { SpeedLobby } from "@/components/circle/SpeedLobby";
import { SpeedRoundTimer } from "@/components/circle/SpeedRoundTimer";
import { SpeedHostCockpit } from "@/components/circle/SpeedHostCockpit";
import { SpeedActionRail, type RailPeer } from "@/components/circle/SpeedActionRail";
import { SkipForward } from "lucide-react";

type Session = {
  id: string; host_user_id: string; title: string; theme: string | null;
  mode: "video" | "audio"; starts_at: string; duration_min: number;
  slot_seconds: number; status: "scheduled" | "live" | "ended" | "canceled";
  fallback_mode?: "pair" | "group" | null;
  group_room_url?: string | null;
};

type Pairing = {
  id: string; session_id: string; round: number; user_a: string; user_b: string;
  room_url: string; room_name: string; started_at: string; ended_at: string | null;
};

// Late-joiners can still hop in this many minutes after Go-Live. After this
// window, the pool is closed so we don't disrupt mid-round matching.
const LATE_JOIN_CUTOFF_MIN = 10;

type PeerInfo = { id: string; full_name: string | null; avatar_url: string | null; primary_role: string | null };

/**
 * Speed Networking lobby + live runner.
 * - Scheduled: countdown + RSVP + admin "Go live".
 * - Live: subscribes to pairings → auto-opens room → in-call Connect / Save-for-later.
 * - Recap: lists pairings the user had.
 */
export default function SpeedSession() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [rsvps, setRsvps] = useState<number>(0);
  const [joinedCount, setJoinedCount] = useState<number>(0);
  const [myRsvp, setMyRsvp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [myPair, setMyPair] = useState<Pairing | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [callRoom, setCallRoom] = useState<{ url: string; name: string; token: string } | null>(null);
  const [pastPairs, setPastPairs] = useState<Pairing[]>([]);
  const [peer, setPeer] = useState<PeerInfo | null>(null);
  const [connectingPeer, setConnectingPeer] = useState(false);
  const [savedPeer, setSavedPeer] = useState(false);
  const [connectedPeer, setConnectedPeer] = useState(false);
  const [profileStrong, setProfileStrong] = useState<boolean | null>(null);
  const [icePrompts, setIcePrompts] = useState<string[]>([]);
  const [iceIdx, setIceIdx] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [stagePresence, setStagePresence] = useState<Set<string>>(new Set());
  const [groupPeers, setGroupPeers] = useState<RailPeer[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const myName = useMemo(
    () => user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest",
    [user],
  );

  const canControl = isAdmin || (!!session && !!user && session.host_user_id === user.id);

  // Stash intended return path so /auth → onboarding → land back on this session.
  const stashReturnAndGoAuth = useCallback((tab: "signup" | "signin" = "signup") => {
    if (!id) return;
    try {
      sessionStorage.setItem("thrivein_post_auth_redirect", `/circle/speed/${id}`);
      sessionStorage.setItem("pending_speed_session", id);
    } catch {}
    navigate(`/auth?tab=${tab}&redirect=${encodeURIComponent(`/circle/speed/${id}`)}`);
  }, [id, navigate]);

  const refresh = useCallback(async () => {
    if (!id) return;
    const { data: sess } = await supabase
      .from("speed_sessions").select("*").eq("id", id).maybeSingle();
    setSession(sess as any);

    const { data: allRsvps } = await supabase
      .from("speed_session_rsvps")
      .select("user_id, status")
      .eq("session_id", id);
    const rows = (allRsvps ?? []) as { user_id: string; status: string }[];
    setRsvps(rows.length);
    setJoinedCount(rows.filter((r) => r.status === "joined").length);
    if (user?.id) setMyRsvp(rows.some((r) => r.user_id === user.id));

    if (user?.id) {
      const { data: pairs } = await supabase
        .from("speed_session_pairings")
        .select("*").eq("session_id", id)
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("round", { ascending: false });
      const all = (pairs ?? []) as Pairing[];
      const active = all.find((p) => !p.ended_at);
      setMyPair(active ?? null);
      setPastPairs(all.filter((p) => p.ended_at));
    }
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => { refresh().catch(() => setLoading(false)); }, [refresh]);

  // Consume any pending RSVP intent after sign-up/sign-in lands the user back here.
  useEffect(() => {
    if (!user || !id || myRsvp) return;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem("pending_speed_session"); } catch {}
    if (pending !== id) return;
    try { sessionStorage.removeItem("pending_speed_session"); } catch {}
    (async () => {
      const { error } = await supabase.functions.invoke("rsvp-speed-session", {
        body: { session_id: id, action: "rsvp" },
      });
      if (!error) {
        trackDeckEvent("speed_rsvp_confirmed", "speed", { session_id: id, via: "post_auth" });
        const when = session?.starts_at
          ? new Date(session.starts_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })
          : "the night";
        toast({ title: "You're in 🎉", description: `Locked in for ${when}. Check your inbox for the calendar invite.` });
        await refresh().catch(() => {});
      }
    })();
  }, [user, id, myRsvp, session?.starts_at, refresh, toast]);

  // Page view (fires once per session id, including guests)
  useEffect(() => {
    if (!id) return;
    trackDeckEvent("speed_session_viewed", "speed", {
      session_id: id,
      authed: !!user,
      is_host: canControl,
    });
  }, [id, user, canControl]);

  // Track when a pairing arrives (round started)
  useEffect(() => {
    if (!myPair || !user) return;
    trackDeckEvent("speed_pair_started", "speed", {
      session_id: id,
      pairing_id: myPair.id,
      round: myPair.round,
    });
  }, [myPair?.id, user, id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`speed-session-${id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "speed_session_pairings", filter: `session_id=eq.${id}` },
        (payload: any) => {
          // Detect a peer skipping me → soft toast so it doesn't feel broken.
          if (payload.eventType === "UPDATE" && user?.id) {
            const row = payload.new as Pairing & { ended_reason?: string };
            const reason = row?.ended_reason ?? "";
            const involvesMe = row?.user_a === user.id || row?.user_b === user.id;
            const skippedByOther = reason.startsWith("skipped_by_") && reason !== `skipped_by_${user.id}`;
            if (involvesMe && skippedByOther) {
              toast({ title: "Your match moved on", description: "Hold tight — finding you a fresh face." });
            }
          }
          refresh().catch(() => {});
        },
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "speed_sessions", filter: `id=eq.${id}` },
        () => { refresh().catch(() => {}); },
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "speed_session_rsvps", filter: `session_id=eq.${id}` },
        () => { refresh().catch(() => {}); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, refresh, user?.id, toast]);

  // Track who's actually present on the stage (Daily room) via Supabase presence.
  useEffect(() => {
    if (!callRoom?.name || !user) return;
    const ch = supabase.channel(`speed-stage:${callRoom.name}`, {
      config: { presence: { key: user.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setStagePresence(new Set(Object.keys(state)));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: user.id, name: myName, at: new Date().toISOString() });
      }
    });
    return () => { void supabase.removeChannel(ch); setStagePresence(new Set()); };
  }, [callRoom?.name, user?.id, myName, user]);

  // Load profile data for everyone present (group-mode action rail).
  useEffect(() => {
    if (!user) { setGroupPeers([]); return; }
    const otherIds = Array.from(stagePresence).filter((uid) => uid !== user.id);
    if (!otherIds.length) { setGroupPeers([]); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", otherIds);
      setGroupPeers((data ?? []).map((p: any) => ({
        id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url,
      })));
    })().catch(() => {});
  }, [stagePresence, user]);

  // Auto-open the room when a new pairing arrives
  useEffect(() => {
    if (!myPair) return;
    if (callRoom?.name === myPair.room_name) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("join-speed-session", {
          body: { pairing_id: myPair.id, user_name: myName },
        });
        if (error) throw error;
        setCallRoom({ url: data.room_url, name: data.room_name, token: data.token });
        setCallOpen(true);
        setSavedPeer(false);
        setConnectedPeer(false);
        toast({ title: "You're paired!", description: "Quick — say hi." });
      } catch (e: any) {
        console.error("[SpeedSession] join", e);
      }
    })();
  }, [myPair, callRoom?.name, myName, toast]);

  // Load peer profile for overlay actions + fetch ice-breaker prompts
  useEffect(() => {
    if (!myPair || !user) { setPeer(null); setIcePrompts([]); return; }
    const peerId = myPair.user_a === user.id ? myPair.user_b : myPair.user_a;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("user_id", peerId)
          .maybeSingle();
        setPeer({
          id: peerId,
          full_name: data?.full_name ?? null,
          avatar_url: data?.avatar_url ?? null,
          primary_role: null,
        });
      } catch {
        setPeer({ id: peerId, full_name: null, avatar_url: null, primary_role: null });
      }
      // Personalised conversation prompts
      setIceIdx(0);
      try {
        const { data: ice } = await supabase.functions.invoke("speed-icebreakers", {
          body: { peer_id: peerId, theme: session?.theme ?? null },
        });
        if (Array.isArray(ice?.prompts) && ice.prompts.length) setIcePrompts(ice.prompts);
      } catch { /* keep empty — UI hides */ }
    })();
  }, [myPair, user, session?.theme]);

  // Close stale sheet between rounds — but NOT when the user is standing on
  // the shared stage (group/host room, names start with `sp-`).
  useEffect(() => {
    if (!myPair && callOpen && callRoom && !callRoom.name.startsWith("sp-")) {
      setCallOpen(false);
      setCallRoom(null);
    }
  }, [myPair, callOpen, callRoom]);

  // Host/admin: while live, re-run matcher every 20s so new joiners get paired and finished rounds re-pair
  useEffect(() => {
    if (!id || !session || session.status !== "live" || !canControl) return;
    const tick = () => {
      supabase.functions.invoke("speed-session-matcher", { body: { session_id: id } }).catch(() => {});
    };
    tick();
    const iv = setInterval(tick, 20_000);
    return () => clearInterval(iv);
  }, [id, session, canControl]);

  // Profile strength → if weak, nudge after RSVP. Match quality depends on it.
  useEffect(() => {
    if (!user) { setProfileStrong(null); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("bio, role, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        const filled = [data?.bio, data?.role, data?.avatar_url].filter(Boolean).length;
        setProfileStrong(filled >= 3);
      } catch { setProfileStrong(null); }
    })();
  }, [user]);

  const toggleRsvp = async () => {
    if (!user) {
      trackDeckEvent("speed_rsvp_gated", "speed", { session_id: id });
      stashReturnAndGoAuth("signup");
      return;
    }
    setBusy(true);
    try {
      const action = myRsvp ? "cancel" : "rsvp";
      const { error } = await supabase.functions.invoke("rsvp-speed-session", {
        body: { session_id: id, action },
      });
      if (error) throw error;
      trackDeckEvent(myRsvp ? "speed_rsvp_canceled" : "speed_rsvp_confirmed", "speed", { session_id: id });
      if (!myRsvp) toast({ title: "Spot saved", description: "We'll ping you 10 min before. Add to your calendar so you don't forget." });
      await refresh();
    } finally { setBusy(false); }
  };

  const markJoined = async () => {
    if (!user || !id) return;
    await supabase.from("speed_session_rsvps")
      .upsert({ session_id: id, user_id: user.id, status: "joined", joined_at: new Date().toISOString() },
        { onConflict: "session_id,user_id" });
    trackDeckEvent("speed_joined_pool", "speed", { session_id: id });
    await supabase.functions.invoke("speed-session-matcher", { body: { session_id: id } }).catch(() => {});
    refresh();
  };


  // Host stage: mint the shared room and drop the host into it. Works whether
  // the night is pair-mode or group-mode — gives the host a place to stand
  // before/while people arrive (and a fallback "main stage" everyone can hop
  // into). Safe to call multiple times; create-speed-group-room is idempotent.
  const openHostStage = async () => {
    if (!user || !id) return;
    // Race fix: if we're already standing on a speed-room (sp-*), don't
    // mint another Daily frame — would race with the group-mode auto-open.
    if (callRoom?.name?.startsWith("sp-")) {
      setCallOpen(true);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("create-speed-group-room", {
        body: { session_id: id, user_name: myName },
      });
      if (error) throw error;
      setCallRoom({ url: data.room_url, name: data.room_name, token: data.token });
      setCallOpen(true);
    } catch (e: any) {
      console.error("[SpeedSession] openHostStage", e);
      toast({ title: "Couldn't open the stage", description: e?.message ?? "Try again in a sec", variant: "destructive" });
    }
  };

  const goLive = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("speed_sessions")
        .update({ status: "live" })
        .eq("id", id);
      if (error) throw error;
      trackDeckEvent("speed_host_went_live", "speed", { session_id: id, rsvps, joined: joinedCount });
      toast({ title: "We're live", description: "Opening the stage…" });
      await supabase.functions.invoke("speed-session-matcher", { body: { session_id: id } }).catch(() => {});
      // Drop the host straight into the stage so they can see the room and
      // greet people as they arrive.
      await openHostStage();
      refresh();
    } catch (e: any) {
      toast({ title: "Couldn't go live", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const endSession = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await supabase
        .from("speed_sessions")
        .update({ status: "ended" })
        .eq("id", id);
      await supabase
        .from("speed_session_pairings")
        .update({ ended_at: new Date().toISOString() })
        .eq("session_id", id)
        .is("ended_at", null);
      trackDeckEvent("speed_host_ended", "speed", { session_id: id, rsvps, joined: joinedCount });
      toast({ title: "Session wrapped" });
      refresh();
    } finally { setBusy(false); }
  };

  // Warm, intentional share copy — not the bare URL.
  const buildShareText = useCallback(() => {
    if (!session) return { title: "Speed Session", text: "", url: `${APP_URL}/circle/speed/${id}` };
    const url = `${APP_URL}/circle/speed/${id}`;
    const startsAt = new Date(session.starts_at);
    const dateStr = startsAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const timeStr = startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const slotMin = Math.round(session.slot_seconds / 60);
    const text = [
      `${session.title} — ${dateStr} at ${timeStr}`,
      "",
      `Speed networking for creators. Meet a fresh face every ${slotMin} mins, ${session.mode === "audio" ? "audio" : "video"} only.`,
      session.theme ? `Vibe: ${session.theme}` : null,
      "",
      `Save your spot 👇`,
      url,
    ].filter(Boolean).join("\n");
    return { title: session.title, text, url };
  }, [session, id]);

  const copyShare = async () => {
    const { title, text, url } = buildShareText();
    const fallbackCopy = async () => {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        trackDeckEvent("speed_share", "speed", { session_id: id, method: "clipboard" });
        toast({ title: "Invite copied", description: "Paste it in WhatsApp, IG, or anywhere." });
      } catch {
        window.prompt("Copy this invite link:", url);
      }
    };
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url });
        trackDeckEvent("speed_share", "speed", { session_id: id, method: "native" });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        // Permission denied / not allowed → fall through to clipboard
      }
    }
    await fallbackCopy();
  };

  // Add-to-calendar helpers
  const calendarEvent = useMemo(() => {
    if (!session) return null;
    return {
      title: session.title,
      description: [
        session.theme,
        "Speed networking for creators on Kretopia. Show up 2 min early.",
        `${APP_URL}/circle/speed/${id}`,
      ].filter(Boolean).join("\n\n"),
      location: `${APP_URL}/circle/speed/${id}`,
      startISO: session.starts_at,
      durationMinutes: session.duration_min,
    };
  }, [session, id]);

  const addToGoogleCalendar = () => {
    if (!calendarEvent) return;
    trackDeckEvent("speed_calendar_add", "speed", { session_id: id, provider: "google" });
    window.open(buildGoogleCalendarUrl(calendarEvent), "_blank", "noopener,noreferrer");
  };
  const addToAppleCalendar = () => {
    if (!calendarEvent) return;
    trackDeckEvent("speed_calendar_add", "speed", { session_id: id, provider: "apple_ics" });
    downloadCalendarIcs(calendarEvent, `speed-session-${id}.ics`);
  };

  const connectPeer = async () => {
    if (!user || !peer) return;
    setConnectingPeer(true);
    try {
      const { error } = await supabase
        .from("connections")
        .upsert(
          { user_id: user.id, connected_user_id: peer.id, status: "pending", context: "speed_session" } as any,
          { onConflict: "user_id,connected_user_id" } as any,
        );
      if (error) throw error;
      setConnectedPeer(true);
      trackDeckEvent("speed_connect_sent", "speed", { session_id: id, pairing_id: myPair?.id, peer_id: peer.id });
      toast({ title: "Connection sent", description: peer.full_name ?? "We let them know." });
    } catch (e: any) {
      toast({ title: "Couldn't send connect", description: e?.message, variant: "destructive" });
    } finally { setConnectingPeer(false); }
  };

  const saveForLater = async () => {
    if (!user || !peer) return;
    try {
      const { error } = await supabase
        .from("saved_sparks")
        .insert({ user_id: user.id, item_type: "creator", item_id: peer.id });
      if (error && error.code !== "23505") throw error;
      setSavedPeer(true);
      trackDeckEvent("speed_save_for_later", "speed", { session_id: id, pairing_id: myPair?.id, peer_id: peer.id });
      toast({ title: "Saved for later", description: "Find them in your Clipped list." });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    }
  };

  // Skip current pair → ends pairing, both return to pool, matcher re-pairs them on next tick.
  const skipPair = async () => {
    if (!myPair || !user) return;
    try {
      await supabase
        .from("speed_session_pairings")
        .update({ ended_at: new Date().toISOString(), ended_reason: `skipped_by_${user.id}` } as any)
        .eq("id", myPair.id);
      trackDeckEvent("speed_skip_pair", "speed", { session_id: id, pairing_id: myPair.id, peer_id: peer?.id });
      setCallOpen(false);
      setCallRoom(null);
      toast({ title: "Skipped", description: "Finding you a fresh match…" });
      await supabase.functions.invoke("speed-session-matcher", { body: { session_id: id } }).catch(() => {});
      refresh().catch(() => {});
    } catch (e: any) {
      toast({ title: "Couldn't skip", description: e?.message, variant: "destructive" });
    }
  };

  // Group mode: when session flips to group + live, mint shared room and auto-open.
  useEffect(() => {
    if (!session || !user) return;
    if (session.status !== "live") return;
    if (session.fallback_mode !== "group") return;
    if (!myRsvp && session.host_user_id !== user.id) return;
    if (callRoom?.name?.startsWith("sp-")) return; // already joined
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-speed-group-room", {
          body: { session_id: session.id, user_name: myName },
        });
        if (error) throw error;
        setCallRoom({ url: data.room_url, name: data.room_name, token: data.token });
        setCallOpen(true);
        trackDeckEvent("speed_group_room_joined", "speed", { session_id: id });
      } catch (e: any) {
        console.error("[SpeedSession] group room", e);
      }
    })();
  }, [session, user, myRsvp, callRoom?.name, myName, id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="font-semibold">Session not found</p>
        <Link to="/circle?tab=live"><Button variant="outline">Back to Sound Stages</Button></Link>
      </div>
    );
  }

  const ModeIcon = session.mode === "audio" ? Mic : Video;
  const startsAt = new Date(session.starts_at);
  const minsTo = Math.round((startsAt.getTime() - Date.now()) / 60_000);
  const isLive = session.status === "live";
  const isEnded = session.status === "ended" || session.status === "canceled";
  const isGroupMode = session.fallback_mode === "group";
  // Lobby shows from T-30 until live.
  const showLobby = !isLive && !isEnded && minsTo <= 30;
  // Late-join window: open from Go-Live for LATE_JOIN_CUTOFF_MIN minutes.
  const minsSinceStart = Math.round((Date.now() - startsAt.getTime()) / 60_000);
  const lateJoinOpen = isLive && minsSinceStart <= LATE_JOIN_CUTOFF_MIN;

  // Group-mode connect/save handlers (per-peer in shared rooms)
  const connectGroupPeer = async (p: RailPeer) => {
    if (!user) return;
    try {
      await supabase
        .from("connections")
        .upsert(
          { user_id: user.id, connected_user_id: p.id, status: "pending", context: "speed_session" } as any,
          { onConflict: "user_id,connected_user_id" } as any,
        );
      setConnectedIds((prev) => new Set([...prev, p.id]));
      trackDeckEvent("speed_connect_sent", "speed", { session_id: id, peer_id: p.id, mode: "group" });
      toast({ title: "Connection sent", description: p.full_name ?? "We let them know." });
    } catch (e: any) {
      toast({ title: "Couldn't send connect", description: e?.message, variant: "destructive" });
    }
  };
  const saveGroupPeer = async (p: RailPeer) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("saved_sparks")
        .insert({ user_id: user.id, item_type: "creator", item_id: p.id });
      if (error && error.code !== "23505") throw error;
      setSavedIds((prev) => new Set([...prev, p.id]));
      trackDeckEvent("speed_save_for_later", "speed", { session_id: id, peer_id: p.id, mode: "group" });
      toast({ title: "Saved for later", description: "Find them in your Clipped list." });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    }
  };

  const showHostCockpit = canControl && stagePresence.size <= 2;

  const overlayActions = (
    <>
      {/* Top-right: round timer (pair mode) */}
      {myPair && (
        <div className="absolute top-3 right-3">
          <SpeedRoundTimer startedAt={myPair.started_at} slotSeconds={session.slot_seconds} />
        </div>
      )}
      {/* Top-left: host cockpit */}
      {showHostCockpit && (
        <div className="absolute top-3 left-3 max-w-[calc(100vw-24px)]">
          <SpeedHostCockpit
            sessionId={session.id}
            isLive={isLive}
            startsAt={session.starts_at}
            rsvpCount={rsvps}
            joinedCount={joinedCount}
            inRoomCount={stagePresence.size}
            onShare={copyShare}
            onStartMatching={() => {
              supabase.functions.invoke("speed-session-matcher", { body: { session_id: id } })
                .then(() => toast({ title: "Matching…", description: "Pairings will pop in seconds." }))
                .catch(() => {});
            }}
          />
        </div>
      )}
      {/* Bottom-center: action rail (pair OR group) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex justify-center px-2">
        {peer && myPair ? (
          <SpeedActionRail
            mode="pair"
            peer={{ id: peer.id, full_name: peer.full_name, avatar_url: peer.avatar_url }}
            icePrompts={icePrompts}
            iceIdx={iceIdx}
            onCycleIce={() => setIceIdx((i) => (i + 1) % icePrompts.length)}
            connecting={connectingPeer}
            connected={connectedPeer}
            saved={savedPeer}
            onConnect={connectPeer}
            onSave={saveForLater}
            onSkip={skipPair}
          />
        ) : groupPeers.length > 0 ? (
          <SpeedActionRail
            mode="group"
            peers={groupPeers}
            connectedIds={connectedIds}
            savedIds={savedIds}
            onConnect={connectGroupPeer}
            onSave={saveGroupPeer}
          />
        ) : null}
      </div>
    </>
  );


  return (
    <div className="min-h-screen pb-28 bg-background">
      <SEO title={`${session.title} · Speed Session`} description={session.theme ?? ""} />

      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-3 py-3 flex items-center gap-2">
          <Link to="/circle?tab=live"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-base font-bold truncate flex-1">{session.title}</h1>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase">
              <Radio className="h-2.5 w-2.5 animate-pulse" /> Live
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={copyShare} aria-label="Share">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-3 py-4 space-y-4 max-w-xl">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold uppercase">{fmt(startsAt, "MMM")}</span>
                <span className="text-lg font-black leading-none">{fmt(startsAt, "d")}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{fmt(startsAt, "EEEE p")}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-0.5"><ModeIcon className="h-3 w-3" /> {session.mode}</span>
                  <span>· {session.duration_min} min</span>
                  <span>· {Math.round(session.slot_seconds / 60)} min/match</span>
                </p>
              </div>
            </div>
            {session.theme && <p className="text-sm text-muted-foreground">{session.theme}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {rsvps} RSVPs</span>
              {isLive && <span>· {joinedCount} in the room</span>}
            </div>
          </CardContent>
        </Card>

        {canControl && !isEnded && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Host controls</p>
              <p className="text-xs text-muted-foreground">
                Sweet spot for great matches: <strong>6+ joined</strong>. With under 4, people will re-pair with each other.
                Currently: <strong>{rsvps}</strong> RSVPs, <strong>{joinedCount}</strong> joined.
              </p>
              <div className="flex flex-wrap gap-2">
                {!isLive ? (
                  <Button onClick={goLive} disabled={busy} variant="lime" className="rounded-full gap-1.5">
                    <PlayCircle className="h-4 w-4" /> Go live now
                  </Button>
                ) : (
                  <>
                    <Button onClick={openHostStage} variant="default" className="rounded-full gap-1.5">
                      <Radio className="h-4 w-4" /> Open stage
                    </Button>
                    <Button onClick={endSession} disabled={busy} variant="destructive" className="rounded-full gap-1.5">
                      <StopCircle className="h-4 w-4" /> End session
                    </Button>
                  </>
                )}
                <Button onClick={copyShare} variant="outline" className="rounded-full gap-1.5">
                  <Share2 className="h-4 w-4" /> Share link
                </Button>
                {!isLive && (
                  <Button onClick={openHostStage} variant="outline" className="rounded-full gap-1.5">
                    <Radio className="h-4 w-4" /> Preview stage
                  </Button>
                )}
                {!isLive && (
                  <>
                    <Button onClick={() => setEditOpen(true)} variant="ghost" className="rounded-full gap-1.5">
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!session) return;
                        if (!confirm("Cancel this session and notify everyone who RSVP'd?")) return;
                        setBusy(true);
                        try {
                          const { error } = await supabase
                            .from("speed_sessions")
                            .update({ status: "canceled", canceled_reason: "host_canceled" })
                            .eq("id", session.id);
                          if (error) throw error;
                          await supabase.functions.invoke("notify-speed-session-update", {
                            body: { session_id: session.id, kind: "canceled" },
                          }).catch(() => {});
                          toast({ title: "Session canceled", description: "RSVPs notified." });
                          refresh().catch(() => {});
                        } catch (e: any) {
                          toast({ title: "Couldn't cancel", description: e?.message, variant: "destructive" });
                        } finally { setBusy(false); }
                      }}
                      variant="ghost"
                      disabled={busy}
                      className="rounded-full gap-1.5 text-destructive hover:text-destructive"
                    >
                      Cancel session
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <SpeedSessionCreateDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          session={session as any}
          onUpdated={() => refresh().catch(() => {})}
        />

        {showLobby && myRsvp && (
          <SpeedLobby
            sessionId={session.id}
            startsAt={session.starts_at}
            theme={session.theme}
            rsvpCount={rsvps}
            isGroupMode={isGroupMode}
          />
        )}

        {isEnded ? (
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="font-bold">Session wrapped</p>
              {pastPairs.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    You met {pastPairs.length} {pastPairs.length === 1 ? "person" : "people"}. Reconnect with anyone you clicked with:
                  </p>
                  <div className="space-y-1.5">
                    {pastPairs.map((p) => {
                      const peerId = p.user_a === user?.id ? p.user_b : p.user_a;
                      return (
                        <Link
                          key={p.id}
                          to={`/profile/${peerId}`}
                          className="flex items-center gap-2 p-2 rounded-xl border hover:bg-muted/50 transition-colors text-sm"
                        >
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            R{p.round}
                          </div>
                          <span className="flex-1 truncate">View their Creative Passport →</span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">You didn't get paired this round.</p>
              )}
              <Button asChild variant="lime" className="w-full rounded-full mt-2">
                <Link to="/circle?tab=live">See the next session</Link>
              </Button>
            </CardContent>
          </Card>
        ) : isLive ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-5 space-y-3">
              <p className="font-bold flex items-center gap-2">
                <Radio className="h-4 w-4 text-destructive animate-pulse" /> Session is live
                {isGroupMode && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                    Group call
                  </span>
                )}
              </p>
              {isGroupMode ? (
                <p className="text-xs text-muted-foreground">
                  Tonight's a small crew — we're running it as one shared room. The call opens automatically.
                </p>
              ) : myPair ? (
                <p className="text-xs text-muted-foreground">You're in a room. The call opens automatically when you're paired.</p>
              ) : myRsvp ? (
                lateJoinOpen ? (
                  <>
                    <p className="text-xs text-muted-foreground">Hit "I'm here" to join the matching pool. We'll pair you within seconds.</p>
                    <Button onClick={markJoined} variant="lime" className="w-full rounded-full">I'm here — match me</Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Pool's closed for this round so we don't disrupt mid-call matches. Catch the next open night.
                    </p>
                    <Button asChild variant="outline" className="w-full rounded-full">
                      <Link to="/circle?tab=live">See next session</Link>
                    </Button>
                  </>
                )
              ) : lateJoinOpen ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {user ? "Save your spot and jump in." : "Sign up free — takes 60 seconds — and jump in."}
                  </p>
                  <Button onClick={toggleRsvp} disabled={busy} variant="default" className="w-full rounded-full">
                    {user ? "Jump in" : "Sign up & jump in"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    This round's pool is closed. We'll have another open night soon.
                  </p>
                  <Button asChild variant="outline" className="w-full rounded-full">
                    <Link to="/circle?tab=live">See next session</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="font-bold">
                {minsTo > 0 ? `Starts in ${minsTo > 60 ? `${Math.floor(minsTo / 60)}h ${minsTo % 60}m` : `${minsTo} min`}` : "Starting soon"}
              </p>
              <p className="text-xs text-muted-foreground">
                Save your spot — we'll ping you 10 minutes before. You'll meet a fresh creator every {Math.round(session.slot_seconds / 60)} minutes
                on {session.mode === "audio" ? "audio" : "video"}. Tap <strong>Connect</strong> on screen to send a request,
                or <strong>Save</strong> to revisit them later.
              </p>

              {!user && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Sign-in required</p>
                  <p className="text-muted-foreground">
                    Speed matches use your profile (role, skills, what you're looking for). A 60-second sign-up unlocks the room
                    and helps us pair you with the right people.
                  </p>
                </div>
              )}

              <Button
                onClick={toggleRsvp}
                disabled={busy}
                variant={myRsvp ? "secondary" : "lime"}
                size="lg"
                className="w-full rounded-full"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  myRsvp ? <><Check className="h-4 w-4" /> Saved — change my mind</> :
                  !user ? "Sign up & save my spot" : "Save my spot"}
              </Button>

              {user && profileStrong === false && myRsvp && (
                <button
                  onClick={() => navigate("/profile?edit=true")}
                  className="w-full text-left rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs hover:bg-amber-500/10 transition-colors"
                >
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Quick — make your profile shine</p>
                  <p className="text-muted-foreground mt-0.5">
                    Add a role, bio, and avatar so people you meet remember you (and Smart Match pairs you better). Tap to edit →
                  </p>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button onClick={addToGoogleCalendar} variant="outline" size="sm" className="rounded-full gap-1.5">
                  <CalendarPlus className="h-3.5 w-3.5" /> Google Cal
                </Button>
                <Button onClick={addToAppleCalendar} variant="outline" size="sm" className="rounded-full gap-1.5">
                  <CalendarPlus className="h-3.5 w-3.5" /> Apple / .ics
                </Button>
              </div>

              <Button onClick={copyShare} variant="ghost" size="sm" className="w-full rounded-full gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> Invite a friend — better matches with 6+
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {callRoom && (
        <VideoCallSheet
          open={callOpen}
          onOpenChange={setCallOpen}
          projectName={`${session.title} · round ${myPair?.round ?? ""}`}
          roomUrl={callRoom.url}
          roomName={callRoom.name}
          token={callRoom.token}
          callId={null}
          userName={myName}
          userAvatar={user?.user_metadata?.avatar_url ?? null}
          peerUserId={peer?.id ?? null}
          peerName={peer?.full_name ?? "your match"}
          overlayActions={overlayActions}
          onPeerBlocked={() => {
            toast({ title: "Blocked", description: "You won't be paired with them again." });
            setCallRoom(null);
          }}
        />
      )}
    </div>
  );
}
