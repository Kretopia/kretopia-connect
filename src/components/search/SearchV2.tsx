import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Sparkles } from "lucide-react";

import { SEO } from "@/components/SEO";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface SearchV2Props {
  initialQuery?: string;
}

export function SearchV2({ initialQuery = "" }: SearchV2Props = {}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const startedRef = useRef(false);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const canTrackSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (!canTrackSearch) {
      startedRef.current = false;
      return;
    }

    if (startedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      analytics.creativeSearchStarted(trimmedQuery);
      startedRef.current = true;
    }, 350);

    return () => window.clearTimeout(timer);
  }, [canTrackSearch, trimmedQuery]);

  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (value.trim().length < 2) {
      startedRef.current = false;
    }
  };


  return (
    <div className="relative z-[60]">
      <SEO
        title="Creative Work Search — Kretopia"
        description="Search public creators, creative work, productions, and opportunities on Kretopia."
      />

<FeaturePageHeader
        eyebrow="Creative Work"
        title="Find the work"
        accentTitle="that moves you."
        subtitle="Search creators, roles, productions, and real opportunities across Kretopia."
        tabs={
          
            <div className="relative z-[700]">
              <UnifiedSearchDropdown
                variant="hero"
                placeholder="Search people, roles, projects, or opportunities…"
                value={query}
                onValueChange={handleQueryChange}
                autoFocus
                className="relative z-[70] text-left"
                style={{ backgroundColor: 'transparent' }}
                showEmptyState={false}
              />
            </div>

         


        }
      />

       
 
 
    </div>
  );
}

export default SearchV2;