import { useState, useEffect, useCallback, useRef } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Home, Users, Calendar, Hash, Info, Sparkles, Newspaper, FolderOpen, Radio, FolderKanban } from "lucide-react";
import { CircleHubHeader } from "@/components/circle/hub/CircleHubHeader";
import { CircleOverviewTab } from "@/components/circle/hub/CircleOverviewTab";
import { CircleAboutTab } from "@/components/circle/hub/CircleAboutTab";
import { CircleEventsTab } from "@/components/circle/hub/CircleEventsTab";
import { CircleMediaTab } from "@/components/circle/hub/CircleMediaTab";
import { CircleFeedTab } from "@/components/circle/hub/CircleFeedTab";
import { CircleLibraryTab } from "@/components/circle/hub/CircleLibraryTab";
import { CircleStagesTab } from "@/components/circle/hub/CircleStagesTab";
import { CircleStudiosTab } from "@/components/circle/hub/CircleStudiosTab";
import { CircleWelcomeModal } from "@/components/circle/hub/CircleWelcomeModal";
import { CircleMemberDirectory } from "@/components/circle/CircleMemberDirectory";
import { CircleAdminPanel } from "@/components/circle/CircleAdminPanel";
import { CreateSessionDialog } from "@/components/sessions/CreateSessionDialog";

const TABS = [
  { value: "feed", label: "Feed", icon: Newspaper },
  { value: "rooms", label: "Channels", icon: Hash },
  { value: "events", label: "Events", icon: Calendar },
  { value: "stages", label: "Stages", icon: Radio },
  { value: "studios", label: "Studios", icon: FolderKanban },
  { value: "members", label: "Members", icon: Users },
  { value: "about", label: "About", icon: Info },
];


