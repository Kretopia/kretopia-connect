import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, Database, Briefcase, User, ArrowRight, X, UserCheck, Mic, Square, MapPin, Wand2, Lock, CalendarDays } from "lucide-react";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import { searchCatalog, CATALOG_KIND_LABEL, type CatalogEntry, type CatalogKind } from "@/lib/searchCatalog";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { VoiceWaveform } from "@/components/search/VoiceWaveform";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { PublicWebSearchResults } from "./PublicWebSearchResults";
import { searchVerificationUsers, VERIFICATION_SEARCH_PAGE_SIZE } from "@/lib/verificationUserSearch";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";
import { directTarget, opportunityTiming, queryClass, snippetAround, whyOpportunity, whyPerson, type RoutableResult } from "@/lib/searchResultView";
import { SEARCH_SCOPES, DEFAULT_SEARCH_SCOPE, isSearchScope, scopeSearchTarget, scopeSources, searchScopeMeta, type SearchScope } from "@/lib/heroSearchScope";
import { searchScoutPeople, scoutSearchTarget, SCOUT_PEOPLE_PAGE_SIZE } from "@/lib/scoutPeopleSearch";
import { HeroIntentPanel, type IntentResult } from "@/components/search/HeroIntentPanel";
import {
  exploreByTarget,
  searchEnterTarget,
  searchExploreBy,
  searchIntentTarget,
  type ExploreByCategoryId,
  type ExploreByItem,
  type SearchIntent,
} from "@/lib/searchIntent";

interface SearchResult {
  type: "creator" | "credit" | "gig" | "event";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  /** The miniature of a result (a photo, a poster, a project still): what it is at a glance. */
  thumbnail?: string | null;
  /** One line of evidence under the subtitle (the part of a bio that matched, a project's context). */
  detail?: string | null;
  /** Why the result appears: the field that matched the words, never a score. */
  why?: string | null;
  /** Timing, said honestly: a deadline, a date, the age of a post. */
  timing?: string | null;
  /** The timing says it is over: the row is not presented as open. */
  closed?: boolean;
  bio?: string;
  credits?: { project: string; role: string }[];
  is_claimed?: boolean;
  is_connected?: boolean;
}

/** The public columns each intent read returns (see opportunityColumns.ts: guest contact columns are never selected). */
interface OpportunityRow { id: string; title: string; type?: string | null; compensation?: string | null; location?: string | null; image_url?: string | null; application_deadline?: string | null; created_at?: string | null; skills?: string[] | null }
interface JamRow { id: string; title: string; start_time?: string | null; venue_name?: string | null; cover_image_url?: string | null }
interface CreditRow { id: string; project_name?: string | null; role?: string | null; year?: number | string | null; project_type?: string | null; thumbnail_url?: string | null }

interface UnifiedSearchDropdownProps {
  variant?: "hero" | "navbar" | "inline";
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  autoFocus?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  onSelect?: (result: SearchResult) => void;
  onQuerySubmit?: (query: string, scope?: SearchScope) => void;
  /** Whether to show this dropdown's own "No results found" panel when a
   *  query matches nothing. Defaults to true (the dropdown IS the whole
   *  results experience for the navbar/landing-hero usages). Pass false
   *  when this search bar sits on a page that already renders its own
   *  full "no results" experience below (e.g. SearchV2 on /search) --
   *  otherwise this floating solid-bg panel duplicates that page's own
   *  suggestions and visually sits on top of them. */
  showEmptyState?: boolean;
  /** Instant roles / skills / locations / work-type suggestions from one
   *  letter. Defaults to true for the hero variant. */
  showCatalog?: boolean;
  /** Member picker: first-letter, paged users only; no AI, web or voice calls. */
  usersOnly?: boolean;
  disabled?: boolean;
  /**
   * The landing hero's search: People / Skills / Opportunities say what is being looked for (Passport, Match, Scout), and Skills opens
   * "Explore by". Only meaningful with variant="hero"; the navbar and the share dialog leave it off and keep their own behaviour.
   */
  intentSearch?: boolean;
  /**
   * The hero's scoped search (needs `intentSearch`): compact topic labels on the bar (All first) narrow where the words are looked
   * for; the topic travels with the query, picks the sources asked while typing and the page Enter opens. Every topic answers inside
   * this one results panel. A guest sees that results exist but opens none of them without signing up: a quiet prompt in the panel
   * carries the topic and the words through sign-up and sign-in (the app's own post-auth return). The microphone and the clear
   * button are both kept, with a "Search" button at the end.
   */
  scopeSearch?: boolean;
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
  /** The topics shown as compact labels above the field, in order (default: every scope). */
  scopes?: readonly SearchScope[];
  /** Caps the results list to this height (any CSS length), for a host that knows how much room is left under the field. */
  resultsMaxHeight?: string;
}

const CATALOG_ICON: Record<CatalogKind, typeof User> = {
  role: User,
  skill: Wand2,
  location: MapPin,
  work: Briefcase,
};

const TYPE_META = {
  event: { label: "Event", icon: CalendarDays, color: "text-primary" },
  creator: { label: "Creator", icon: User, color: "text-primary" },
  credit: { label: "Credit", icon: Database, color: "text-accent" },
  gig: { label: "Gig", icon: Briefcase, color: "text-emerald-500" },
};

// Group headers for the mixed results list — "Users", "Creative Work" and
// "Opportunities" are the three canonical groups. Only real, existing
// database records are ever shown here — no AI-guessed or web-sourced
// suggestions when a name doesn't match anything real.
const RESULT_GROUP_LABEL: Record<SearchResult["type"], string> = {
  event: "Events",
  creator: "Users",
  credit: "Projects",
  gig: "Opportunities",
};

