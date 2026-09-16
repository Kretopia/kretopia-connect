import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Image as ImageIcon, Award, Loader2 } from "lucide-react";

interface Props {
  circleId: string;
  members: Array<{ user_id: string; full_name?: string; avatar_url?: string }>;
}

/**
 * Media / Spotlight tab — surfaces verified credits and featured work
 * from circle members. Open to non-members (browsable showcase).
 */
export function CircleMediaTab({ circleId, members }: Props) {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<any[]>([]);
  const [topCreator, setTopCreator] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!members.length) { setLoading(false); return; }
    const ids = members.map(m => m.user_id);

    (async () => {
      const { data } = await supabase
        .from("credits")
        .select("id, project_name, role, thumbnail_url, primary_media_url, verification_status, user_id, year, credit_category")
        .in("user_id", ids)
        .not("thumbnail_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);

      const memberMap = new Map(members.map(m => [m.user_id, m]));
      const enriched = (data || []).map((c: any) => ({
        ...c,
        author: memberMap.get(c.user_id),
      }));
      setFeatured(enriched);

      // Top creator = most verified credits in the circle
      if (enriched.length) {
        const counts = new Map<string, number>();
        enriched.forEach((c: any) => {
          if (c.verification_status === "verified") {
            counts.set(c.user_id, (counts.get(c.user_id) || 0) + 1);
          }
        });
        const topId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topId) setTopCreator({ ...memberMap.get(topId), verifiedCount: counts.get(topId) });
      }
      setLoading(false);
    })();
  }, [circleId, members]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!featured.length) {
    return (
      <div className="px-4">
        <Card className="p-8 text-center border-dashed">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-sm mb-1">No spotlight yet</p>
          <p className="text-xs text-muted-foreground">
            When members add verified credits, their best work will appear here.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-5">
      {/* Top Creator */}
      {topCreator && (
        <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Top Creator</p>
          </div>
          <button
            onClick={() => navigate(`/u/${topCreator.user_id}`)}
            className="flex items-center gap-3 w-full text-left"
          >
            <Avatar className="h-12 w-12 ring-2 ring-primary/30">
              <AvatarImage src={topCreator.avatar_url || ""} />
              <AvatarFallback>{topCreator.full_name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{topCreator.full_name}</p>
              <p className="text-[11px] text-muted-foreground">
                {topCreator.verifiedCount} verified credit{topCreator.verifiedCount !== 1 ? "s" : ""} in this circle
              </p>
            </div>
          </button>
        </Card>
      )}

      {/* Spotlight grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-accent" />
          <h3 className="font-bold text-sm">Featured Work</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">{featured.length}</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {featured.map((c: any) => (
            <button
              key={c.id}
              onClick={() => navigate(`/credit/${c.id}`)}
              className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 hover:border-primary/50 transition-all"
            >
              <img
                src={c.thumbnail_url || c.primary_media_url}
                alt={c.project_name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2">
                <p className="text-[11px] font-bold text-white line-clamp-1">{c.project_name}</p>
                <p className="text-[9px] text-white/70 line-clamp-1">{c.role}{c.year ? ` · ${c.year}` : ""}</p>
              </div>
              {c.verification_status === "verified" && (
                <div className="absolute top-1.5 right-1.5 bg-primary/90 backdrop-blur rounded-full p-1">
                  <Award className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
