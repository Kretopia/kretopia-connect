import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { MessageSquareMore, Plus, Search, Users } from "lucide-react";
import { CreateCircleDialog } from "@/components/scene/CirclesTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CircleCard, type CircleData } from "@/components/circle/CircleCard";
import { CircleActivityDigest } from "@/components/circle/CircleActivityDigest";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";

const CirclesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [circles, setCircles] = useState<CircleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchCircles = useCallback(async () => {
    if (!user) { setCircles([]); setLoading(false); return; }
    setLoading(true);
    try {
      // My Crews only: rooms I'm a member of
      const { data: memberRows } = await supabase
        .from("spark_room_members")
        .select("room_id, role")
        .eq("user_id", user.id);

      const ids = (memberRows ?? []).map((m: any) => m.room_id);
      if (!ids.length) { setCircles([]); setLoading(false); return; }

      const { data: roomsData } = await supabase
        .from("spark_rooms")
        .select("*")
        .in("id", ids)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (!roomsData?.length) { setCircles([]); setLoading(false); return; }

      const creatorIds = [...new Set(roomsData.map(r => r.created_by))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", creatorIds);

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const roleMap = new Map((memberRows ?? []).map((m: any) => [m.room_id, m.role]));

      setCircles(roomsData.map(r => ({
        ...r,
        icon_emoji: r.icon_emoji || "",
        is_private: r.is_private || false,
        is_paid: r.is_paid || false,
        price_monthly: r.price_monthly || 0,
        currency: r.currency || "USD",
        circle_type: r.circle_type || "community",
        invite_code: r.invite_code || null,
        rules: r.rules || null,
        cover_url: r.cover_url || null,
        creator_name: profileMap.get(r.created_by)?.full_name || "Unknown",
        creator_avatar: profileMap.get(r.created_by)?.avatar_url || undefined,
        is_member: true,
        user_role: roleMap.get(r.id) || "member",
      })));
    } catch (err) {
      console.error("Error fetching crews:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCircles(); }, [fetchCircles]);

  const displayCircles = circles.filter(c =>
    !searchQuery ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>My Crews | Kretopia</title>
        <meta name="description" content="Your private Crews on Kretopia — invite-only spaces to run with your people." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <MessageSquareMore className="h-5 w-5 text-primary" />
                My Crews
              </h1>
              <p className="text-xs text-muted-foreground">
                {circles.length === 0 ? "Private, invite-only spaces for your people." : `${circles.length} ${circles.length === 1 ? "Crew" : "Crews"}`}
              </p>
            </div>
            <Button size="sm" variant="gradient" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Crew
            </Button>
          </div>

          <CreateCircleDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchCircles} />

          {circles.length > 0 && <CircleActivityDigest className="mb-3" />}

          {circles.length > 3 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search your Crews..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50"
              />
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 rounded bg-muted" />
                      <div className="h-3 w-1/2 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : circles.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-3 inline-flex">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <p className="font-semibold mb-1">Start your first Crew</p>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                A Crew is your private home for your community, fans or collaborators.
                Run a feed, drop events, host stages, spin up Studios — all in one place.
              </p>
              <Button variant="gradient" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create a Crew
              </Button>
            </Card>
          ) : displayCircles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No Crews match your search.</p>
          ) : (
            <div className="space-y-2">
              {displayCircles.map(circle => (
                <CircleCard key={circle.id} circle={circle} onClick={() => navigate(`/crew/${circle.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CirclesPage;
