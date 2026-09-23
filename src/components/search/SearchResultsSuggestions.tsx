import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import GigCard, { type GigOpportunity, type GigCreatorProfile } from "@/components/opportunity/GigCard";
import { PassportPreviewCard } from "@/components/passport/PassportPreviewCard";
import {
  buildMyMatchContext,
  computeMatchScore,
  extractSkillsArray,
  fetchPastCollaboratorIds,
  type MyMatchContext,
} from "@/lib/matchScoring";
import { computeOpportunityMatch, type ViewerProfileForMatch } from "@/lib/opportunityMatch";

interface Props {
  query: string;
  userId?: string | null;
}

interface CreatorSuggestion {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  role: string | null;
  sub_roles: string[] | null;
  location: string | null;
  /** Only present for the signed-in path (real `profiles` read) -- the
   *  anonymous path reads public_profiles_safe, which doesn't expose it. */
  average_rating?: number | null;
  /** Only present for the anonymous path -- used as its ranking signal
   *  in place of average_rating. */
  level?: number | null;
  match_score?: number;
  match_reason?: string;
}

interface ScoredOpportunity {
  opp: GigOpportunity;
  score: number | null;
}

/**
 * What a "no results" search renders instead of a dead end: real
 * opportunities and creators pulled from the same pools + scoring logic
 * already used on Scout/Discover (src/lib/opportunityMatch.ts,
 * src/lib/matchScoring.ts) -- never a fabricated "you might like" list.
 * Signed out (or a profile with no role/skills yet) falls back to the
 * most recent active opportunities and best-rated creators, with no
 * personalization claimed.
 */
