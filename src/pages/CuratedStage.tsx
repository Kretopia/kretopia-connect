import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { ApplyToStageSheet } from "@/components/circle/ApplyToStageSheet";
import { StageHostConsole } from "@/components/circle/StageHostConsole";
import { InviteToStageDialog } from "@/components/circle/InviteToStageDialog";
import { StageDoorsCountdown } from "@/components/circle/StageDoorsCountdown";
import { ArrowLeft, Calendar, Users, Radio, Mic2, Search, Loader2, CheckCircle2, Hand, Lock, Link2, Send, Sparkles } from "lucide-react";
import { formatDistanceToNowStrict, format } from "date-fns";

type Stage = {
  id: string; type: "scout" | "showcase"; title: string; blurb: string | null;
  cover_url: string | null; starts_at: string; ends_at: string | null;
  capacity: number; is_paid: boolean; price_cents: number | null; currency: string | null;
  status: string; host_user_id: string; rsvp_count: number; attended_count: number;
  application_required: boolean; application_prompt: string | null;
  vibe_tags: string[] | null; recording_enabled: boolean; turn_seconds: number;
  mode?: "audio" | "video" | null;
  visibility?: "public" | "unlisted" | "private" | null;
  invite_token?: string | null;
  description?: string | null;
};

const CuratedStage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState<{ full_name: string | null; avatar_url: string | null; username: string | null } | null>(null);
  const [myRsvp, setMyRsvp] = useState<{ status: string } | null>(null);
  const [myApp, setMyApp] = useState<{ status: string } | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [room, setRoom] = useState<{ url: string; name: string; token: string; recordingEnabled: boolean } | null>(null);
  const [joining, setJoining] = useState(false);
  const [rsvping, setRsvping] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [raising, setRaising] = useState(false);
  const [verifyingTicket, setVerifyingTicket] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [backstageMode, setBackstageMode] = useState(false);

  const inviteToken = searchParams.get("invite") || undefined;

  const isHost = !!user && !!stage && stage.host_user_id === user.id;
  const myName = useMemo(() => user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest", [user]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const load = async () => {
      let { data: s } = await supabase.from("curated_stages").select("*").eq("id", id).maybeSingle();
      if (!s && inviteToken) {
        // Private/unlisted stage: RLS hides the row, but a valid invite link
        // still resolves it server-side (invite_token is never returned).
        const { data: viaInvite } = await (supabase as any).rpc("get_curated_stage_by_invite", {
          p_stage_id: id,
          p_token: inviteToken,
        });
        s = Array.isArray(viaInvite) ? viaInvite[0] : viaInvite;
      }
      if (!mounted) return;
      if (!s) { setLoading(false); return; }
      setStage(s as any);


      const { data: h } = await supabase.from("profiles")
        .select("full_name, avatar_url, username").eq("user_id", (s as any).host_user_id).maybeSingle();
      if (mounted) setHost(h as any);

      if (user) {
        const [{ data: r }, { data: a }] = await Promise.all([
          supabase.from("curated_stage_rsvps").select("status").eq("stage_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("curated_stage_applications").select("status").eq("stage_id", id).eq("user_id", user.id).maybeSingle(),
        ]);
        if (mounted) { setMyRsvp(r as any); setMyApp(a as any); }
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`stage_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "curated_stages", filter: `id=eq.${id}` },
        (payload) => mounted && setStage(payload.new as any))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [id, user]);

  // Listen for host promoting a raised hand → swap in speaker token
  useEffect(() => {
    if (!user || !stage || !room) return;
    const ch = supabase.channel(`stage_speaker_${stage.id}_${user.id}`)
      .on("broadcast", { event: "promoted" }, ({ payload }) => {
        const newToken = (payload as any)?.token;
        if (!newToken) return;
        setRoom((prev) => prev ? { ...prev, token: newToken } : prev);
        setCallOpen(false);
        setTimeout(() => setCallOpen(true), 250);
        setHandRaised(false);
        toast({ title: "You're up", description: "Host pulled you on stage — mic/cam on." });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, stage, room, toast]);

  // Post-checkout: verify Stripe session and confirm RSVP
  useEffect(() => {
    const ticket = searchParams.get("ticket");
    const sessionId = searchParams.get("session_id");
    if (ticket === "success" && sessionId && user && id) {
      setVerifyingTicket(true);
      supabase.functions.invoke("verify-stage-ticket", { body: { session_id: sessionId, stage_id: id } })
        .then(({ data, error }) => {
          if (error) throw error;
          if (data?.status === "paid") {
            setMyRsvp({ status: "rsvp" });
            toast({ title: "Ticket confirmed", description: "You're in. We'll remind you before it starts." });
          }
        })
        .catch((e) => toast({ title: "Couldn't verify ticket", description: e?.message, variant: "destructive" }))
        .finally(() => {
          setVerifyingTicket(false);
          searchParams.delete("ticket"); searchParams.delete("session_id");
          setSearchParams(searchParams, { replace: true });
        });
    } else if (ticket === "cancel") {
      toast({ title: "Checkout cancelled" });
      searchParams.delete("ticket");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, user, id]);

  const handleRsvp = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!stage) return;
    if (stage.is_paid) {
      setRsvping(true);
      try {
        const { data, error } = await supabase.functions.invoke("checkout-stage-ticket", {
          body: { stage_id: stage.id },
        });
        if (error) throw error;
        if (data?.url) window.location.href = data.url;
      } catch (e: any) {
        toast({ title: "Couldn't start checkout", description: e?.message, variant: "destructive" });
      } finally { setRsvping(false); }
      return;
    }
    setRsvping(true);
    try {
      const { data, error } = await supabase.functions.invoke("rsvp-curated-stage", {
        body: { stage_id: stage.id, invite_token: inviteToken },
      });
      if (error) throw error;
      setMyRsvp({ status: data?.status || "rsvp" });
      toast({ title: data?.status === "waitlist" ? "You're on the waitlist" : "You're in" });
    } catch (e: any) {
      toast({ title: "Couldn't RSVP", description: e?.message, variant: "destructive" });
    } finally { setRsvping(false); }
  };

  const handleRaiseHand = async () => {
    if (!user || !stage) return;
    setRaising(true);
    try {
      const { error } = await supabase.functions.invoke("raise-hand-stage", { body: { stage_id: stage.id } });
      if (error) throw error;
      setHandRaised(true);
      toast({ title: "Hand raised", description: "Host will pull you up if there's a slot." });
    } catch (e: any) {
      toast({ title: "Couldn't raise hand", description: e?.message, variant: "destructive" });
    } finally { setRaising(false); }
  };

  const handleJoinLive = async (opts?: { backstage?: boolean }) => {
    if (!user || !stage) { navigate("/auth"); return; }
    const wantsBackstage = !!opts?.backstage;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("go-live-stage", {
        body: { stage_id: stage.id, user_name: myName, invite_token: inviteToken, backstage: wantsBackstage },
      });
      if (error) throw error;
      setBackstageMode(!!data?.backstage);
      setRoom({
        url: data.room_url,
        name: data.room_name,
        token: data.token,
        recordingEnabled: !!data.recording_enabled,
      });
      setCallOpen(true);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("INVITE_REQUIRED") || msg.includes("private")) {
        toast({ title: "Invite-only stage", description: "Ask the host for an invite link to join.", variant: "destructive" });
      } else {
        toast({ title: "Couldn't join", description: msg, variant: "destructive" });
      }
    } finally { setJoining(false); }
  };

  const handleCallClose = async (open: boolean) => {
    setCallOpen(open);
    if (!open && isHost && stage && !backstageMode) {
      // Host ended a LIVE stage — wrap it. (Backstage exits do not end the stage.)
      supabase.functions.invoke("end-curated-stage", { body: { stage_id: stage.id } }).catch(() => {});
    }
    if (!open) setBackstageMode(false);
  };

  if (loading) return <div className="container max-w-3xl mx-auto p-6 space-y-4"><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-8 w-2/3" /></div>;
  if (!stage) return <div className="container max-w-3xl mx-auto p-12 text-center"><p className="text-muted-foreground">Stage not found.</p></div>;

  const isLive = stage.status === "live";
  const isEnded = stage.status === "ended";
  const isFull = stage.rsvp_count >= stage.capacity && !myRsvp;
  const Icon = stage.type === "scout" ? Search : Mic2;
  const remaining = Math.max(0, stage.capacity - stage.rsvp_count);

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO title={`${stage.title} | Sound Stages`} description={stage.blurb ?? "Curated live stage on Kretopia."} />

      <header className="border-b border-border/60 sticky top-0 bg-background z-20 pt-[env(safe-area-inset-top)]">
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/circle?tab=live" className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Sound Stages</p>
        </div>
      </header>

      <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Cover */}
        <div
          className="h-44 rounded-2xl bg-gradient-to-br from-primary/30 via-accent/15 to-background relative overflow-hidden"
          style={stage.cover_url ? { backgroundImage: `url(${stage.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
        >
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" />{stage.type === "scout" ? "Scout Stage" : "Showcase"}</Badge>
            {stage.mode === "audio" && <Badge variant="outline" className="gap-1 bg-background/70">Audio</Badge>}
            {stage.mode === "video" && <Badge variant="outline" className="gap-1 bg-background/70">Video</Badge>}
            {stage.visibility === "private" && <Badge variant="outline" className="gap-1 bg-background/70"><Lock className="h-3 w-3" /> Private</Badge>}
            {stage.visibility === "unlisted" && <Badge variant="outline" className="gap-1 bg-background/70"><Link2 className="h-3 w-3" /> Unlisted</Badge>}
            {isLive && <Badge variant="destructive" className="gap-1 animate-pulse"><Radio className="h-3 w-3" /> Live</Badge>}
            {isEnded && <Badge variant="outline">Ended</Badge>}
          </div>
        </div>

        {/* Title + meta */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold leading-tight">{stage.title}</h1>
          {stage.blurb && <p className="text-sm text-muted-foreground">{stage.blurb}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(stage.starts_at), "EEE, MMM d · h:mma")}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{stage.rsvp_count}/{stage.capacity}</span>
            {!isLive && !isEnded && <span>Starts {formatDistanceToNowStrict(new Date(stage.starts_at), { addSuffix: true })}</span>}
          </div>
          {stage.type === "scout" && stage.description && (
            <Card className="p-4 mt-2 bg-muted/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">What the host is looking for</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{stage.description}</p>
            </Card>
          )}
        </div>

        {/* Host card */}
        {host && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={host.avatar_url ?? undefined} />
                <AvatarFallback>{(host.full_name ?? "?").slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hosted by</p>
                <Link to={host.username ? `/u/${host.username}` : `/profile/${stage.host_user_id}`}
                  className="font-bold text-sm hover:underline">
                  {host.full_name || "Host"}
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Doors-open countdown (RSVPs + host, pre-live only) */}
        {!isLive && !isEnded && <StageDoorsCountdown startsAt={stage.starts_at} />}

        {/* Primary CTA */}
        {isHost ? (
          <div className="space-y-2">
            <Button onClick={() => handleJoinLive()} disabled={joining} size="lg" className="w-full" variant={isLive ? "destructive" : "default"}>
              {joining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Radio className="h-4 w-4 mr-2" />}
              {isLive ? "Re-enter stage" : isEnded ? "Stage ended" : "Open doors & go live"}
            </Button>
            {!isLive && !isEnded && (
              <Button onClick={() => handleJoinLive({ backstage: true })} disabled={joining} variant="outline" className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Rehearse backstage (doors stay closed)
              </Button>
            )}
            {(stage.visibility === "private" || stage.visibility === "unlisted") && !isEnded && (
              <Button onClick={() => setInviteOpen(true)} variant="outline" className="w-full">
                {stage.visibility === "private"
                  ? <><Send className="h-4 w-4 mr-2" /> Invite people</>
                  : <><Link2 className="h-4 w-4 mr-2" /> Copy share link</>}
              </Button>
            )}
            <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
              {stage.visibility === "private" && <><Lock className="h-3 w-3" /> Private — invite only.</>}
              {stage.visibility === "unlisted" && <><Link2 className="h-3 w-3" /> Unlisted — anyone with the link.</>}
              {(!stage.visibility || stage.visibility === "public") && <>You're the host. {stage.type === "scout" ? "Review applicants below before going live." : "Rehearse first, then open the doors when you're ready."}</>}
            </p>
          </div>
        ) : isLive ? (
          <div className="space-y-2">
            <Button onClick={() => handleJoinLive()} disabled={joining} size="lg" variant="lime" className="w-full">
              {joining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Radio className="h-4 w-4 mr-2" />}
              Walk in
            </Button>
            {!isHost && (
              <Button onClick={handleRaiseHand} disabled={raising || handRaised} variant="outline" className="w-full">
                <Hand className="h-4 w-4 mr-2" />
                {handRaised ? "Hand raised — waiting for host" : "Raise hand to come on stage"}
              </Button>
            )}
          </div>
        ) : isEnded ? (
          <Card className="p-6 text-center bg-muted/30">
            <p className="text-sm font-semibold">This stage has wrapped.</p>
            <p className="text-xs text-muted-foreground mt-1">Check your inbox for follow-ups from the host.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {myRsvp ? (
              <Card className="p-4 bg-primary/5 border-primary/30 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold">
                  {myRsvp.status === "waitlist" ? "You're on the waitlist — we'll let you know if a spot opens." : "You're in. We'll remind you 24h and 1h before."}
                </p>
              </Card>
            ) : (
              <Button onClick={handleRsvp} disabled={rsvping} size="lg" className="w-full">
                {rsvping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {stage.is_paid ? `Get ticket — $${((stage.price_cents ?? 0) / 100).toFixed(0)}` : isFull ? "Join the waitlist" : "Save my spot"}
              </Button>
            )}

            {stage.type === "scout" && stage.application_required && (
              myApp ? (
                <Card className="p-3 text-center text-xs bg-card">
                  Application <strong>{myApp.status}</strong>{myApp.status === "accepted" && " — you'll get pulled up when it's your turn"}
                </Card>
              ) : (
                <Button onClick={() => setApplyOpen(true)} variant="outline" className="w-full">
                  <Hand className="h-4 w-4 mr-2" /> Apply to be scouted
                </Button>
              )
            )}

            {remaining > 0 && remaining <= 5 && !myRsvp && (
              <p className="text-[11px] text-center text-energy font-bold uppercase">Only {remaining} spots left</p>
            )}
          </div>
        )}

        {/* Host console (only host, only when live) */}
        {isHost && stage.type === "scout" && (
          <StageHostConsole stage={stage} />
        )}

        <p className="text-[11px] text-center text-muted-foreground">
          Code of conduct applies. Report or block from inside the call.
        </p>
      </div>

      <ApplyToStageSheet
        open={applyOpen} onOpenChange={setApplyOpen}
        stageId={stage.id} stageTitle={stage.title}
        applicationPrompt={stage.application_prompt}
        onApplied={() => setMyApp({ status: "pending" })}
      />

      {room && (
        <VideoCallSheet
          open={callOpen}
          onOpenChange={handleCallClose}
          projectName={stage.title}
          roomUrl={room.url}
          roomName={room.name}
          token={room.token}
          callId={null}
          userName={myName}
          userAvatar={user?.user_metadata?.avatar_url ?? null}
          lobbyCta={isHost ? (backstageMode ? "Enter backstage" : "Start stage") : "Walk in"}
          isHost={isHost}
          autoStartRecording={isHost && !backstageMode && room.recordingEnabled}
          backstage={backstageMode}
        />
      )}

      {isHost && (
        <InviteToStageDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          stageId={stage.id}
          stageTitle={stage.title}
          inviteToken={stage.invite_token}
          visibility={(stage.visibility ?? "public") as "public" | "unlisted" | "private"}
        />
      )}
    </div>
  );
};

export default CuratedStage;
