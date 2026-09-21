import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Database,
  Loader2,
  Mic,
  Search,
  SearchX,
  Square,
  User,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { VoiceWaveform } from "@/components/search/VoiceWaveform";

type ResultType = "creator" | "credit" | "gig";

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
}

interface CreditRow {
  id: string;
  project_name: string | null;
  role: string | null;
  year: number | null;
  project_type: string | null;
  thumbnail_url: string | null;
}

interface OpportunityRow {
  id: string;
  title: string;
  type: string | null;
  compensation: string | null;
  location: string | null;
}

interface UnifiedSearchDropdownProps {
  variant?: "hero" | "navbar" | "inline";
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  autoFocus?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  onSelect?: (result: SearchResult) => void;
  onQuerySubmit?: (query: string) => void;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 320;

const getInitial = (value: string | null | undefined) =>
  value?.trim().charAt(0).toUpperCase() || "K";

const getResultLabel = (type: ResultType) => {
  if (type === "creator") return "Creator";
  if (type === "credit") return "Creative Work";
  return "Opportunity";
};

const getResultIcon = (type: ResultType) => {
  if (type === "creator") return User;
  if (type === "credit") return Database;
  return Briefcase;
};

const getResultIconClass = (type: ResultType) => {
  if (type === "creator") return "text-primary";
  if (type === "credit") return "text-accent";
  return "text-emerald-500";
};

const buildFuzzyProfileFilter = (query: string) => {
  const variants = new Set<string>([query]);

  const swaps: Array<[string, string]> = [
    ["i", "y"],
    ["y", "i"],
    ["z", "s"],
    ["s", "z"],
    ["c", "k"],
    ["k", "c"],
    ["ph", "f"],
    ["f", "ph"],
  ];

  for (const [from, to] of swaps) {
    if (query.toLowerCase().includes(from)) {
      variants.add(query.toLowerCase().replace(new RegExp(from, "gi"), to));
    }
  }

  return Array.from(variants)
    .flatMap((variant) => {
      const escaped = escapePostgrestValue(`%${variant}%`);

      return [
        `full_name.ilike.${escaped}`,
        `role.ilike.${escaped}`,
      ];
    })
    .join(",");
};

export function UnifiedSearchDropdown({
  variant = "navbar",
  placeholder = "Search people, work and opportunities…",
  value,
  onValueChange,
  autoFocus = false,
  onOpenChange,
  className,
  onSelect,
  onQuerySubmit,
}: UnifiedSearchDropdownProps) {
  const navigate = useNavigate();
  const listboxId = useId();

  const [internalQuery, setInternalQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasTechnicalError, setHasTechnicalError] = useState(false);
  const [portalStyle, setPortalStyle] = useState<CSSProperties | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const suppressFocusOpenRef = useRef(false);

  const query = value ?? internalQuery;
  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const isHero = variant === "hero";
  const isNavbar = variant === "navbar";

  const setQuery = useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalQuery(nextValue);
      }

      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setIsOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const clearSearch = useCallback(() => {
    abortControllerRef.current?.abort();
    requestVersionRef.current += 1;

    setQuery("");
    setResults([]);
    setIsLoading(false);
    setHasTechnicalError(false);
    setOpen(false);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [setOpen, setQuery]);

  const updatePortalPosition = useCallback(() => {
    const element = wrapperRef.current;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const gutter = 12;
    const maxWidth = window.innerWidth - gutter * 2;

    setPortalStyle({
      position: "fixed",
      top: rect.bottom + 10,
      left: Math.max(gutter, rect.left),
      width: Math.min(rect.width, maxWidth),
      zIndex: 9999,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !canSearch) {
      setPortalStyle(null);
      return;
    }

    updatePortalPosition();

    const handleViewportChange = () => {
      updatePortalPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [canSearch, isOpen, updatePortalPosition]);

  const executeSearch = useCallback(
    async (rawQuery: string) => {
      const searchQuery = rawQuery.trim();

      if (searchQuery.length < MIN_QUERY_LENGTH) {
        return;
      }

      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;

      setIsLoading(true);
      setHasTechnicalError(false);
      setResults([]);

      const likeQuery = `%${searchQuery}%`;
      const escapedLikeQuery = escapePostgrestValue(likeQuery);
      const fuzzyProfileFilter = buildFuzzyProfileFilter(searchQuery);

      try {
        const [profilesResponse, creditsResponse, opportunitiesResponse] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("user_id, full_name, avatar_url, role, location")
              .or(fuzzyProfileFilter)
              .limit(8),

            supabase
              .from("credits")
              .select(
                "id, project_name, role, year, project_type, thumbnail_url",
              )
              .or(
                `project_name.ilike.${escapedLikeQuery},role.ilike.${escapedLikeQuery}`,
              )
              .limit(6),

            supabase
              .from("opportunities")
              .select("id, title, type, compensation, location")
              .eq("status", "active")
              .ilike("title", likeQuery)
              .limit(6),
          ]);

        if (
          controller.signal.aborted ||
          requestVersionRef.current !== requestVersion
        ) {
          return;
        }

        if (
          profilesResponse.error ||
          creditsResponse.error ||
          opportunitiesResponse.error
        ) {
          throw (
            profilesResponse.error ||
            creditsResponse.error ||
            opportunitiesResponse.error
          );
        }

        const nextResults: SearchResult[] = [];

        for (const profile of (profilesResponse.data ?? []) as ProfileRow[]) {
          nextResults.push({
            type: "creator",
            id: profile.user_id,
            title: profile.full_name || "Creator",
            subtitle: [profile.role, profile.location]
              .filter(Boolean)
              .join(" · "),
            imageUrl: profile.avatar_url,
          });
        }

        const seenProductions = new Set<string>();

        for (const credit of (creditsResponse.data ?? []) as CreditRow[]) {
          const projectName = credit.project_name?.trim();

          if (!projectName) {
            continue;
          }

          const dedupeKey = projectName.toLocaleLowerCase();

          if (seenProductions.has(dedupeKey)) {
            continue;
          }

          seenProductions.add(dedupeKey);

          nextResults.push({
            type: "credit",
            id: credit.id,
            title: projectName,
            subtitle: [credit.role, credit.year, credit.project_type]
              .filter(Boolean)
              .join(" · "),
            imageUrl: credit.thumbnail_url,
          });
        }

        for (const opportunity of (opportunitiesResponse.data ??
          []) as OpportunityRow[]) {
          nextResults.push({
            type: "gig",
            id: opportunity.id,
            title: opportunity.title,
            subtitle: [
              opportunity.type,
              opportunity.compensation,
              opportunity.location,
            ]
              .filter(Boolean)
              .join(" · "),
            imageUrl: null,
          });
        }

        setResults(nextResults);
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestVersionRef.current !== requestVersion
        ) {
          return;
        }

        console.error("Kretopia unified search error:", error);
        setResults([]);
        setHasTechnicalError(true);
      } finally {
        if (
          !controller.signal.aborted &&
          requestVersionRef.current === requestVersion
        ) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!canSearch) {
      abortControllerRef.current?.abort();
      requestVersionRef.current += 1;

      setResults([]);
      setIsLoading(false);
      setHasTechnicalError(false);
      setOpen(false);

      return;
    }

    if (!suppressFocusOpenRef.current) {
      setOpen(true);
    }

    const timer = window.setTimeout(() => {
      void executeSearch(trimmedQuery);
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canSearch, executeSearch, setOpen, trimmedQuery]);

  useEffect(() => {
    const handleOutsidePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedInputArea = wrapperRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);

      if (!clickedInputArea && !clickedDropdown) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointerDown);
    };
  }, [setOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const groupedResults = useMemo(() => {
    return [
      {
        type: "creator" as const,
        label: "People",
        items: results.filter((result) => result.type === "creator"),
      },
      {
        type: "credit" as const,
        label: "Creative Work",
        items: results.filter((result) => result.type === "credit"),
      },
      {
        type: "gig" as const,
        label: "Opportunities",
        items: results.filter((result) => result.type === "gig"),
      },
    ].filter((group) => group.items.length > 0);
  }, [results]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setResults([]);

      onSelect?.(result);

      if (onSelect) {
        return;
      }

      if (result.type === "creator") {
        navigate(`/profile/${result.id}`);
        return;
      }

      if (result.type === "credit") {
        navigate(`/production?name=${encodeURIComponent(result.title)}`);
        return;
      }

      navigate(`/opportunity/${result.id}`);
    },
    [navigate, onSelect, setOpen],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    /*
     * Important:
     * Enter does NOT redirect when no real data exists.
     *
     * It only selects the first actual fetched result. Otherwise, the
     * dropdown remains open and displays the “not found” state locally.
     */
    if (!canSearch || isLoading) {
      return;
    }

    if (results.length > 0) {
      selectResult(results[0]);
      return;
    }

    setOpen(true);
    onQuerySubmit?.(trimmedQuery);
  };

  const handleInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      suppressFocusOpenRef.current = true;
      setOpen(false);
      return;
    }

