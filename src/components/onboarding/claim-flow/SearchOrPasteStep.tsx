import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Link2, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { toast } from "sonner";
import type { WebCreditResult } from "./types";

interface Props {
  initialQuery?: string;
  onResults: (results: WebCreditResult[], query: string) => void;
}

interface ProfileSuggestion {
  user_id: string;
  full_name: string;
  role: string | null;
  location: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  is_claimed: boolean | null;
}

const URL_RX = /^https?:\/\//i;
const KRETOPIA_GRADIENT =
  "linear-gradient(135deg, hsl(var(--energy)/0.35), hsl(var(--primary)/0.25))";

/** Step 1: search the Creative Universe or paste a portfolio link.
 *
 * Below the input, a live "Google-like" dropdown of existing Kretopia
 * profiles appears as the user types (debounced, 2+ chars) -- this is the
 * fast path: an instant DB lookup, separate from the slower "Continue"
 * action which kicks off a full web crawl (search-credits-web) for people
 * not on Kretopia yet. Distinct backends because a live crawl per keystroke
 * isn't a real option latency- or cost-wise; the profile match is.
 */
export const SearchOrPasteStep = ({ initialQuery = "", onResults }: Props) => {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isUrl = URL_RX.test(query.trim());
  const isLinkedIn = /linkedin\.com/i.test(query);

  // Live profile suggestions -- debounced, fires on every keystroke past 2 chars.
  useEffect(() => {
    const q = query.trim();
    if (isUrl || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSuggestLoading(true);
      try {
        const ev = escapePostgrestValue(`%${q}%`);
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, full_name, role, location, avatar_url, cover_image_url, is_claimed")
          .or(`full_name.ilike.${ev},role.ilike.${ev}`)
          .limit(6);
        if (controller.signal.aborted) return;
        if (error) throw error;
        setSuggestions((data || []) as ProfileSuggestion[]);
        setShowSuggestions(true);
        setHighlightedIndex(-1);
      } catch {
        // A failed live-suggestion lookup shouldn't block typing or the
        // explicit "Continue" search -- just show nothing this keystroke.
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggestLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, isUrl]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setShowSuggestions(false);
    setLoading(true);
    try {
      if (isLinkedIn) {
        toast.warning("LinkedIn blocks scraping", {
          description: "Try IMDb, Behance, your personal site, or just search by name.",
        });
        setLoading(false);
        return;
      }
      console.info("[ClaimFlow] searching for", q);

      // Reuse cached results within 24h so the same name doesn't return a different person
      const cacheKey = `claim_search:${q.toLowerCase()}`;
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.ts && Date.now() - parsed.ts < 24 * 60 * 60 * 1000 && Array.isArray(parsed.results) && parsed.results.length > 0) {
            console.info("[ClaimFlow] using cached", parsed.results.length, "results");
            onResults(parsed.results, q);
            return;
          }
        }
      } catch {}

      const { data, error } = await supabase.functions.invoke("search-credits-web", {
        body: { query: q },
      });
      if (error) {
        console.error("[ClaimFlow] invoke error", error);
        throw error;
      }
      const rawResults: any[] = data?.results || [];
      const results: WebCreditResult[] = rawResults.map((r) => ({
        ...r,
        thumbnail: r.thumbnail || r.image_url || undefined,
      }));
      console.info("[ClaimFlow] received", results.length, "results");
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), query: q, results }));
      } catch {}
      if (results.length === 0) {
        toast.info("No matches yet", {
          description: "Try a different spelling, or paste a portfolio link.",
        });
      }
      onResults(results, q);
    } catch (e: any) {
      console.error("[ClaimFlow] search failed", e);
      toast.error("Search hiccup", {
        description: e?.message || "Please try again in a moment.",
      });
      // Don't advance to empty state — let user retry
    } finally {
      setLoading(false);
    }
  }, [query, isLinkedIn, onResults]);

  const openSuggestion = (s: ProfileSuggestion) => {
    window.open(`/profile/${s.user_id}`, "_blank", "noopener,noreferrer");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
      if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        openSuggestion(suggestions[highlightedIndex]);
        return;
      }
    }
    if (e.key === "Enter") submit();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Find yourself</h2>
        <p className="text-sm text-muted-foreground">
          Search the Creative Universe for your projects, or paste a portfolio link.
        </p>
      </div>

      <div ref={containerRef} className="relative">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {isUrl ? <Link2 className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </span>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={onKeyDown}
            placeholder="Your name, a project, or paste imdb.com / behance.net / yoursite.com"
            className="pl-9 h-12 text-base"
            disabled={loading}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="claim-search-suggestions"
            aria-autocomplete="list"
          />
          {suggestLoading && (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Google-like suggestions dropdown -- fast DB match on existing
            Kretopia profiles, shown as soon as 2+ characters are typed. */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            id="claim-search-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl"
          >
            {suggestions.map((s, i) => {
              const cover = s.cover_image_url || s.avatar_url;
              const isHighlighted = i === highlightedIndex;
              return (
                <button
                  key={s.user_id}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onClick={() => openSuggestion(s)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isHighlighted ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <div
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-cover bg-center"
                    style={{
                      backgroundImage: cover ? `url(${cover})` : KRETOPIA_GRADIENT,
                    }}
                  >
                    {s.avatar_url && s.cover_image_url && (
                      <img
                        src={s.avatar_url}
                        alt=""
                        className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border border-background object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-foreground">{s.full_name}</p>
                      {s.is_claimed && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--energy))" }} />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[s.role, s.location].filter(Boolean).join(" · ") || "Kretopia creator"}
                    </p>
                  </div>
                  {s.is_claimed && (
                    <span className="shrink-0 rounded-full bg-[hsl(var(--energy)/0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--energy))" }}>
                      Has Passport
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Button
        onClick={submit}
        disabled={loading || query.trim().length < 2}
        className="w-full h-12 text-base"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching the Creative Universe…
          </>
        ) : (
          <>Continue</>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Tip: paste IMDb, Behance, Spotify, or your personal site for the best results.
      </p>
    </div>
  );
};