export function SearchResultsSuggestions({ query, userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<ScoredOpportunity[]>([]);
  const [oppCreators, setOppCreators] = useState<Record<string, GigCreatorProfile>>({});
  const [creators, setCreators] = useState<CreatorSuggestion[]>([]);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let viewer: ViewerProfileForMatch | null = null;
        let myContext: MyMatchContext | null = null;

        if (userId) {
          const [{ data: meProfile }, pastCollabIds] = await Promise.all([
            supabase
              .from("profiles")
              .select("role, sub_roles, location, professional_skills, passion_skills")
              .eq("user_id", userId)
              .maybeSingle(),
            fetchPastCollaboratorIds(userId),
          ]);
          if (meProfile && (meProfile.role || meProfile.professional_skills)) {
            myContext = buildMyMatchContext(meProfile, pastCollabIds);
            viewer = {
              skills: [
                ...extractSkillsArray(meProfile.professional_skills),
                ...extractSkillsArray(meProfile.passion_skills),
              ],
              role: meProfile.role || "",
              location: meProfile.location || "",
            };
          }
        }

        const { data: oppRows } = await supabase
          .from("opportunities")
          .select(OPPORTUNITY_PUBLIC_COLUMNS)
          .in("status", ["active", "open"])
          .order("created_at", { ascending: false })
          .limit(40);

        const scored: ScoredOpportunity[] = ((oppRows || []) as unknown as GigOpportunity[])
          .map((opp) => ({ opp, score: viewer ? computeOpportunityMatch(opp, viewer) : null }))
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 6);

        let creatorLookup: Record<string, GigCreatorProfile> = {};
        const oppCreatorIds = [...new Set(scored.map((s) => s.opp.created_by).filter(Boolean))] as string[];
        if (oppCreatorIds.length > 0) {
          const { data: gprofiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, role")
            .in("user_id", oppCreatorIds);
          creatorLookup = Object.fromEntries((gprofiles || []).map((p) => [p.user_id, p]));
        }

        // `profiles` RLS has no broad anonymous-read policy -- an anon
        // request against it returns 200 with an empty array, not an
        // error, so this was silently dropping the whole creators section
        // for signed-out visitors. public_profiles_safe is the same view
        // CreatorOrbitLoader already uses for anonymous-safe discovery;
        // it's missing average_rating/is_claimed, so the ranking and
        // ghost-profile filter both adapt to what's actually available.
        let creatorRows: any[];
        if (userId) {
          let q = supabase
            .from("profiles")
            .select(
              "user_id, full_name, avatar_url, cover_image_url, role, sub_roles, location, professional_skills, average_rating, is_claimed, badge",
            )
            .eq("onboarding_completed", true)
            .not("full_name", "is", null)
            .not("avatar_url", "is", null)
            .neq("avatar_url", "")
            .neq("user_id", userId)
            .limit(60);
          const { data } = await q;
          creatorRows = ((data || []) as any[]).filter(
            (r) => r.full_name?.trim() && r.role?.trim() && r.avatar_url && !(r.is_claimed === false && r.badge !== "odos"),
          );
        } else {
          const { data } = await supabase
            .from("public_profiles_safe")
            .select("user_id, full_name, avatar_url, cover_image_url, role, sub_roles, location, professional_skills, badge, level")
            .eq("onboarding_completed", true)
            .not("full_name", "is", null)
            .not("avatar_url", "is", null)
            .neq("avatar_url", "")
            .limit(60);
          creatorRows = ((data || []) as any[]).filter((r) => r.full_name?.trim() && r.role?.trim() && r.avatar_url && r.user_id);
        }

        if (myContext) {
          creatorRows = creatorRows
            .map((r) => {
              const { score, ...signals } = computeMatchScore(myContext!, {
                userId: r.user_id,
                role: r.role,
                subRoles: r.sub_roles,
                location: r.location,
                skills: extractSkillsArray(r.professional_skills),
              });
              const reason = signals.pastCollab
                ? "You've worked together before"
                : signals.sameSector
                ? "Same sector as you"
                : signals.sameCity
                ? "Same city as you"
                : signals.skillOverlapRatio > 0.2
                ? "Shares your skills"
                : undefined;
              return { ...r, match_score: Math.round(score), match_reason: reason };
            })
            .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        } else if (userId) {
          creatorRows = creatorRows.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        } else {
          // No average_rating in the safe view -- level is the closest
          // real "notable on Kretopia" signal available to an anon reader.
          creatorRows = creatorRows.sort((a, b) => (b.level || 0) - (a.level || 0));
        }

        if (!cancelled) {
          setOpportunities(scored);
          setOppCreators(creatorLookup);
          setCreators(creatorRows.slice(0, 6));
          setPersonalized(!!viewer);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Finding what fits you…</p>
      </div>
    );
  }

  const nothingToShow = opportunities.length === 0 && creators.length === 0;

  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <Search className="h-8 w-8 text-primary/50" aria-hidden />
        <h1 className="text-xl font-bold text-foreground">No results for &ldquo;{query}&rdquo;</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {personalized
            ? "Nothing matched exactly — but here's what fits your Passport right now."
            : "Nothing matched exactly — here's what's active on Kretopia right now."}
        </p>
        {!userId && (
          <Link to="/auth?tab=signup" className="mt-1 text-sm font-semibold text-primary hover:underline">
            Sign up to get suggestions tailored to your Passport →
          </Link>
        )}
      </div>

      {opportunities.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {personalized ? "Opportunities that fit you" : "Active opportunities"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {opportunities.map(({ opp, score }) => (
              <GigCard
                key={opp.id}
                opportunity={opp}
                creator={oppCreators[opp.created_by || ""] || null}
                matchScore={score}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {creators.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {personalized ? "Creators that fit you" : "Creators on Kretopia"}
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {creators.map((c) => (
              <PassportPreviewCard
                key={c.user_id}
                userId={c.user_id}
                fullName={c.full_name}
                avatarUrl={c.avatar_url}
                coverImageUrl={c.cover_image_url}
                role={c.role}
                subRoles={c.sub_roles}
                matchScore={c.match_score}
                reason={c.match_reason}
              />
            ))}
          </div>
        </section>
      )}

      {nothingToShow && (
        <p className="text-center text-sm text-muted-foreground">Nothing active on Kretopia right now — check back soon.</p>
      )}
    </div>
  );
}

export default SearchResultsSuggestions;
