import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { SEO } from "@/components/SEO";
import { SearchV2 } from "@/components/search/SearchV2";
import { SearchResultsSuggestions } from "@/components/search/SearchResultsSuggestions";
import GigCard, { type GigOpportunity, type GigCreatorProfile } from "@/components/opportunity/GigCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CreatorResult {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
}

interface CreditResult {
  id: string;
  project_name: string;
  role: string | null;
  year: number | null;
  thumbnail_url: string | null;
}

/**
 * /search — the full results page a deep search (Enter/submit from any
 * search bar, or the navbar) lands on, seeded with ?q=. Distinct from
 * UnifiedSearchDropdown's inline autocomplete: real results across
 * creators/credits/opportunities by role, location and type of work, and
 * when nothing matches, real suggestions instead of a dead end (see
 * SearchResultsSuggestions.tsx).
 */
export default function SearchResults() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<CreatorResult[]>([]);
  const [credits, setCredits] = useState<CreditResult[]>([]);
  const [gigs, setGigs] = useState<GigOpportunity[]>([]);
  const [gigCreators, setGigCreators] = useState<Record<string, GigCreatorProfile>>({});

  useEffect(() => {
    let cancelled = false;
    if (q.length < 2) {
      setLoading(false);
      setCreators([]);
      setCredits([]);
      setGigs([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const likeQ = escapePostgrestValue(`%${q}%`);
        const [profilesRes, creditsRes, oppsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, role, location, is_claimed")
            .or(`full_name.ilike.${likeQ},role.ilike.${likeQ},location.ilike.${likeQ}`)
            .or("onboarding_completed.eq.true,is_claimed.eq.false")
            .limit(24),
          supabase
            .from("credits")
            .select("id, project_name, role, year, thumbnail_url")
            .or(`project_name.ilike.${likeQ},role.ilike.${likeQ}`)
            .limit(18),
          supabase
            .from("opportunities")
            .select(OPPORTUNITY_PUBLIC_COLUMNS)
            .eq("status", "active")
            .or(`title.ilike.${likeQ},location.ilike.${likeQ},type.ilike.${likeQ}`)
            .limit(18),
        ]);
        if (cancelled) return;

        const oppRows = (oppsRes.data || []) as unknown as GigOpportunity[];
        let creatorLookup: Record<string, GigCreatorProfile> = {};
        const oppCreatorIds = [...new Set(oppRows.map((o) => o.created_by).filter(Boolean))] as string[];
        if (oppCreatorIds.length > 0) {
          const { data: gprofiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, role")
            .in("user_id", oppCreatorIds);
          creatorLookup = Object.fromEntries((gprofiles || []).map((p) => [p.user_id, p]));
        }

        if (!cancelled) {
          setCreators((profilesRes.data || []) as CreatorResult[]);
          setCredits((creditsRes.data || []) as CreditResult[]);
          setGigs(oppRows);
          setGigCreators(creatorLookup);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const hasResults = creators.length + credits.length + gigs.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={q ? `"${q}" — Search — Kretopia` : "Search — Kretopia"}
        description="Search creators, credits and opportunities on Kretopia."
      />
      <SearchV2 initialQuery={q} />

      <div className="relative z-0 mx-auto max-w-5xl bg-background px-4 py-10 sm:px-6 lg:px-8">
        {q.length < 2 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Search creators, credits and opportunities across Kretopia.
          </p>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Searching Kretopia…</p>
          </div>
        ) : hasResults ? (
          <div className="space-y-10">
            {creators.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Users</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {creators.map((c) => (
                    <Link
                      key={c.user_id}
                      to={`/profile/${c.user_id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarImage src={c.avatar_url || ""} />
                        <AvatarFallback>{(c.full_name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{c.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.role, c.location].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {credits.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Creative Work</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {credits.map((c) => (
                    <Link
                      key={c.id}
                      to={`/production?name=${encodeURIComponent(c.project_name)}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{c.project_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.role, c.year].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {gigs.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Opportunities</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {gigs.map((g) => (
                    <GigCard key={g.id} opportunity={g} creator={gigCreators[g.created_by || ""] || null} compact />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <SearchResultsSuggestions query={q} userId={user?.id || null} />
        )}
      </div>
    </div>
  );
}
