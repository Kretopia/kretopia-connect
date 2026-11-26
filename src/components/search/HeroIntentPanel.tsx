import type { KeyboardEvent, ReactNode } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Building2, ChevronRight, Clapperboard, Music, Palette, User, Wand2, type LucideIcon } from "lucide-react";

import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  EXPLORE_BY,
  exploreByCategory,
  searchExploreBy,
  searchIntentMeta,
  type ExploreByCategoryId,
  type ExploreByItem,
  type SearchIntent,
} from "@/lib/searchIntent";
import { cn } from "@/lib/utils";

/** What the panel needs of a result row: people and opportunities share the same shape. */
export interface IntentResult {
  type: "creator" | "gig";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string | null;
}

const CATEGORY_ICON: Record<ExploreByCategoryId, LucideIcon> = {
  disciplines: Palette,
  crew: Clapperboard,
  skills: Wand2,
  studios: Building2,
  music: Music,
};

interface HeroIntentPanelProps {
  intent: SearchIntent;
  query: string;
  results: IntentResult[];
  loading: boolean;
  error: boolean;
  /** The "Explore by" category that is open, or null for the list of categories. */
  category: ExploreByCategoryId | null;
  onCategoryChange: (id: ExploreByCategoryId | null) => void;
  /** Keyboard handler shared with the results, so the arrow keys walk the whole panel. */
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onSelectResult: (result: IntentResult) => void;
  onExplore: (item: ExploreByItem) => void;
  /** Sends the typed words to the intent's own feature (Passport, Match or Scout). */
  onSubmit: () => void;
  onRetry: () => void;
}

const eyebrow = "px-4 pb-1.5 pt-3 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground";
const row =
  "group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none";

function SubmitRow({ label, query, onSubmit, onKeyDown }: { label: string; query: string; onSubmit: () => void; onKeyDown: HeroIntentPanelProps["onKeyDown"] }) {
  return (
    <Button
      variant="ghost"
      data-search-result
      onKeyDown={onKeyDown}
      onClick={onSubmit}
      aria-label={`${label} ${query}`}
      className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none border-t border-border px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block break-words font-semibold">{query}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
    </Button>
  );
}

/** Skills → "Explore by": five ways in, then the items of the one chosen, then the matching professionals in Match. */
function ExploreBy({ query, category, onCategoryChange, onKeyDown, onExplore, onSubmit }: Pick<HeroIntentPanelProps, "query" | "category" | "onCategoryChange" | "onKeyDown" | "onExplore" | "onSubmit">) {
  const typed = query.trim();
  if (typed) {
    const matches = searchExploreBy(typed);
    return (
      <>
        <p className={eyebrow}>Explore by</p>
        {matches.length > 0 ? (
          matches.map(({ category: c, item }) => {
            const Icon = CATEGORY_ICON[c.id];
            return (
              <button key={`${c.id}-${item.label}`} type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onExplore(item)} className={row}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground/80 transition-colors group-hover:border-primary/40 group-hover:text-primary">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{c.label} · {item.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              </button>
            );
          })
        ) : (
          <p className="px-4 pb-3 text-sm text-muted-foreground">No area by that name. Search Match for the words you typed.</p>
        )}
        <SubmitRow label="Find professionals in Match" query={typed} onSubmit={onSubmit} onKeyDown={onKeyDown} />
      </>
    );
  }

  const open = exploreByCategory(category);
  if (open) {
    return (
      <>
        <button type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onCategoryChange(null)} className={cn(row, "border-b border-border py-2")}>
          <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Explore by</span>
            <span className="block truncate text-sm font-semibold text-foreground">{open.label}</span>
          </span>
        </button>
        <div className="grid sm:grid-cols-2">
          {open.items.map((item) => (
            <button key={item.label} type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onExplore(item)} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <p className={eyebrow}>Explore by</p>
      {EXPLORE_BY.map((c) => {
        const Icon = CATEGORY_ICON[c.id];
        return (
          <button key={c.id} type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onCategoryChange(c.id)} className={row}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground/80 transition-colors group-hover:border-primary/40 group-hover:text-primary">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{c.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{c.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        );
      })}
    </>
  );
}

function ResultList({
  heading,
  icon: Icon,
  results,
  emptyText,
  children,
  onKeyDown,
  onSelectResult,
}: {
  heading: string;
  icon: LucideIcon;
  results: IntentResult[];
  emptyText: ReactNode;
  children: ReactNode;
  onKeyDown: HeroIntentPanelProps["onKeyDown"];
  onSelectResult: HeroIntentPanelProps["onSelectResult"];
}) {
  return (
    <>
      <p className={eyebrow}>{heading}</p>
      {results.length === 0 ? <p className="px-4 pb-3 text-sm text-muted-foreground">{emptyText}</p> : null}
      {results.map((r) => (
        <button key={`${r.type}-${r.id}`} type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onSelectResult(r)} className={row}>
          {r.avatar !== undefined && r.type === "creator" ? (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={r.avatar || ""} />
              <AvatarFallback className="bg-primary/10 text-xs text-primary">{(r.title || "?")[0]}</AvatarFallback>
            </Avatar>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
            {r.subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{r.subtitle}</span> : null}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        </button>
      ))}
      {children}
    </>
  );
}

/**
 * The hero search's results, by intent. People: real Passports (public-safe for guests) and a way into the whole directory.
 * Skills: "Explore by", then the matching professionals in Match. Opportunities: real open gigs and a way into Scout.
 * Semantic tokens only; the loader is the shared K mark.
 */
export function HeroIntentPanel({ intent, query, results, loading, error, category, onCategoryChange, onKeyDown, onSelectResult, onExplore, onSubmit, onRetry }: HeroIntentPanelProps) {
  const typed = query.trim();
  const meta = searchIntentMeta(intent);

  if (intent === "skills") {
    return <ExploreBy query={query} category={category} onCategoryChange={onCategoryChange} onKeyDown={onKeyDown} onExplore={onExplore} onSubmit={onSubmit} />;
  }

  const isPeople = intent === "people";
  const found = results.filter((r) => (isPeople ? r.type === "creator" : r.type === "gig"));
  return (
    <>
      {loading && found.length === 0 ? <KretopiaLoader size="sm" label="Searching Kretopia" className="px-4" /> : null}
      {!loading && error ? (
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-destructive">Search failed</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Check your connection and try again.</p>
          <button type="button" onClick={onRetry} className="mt-2 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            Try again
          </button>
        </div>
      ) : null}
      {!error && (!loading || found.length > 0) ? (
        <ResultList
          heading={isPeople ? "People" : "Opportunities"}
          icon={isPeople ? User : Briefcase}
          results={found}
          emptyText={isPeople ? "No one by that name yet. Search the Passport directory for the words you typed." : "No open opportunity by that name. Search Scout for the words you typed."}
          onKeyDown={onKeyDown}
          onSelectResult={onSelectResult}
        >
          <SubmitRow label={isPeople ? `Search ${meta.destination} for people` : `Search ${meta.destination}`} query={typed} onSubmit={onSubmit} onKeyDown={onKeyDown} />
        </ResultList>
      ) : null}
    </>
  );
}

export default HeroIntentPanel;
