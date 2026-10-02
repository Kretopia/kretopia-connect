import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { SEO } from "@/components/SEO";
import { SearchV2 } from "@/components/search/SearchV2";
import { SearchResultsSuggestions } from "@/components/search/SearchResultsSuggestions";
import GigCard, { type GigOpportunity, type GigCreatorProfile } from "@/components/opportunity/GigCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLoader } from "@/components/brand/BrandDots";
import { PageBackButton } from "@/components/navigation/PageBackButton";

interface CreatorResult {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
  is_connected?: boolean;
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
    if (q.length < 1) {
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
        const profileSource = user ? "profiles" : "public_profiles_safe";
        const [nameMatches, profilesRes, creditsRes, oppsRes] = await Promise.all([
          supabase.from(profileSource)
            .select("user_id, full_name, avatar_url, role, location")
            .ilike("full_name", `${q}%`)
            .limit(48),
          user ? supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, role, location, is_claimed")
            .or(`full_name.ilike.${likeQ},role.ilike.${likeQ},location.ilike.${likeQ}`)
            .or("onboarding_completed.eq.true,is_claimed.eq.false")
            .limit(48) : supabase
            .from("public_profiles_safe")
            .select("user_id, full_name, avatar_url, role, location")
            .eq("onboarding_completed", true)
            .or(`full_name.ilike.${likeQ},role.ilike.${likeQ},location.ilike.${likeQ}`)
            .limit(48),
          q.length >= 2 ? supabase
            .from("credits")
            .select("id, project_name, role, year, thumbnail_url")
            .or(`project_name.ilike.${likeQ},role.ilike.${likeQ}`)
            .limit(18) : Promise.resolve({ data: [] }),
          q.length >= 2 ? supabase
            .from("opportunities")
            .select(OPPORTUNITY_PUBLIC_COLUMNS)
            .eq("status", "active")
            .or(`title.ilike.${likeQ},location.ilike.${likeQ},type.ilike.${likeQ}`)
            .limit(18) : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;

        let connectedIds = new Set<string>();
        if (user?.id && (profilesRes.data?.length || nameMatches.data?.length)) {
          const { data: links } = await supabase.from("connections")
            .select("user_id, connected_user_id")
            .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
            .eq("status", "accepted");
          if (cancelled) return;
          connectedIds = new Set((links || []).map(link => link.user_id === user.id ? link.connected_user_id : link.user_id));
        }

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
          const merged = [...(nameMatches.data || []), ...(profilesRes.data || [])] as CreatorResult[];
          setCreators(merged
            .filter(profile => profile.user_id && profile.full_name)
            .filter((profile, index, all) => all.findIndex(other => other.user_id === profile.user_id) === index)
            .map(profile => ({ ...profile, is_connected: connectedIds.has(profile.user_id) }))
            .sort((a, b) => Number(b.is_connected) - Number(a.is_connected)
              || Number(b.full_name?.toLowerCase().startsWith(q.toLowerCase())) - Number(a.full_name?.toLowerCase().startsWith(q.toLowerCase()))
              || (a.full_name || "").localeCompare(b.full_name || "")));
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
  }, [q, user?.id]);

  const hasResults = creators.length + credits.length + gigs.length > 0;

  return (
    <div className="relative min-h-screen bg-background">
      <SEO
        title={q ? `"${q}" — Search — Kretopia` : "Search — Kretopia"}
        description="Search creators, credits and opportunities on Kretopia."
      />
      <PageBackButton />
      <SearchV2 initialQuery={q} />

      <div className="relative z-0 mx-auto max-w-5xl bg-background px-4 py-10 sm:px-6 lg:px-8">
        {q.length < 1 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Search creators, credits and opportunities across Kretopia.
          </p>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <BrandLoader fullscreen={false} />
            <p className="text-sm text-muted-foreground">Searching Kretopia…</p>
          </div>
        ) : hasResults ? (
          <div className="space-y-8">
            {creators.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Users</h2>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
                  {creators.map((c) => (
                    <Link
                      key={c.user_id}
                      to={`/profile/${c.user_id}`}
                      className="group flex min-h-20 min-w-0 items-center gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-energy/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-energy"
                    >
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarImage src={c.avatar_url || ""} />
                        <AvatarFallback>{(c.full_name || "?")[0]}</AvatarFallback>
                      </Avatar>
                       <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{c.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.role, c.location].filter(Boolean).join(" · ")}
                        </p>
                        {c.is_connected && <p className="mt-1 text-xs font-semibold text-energy">Connected</p>}
                      </div>
                       <span className="shrink-0 text-xs font-semibold text-primary">{user ? "View Passport" : "Sign up to view"} <ArrowRight className="inline h-3 w-3" /></span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {credits.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Projects</h2>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
                  {credits.map((c) => (
                    <Link
                      key={c.id}
                      to={`/production?name=${encodeURIComponent(c.project_name)}`}
                      className="group flex min-h-20 min-w-0 items-center gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-energy/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-energy"
                    >
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-energy/10 text-energy"><BriefcaseBusiness className="h-5 w-5" /></div>
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