export function UnifiedSearchDropdown({
  variant = "navbar",
  placeholder = "Search users, work and opportunities",
  value,
  onValueChange,
  autoFocus = false,
  onOpenChange,
  className,
  onSelect,
  onQuerySubmit,
  showEmptyState = true,
  showCatalog,
  usersOnly = false,
  disabled = false,
  intentSearch = false,
  scopeSearch = false,
  scope: scopeProp,
  onScopeChange,
  scopes,
  resultsMaxHeight,
}: UnifiedSearchDropdownProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const intentMode = intentSearch && variant === "hero" && !usersOnly;
  const [exploreCategory, setExploreCategory] = useState<ExploreByCategoryId | null>(null);
  const [scopeState, setScopeState] = useState<SearchScope>(DEFAULT_SEARCH_SCOPE);
  /** The scope in force: only the hero's scoped search has one. */
  const scope: SearchScope | undefined = scopeSearch && intentMode ? scopeProp ?? scopeState : undefined;
  const topics = scopes && scopes.length > 0 ? scopes : SEARCH_SCOPES.map((m) => m.id);
  const pillsRef = useRef<HTMLDivElement>(null);
  const changeScope = (next: string, focusField = true) => {
    if (!isSearchScope(next)) return;
    setScopeState(next);
    onScopeChange?.(next);
    setExploreCategory(null);
    if (focusField) inputRef.current?.focus();
  };
  /** Left and right move between topics, as in any radio group; the field is not stolen while someone is on the labels. */
  const handleTopicKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = topics[(index + step + topics.length) % topics.length];
    changeScope(next, false);
    requestAnimationFrame(() => pillsRef.current?.querySelector<HTMLButtonElement>(`[data-scope-pill="${next}"]`)?.focus());
  };
  // The old catalog ("Roles") is what "Explore by" replaces, so the intent search never shows it.
  const catalogEnabled = !usersOnly && !intentMode && (showCatalog ?? variant === "hero");
  const minChars = intentMode ? 2 : usersOnly || catalogEnabled ? 1 : 2;
  const [internalQuery, setInternalQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  /** The words the current results answer: a direct route is only taken when they are the words just submitted. */
  const [resultsFor, setResultsFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedCreator, setHighlightedCreator] = useState<SearchResult | null>(null);
  const [error, setError] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [expandHeroUsers, setExpandHeroUsers] = useState(false);
  const usersOffsetRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Escape should close and stay closed — without this, refocusing the
  // input (to return focus after Escape) would immediately reopen the
  // dropdown via onFocus, since the query text is still present.
  const suppressReopenRef = useRef(false);
  const query = value ?? internalQuery;
  const listboxId = useRef(`search-results-${Math.random().toString(36).slice(2)}`).current;

  const setQuery = useCallback((nextValue: string) => {
    if (value === undefined) setInternalQuery(nextValue);
    onValueChange?.(nextValue);
  }, [onValueChange, value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOpenChange]);

  // Debounced search
  useEffect(() => {
    abortRef.current?.abort();
    setLoading(false);
    const trimmedQuery = query.trim();
    setExpandHeroUsers(false);
    if (intentMode) {
      setHasMoreUsers(false);
      setError(false);
      setHighlightedCreator(null);
      if (trimmedQuery.length < minChars) {
        // Under two letters there is nothing to fetch: "Explore by" and the matching areas are public vocabulary, answered on the spot.
        setResults([]);
        return;
      }
    } else if (trimmedQuery.length < minChars) {
      setOpen(false);
      onOpenChange?.(false);
      setResults([]);
      setError(false);
      setHighlightedCreator(null);
      return;
    }
    setOpen(true);
    onOpenChange?.(true);
    if (usersOnly || variant === "hero") {
      setResults([]);
      setHasMoreUsers(false);
      setLoading(true);
    }
    const timer = setTimeout(() => doSearch(trimmedQuery), usersOnly || variant === "hero" ? 150 : 350);
    return () => { clearTimeout(timer); abortRef.current?.abort(); };
  }, [query, usersOnly, user?.id, variant, intentMode, scope]);

  const doSearch = useCallback(async (q: string, appendUsers = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);
    setHighlightedCreator(null);

    try {
      if (intentMode) {
        // Only the sources of the scope are asked: all of them under All, one under a chosen scope. Everything here is public: the public
        // profile view, the public opportunity columns, public events and project credits. A guest gets all of it; Skills are answered
        // from the vocabulary and SoundStages opens its own page, so neither fetches anything.
        const want = scope ? scopeSources(scope) : { people: true, skills: true, opportunities: true, events: false, work: false, stages: false };
        const nothing = Promise.resolve(null);
        const like = escapePostgrestValue(`%${q}%`);
        // Public columns only (opportunities keeps its guest contact columns locked); the first read adds the miniature and the timing,
        // and if a deployment lacks one of them the read repeats with the basics, so a missing thumbnail never costs the answer.
        const readOpportunities = async () => {
          const rich = await supabase.from("opportunities").select("id, title, type, compensation, location, image_url, application_deadline, created_at, skills").eq("status", "active").ilike("title", `%${q}%`).limit(3);
          if (!rich.error) return rich;
          return supabase.from("opportunities").select("id, title, type, compensation, location").eq("status", "active").ilike("title", `%${q}%`).limit(3);
        };
        const [people, gigs, jams, credits] = await Promise.allSettled([
          want.people ? searchScoutPeople(q, 0) : nothing,
          want.opportunities ? readOpportunities() : nothing,
          want.events
            ? supabase
                .from("creative_jams")
                .select("id, title, start_time, venue_name, cover_image_url")
                .eq("is_public", true)
                .gte("start_time", new Date().toISOString())
                .or(`title.ilike.${like},venue_name.ilike.${like}`)
                .order("start_time", { ascending: true })
                .limit(3)
            : nothing,
          want.work ? supabase.from("credits").select("id, project_name, role, year, project_type, thumbnail_url").ilike("project_name", `%${q}%`).limit(8) : nothing,
        ]);
        if (controller.signal.aborted) return;
        const rowsOf = <T,>(outcome: PromiseSettledResult<unknown>): T[] | null => {
          if (outcome.status !== "fulfilled") return null;
          if (outcome.value === null) return [];
          const reply = outcome.value as { error: unknown; data: unknown[] | null };
          return reply.error ? null : ((reply.data ?? []) as T[]);
        };
        const gigRows = rowsOf<OpportunityRow>(gigs);
        const jamRows = rowsOf<JamRow>(jams);
        const peopleOk = people.status === "fulfilled";
        // It fails only when every source that was asked failed. Work is a bonus source: its absence is never an error.
        const failed = [want.people && !peopleOk, want.opportunities && gigRows === null, want.events && jamRows === null].filter(Boolean).length;
        const asked = [want.people, want.opportunities, want.events].filter(Boolean).length;
        if (asked > 0 && failed === asked) throw people.status === "rejected" ? people.reason : new Error("search failed");

        const peopleRows: SearchResult[] = people.status === "fulfilled" && people.value
          ? people.value.users.slice(0, 3).map((p) => {
              const why = whyPerson(q, { name: p.full_name, role: p.role, bio: p.bio, location: p.location });
              const evidence = snippetAround(p.bio, q);
              return {
                type: "creator" as const,
                id: p.user_id,
                title: p.full_name || "Kretopia user",
                subtitle: [p.role, p.location].filter(Boolean).join(" · "),
                avatar: p.avatar_url,
                thumbnail: p.avatar_url,
                why,
                detail: evidence && evidence !== why ? evidence : null,
              };
            })
          : [];
        const gigResults: SearchResult[] = (gigRows ?? []).map((o) => {
          const timing = opportunityTiming(o.application_deadline, o.created_at);
          return {
            type: "gig" as const,
            id: o.id,
            title: o.title,
            subtitle: [o.type, o.compensation, o.location].filter(Boolean).join(" · "),
            thumbnail: o.image_url ?? null,
            why: whyOpportunity(q, { title: o.title, type: o.type, skills: o.skills, location: o.location }),
            timing: timing?.label ?? null,
            closed: timing?.closed ?? false,
          };
        });
        const eventResults: SearchResult[] = (jamRows ?? []).map((j) => ({
          type: "event" as const,
          id: j.id,
          title: j.title,
          subtitle: [j.start_time ? new Date(j.start_time).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null, j.venue_name].filter(Boolean).join(" · "),
          thumbnail: j.cover_image_url ?? null,
        }));
        // Work: one row per project name (a credit is one person's line on it), shown with the kind of project and how many credits carry it.
        const projects = new Map<string, { row: CreditRow; count: number }>();
        for (const c of rowsOf<CreditRow>(credits) ?? []) {
          const key = String(c.project_name ?? "").trim().toLowerCase();
          if (!key) continue;
          const seen = projects.get(key);
          if (seen) seen.count += 1;
          else projects.set(key, { row: c, count: 1 });
        }
        const workResults: SearchResult[] = Array.from(projects.values()).slice(0, 3).map(({ row, count }) => ({
          type: "credit" as const,
          id: row.id,
          title: row.project_name ?? "",
          subtitle: [row.project_type, row.year].filter(Boolean).join(" · "),
          thumbnail: row.thumbnail_url ?? null,
          detail: `${count} ${count === 1 ? "credit" : "credits"} on Kretopia`,
        }));
        setResults([...peopleRows, ...gigResults, ...workResults, ...eventResults]);
        setResultsFor(q);
        setLoading(false);
        return;
      }
      if (variant === "hero" && !usersOnly) {
        const offset = appendUsers ? usersOffsetRef.current : 0;
        const [page, scoutResults] = await Promise.all([
          searchScoutPeople(q, offset),
          appendUsers ? Promise.resolve({ data: [] }) : supabase.from("opportunities")
            .select("id, title, type, location").eq("status", "active")
            .ilike("title", `%${q}%`).limit(3),
        ]);
        if (controller.signal.aborted) return;
        const matches: SearchResult[] = page.users.map(p => ({ type: "creator", id: p.user_id, title: p.full_name || "Kretopia user", subtitle: [p.role, p.location].filter(Boolean).join(" · "), avatar: p.avatar_url }));
        const scouts: SearchResult[] = (scoutResults.data ?? []).map(p => ({ type: "gig", id: p.id, title: p.title, subtitle: [p.type, p.location].filter(Boolean).join(" · ") }));
        setResults(previous => appendUsers ? [...previous.filter(r => r.type === "creator"), ...matches.filter(r => !previous.some(p => p.id === r.id)), ...previous.filter(r => r.type !== "creator")] : [...matches, ...scouts]);
        usersOffsetRef.current = offset + SCOUT_PEOPLE_PAGE_SIZE;
        setHasMoreUsers(page.hasMore);
        setLoading(false);
        return;
      }
      if (usersOnly) {
        const offset = appendUsers ? usersOffsetRef.current : 0;
        const page = await searchVerificationUsers(q, user?.id, offset, controller.signal);
        if (controller.signal.aborted) return;
        const userResults: SearchResult[] = page.users.map(p => ({
          type: "creator",
          id: p.user_id,
          title: p.full_name || ("username" in p ? String(p.username || "Kretopia user") : "Kretopia user"),
          subtitle: ["username" in p && p.username ? `@${p.username}` : null, p.role].filter(Boolean).join(" · "),
          avatar: p.avatar_url,
        }));
        setResults(previous => appendUsers ? [...previous, ...userResults.filter(r => !previous.some(p => p.id === r.id))] : userResults);
        usersOffsetRef.current = offset + VERIFICATION_SEARCH_PAGE_SIZE;
        setHasMoreUsers(page.hasMore);
        setLoading(false);
        return;
      }
      const likeQ = `%${q}%`;
      const likeQEscaped = escapePostgrestValue(likeQ);

      // Generate fuzzy variants (swap common letter pairs: i/y, z/s, etc.)
      const fuzzyVariants = new Set<string>([q]);
      const swaps: [string, string][] = [['i', 'y'], ['y', 'i'], ['z', 's'], ['s', 'z'], ['c', 'k'], ['k', 'c'], ['ph', 'f'], ['f', 'ph']];
      for (const [from, to] of swaps) {
        if (q.toLowerCase().includes(from)) {
          fuzzyVariants.add(q.toLowerCase().replace(new RegExp(from, 'gi'), to));
        }
      }

      const fuzzyFilters = Array.from(fuzzyVariants)
        .map(v => {
          const ev = escapePostgrestValue(`%${v}%`);
          return `full_name.ilike.${ev},role.ilike.${ev}`;
        })
        .join(',');

      // Real DB records only — creators, credits and gigs that actually
      // exist. No web/AI-guessed suggestions when nothing matches.
      const [nameMatches, profiles, credits, opps] = await Promise.all([
        (user ? supabase.from("profiles") : supabase.from("public_profiles_safe"))
          .select("user_id, full_name, avatar_url, role, bio, location")
          .ilike("full_name", `${q}%`)
          .limit(24),
        user ? supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role, bio, location, is_claimed")
          .or(fuzzyFilters)
          .or("onboarding_completed.eq.true,is_claimed.eq.false")
          .limit(24) : supabase
          .from("public_profiles_safe")
          .select("user_id, full_name, avatar_url, role, bio, location")
          .eq("onboarding_completed", true)
          .or(`full_name.ilike.${likeQEscaped},role.ilike.${likeQEscaped}`)
          .limit(24),
        q.length >= 2 ? supabase
          .from("credits")
          .select("id, project_name, role, year, project_type, thumbnail_url")
          .or(`project_name.ilike.${likeQEscaped},role.ilike.${likeQEscaped}`)
          .limit(5) : Promise.resolve({ data: [] }),
        q.length >= 2 ? supabase
          .from("opportunities")
          .select("id, title, type, compensation, location")
          .eq("status", "active")
          .ilike("title", likeQ)
          .limit(3) : Promise.resolve({ data: [] }),
      ]);
      if (controller.signal.aborted) return;

      // A failed people query must not look like a legitimate empty search.
      if (profiles.error && nameMatches.error) throw profiles.error;
      let connectedIds = new Set<string>();
      if (user?.id && (profiles.data?.length || nameMatches.data?.length)) {
        const { data: links } = await supabase.from("connections")
          .select("user_id, connected_user_id")
          .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
          .eq("status", "accepted");
        if (controller.signal.aborted) return;
        connectedIds = new Set((links || []).map(link => link.user_id === user.id ? link.connected_user_id : link.user_id));
      }

      const dbResults: SearchResult[] = [];

      const dedupedProfiles = [...(nameMatches.data || []), ...(profiles.data || [])]
        .filter(p => p.user_id && p.full_name)
        .filter((p, index, all) => all.findIndex(other => other.user_id === p.user_id) === index);
      const sortedProfiles = dedupedProfiles
        .sort((a, b) => Number(connectedIds.has(b.user_id)) - Number(connectedIds.has(a.user_id))
          || Number(b.full_name?.toLowerCase().startsWith(q.toLowerCase())) - Number(a.full_name?.toLowerCase().startsWith(q.toLowerCase()))
          || (a.full_name || "").localeCompare(b.full_name || ""));
      for (const p of sortedProfiles.slice(0, 8)) {
        dbResults.push({
          type: "creator",
          id: p.user_id,
          title: p.full_name || "Creator",
          subtitle: [p.role, p.location].filter(Boolean).join(" · "),
          avatar: p.avatar_url,
          bio: p.bio || undefined,
          is_claimed: "is_claimed" in p ? p.is_claimed !== false : true,
          is_connected: connectedIds.has(p.user_id),
        });
      }

      for (const c of credits.data || []) {
        dbResults.push({
          type: "credit",
          id: c.id,
          title: c.project_name,
          subtitle: [c.role, c.year].filter(Boolean).join(" · "),
          avatar: c.thumbnail_url,
        });
      }

      for (const o of opps.data || []) {
        dbResults.push({
          type: "gig",
          id: o.id,
          title: o.title,
          subtitle: [o.type, o.compensation, o.location].filter(Boolean).join(" · "),
        });
      }

      setResults(dbResults);
      setLoading(false);

      // Highlight first creator
      const firstCreator = dbResults.find((r) => r.type === "creator");
      if (firstCreator && user) {
        const { data: creatorCredits } = await supabase
          .from("credits")
          .select("project_name, role")
          .eq("user_id", firstCreator.id)
          .order("year", { ascending: false })
          .limit(4);

        if (!controller.signal.aborted) {
          firstCreator.credits = (creatorCredits || []).map((c) => ({
            project: c.project_name,
            role: c.role,
          }));
          setHighlightedCreator(firstCreator);
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Search error:", err);
        setResults([]);
        setError(true);
        setLoading(false);
      }
    }
  }, [user?.id, usersOnly, variant, intentMode, scope]);

  const catalogMatches = catalogEnabled ? searchCatalog(query) : [];

  // Guests can browse the vocabulary, but people's data needs an account.
  const requireAuthFor = (target: string) => {
    if (user) return false;
    sessionStorage.setItem("thrivein_post_auth_redirect", target);
    setOpen(false);
    onOpenChange?.(false);
    navigate("/auth?tab=signup");
    return true;
  };

  const handleCatalogSelect = (entry: CatalogEntry) => {
    if (variant === "hero") { submitQuery(query); return; }
    const target = `/search?q=${encodeURIComponent(entry.label)}`;
    if (requireAuthFor(target)) return;
    setOpen(false);
    onOpenChange?.(false);
    setQuery("");
    navigate(target);
  };

  const handleSelect = (r: SearchResult) => {
    if (disabled) return;
    if (catalogEnabled && variant !== "hero" && !onSelect) {
      const target = r.type === "creator" ? `/profile/${r.id}` : r.type === "gig" ? `/opportunity/${r.id}` : r.type === "event" ? `/event/${r.id}` : `/production?name=${encodeURIComponent(r.title)}`;
      if (requireAuthFor(target)) return;
    }
    if (scope) analytics.featureUsed("landing_hero_search_result", { scope, group: r.type });
    setOpen(false);
    setQuery("");
    setResults([]);
    setHighlightedCreator(null);
    onOpenChange?.(false);

    if (onSelect) {
      onSelect(r);
      return;
    }

    if (r.type === "creator") navigate(`/profile/${r.id}`);
    else if (r.type === "gig") navigate(`/opportunity/${r.id}`);
    else if (r.type === "event") navigate(`/event/${r.id}`);
    else navigate(`/production?name=${encodeURIComponent(r.title)}`);
  };

  const submitQuery = useCallback((rawQuery: string) => {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery) return;
    if (usersOnly) {
      setOpen(true);
      return;
    }

    setOpen(false);
    onOpenChange?.(false);

    // An unmistakable match skips the results: an exact, unique name opens that public profile, an exact, unique title that
    // opportunity. Only when the results on screen answer the words just submitted; anything uncertain stays a mixed search.
    const routable: RoutableResult[] = results.map((r) => ({ kind: r.type === "creator" ? "person" : r.type === "gig" ? "opportunity" : r.type === "event" ? "event" : "work", id: r.id, title: r.title }));
    const fresh = resultsFor === trimmedQuery;
    const direct = scope && fresh ? directTarget(scope, trimmedQuery, routable) : null;
    // What is measured is the kind of search and where it went, never the words.
    if (scope) analytics.featureUsed("landing_hero_search", { scope, class: fresh ? queryClass(trimmedQuery, routable) : "unresolved", route: direct ? "direct" : "scope" });

    if (onQuerySubmit) {
      if (scope) onQuerySubmit(trimmedQuery, scope);
      else onQuerySubmit(trimmedQuery);
      return;
    }

    setQuery("");
    if (direct) {
      navigate(direct);
      return;
    }
    if (intentMode && scope) {
      // The scope travels with the words: a chosen scope opens its own area, All opens the first area with an answer.
      navigate(scopeSearchTarget(scope, trimmedQuery, {
        people: results.filter(r => r.type === "creator").length,
        skills: searchExploreBy(trimmedQuery, 1).length,
        opportunities: results.filter(r => r.type === "gig").length,
        events: results.filter(r => r.type === "event").length,
      }));
      return;
    }
    if (intentMode) {
      // Enter with nothing picked: the Grid, unless the only answer is an open opportunity.
      navigate(searchEnterTarget(trimmedQuery, {
        people: results.filter(r => r.type === "creator").length,
        skills: searchExploreBy(trimmedQuery, 1).length,
        opportunities: results.filter(r => r.type === "gig").length,
      }));
      return;
    }
    navigate(scoutSearchTarget(rawQuery));
  }, [navigate, onOpenChange, onQuerySubmit, setQuery, usersOnly, intentMode, results, resultsFor, scope]);

  // Skills → Explore by → an item: the matching professionals, in Match.
  const handleExplore = (entry: ExploreByItem) => {
    setOpen(false);
    onOpenChange?.(false);
    setQuery("");
    setExploreCategory(null);
    navigate(exploreByTarget(entry));
  };

  // A section's "see all": the full search behind it (the Grid for People and Skills, Scout for Opportunities).
  const handleSeeAll = (target: SearchIntent) => {
    const words = query.trim();
    if (!words) return;
    setOpen(false);
    onOpenChange?.(false);
    setQuery("");
    navigate(searchIntentTarget(target, words));
  };

  // Events and SoundStages have no intent of their own: their "see all" opens the scope's page with the words in it.
  const handleSeeAllScope = (target: SearchScope) => {
    const words = query.trim();
    if (!words) return;
    setOpen(false);
    onOpenChange?.(false);
    setQuery("");
    navigate(scopeSearchTarget(target, words));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(query);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(false);
    setHighlightedCreator(null);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
        onOpenChange?.(false);
      } else if (query) {
        handleClear();
      }
      return;
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && open) {
      e.preventDefault();
      const focusable = resultsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-search-result]");
      if (!focusable || focusable.length === 0) return;
      if (e.key === "ArrowDown") focusable[0].focus();
      else focusable[focusable.length - 1].focus();
    }
  };

  const handleResultKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      onOpenChange?.(false);
      suppressReopenRef.current = true;
      inputRef.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const focusable = Array.from(
      resultsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-search-result]") ?? [],
    );
    const currentIndex = focusable.indexOf(e.currentTarget);
    if (currentIndex === -1) return;
    const nextIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0) {
      inputRef.current?.focus();
    } else if (nextIndex < focusable.length) {
      focusable[nextIndex].focus();
    }
  };

  const isHero = variant === "hero";
  const isNavbar = variant === "navbar";

  const voice = useVoiceSearch({
    onTranscript: (text) => {
      setQuery(text);
      setOpen(true);
      onOpenChange?.(true);
      inputRef.current?.focus();
    },
  });

  // Transient permission/error messages clear themselves — they're a
  // toast-style note, not a persistent blocker; typed search keeps working
  // the whole time regardless of voice state.
  useEffect(() => {
    if (voice.status !== "denied" && voice.status !== "error") return;
    const t = setTimeout(voice.dismissError, 5000);
    return () => clearTimeout(t);
  }, [voice.status, voice.dismissError]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {scope ? (
        // The topics: compact labels on the bar, All first. They say where the words are looked for; they are not tabs or pages.
        <div role="radiogroup" aria-label="Search topic" ref={pillsRef} className="mb-2.5 flex justify-center">
          <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-card/60 p-0.5 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {topics.map((id, index) => {
              const selected = id === scope;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  data-scope-pill={id}
                  disabled={disabled}
                  onClick={() => changeScope(id)}
                  onKeyDown={(e) => handleTopicKeyDown(e, index)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 sm:px-4",
                    selected ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {searchScopeMeta(id).label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <form onSubmit={handleSubmit}>
        <div className={cn("group relative", isHero && "k-search-hero")}>
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground",
              isHero ? "left-5 h-5 w-5 transition-colors group-focus-within:text-foreground" : "left-3 h-4 w-4"
            )}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              onOpenChange?.(true);
            }}
            onFocus={() => {
              if (suppressReopenRef.current) {
                suppressReopenRef.current = false;
                return;
              }
              if (intentMode || query.trim().length >= minChars) {
                setOpen(true);
                onOpenChange?.(true);
              }
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            disabled={disabled}
            enterKeyHint="search"
            role="combobox"
            aria-label={usersOnly ? "Search Kretopia users" : scope ? `Search ${scope === "all" ? "creatives, skills or opportunities" : searchScopeMeta(scope).label}` : intentMode ? "Search people, skills or opportunities" : "Search a name, project or opportunity"}
            aria-expanded={open}
            aria-controls={listboxId}
            className={cn(
              "w-full border text-foreground transition-all placeholder:text-muted-foreground/50 focus:outline-none",
              isHero
                // The gradient hairline and glow come from .k-search-hero (index.css), so the
                // field's own border stays invisible and its box never changes on focus.
                ? cn(
                    "h-14 sm:h-16 rounded-[var(--k-hero-radius)] border-transparent bg-card/90 backdrop-blur-sm text-base shadow-lg placeholder:text-[13px] sm:placeholder:text-base placeholder:text-muted-foreground/70 focus:border-transparent",
                    scope ? "text-ellipsis pl-12 pr-[7.5rem] sm:pl-14 sm:pr-[11.25rem]" : "pl-12 pr-[5.75rem] sm:pl-14 sm:pr-24",
                  )
                : isNavbar
                ? "h-9 rounded-xl border-border bg-muted/40 pl-9 pr-8 text-sm focus:border-primary/50 focus:bg-card"
                : "h-10 rounded-xl border-border bg-muted/40 pl-9 pr-8 text-sm focus:border-primary/50 focus:bg-card"
            )}
          />
          {(voice.status === "recording" || voice.status === "processing") ? (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 right-1.5 flex items-center gap-1.5 glass-surface pl-2.5 pr-1 py-1",
                isHero ? "rounded-[8px]" : "rounded-full",
              )}
            >
              {voice.status === "recording" ? (
                <>
                  <VoiceWaveform level={voice.level} className="w-8" />
                  <button
                    type="button"
                    onClick={voice.stop}
                    aria-label="Stop and use this recording"
                    title="Stop"
                    className={cn("k-mic-button is-active h-6 w-6 shrink-0 flex items-center justify-center hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))]", isHero ? "rounded-[6px]" : "rounded-full")}
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                  </button>
                  <button
                    type="button"
                    onClick={voice.cancel}
                    aria-label="Cancel recording"
                    title="Cancel"
                    className={cn("h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))]", isHero ? "rounded-[6px]" : "rounded-full")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                  <KretopiaSpinner className="h-3 w-3" />
                  Transcribing…
                </span>
              )}
            </div>
          ) : (
            <>
              {query ? (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search"
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors before:absolute before:-inset-2.5 before:content-['']",
                    isHero ? (scope ? "right-[6.25rem] sm:right-[9.6rem]" : "right-[3.75rem] sm:right-[4.25rem]") : "right-8"
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {(!query || scope) && !usersOnly && voice.supported ? (
                <button
                  type="button"
                  onClick={voice.start}
                  disabled={voice.status === "requesting"}
                  aria-label="Search by voice"
                  title="Search by voice"
                  className={cn(
                    "k-mic-button absolute top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center transition-all disabled:opacity-50 before:absolute before:-inset-1.5 before:content-['']",
                    isHero ? (scope ? "right-[3.75rem] sm:right-[7.1rem] rounded-[8px]" : "right-[3.75rem] sm:right-[4.25rem] rounded-[8px]") : "right-6 rounded-full"
                  )}
                >
                  {voice.status === "requesting" ? (
                    <KretopiaSpinner className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
              <button
                type="submit"
                aria-label="Search"
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors",
                  isHero
                    ? cn(
                        "right-2.5 h-10 rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        scope ? "w-10 sm:h-11 sm:w-auto sm:px-5 sm:text-sm sm:font-semibold" : "w-10 sm:h-11 sm:w-11",
                      )
                    : "right-1.5 h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/80"
                )}
              >
                {scope ? (
                  <>
                    <ArrowRight className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">Search</span>
                  </>
                ) : isHero ? <ArrowRight className="h-4 w-4" /> : <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </>
          )}
        </div>

        {/* Voice permission/error note — transient, self-dismissing, never
            blocks typed search which keeps working throughout. */}
        {(voice.status === "denied" || voice.status === "error") && voice.errorMessage && (
          <div
            role="status"
            className="mt-1.5 flex items-center justify-between gap-2 rounded-lg glass-surface px-2.5 py-1.5 text-[11px] text-muted-foreground"
          >
            <span>{voice.errorMessage}</span>
            <button
              type="button"
              onClick={voice.dismissError}
              aria-label="Dismiss"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </form>

      {/* ═══ DROPDOWN ═══ */}
      {open && (query.trim().length >= minChars || intentMode) && (
        <div
          id={listboxId}
          role="region"
          aria-label="Search results"
          style={resultsMaxHeight ? { maxHeight: resultsMaxHeight } : undefined}
          className={cn(
            // Solid bg-popover, not the translucent glass-surface-elevated
            // treatment used elsewhere in the app -- a search results list
            // sitting over the page's own content (hero backgrounds, other
            // cards) needs a genuinely opaque surface to stay readable,
            // same token every other dropdown/popover in this codebase
            // already uses (command.tsx, context-menu.tsx, hover-card.tsx).
            "absolute left-0 right-0 mt-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-[100] overflow-hidden",
            usersOnly ? "max-h-[min(40vh,20rem)]" : isNavbar ? "max-h-[70vh]" : "max-h-[60vh]"
          )}
        >
          <div ref={resultsRef} className="flex flex-col overflow-y-auto max-h-[inherit]">
            {intentMode ? (<>
              <HeroIntentPanel
                query={query}
                people={results.filter((r) => r.type === "creator") as IntentResult[]}
                opportunities={results.filter((r) => r.type === "gig") as IntentResult[]}
                events={results.filter((r) => r.type === "event") as IntentResult[]}
                work={results.filter((r) => r.type === "credit") as IntentResult[]}
                onBroaden={() => { setQuery(""); setExploreCategory(null); inputRef.current?.focus(); }}
                scope={scope}
                onSeeAllScope={handleSeeAllScope}
                loading={loading}
                error={error}
                category={exploreCategory}
                onCategoryChange={setExploreCategory}
                onKeyDown={handleResultKeyDown}
                onSelectResult={(r) => handleSelect(r as SearchResult)}
                onExplore={handleExplore}
                onSeeAll={handleSeeAll}
                onRetry={() => doSearch(query.trim())}
              />
            </>) : (<>
            {isHero && !usersOnly && <div className="order-first border-b border-border px-4 py-3 text-left"><p className="text-xs font-semibold text-foreground">Explore Kretopia</p></div>}
            {catalogMatches.length > 0 && (
              <div className={cn("border-b border-border px-2 py-3", isHero ? "order-1" : "order-3")}>
                <div className="flex items-center justify-between px-2 pb-1.5">
                  <p className="text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {isHero ? "Roles" : "Explore Kretopia"}
                  </p>
                  {!user && !isHero && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" />
                      Sign up to see people and details
                    </span>
                  )}
                </div>
                <div className={cn("grid gap-x-2", !isHero && "sm:grid-cols-2")}>
                  {(isHero ? ["role"] as const : ["role", "skill", "location", "work"] as const).map((kind) => {
                    const items = catalogMatches.filter((e) => e.kind === kind);
                    if (items.length === 0) return null;
                    const Icon = CATALOG_ICON[kind];
                    return (
                      <div key={kind} className="py-1">
                        <p className={cn("px-2 pb-0.5 text-[10px] font-medium text-muted-foreground/70", isHero && "sr-only")}>
                          {CATALOG_KIND_LABEL[kind]}
                        </p>
                        {items.map((e) => (
                          <button
                            key={`${kind}-${e.label}`}
                            type="button"
                            data-search-result
                            onKeyDown={handleResultKeyDown}
                            onClick={() => handleCatalogSelect(e)}
                            className="group w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                          >
                            <span className="h-7 w-7 shrink-0 rounded-lg border border-border bg-muted/40 flex items-center justify-center text-foreground/80 group-hover:border-primary/40 group-hover:text-primary transition-colors">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-foreground truncate">{e.label}</span>
                              <span className="block text-[11px] text-muted-foreground truncate">{e.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Loading state: the Kretopia K-mark loader alone, never a ring plus a spinner. */}
            {loading && (
              <KretopiaLoader
                size="sm"
                label="Searching Kretopia"
                hint={usersOnly ? undefined : "Checking creators, credits & gigs…"}
                className="order-4 px-4"
              />
            )}

            {/* Highlighted creator card (from DB) */}
            {highlightedCreator && (
              <div className="order-1 border-b border-border">
                <button
                  data-search-result
                  onKeyDown={handleResultKeyDown}
                  onClick={() => handleSelect(highlightedCreator)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
                      <AvatarImage src={highlightedCreator.avatar || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {(highlightedCreator.title || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">
                          {highlightedCreator.title}
                        </p>
                        {highlightedCreator.is_connected ? (
                          <Badge variant="outline" className="shrink-0 border-energy/40 text-energy text-[9px]">Connected</Badge>
                        ) : highlightedCreator.is_claimed === false ? (
                          <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10 shrink-0">
                            Unclaimed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-primary border-primary/30 shrink-0">
                            Creator
                          </Badge>
                        )}
                      </div>
                       {highlightedCreator.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">{highlightedCreator.subtitle}</p>
                      )}
                      {highlightedCreator.bio && (
                        <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 italic">
                          "{highlightedCreator.bio}"
                        </p>
                      )}
                      {highlightedCreator.credits && highlightedCreator.credits.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {highlightedCreator.credits.slice(0, 3).map((c, i) => (
                            <span key={i} className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/10">
                              {c.project} — {c.role}
                            </span>
                          ))}
                          {highlightedCreator.credits.length > 3 && (
                            <span className="text-[10px] text-muted-foreground px-1">
                              +{highlightedCreator.credits.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                     </div>
                     <span className="shrink-0 self-center text-xs font-semibold text-primary">{user ? "View Passport" : "Sign up to view"} <ArrowRight className="inline h-3 w-3" /></span>
                  </div>
                </button>

                <div className="px-4 pb-2 space-y-1.5">
                  {highlightedCreator.is_claimed === false && (
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground/60">
                        Is this you? Verify your identity to claim.
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setQuery("");
                          onOpenChange?.(false);
                          navigate(`/profile/${highlightedCreator.id}?showClaim=true`);
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg bg-energy text-energy-foreground hover:brightness-110 shadow-glow-lime transition-all shrink-0"
                      >
                        <UserCheck className="h-3 w-3" />
                        Claim Profile
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/60">
                    Not who you're looking for?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setHighlightedCreator(null);
                        inputRef.current?.focus();
                      }}
                      className="text-primary/70 hover:text-primary underline underline-offset-2"
                    >
                      See all results
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* Other DB creator matches */}
            {highlightedCreator && (() => {
              const otherCreators = results.filter(
                (r) => r.type === "creator" && r.id !== highlightedCreator.id
              );
              if (otherCreators.length === 0) return null;
              return (
                <div className="order-2 border-b border-border">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Other potential matches
                  </p>
                  {otherCreators.slice(0, 3).map((r, i) => (
                    <button
                      key={`alt-${r.id}-${i}`}
                      data-search-result
                      onKeyDown={handleResultKeyDown}
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={r.avatar || ""} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(r.title || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                        {r.subtitle && (
                          <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                        )}
                      </div>
                      {r.is_connected ? (
                        <Badge variant="outline" className="shrink-0 border-energy/40 text-energy text-[9px]">Connected</Badge>
                      ) : r.is_claimed === false ? (
                        <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10 shrink-0">
                          Unclaimed
                        </Badge>
                      ) : null}
                      <span className="shrink-0 text-[10px] font-semibold text-primary">{user ? "View Passport" : "Sign up to view"}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Rest of results — grouped under labeled headers (Users /
                Creative Work / Opportunities), all real database records. */}
            {(["creator", "credit", "gig"] as const).map((groupType) => {
              const items = results.filter((r) => {
                if (r.type !== groupType) return false;
                if (!highlightedCreator) return true;
                // Creator-type results are already covered by the
                // highlighted-creator card and "Other potential matches"
                // above once a highlightedCreator exists — avoid duplicates.
                return r.id !== highlightedCreator.id && r.type !== "creator";
              });
              if (items.length === 0) return null;
              return (
                <div key={groupType} className={cn("border-b border-border last:border-b-0 py-2", isHero && groupType === "gig" ? "order-4" : "order-2")}>
                  <p className="px-4 pt-1 pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isHero && groupType === "gig" ? "Scouts" : RESULT_GROUP_LABEL[groupType]}
                  </p>
                  {(isHero && groupType === "creator" && !expandHeroUsers ? items.slice(0, 4) : items).map((r, i) => {
                    const meta = TYPE_META[r.type];
                    return (
                      <button
                        key={`${r.type}-${r.id}-${i}`}
                        type="button"
                        disabled={disabled}
                        data-search-result
                        onKeyDown={handleResultKeyDown}
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors text-left"
                      >
                        {r.avatar ? (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={r.avatar} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(r.title || "?")[0]}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <meta.icon className={cn("h-3.5 w-3.5", meta.color)} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                          {r.subtitle && (
                            <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                          )}
                        </div>
                        {usersOnly || isHero ? (
                          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                        ) : r.type === "creator" && r.is_connected ? (
                          <span className="shrink-0 text-[10px] font-semibold text-energy">Connected · View Passport</span>
                        ) : r.type === "creator" && r.is_claimed === false ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10">
                              Unclaimed
                            </Badge>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                setQuery("");
                                onOpenChange?.(false);
                                navigate(`/profile/${r.id}?showClaim=true`);
                              }}
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-[hsl(var(--color-accent))] text-white"
                            >
                              <UserCheck className="h-2.5 w-2.5" />
                              Claim
                            </button>
                          </div>
                        ) : r.type === "creator" ? (
                          <span className="shrink-0 text-[10px] font-semibold text-primary">{user ? "View Passport" : "Sign up to view"}</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn("text-[9px] shrink-0", meta.color)}
                          >
                            {meta.label}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                  {isHero && groupType === "creator" && items.length > 4 && !expandHeroUsers && <Button variant="ghost" className="w-full justify-start px-4 text-xs text-primary" data-search-result onKeyDown={handleResultKeyDown} onClick={() => setExpandHeroUsers(true)}>Show all {items.length} users <ArrowRight className="ml-2 h-3 w-3" /></Button>}
                </div>
              );
            })}

            {(usersOnly || isHero) && hasMoreUsers && (
              <Button variant="ghost" className="order-3 w-full shrink-0" data-search-result onKeyDown={handleResultKeyDown} disabled={loading || disabled} onClick={() => { setExpandHeroUsers(true); void doSearch(query.trim(), true); }}>
                {loading ? <KretopiaSpinner className="h-4 w-4" /> : "Show more users"}
              </Button>
            )}
            {isHero && !usersOnly && <div className="order-4 px-2 py-3">
              {!results.some(r => r.type === "gig") && <p className="px-2 pb-2 text-[10px] font-semibold uppercase text-muted-foreground">Scouts</p>}
              <Button variant="ghost" className="h-auto w-full justify-between gap-3 whitespace-normal rounded-lg px-2 py-2 text-left" data-search-result onKeyDown={handleResultKeyDown} onClick={() => submitQuery(query)}>
                <span className="min-w-0"><span className="block text-xs text-muted-foreground">Search Scout</span><span className="block break-words font-semibold">{query}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              </Button>
            </div>}
            {!usersOnly && !isHero && <PublicWebSearchResults query={query} />}

            {/* Error state — distinct from "no results" so a failed search
                isn't mistaken for a genuinely empty result set. */}
            {!loading && error && (
              <div className="order-5 px-4 py-4 text-center">
                <p className="text-sm text-destructive">Search failed</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Something went wrong reaching search — check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => doSearch(query.trim())}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--color-accent))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))] rounded"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty state — no fallback suggestions, no navigation anywhere.
                If nothing real matches, we say so and stop. */}
            {showEmptyState && !loading && !error && results.length === 0 && catalogMatches.length === 0 && query.trim().length >= minChars && (
              <div className="order-5 px-4 py-4 text-center">
                <Sparkles className="h-5 w-5 text-primary/50 mx-auto mb-1.5" />
                <p className="text-sm text-muted-foreground">No Kretopia results found</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {usersOnly ? "Try a different name or @username" : "Try a different name or project"}
                </p>
              </div>
            )}
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
