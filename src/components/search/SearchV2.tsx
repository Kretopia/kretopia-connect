import { useEffect, useRef, useState } from "react";
import { Radar } from "lucide-react";
import { SEO } from "@/components/SEO";
import { EmptyState } from "@/components/ui/empty-state";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { analytics } from "@/lib/analytics";

/**
 * Search V2 — the premium Creative Record discovery entry point.
 * FEATURE_SEARCH_V2, default off; mounted from Search.tsx behind the flag.
 *
 * Deliberately does not reimplement live search: UnifiedSearchDropdown
 * already does dynamic-as-you-type profile/credit/gig/web search (used by
 * Navbar, Home, and two landing pages today) — reusing it here means zero
 * new Supabase queries and zero duplicated search logic. This component is
 * the premium page shell + framing around it, not a second search engine.
 */
export function SearchV2({ initialQuery = "" }: { initialQuery?: string } = {}) {
  const [query, setQuery] = useState(initialQuery);

  const startedRef = useRef(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    const timer = setTimeout(() => {
      analytics.creativeSearchStarted(trimmed);
      startedRef.current = true;
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Search — Kretopia"
        description="Find your creative identity — search creators, productions & opportunities across the creative economy."
      />

      <FeaturePageHeader
        eyebrow="Creative Record"
        title="Find your"
        accentTitle="creative identity."
        subtitle="Search your name, a collaborator's, or any production — backed by verified credits across the creative economy."
        tabs={
          <UnifiedSearchDropdown
            variant="hero"
            placeholder="Search your name, a project, a production..."
            value={query}
            onValueChange={setQuery}
            autoFocus
            className="text-left"
          />
        }
      />

      <StudioFeatureShell>
        {query.trim().length < 2 && (
          <div className="max-w-2xl mx-auto">
            <EmptyState
              icon={Radar}
              eyebrow="How it works"
              title="Your work, wherever it lives"
              description="Search pulls from Kretopia's own creator base and the open web — if your credits exist anywhere, we'll surface them and help you claim your Passport."
              accent="purple"
            />
          </div>
        )}
      </StudioFeatureShell>
    </div>
  );
}

export default SearchV2;
