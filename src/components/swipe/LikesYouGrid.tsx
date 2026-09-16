import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";

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
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());

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
      if (direction === "right") toast({ title: "It's a match", description: "Say hello in Messages." });
    } catch (e: any) {
      toast({ title: "Couldn't save that", description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading likes…
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
          action={{ label: "Browse creators", icon: Heart, onClick: () => navigate("/circle") }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
      {likers.map((p) => (
        <div key={p.user_id} className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => navigate(`/profile/${p.user_id}`)}
            className="block w-full aspect-[3/4] bg-muted"
          >
            {p.avatar_url && !failedAvatars.has(p.user_id) ? (
              <img
                src={p.avatar_url}
                alt={p.full_name ?? "Creator"}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setFailedAvatars((prev) => new Set(prev).add(p.user_id))}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {(p.full_name ?? "?").charAt(0)}
              </div>
            )}
          </button>
          <div className="p-2.5">
            <p className="font-semibold text-sm truncate">{p.full_name ?? "Creator"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {[p.role, p.location].filter(Boolean).join(" · ") || "Creator"}
            </p>
            <div className="flex gap-1.5 mt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs"
                disabled={busyId === p.user_id}
                onClick={() => respond(p.user_id, "left")}
              >
                Pass
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs gap-1"
                disabled={busyId === p.user_id}
                onClick={() => respond(p.user_id, "right")}
              >
                <Heart className="h-3 w-3" /> Match
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LikesYouGrid;
