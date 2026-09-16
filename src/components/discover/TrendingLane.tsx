import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ShieldCheck, Handshake, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrendingCreator {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
  vouch_count: number;
}

interface NewCredit {
  id: string;
  project_name: string | null;
  role: string | null;
  user_id: string;
  thumbnail_url: string | null;
  created_at: string;
}

/**
 * Trending lane — light v1.
 * - Rising creators: most co-signs in the last 14 days
 * - New on Kretopia: recently added verified credits
 * - Co-sign nudges: prompt to vouch for collaborators (placeholder card linking to Passport)
 */
export const TrendingLane = () => {
  const [risingCreators, setRisingCreators] = useState<TrendingCreator[]>([]);
  const [newCredits, setNewCredits] = useState<NewCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const [vouchRes, creditRes] = await Promise.all([
        supabase
          .from("credit_vouches")
          .select("credit_id, credits(user_id)")
          .gte("created_at", since)
          .limit(200),
        supabase
          .from("credits")
          .select("id, project_name, role, user_id, thumbnail_url, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]).catch(() => [{ data: [] }, { data: [] }] as any);

      // Tally vouches per credit owner
      const tally: Record<string, number> = {};
      ((vouchRes as any).data || []).forEach((v: any) => {
        const ownerId = v.credits?.user_id;
        if (ownerId) tally[ownerId] = (tally[ownerId] || 0) + 1;
      });
      const topIds = Object.keys(tally)
        .sort((a, b) => tally[b] - tally[a])
        .slice(0, 6);

      let creators: TrendingCreator[] = [];
      if (topIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role")
          .in("user_id", topIds);
        creators = (profs || []).map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role,
          vouch_count: tally[p.user_id] || 0,
        })).sort((a, b) => b.vouch_count - a.vouch_count);
      }

      if (!cancelled) {
        setRisingCreators(creators);
        setNewCredits(((creditRes as any).data || []) as NewCredit[]);
        setLoading(false);
      }
    };
    load().catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-8 justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the pulse…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rising creators */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="h-4 w-4 text-[hsl(var(--energy))]" />
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            Rising this fortnight
          </h3>
        </div>
        {risingCreators.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-xs text-muted-foreground">
              No co-signs yet this fortnight. Be the first to vouch.
            </CardContent>
          </Card>
        ) : (
          <div className="-mx-3 px-3 overflow-x-auto scrollbar-none">
            <div className="flex gap-3 pb-1">
              {risingCreators.map((c) => (
                <Link
                  key={c.user_id}
                  to={`/u/${c.user_id}`}
                  className="shrink-0 w-[160px] rounded-2xl border border-border bg-card hover:border-[hsl(var(--energy))]/40 transition-colors p-3 text-center"
                >
                  <Avatar className="h-14 w-14 mx-auto mb-2">
                    <AvatarImage src={c.avatar_url || undefined} />
                    <AvatarFallback>{c.full_name?.[0] ?? "U"}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-sm truncate">{c.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{c.role ?? "Creative"}</p>
                  <Badge variant="secondary" className="mt-2 text-[10px] gap-1">
                    <Handshake className="h-3 w-3" />
                    {c.vouch_count} co-sign{c.vouch_count === 1 ? "" : "s"}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* New on Kretopia */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <ShieldCheck className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            New on Kretopia
          </h3>
        </div>
        {newCredits.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-xs text-muted-foreground">
              Quiet on the wire. Add a Stamp to your Passport to kick things off.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {newCredits.map((cr) => (
              <Link
                key={cr.id}
                to={`/credit/${cr.id}`}
                className="rounded-xl border border-border bg-card overflow-hidden hover:border-[hsl(var(--signal-teal))]/40 transition-colors"
              >
                <div className="aspect-video bg-muted">
                  {cr.thumbnail_url && !failedThumbs.has(cr.id) && (
                    <img
                      src={cr.thumbnail_url}
                      alt={cr.project_name ?? ""}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() => setFailedThumbs((prev) => new Set(prev).add(cr.id))}
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold truncate">{cr.project_name || "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{cr.role || "Credit"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Co-sign nudge */}
      <Card className="border-[hsl(var(--energy))]/30 bg-[hsl(var(--energy))]/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-[hsl(var(--energy))]" />
            <p className="font-semibold text-sm">Give a co-sign</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Vouching for collaborators boosts their standing and yours. See who you've worked with on your Passport.
          </p>
          <Link to="/profile" className="text-xs font-semibold text-[hsl(var(--energy))] hover:underline">
            Open your Passport →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
