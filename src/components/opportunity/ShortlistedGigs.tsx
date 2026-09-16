import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, MapPin, ExternalLink, X, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ScoutedGig {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  description: string | null;
  image_url: string | null;
  apply_url: string | null;
  source_url: string;
  fit_score: number;
  fit_reason: string | null;
  scouted_at: string;
}

/**
 * Saved gigs (shortlist). Pulls scouted_gig_actions where action='saved'
 * and joins the underlying scouted_gigs row.
 */
export function ShortlistedGigs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const queryKey = ["shortlisted-gigs", user?.id];
  const { data: gigs = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      // Fetch all 'saved' actions then their gigs (subset is small).
      const { data: actions } = await supabase
        .from("scouted_gig_actions")
        .select("scouted_gig_id, created_at")
        .eq("user_id", user!.id)
        .eq("action", "saved")
        .order("created_at", { ascending: false })
        .limit(60);

      const ids = (actions || []).map((a) => a.scouted_gig_id);
      if (ids.length === 0) return [] as ScoutedGig[];

      const { data: rows } = await supabase
        .from("scouted_gigs")
        .select("id, title, company, location, remote, description, image_url, apply_url, source_url, fit_score, fit_reason, scouted_at")
        .in("id", ids);

      // Preserve action ordering (most recently saved first)
      const order = new Map(ids.map((id, i) => [id, i]));
      return ((rows || []) as ScoutedGig[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
    enabled: !!user,
  });

  const unsave = async (gigId: string) => {
    if (!user) return;
    await supabase
      .from("scouted_gig_actions")
      .delete()
      .eq("user_id", user.id)
      .eq("scouted_gig_id", gigId)
      .eq("action", "saved");
    queryClient.setQueryData<ScoutedGig[]>(queryKey, (prev) => (prev ?? []).filter((g) => g.id !== gigId));
    toast({ title: "Removed from shortlist" });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (gigs.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
          <Bookmark className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">Nothing shortlisted yet</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Tap the bookmark on any scouted gig to save it here. Great for stacking applications to do later.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        {gigs.length} gig{gigs.length === 1 ? "" : "s"} saved — apply when you're ready.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {gigs.map((g) => (
          <Card key={g.id} className="overflow-hidden flex flex-col">
            {g.image_url && !failedImages.has(g.id) && (
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                <img
                  src={g.image_url}
                  alt={g.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setFailedImages((prev) => new Set(prev).add(g.id))}
                />
              </div>
            )}
            <div className="p-3 flex flex-col gap-2 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold leading-tight line-clamp-2 flex-1">{g.title}</h3>
                <Badge className="h-5 text-[10px] bg-energy/15 text-energy border-energy/30 shrink-0">
                  {g.fit_score}% fit
                </Badge>
              </div>
              {(g.company || g.location) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  {g.company && <span className="font-medium text-foreground/80">{g.company}</span>}
                  {g.location && <><span>·</span><MapPin className="h-3 w-3" />{g.location}</>}
                  {g.remote && <Badge variant="outline" className="h-4 text-[9px] px-1">Remote</Badge>}
                </p>
              )}
              {g.fit_reason && (
                <p className="text-[11px] leading-snug text-foreground/70 line-clamp-2 flex gap-1">
                  <Sparkles className="h-3 w-3 text-energy shrink-0 mt-0.5" />
                  <span>{g.fit_reason}</span>
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-muted-foreground">
                  Saved {formatDistanceToNow(new Date(g.scouted_at), { addSuffix: true })}
                </span>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <a href={g.apply_url || g.source_url} target="_blank" rel="noopener noreferrer">
                      Apply <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => unsave(g.id)}
                    title="Remove from shortlist"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
