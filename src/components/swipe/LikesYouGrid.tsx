import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Sparkles } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { CreatorPassportCard } from "@/components/discover/CreatorPassportCard";
import { groupCreatorsByCraft } from "@/components/discover/creatorCategories";
import { ScoutFieldCarousel } from "@/components/scout/ScoutFieldCarousel";
import { Button } from "@/components/ui/button";

/** Cards mounted per row before "Show all": a long row keeps scrolling smoothly. Nobody is dropped, only deferred. */
const ROW_CARD_LIMIT = 24;

interface Liker {
  user_id: string;
  full_name: string | null;
  role: string | null;
  location: string | null;
  avatar_url: string | null;
}

/**
 * "Likes you" — creators who swiped right on you and are still waiting on a reply.
 * Liking back records the mutual swipe, exactly like the deck does.
 */
export function LikesYouGrid() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [incoming, outgoing] = await Promise.all([
          supabase
            .from("swipes")
            .select("user_id, created_at")
            .eq("target_id", user.id)
            .eq("target_type", "profile")
            .eq("direction", "right")
            .order("created_at", { ascending: false })
            .limit(60),
          supabase.from("swipes").select("target_id").eq("user_id", user.id),
        ]);

        const already = new Set((outgoing.data ?? []).map((s: any) => s.target_id));
        const ids = [...new Set((incoming.data ?? []).map((s: any) => s.user_id))].filter(
          (id) => !already.has(id),
        );
        if (!ids.length) {
          if (!cancelled) setLikers([]);
          return;
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, role, location, avatar_url")
          .in("user_id", ids);

        if (!cancelled) setLikers((profiles ?? []) as Liker[]);
      } catch (e) {
        console.error("LikesYouGrid load failed:", e);
        if (!cancelled) setLikers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load().catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const respond = async (targetId: string, direction: "left" | "right") => {
    if (!user) return;
    setBusyId(targetId);
    try {
      const { error } = await supabase.from("swipes").insert({
        user_id: user.id,
        target_id: targetId,
        target_type: "profile",
        direction,
      });
      if (error) throw error;
      setLikers((l) => l.filter((p) => p.user_id !== targetId));
      // A saved answer is all this write proves: it creates no connection, so it must not announce a match.
      if (direction === "right") toast({ title: "Interest saved", description: "Your answer is saved. You can say hello in Messages." });
    } catch (e: any) {
      toast({ title: "Couldn't save that", description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
        <KretopiaSpinner className="h-4 w-4" /> Loading likes…
      </div>
    );
  }

  if (!likers.length) {
    return (
      <div className="py-6">
        <EmptyState
          icon={Sparkles}
          eyebrow="Interested"
          title="No one waiting yet"
          description="When a creator swipes right on you, they land here so you can answer in one tap."
          accent="lime"
          action={{ label: "Browse creators", icon: Heart, onClick: () => navigate("/match?tab=browse&view=grid") }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupCreatorsByCraft(likers).map((group) => {
        const all = expanded[group.id] || group.creators.length <= ROW_CARD_LIMIT;
        const shown = all ? group.creators : group.creators.slice(0, ROW_CARD_LIMIT);
        return (
          <section key={group.id} aria-label={`${group.label} creators`} className="min-w-0">
            <ScoutFieldCarousel
              label={`${group.label} creators`}
              heading={
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  {group.label}
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">{group.creators.length}</span>
                </h2>
              }
            >
              {shown.map((p) => (
                <li key={p.user_id}>
                  <CreatorPassportCard
                    profile={p}
                    onOpen={() => navigate(`/profile/${p.user_id}`)}
                    reply={{ onMatch: () => respond(p.user_id, "right"), onPass: () => respond(p.user_id, "left"), busy: busyId === p.user_id }}
                  />
                </li>
              ))}
              {!all && (
                <li className="flex items-center">
                  <Button variant="outline" onClick={() => setExpanded((e) => ({ ...e, [group.id]: true }))}>
                    Show all {group.creators.length}
                  </Button>
                </li>
              )}
            </ScoutFieldCarousel>
          </section>
        );
      })}
    </div>
  );
}

export default LikesYouGrid;