    if (event.key !== "ArrowDown") {
      return;
    }

    const firstResult = dropdownRef.current?.querySelector<HTMLButtonElement>(
      "button[data-search-result]",
    );

    if (!firstResult) {
      return;
    }

    event.preventDefault();
    firstResult.focus();
  };

  const handleResultKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      suppressFocusOpenRef.current = true;
      setOpen(false);
      inputRef.current?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    const buttons = Array.from(
      dropdownRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-search-result]",
      ) ?? [],
    );

    const currentIndex = buttons.indexOf(event.currentTarget);

    if (currentIndex < 0) {
      return;
    }

    event.preventDefault();

    const nextIndex =
      event.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0) {
      inputRef.current?.focus();
      return;
    }

    if (nextIndex >= buttons.length) {
      buttons[0]?.focus();
      return;
    }

    buttons[nextIndex]?.focus();
  };

  const voice = useVoiceSearch({
    onTranscript: (transcript) => {
      const spokenQuery = transcript.trim();

      if (!spokenQuery) {
        return;
      }

      suppressFocusOpenRef.current = false;
      setQuery(spokenQuery);
      setOpen(true);

      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
  });

  const handleInputChange = (nextValue: string) => {
    suppressFocusOpenRef.current = false;
    setQuery(nextValue);

    if (nextValue.trim().length >= MIN_QUERY_LENGTH) {
      setOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (suppressFocusOpenRef.current) {
      suppressFocusOpenRef.current = false;
      return;
    }

    if (query.trim().length >= MIN_QUERY_LENGTH) {
      setOpen(true);
    }
  };

  const showDropdown = isOpen && canSearch && portalStyle;
  const showLoading = showDropdown && isLoading;
  const showNotFound =
    showDropdown &&
    !isLoading &&
    !hasTechnicalError &&
    results.length === 0;
  const showTechnicalError =
    showDropdown && !isLoading && hasTechnicalError;

  const dropdown = showDropdown
    ? createPortal(
        <div
          ref={dropdownRef}
          id={listboxId}
          role="region"
          aria-label="Creative Work search results"
          style={portalStyle}
          className={cn(
            "overflow-hidden rounded-2xl border border-border/80",
            "bg-popover text-popover-foreground shadow-2xl",
            "ring-1 ring-black/5 dark:ring-white/10",
            isHero ? "max-h-[min(68vh,42rem)]" : "max-h-[min(62vh,34rem)]",
          )}
        >
          <div className="max-h-[inherit] overflow-y-auto overscroll-contain">
            {showLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-3 px-5 py-8 text-center"
              >
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <Search
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  <Loader2
                    className="absolute inset-0 h-11 w-11 animate-spin text-primary/55"
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Searching Kretopia
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Looking through people, creative work, and opportunities.
                  </p>
                </div>
              </div>
            ) : null}

            {showTechnicalError ? (
              <div
                role="status"
                aria-live="polite"
                className="px-5 py-7 text-center"
              >
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <SearchX className="h-5 w-5" aria-hidden="true" />
                </div>

                <p className="mt-3 text-sm font-semibold text-foreground">
                  Search is temporarily unavailable.
                </p>

                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Kretopia could not check its records right now. Try again in
                  a moment.
                </p>

                <button
                  type="button"
                  onClick={() => void executeSearch(trimmedQuery)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Try again
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {showNotFound ? (
              <div
                role="status"
                aria-live="polite"
                className="relative overflow-hidden px-5 py-7 text-center sm:px-6"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent"
                />

                <div className="relative mx-auto max-w-md">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.16)]">
                    <SearchX className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <p className="mt-4 text-sm font-semibold text-foreground">
                    Nothing public matched “{trimmedQuery}” yet.
                  </p>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    No creator, project, creative work, or active opportunity
                    matched this search. Try another name, role, skill, or
                    spelling.
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {[
                      "Graphic Designer",
                      "Creative Producer",
                      "Music video",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleInputChange(suggestion)}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Search
                          className="mr-1.5 inline-block h-3 w-3 text-primary"
                          aria-hidden="true"
                        />
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <p className="mt-5 text-[11px] text-muted-foreground/80">
                    No page was opened. You can refine your search here.
                  </p>
                </div>
              </div>
            ) : null}

            {!showLoading && !showTechnicalError && !showNotFound ? (
              <>
                {groupedResults.map((group) => (
                  <section
                    key={group.type}
                    aria-label={group.label}
                    className="border-b border-border last:border-b-0"
                  >
                    <div className="sticky top-0 z-10 border-b border-border/70 bg-popover/98 px-4 py-2 backdrop-blur">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {group.label}
                      </p>
                    </div>

                    <div className="p-2">
                      {group.items.map((result) => {
                        const Icon = getResultIcon(result.type);

                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            type="button"
                            data-search-result
                            onKeyDown={handleResultKeyDown}
                            onClick={() => selectResult(result)}
                            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/55 focus-visible:bg-muted/55 focus-visible:outline-none"
                          >
                            {result.type === "creator" ? (
                              <Avatar className="h-9 w-9 shrink-0 border border-border">
                                <AvatarImage src={result.imageUrl || ""} alt="" />
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                  {getInitial(result.title)}
                                </AvatarFallback>
                              </Avatar>
                            ) : result.imageUrl ? (
                              <img
                                src={result.imageUrl}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/45",
                                  getResultIconClass(result.type),
                                )}
                              >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {result.title}
                                </p>

                                <span
                                  className={cn(
                                    "shrink-0 text-[10px] font-semibold",
                                    getResultIconClass(result.type),
                                  )}
                                >
                                  {getResultLabel(result.type)}
                                </span>
                              </div>

                              {result.subtitle ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {result.subtitle}
                                </p>
                              ) : null}
                            </div>

                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                              aria-hidden="true"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div ref={wrapperRef} className={cn("relative w-full", className)}>
        <form onSubmit={handleSubmit} role="search">
          <div className="relative">
            <Search
              className={cn(
                "pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-muted-foreground",
                isHero ? "left-4 h-5 w-5" : "left-3 h-4 w-4",
              )}
              aria-hidden="true"
            />

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => handleInputChange(event.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleInputKeyDown}
              placeholder={placeholder}
              autoFocus={autoFocus}
              autoComplete="off"
              role="combobox"
              aria-label="Search people, projects, creative work and opportunities"
              aria-expanded={Boolean(showDropdown)}
              aria-controls={listboxId}
              aria-autocomplete="list"
              className={cn(
                "w-full border text-foreground transition-all placeholder:text-muted-foreground/70 focus:outline-none",
                isHero
                  ? "h-12 rounded-2xl border-border/60 bg-card/95 pl-12 pr-24 text-sm shadow-xl backdrop-blur-xl focus:border-primary focus:shadow-[0_0_28px_hsl(var(--primary)/0.2)] sm:h-14 sm:text-base"
                  : isNavbar
                    ? "h-9 rounded-xl border-border bg-muted/40 pl-9 pr-18 text-sm focus:border-primary/50 focus:bg-card"
                    : "h-10 rounded-xl border-border bg-muted/40 pl-9 pr-18 text-sm focus:border-primary/50 focus:bg-card",
              )}
            />

            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                className={cn(
                  "absolute top-1/2 z-20 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isHero ? "right-12 sm:right-14" : "right-8",
                )}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}

            {voice.status === "recording" ||
            voice.status === "processing" ||
            voice.status === "requesting" ? (
              <div
                className={cn(
                  "absolute top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-border/70 bg-background/95 py-1 pl-2.5 pr-1 shadow-sm backdrop-blur",
                  isHero ? "right-2" : "right-1.5",
                )}
              >
                {voice.status === "recording" ? (
                  <>
                    <VoiceWaveform level={voice.level} className="w-8" />

                    <button
                      type="button"
                      onClick={voice.stop}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Stop recording and search"
                    >
                      <Square className="h-2.5 w-2.5 fill-current" />
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-primary"
                      aria-hidden="true"
                    />
                    <span className="px-1 text-[11px] text-muted-foreground">
                      {voice.status === "requesting"
                        ? "Starting…"
                        : "Listening…"}
                    </span>
                    <button
                      type="button"
                      onClick={voice.cancel}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Cancel voice search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ) : voice.supported ? (
              <button
                type="button"
                onClick={voice.start}
                disabled={voice.status === "requesting"}
                className={cn(
                  "absolute top-1/2 z-20 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isHero ? "right-2" : "right-1",
                )}
                aria-label="Search by voice"
                title="Search by voice"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {dropdown}
    </>
  );
}

export default UnifiedSearchDropdown;