import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, CalendarDays, Clapperboard, Search, type LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PublicSearchResult } from "@/lib/publicSearch";
import { RESULT_ACTION, type ResultKind } from "@/lib/searchResultView";
import { cn } from "@/lib/utils";

const KIND: Record<PublicSearchResult["type"], ResultKind> = { creator: "person", gig: "opportunity", event: "event", credit: "work" };
const THUMB_ICON: Record<PublicSearchResult["type"], LucideIcon> = { creator: Search, gig: Briefcase, event: CalendarDays, credit: Clapperboard };

/** The miniature of a result: the photo when there is one and it loads, otherwise the kind's own icon on a quiet tile. */
export function SearchThumb({ result, className }: { result: PublicSearchResult; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = result.thumbnail || result.avatar || null;
  if (result.type === "creator") {
    return (
      <Avatar className={cn("h-12 w-12 shrink-0 rounded-xl", className)}>
        <AvatarImage src={src || ""} alt="" className="object-cover" />
        <AvatarFallback className="rounded-xl bg-primary/10 text-sm text-primary">{(result.title || "?")[0]}</AvatarFallback>
      </Avatar>
    );
  }
  const Icon = THUMB_ICON[result.type];
  return (
    <span className={cn("relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/60", className)}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

const rowClass =
  "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none";

function Body({ result }: { result: PublicSearchResult }) {
  return (
    <>
      <SearchThumb result={result} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{result.title}</span>
        {result.subtitle ? <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span> : null}
        {result.detail ? <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted-foreground/90">{result.detail}</span> : null}
        {result.why || result.timing ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            {result.why ? <span className="rounded-full border border-border bg-muted/40 px-2 py-px text-muted-foreground">{result.why}</span> : null}
            {result.timing ? <span className={result.closed ? "font-medium text-destructive" : "text-muted-foreground"}>{result.timing}</span> : null}
          </span>
        ) : null}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1 self-center pl-1 text-xs font-semibold text-primary">
        <span className="hidden sm:inline">{RESULT_ACTION[KIND[result.type]]}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      </span>
    </>
  );
}

interface SearchResultRowProps {
  result: PublicSearchResult;
  /** A button row (the dropdown): the host decides what opening it does. */
  onSelect?: (result: PublicSearchResult) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  /** A link row (the Search Page): a real link, so it opens in a new tab and shows where it goes. */
  href?: string;
  onNavigate?: (result: PublicSearchResult) => void;
  /** Extra marks after the title line, for what is known about the signed-in member (Saved, Connected). */
  badge?: string | null;
}

/**
 * One result, answering three questions at a glance: what is this (miniature, title, subtitle, a line of evidence), why is it
 * relevant (the field that matched, never a score) and what can I do next (a specific action, not "View" everywhere). A closed
 * opportunity says so and is not shown as open. The same row serves the dropdown (a button) and the Search Page (a link).
 */
export function SearchResultRow({ result, onSelect, onKeyDown, href, onNavigate, badge }: SearchResultRowProps) {
  const cls = cn(rowClass, result.closed && "opacity-75");
  const kind = KIND[result.type];
  const mark = badge ? <span className="absolute right-4 top-2 hidden rounded-full bg-primary/10 px-2 py-px text-[10px] font-semibold text-primary sm:inline">{badge}</span> : null;
  if (href) {
    return (
      <div className="relative">
        <Link to={href} data-result-kind={kind} onClick={() => onNavigate?.(result)} className={cls}>
          <Body result={result} />
        </Link>
        {mark}
      </div>
    );
  }
  return (
    <button type="button" data-search-result data-result-kind={kind} onKeyDown={onKeyDown} onClick={() => onSelect?.(result)} className={cls}>
      <Body result={result} />
    </button>
  );
}

export default SearchResultRow;
