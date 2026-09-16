// /@:handle/room — personal always-on room
// Owner: opens an instant room lobby + shows shareable canonical URL.
// Guest: knocks; polls for accept; auto-routes to /meet/:id?t=… on accept.
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLoader } from "@/components/brand/BrandDots";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Copy, Share2, DoorOpen, Loader2, Check, Fingerprint } from "lucide-react";
import { APP_URL } from "@/lib/constants";
import { toast } from "sonner";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";

interface Owner {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export default function PersonalRoom() {
  const { handle: rawHandle } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const handle = (rawHandle || "").replace(/^@/, "").toLowerCase();

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Owner-side instant room state
  const [opening, setOpening] = useState(false);
  const [created, setCreated] = useState<{ roomUrl: string; token: string; shareUrl: string } | null>(null);
  const [callOpen, setCallOpen] = useState(false);

  // Guest-side knock state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [message, setMessage] = useState("");
  const [knocking, setKnocking] = useState(false);
  const [knock, setKnock] = useState<{ id: string; token: string } | null>(null);
  const [knockStatus, setKnockStatus] = useState<"pending" | "accepted" | "declined" | "expired">("pending");

  const isOwner = !!user && owner?.user_id === user.id;
  const canonicalUrl = useMemo(() => `${APP_URL}/@${handle}/room`, [handle]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url, username")
        .ilike("username", handle)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
      } else {
        setOwner(data as unknown as Owner);
      }
      setLoading(false);
    })().catch(() => !cancelled && setNotFound(true));
    return () => { cancelled = true; };
  }, [handle]);

  // Prefill guest name from session
  useEffect(() => {
    if (!user || isOwner) return;
    const n = (user.user_metadata as any)?.full_name as string | undefined;
    if (n && !guestName) setGuestName(n);
    if (user.email && !guestEmail) setGuestEmail(user.email);
  }, [user, isOwner, guestName, guestEmail]);

  // Poll knock status when waiting
  useEffect(() => {
    if (!knock || knockStatus !== "pending") return;
    let timer: number | undefined;
    const tick = async () => {
      const { data } = await supabase.rpc("get_knock_status", {
        _knock_id: knock.id,
        _guest_token: knock.token,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.status === "accepted" && row.share_url) {
        setKnockStatus("accepted");
        window.location.href = row.share_url;
        return;
      }
      if (row?.status === "declined") setKnockStatus("declined");
      if (row?.expires_at && new Date(row.expires_at).getTime() < Date.now())
        setKnockStatus("expired");
      timer = window.setTimeout(tick, 3000);
    };
    tick().catch(() => {});
    return () => { if (timer) window.clearTimeout(timer); };
  }, [knock, knockStatus]);

  const openMyRoom = async () => {
    if (!owner) return;
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-meeting", {
        body: {
          source: "adhoc",
          title: `${owner.full_name || handle}'s room`,
          max_participants: 8,
          recording_enabled: false,
          transcript_enabled: false,
          knocking_enabled: false,
        },
      });
      if (error) throw error;
      const shareUrl = `${APP_URL}/meet/${data.meeting_id}?t=${data.share_token}`;
      setCreated({ roomUrl: data.room_url, token: data.host_token, shareUrl });
      setCallOpen(true);
    } catch (e: any) {
      toast.error("Couldn't open room", { description: e?.message });
    } finally {
      setOpening(false);
    }
  };

  const sendKnock = async () => {
    if (!owner) return;
    const name = guestName.trim();
    if (!name) {
      toast.error("Add your name first");
      return;
    }
    setKnocking(true);
    try {
      const { data, error } = await supabase.functions.invoke("knock-personal-room", {
        body: {
          owner_id: owner.user_id,
          guest_name: name,
          guest_email: guestEmail.trim() || undefined,
          message: message.trim() || undefined,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setKnock({ id: data.knock_id, token: data.guest_token });
    } catch (e: any) {
      toast.error("Couldn't knock", { description: e?.message });
    } finally {
      setKnocking(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      toast.success("Room link copied");
    } catch { toast.error("Copy failed"); }
  };
  const nativeShare = async () => {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({
        title: `${owner?.full_name || handle}'s room`,
        text: "Hop in when you're ready.",
        url: canonicalUrl,
      });
    } catch { /* dismissed */ }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><BrandLoader /></div>;
  }
  if (notFound || !owner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <Fingerprint className="h-10 w-10 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Room not found</h1>
        <p className="text-sm text-muted-foreground mt-1">@{handle} isn't on Kretopia yet.</p>
        <Link to="/" className="mt-4 text-sm underline">Back home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEO
        title={`${owner.full_name || handle}'s room — Kretopia`}
        description={`Knock to start a call with ${owner.full_name || handle}.`}
      />
      <div className="max-w-md mx-auto px-4 pt-10">
        {/* Owner card */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-20 w-20 ring-4 ring-[hsl(var(--signal-teal))]/20">
            <AvatarImage src={owner.avatar_url ?? undefined} />
            <AvatarFallback>{(owner.full_name || handle).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {owner.full_name || `@${handle}`}'s room
          </h1>
          <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            {canonicalUrl.replace(/^https?:\/\//, "")}
          </p>
        </div>

        {/* Owner controls */}
        {isOwner && (
          <Card className="mt-6">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                This is your always-on room link. Drop it in a bio, an email signature, anywhere.
                Visitors knock — you decide who comes in.
              </p>
              <Button onClick={openMyRoom} disabled={opening} className="w-full h-11" variant="hero">
                {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                Open my room now
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={copyLink} className="h-10">
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </Button>
                <Button variant="outline" onClick={nativeShare} className="h-10">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </Button>
              </div>
              <Link to="/inbox" className="block text-center text-xs text-muted-foreground underline">
                See who's knocked →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Guest knock */}
        {!isOwner && !knock && (
          <Card className="mt-6">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <DoorOpen className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
                Knock to enter
              </div>
              <p className="text-xs text-muted-foreground">
                {owner.full_name?.split(" ")[0] || "They"}'ll get notified.
                The room opens the moment they let you in.
              </p>
              <Input
                placeholder="Your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="h-11"
              />
              <Input
                type="email"
                placeholder="Email (optional)"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="h-11"
              />
              <Textarea
                placeholder="What's this about? (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={400}
              />
              <Button
                onClick={sendKnock}
                disabled={knocking || !guestName.trim()}
                variant="hero"
                className="w-full h-11"
              >
                {knocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                Knock
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Guest waiting */}
        {!isOwner && knock && knockStatus === "pending" && (
          <Card className="mt-6 border-[hsl(var(--signal-teal))]/40 bg-[hsl(var(--signal-teal))]/5">
            <CardContent className="p-5 text-center space-y-2">
              <div className="relative flex justify-center">
                <span className="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-[hsl(var(--signal-teal))] opacity-60" />
                <span className="relative inline-flex h-12 w-12 rounded-full bg-[hsl(var(--signal-teal))]/30 items-center justify-center">
                  <DoorOpen className="h-5 w-5 text-[hsl(var(--signal-teal))]" />
                </span>
              </div>
              <p className="text-sm font-semibold mt-2">Knocking…</p>
              <p className="text-xs text-muted-foreground">
                Hang tight — we'll drop you straight into the room the moment they open up.
              </p>
            </CardContent>
          </Card>
        )}
        {!isOwner && knockStatus === "declined" && (
          <Card className="mt-6"><CardContent className="p-5 text-center text-sm">
            They couldn't make it right now. Try <Link to={`/@${handle}/book`} className="underline">booking a slot</Link>?
          </CardContent></Card>
        )}
        {!isOwner && knockStatus === "expired" && (
          <Card className="mt-6"><CardContent className="p-5 text-center text-sm">
            No answer. <button onClick={() => { setKnock(null); setKnockStatus("pending"); }} className="text-white hover:text-[#FF2DA1] underline transition-colors">Knock again</button> or <Link to={`/@${handle}/book`} className="text-white hover:text-[#FF2DA1] underline transition-colors">book a slot</Link>.
          </CardContent></Card>
        )}

        {/* Always-visible book CTA */}
        <Link
          to={`/@${handle}/book`}
          className="block mt-4 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Prefer to schedule? Book a call →
        </Link>
      </div>

      {created && (
        <VideoCallSheet
          open={callOpen}
          onOpenChange={setCallOpen}
          projectName={`${owner.full_name || handle}'s room`}
          roomUrl={created.roomUrl}
          token={created.token}
          callId={null}
          userName={(user?.user_metadata as any)?.full_name || user?.email?.split("@")[0] || "Host"}
          projectId={null}
          roomName={null}
          meetingShareUrl={created.shareUrl}
        />
      )}
    </div>
  );
}
