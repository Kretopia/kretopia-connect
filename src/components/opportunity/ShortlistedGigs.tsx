import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, MapPin, ExternalLink, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ScoutEvidence } from "./ScoutEvidence";
import { useOptionalScoutScan } from "@/components/scout/scoutScanContext";
import { ScoutGigCard } from "@/components/scout/ScoutGigCard";
import { gigStatesById } from "@/components/scout/gigState";

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
  source: string;
  compensation: string | null;
  fit_reason: string | null;
  scouted_at: string;
  posted_at: string | null;
  /** When this person saved it (the action's own timestamp), not when Scout found it. */
  saved_at: string | null;
}

/**
 * Saved gigs (shortlist). Pulls scouted_gig_actions where action='saved'
 * and joins the underlying scouted_gigs row.
 */
export function ShortlistedGigs({ onOpenForYou }: { onOpenForYou?: () => void } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scan = useOptionalScoutScan();
  const gigStates = useMemo(() => gigStatesById(scan?.actions ?? []), [scan?.actions]);
  const queryKey = ["shortlisted-gigs", user?.id];
  const { data: gigs = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      // Fetch all 'saved' actions then their gigs (subset is small).
      const { data: actions } = await supabase
        .from("scouted_gig_actions")
        .select("scouted_gig_id, created_at")
        .eq("user_id", user.id)
        .eq("action", "saved")
        .order("created_at", { ascending: false })
        .limit(60);

      const ids = (actions || []).map((a) => a.scouted_gig_id);
      if (ids.length === 0) return [] as ScoutedGig[];

      const { data: rows } = await supabase
        .from("scouted_gigs")
        .select("id, title, company, location, remote, description, image_url, apply_url, source_url, source, compensation, fit_reason, scouted_at, posted_at")
        .in("id", ids);

      // Preserve action ordering (most recently saved first) and keep when each was saved
      const order = new Map(ids.map((id, i) => [id, i]));
      const savedAt = new Map((actions || []).map((a) => [a.scouted_gig_id, a.created_at as string | null]));
      return ((rows || []) as Omit<ScoutedGig, "saved_at">[])
        .map((r) => ({ ...r, saved_at: savedAt.get(r.id) ?? null }))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) as ScoutedGig[];
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
        {onOpenForYou && (
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={onOpenForYou}>
            See gigs for you
          </Button>
        )}
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
          <ScoutGigCard key={g.id} title={g.title} image={g.image_url} href={g.apply_url || g.source_url} pay={g.compensation}
            badges={gigStates.get(g.id) && <Badge variant="outline" title={gigStates.get(g.id)?.hint} className="bg-background/90 text-[10px]">{gigStates.get(g.id)?.label}</Badge>}
            footer={<div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">{g.saved_at ? `Saved ${formatDistanceToNow(new Date(g.saved_at), { addSuffix: true })}` : `Found ${formatDistanceToNow(new Date(g.scouted_at), { addSuffix: true })}`}</span>
              <div className="flex items-center gap-1"><Button asChild size="sm" variant="outline" className="min-h-11"><a href={g.apply_url || g.source_url} target="_blank" rel="noopener noreferrer">Apply <ExternalLink className="ml-1 h-3 w-3" /></a></Button><Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => unsave(g.id)} title="Remove from shortlist" aria-label={`Remove ${g.title} from shortlist`}><X className="h-4 w-4" /></Button></div>
            </div>}>
            {(g.company || g.location) && <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">{g.company}{g.location && <><MapPin className="h-3 w-3" />{g.location}</>}{g.remote && <Badge variant="outline">Remote</Badge>}</p>}
            <ScoutEvidence gig={g} compact />
          </ScoutGigCard>
        ))}
      </div>
    </div>
  );
}