const CircleDetail = () => {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [circle, setCircle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [leader, setLeader] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState("member");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const justJoined = useRef(false);

  const tab = search.get("tab") || "feed";
  const setTab = (v: string) => setSearch((p) => { p.set("tab", v); return p; }, { replace: true });


  const isAdmin = userRole === "admin" || circle?.created_by === user?.id;

  const fetchAll = useCallback(async () => {
    if (!circleId) return;
    setLoading(true);
    try {
      const [circleRes, membersRes, eventsRes, membershipRes] = await Promise.all([
        supabase.from("spark_rooms").select("*").eq("id", circleId).single(),
        supabase.from("spark_room_members").select("user_id, role, joined_at").eq("room_id", circleId),
        supabase.from("creative_jams")
          .select("id, title, start_time, status, cover_image_url, venue_name")
          .eq("circle_id", circleId)
          .order("start_time", { ascending: true })
          .limit(20),
        user
          ? supabase.from("spark_room_members").select("role").eq("room_id", circleId).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (circleRes.data) {
        setCircle(circleRes.data);
        // Leader profile
        const { data: leaderProfile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, bio")
          .eq("user_id", circleRes.data.created_by)
          .maybeSingle();
        setLeader(leaderProfile);
      }

      if (membersRes.data?.length) {
        const userIds = membersRes.data.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, bio")
          .in("user_id", userIds);
        const pMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        setMembers(membersRes.data.map((m: any) => ({
          ...m,
          full_name: pMap.get(m.user_id)?.full_name || "Unknown",
          avatar_url: pMap.get(m.user_id)?.avatar_url,
          bio: pMap.get(m.user_id)?.bio,
        })));
      } else {
        setMembers([]);
      }

      setEvents(eventsRes.data || []);

      if (membershipRes.data) {
        setIsMember(true);
        setUserRole(membershipRes.data.role || "member");
      } else {
        setIsMember(false);
      }
    } catch (err) {
      console.error("Hub fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [circleId, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const joinCircle = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!circle) return;
    if (circle.is_paid && circle.price_monthly > 0) {
      try {
        const { data, error } = await supabase.functions.invoke("join-paid-circle", { body: { circleId: circle.id } });
        if (error) throw error;
        if (data?.url) window.open(data.url, "_blank");
      } catch (err: any) {
        toast({ title: "Payment Error", description: err?.message || "Could not start payment", variant: "destructive" });
      }
      return;
    }
    const { error } = await supabase.from("spark_room_members").insert({ room_id: circle.id, user_id: user.id });
    if (error) { toast({ title: "Could not join", description: error.message, variant: "destructive" }); return; }

    // System welcome message in chat
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const memberName = profile?.full_name || "A new member";
    await supabase.from("spark_room_messages").insert({
      room_id: circle.id, user_id: user.id,
      content: `${memberName} just joined the circle! Welcome aboard!`,
      message_type: "system",
    }).then(() => null, () => null);

    setIsMember(true);
    setUserRole("member");
    justJoined.current = true;
    setShowWelcome(true);
    fetchAll();
  };

  const shareCircle = async () => {
    if (!circle) return;
    const url = `https://www.kretopia.com/circle/${circle.id}`;
    const shareText = `Join "${circle.title}" on Kretopia — your creative circle.\n\n${url}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (navigator.share) {
        await navigator.share({ title: circle.title, text: shareText, url }).catch(() => null);
      } else {
        toast({ title: "Link copied!" });
      }
    } catch {
      toast({ title: "Link copied!" });
    }
  };

  const goToChat = () => navigate(`/circle/${circleId}/chat`);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!circle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Crew not found</p>
        <Button onClick={() => navigate("/crews")}>Back to My Crews</Button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>{circle.title} · Crew | Kretopia</title>
        <meta name="description" content={circle.tagline || circle.description?.slice(0, 150) || `${circle.title} — a private Crew on Kretopia.`} />
      </Helmet>


      <CircleHubHeader
        circle={circle}
        memberCount={members.length || circle.member_count || 0}
        isMember={isMember}
        isAdmin={isAdmin}
        user={user}
        copied={copied}
        leaderProfile={leader}
        onBack={() => navigate(-1)}
        onJoin={joinCircle}
        onShare={shareCircle}
        onMessage={goToChat}
        onManage={() => setShowAdmin(true)}
      />

      <Tabs value={tab} onValueChange={(v) => v === "rooms" ? goToChat() : setTab(v)} className="mt-4">
        <div className="sticky top-14 z-30 bg-background border-b border-border/50">
          <TabsList className="w-full h-auto p-0 bg-transparent justify-start overflow-x-auto scrollbar-hide rounded-none">
            {TABS.map(t => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex-shrink-0 gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-xs font-semibold"
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="feed" className="mt-4">
          <CircleFeedTab
            circleId={circleId!}
            isMember={isMember}
            isAdmin={isAdmin}
            onOpenChat={goToChat}
          />
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <CircleEventsTab
            events={events}
            isMember={isMember}
            onCreateEvent={() => setShowCreateEvent(true)}
          />
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <CircleStagesTab circleId={circleId!} isMember={isMember} />
        </TabsContent>

        <TabsContent value="studios" className="mt-4">
          <CircleStudiosTab circleId={circleId!} isMember={isMember} />
        </TabsContent>

        <TabsContent value="members" className="mt-4 px-4">
          <CircleMemberDirectory
            members={members}
            onMessage={(userId) => navigate(`/messages?user=${userId}`)}
          />
        </TabsContent>

        <TabsContent value="about" className="mt-4">
          <CircleAboutTab circle={circle} leaderProfile={leader} memberCount={members.length} />
        </TabsContent>
      </Tabs>


      {showAdmin && circle && (
        <CircleAdminPanel circle={circle} onClose={() => { setShowAdmin(false); fetchAll(); }} />
      )}

      <CreateSessionDialog
        open={showCreateEvent}
        onOpenChange={setShowCreateEvent}
        onCreated={fetchAll}
        defaultCircleId={circleId}
      />

      <CircleWelcomeModal
        open={showWelcome}
        onOpenChange={setShowWelcome}
        circle={circle}
        onSwitchTab={setTab}
      />
    </div>
  );
};

export default CircleDetail;
