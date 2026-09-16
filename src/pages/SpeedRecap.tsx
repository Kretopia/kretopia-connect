import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { SEO } from "@/components/SEO";
import { trackDeckEvent } from "@/lib/deckMetrics";

type Peer = { id: string; full_name: string | null; avatar_url: string | null; role: string | null };

/**
 * Post-session recap page. Lists everyone the user was paired with (or was
 * in the group room with) and lets them follow up: open chat, send Connect.
 * Also linked from the recap email.
 */
export default function SpeedRecap() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Speed Session");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      try {
        const { data: sess } = await supabase
          .from("speed_sessions").select("title").eq("id", id).maybeSingle();
        if (sess?.title) setTitle(sess.title);

        const { data: pairs } = await supabase
          .from("speed_session_pairings")
          .select("user_a, user_b")
          .eq("session_id", id)
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
        const peerIds = Array.from(new Set(
          (pairs ?? []).map((p: any) => p.user_a === user.id ? p.user_b : p.user_a)
        ));
        if (peerIds.length === 0) {
          setPeers([]);
          setLoading(false);
          return;
        }
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role")
          .in("user_id", peerIds);
        setPeers((profs ?? []).map((p: any) => ({
          id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url, role: p.role,
        })));
        trackDeckEvent("speed_recap_viewed", "speed", { session_id: id, peers: peerIds.length });
      } finally {
        setLoading(false);
      }
    })().catch(() => setLoading(false));
  }, [id, user]);

  const sayHi = async (peer: Peer) => {
    if (!user) return;
    setSending(peer.id);
    try {
      // Ensure a connection exists (auto-accept-style happens in the trigger if both opted in)
      await supabase.from("connections").upsert(
        { user_id: user.id, connected_user_id: peer.id, status: "pending", context: "speed_session" } as any,
        { onConflict: "user_id,connected_user_id" } as any,
      );
      // Send a warm opener
      const opener = `Hey ${peer.full_name?.split(" ")[0] ?? ""} — great meeting you at ${title}. Let's keep the convo going 👋`;
      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: peer.id,
        content: opener,
        read: false,
      } as any);
      trackDeckEvent("speed_recap_message_sent", "speed", { session_id: id, peer_id: peer.id });
      toast({ title: "Sent", description: "Opened your chat with them." });
      navigate(`/messages?with=${peer.id}`);
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e?.message, variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="font-semibold">Sign in to see your recap</p>
        <Link to={`/auth?redirect=/circle/speed/${id}/recap`}>
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen pb-28 bg-background">
      <SEO title={`Recap · ${title}`} description="Follow up with everyone you met." />
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-3 py-3 flex items-center gap-2 max-w-xl">
          <Link to={`/circle/speed/${id}`}><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-base font-bold truncate flex-1">Recap · {title}</h1>
        </div>
      </div>

      <div className="container mx-auto px-3 py-4 space-y-3 max-w-xl">
        {peers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <p className="font-semibold">No pairings on file</p>
              <p className="text-xs text-muted-foreground">
                Either the session was group-style, or you didn't get matched. Catch the next night.
              </p>
              <Link to="/circle/speed"><Button variant="outline" className="mt-2">Browse nights</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm">
                  You met <strong>{peers.length}</strong> {peers.length === 1 ? "creator" : "creators"}. Worth a hello while it's fresh.
                </p>
              </CardContent>
            </Card>
            {peers.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name ?? ""} />}
                    <AvatarFallback>{(p.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link to={`/u/${p.id}`} className="font-semibold text-sm hover:underline truncate block">
                      {p.full_name ?? "A creator"}
                    </Link>
                    {p.role && <p className="text-xs text-muted-foreground truncate">{p.role}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="lime"
                    className="rounded-full gap-1.5"
                    onClick={() => sayHi(p)}
                    disabled={sending === p.id}
                  >
                    {sending === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    Say hi
                  </Button>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
