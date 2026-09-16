import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Image as ImageIcon, Link2, ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditThumb } from "./CreditThumb";
import type { ClaimedCredit, WebCreditResult } from "./types";

interface Props {
  results: WebCreditResult[];
  query: string;
  onBack: () => void;
  onConfirm: (selected: ClaimedCredit[]) => void;
  onPasteLink: () => void;
  onSkipToSignup?: () => void;
}

/** Step 2: Larger verifiable cards (2 per row) with thumbnail, source URL, and external link. */
export const DisambiguationStep = ({ results, query, onBack, onConfirm, onPasteLink, onSkipToSignup }: Props) => {
  const items: ClaimedCredit[] = useMemo(
    () => results.map((r, i) => ({ ...r, _id: `${i}-${r.title}` })),
    [results]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (items.length === 0) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold">Nothing found for "{query}"</h2>
          <p className="text-sm text-muted-foreground px-4">
            New to the scene? No problem — just sign up and we'll build your profile from scratch. Or paste a portfolio link (IMDb, Behance, Spotify, your site).
          </p>
        </div>
        {onSkipToSignup && (
          <Button onClick={onSkipToSignup} className="w-full" size="lg">
            Just sign me up
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button variant="outline" onClick={onPasteLink} className="flex-1">
            <Link2 className="mr-2 h-4 w-4" />
            Paste a link
          </Button>
        </div>
      </div>
    );
  }

  const confirm = () => {
    const chosen = items.filter((i) => selected.has(i._id));
    onConfirm(chosen);
  };

  const prettyHost = (url?: string) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };

  // Build a "we found you" hero from the results so signup feels like the public name-search
  const heroAvatar = items.find((i) => i.thumbnail)?.thumbnail;
  const platformSet = Array.from(
    new Set(
      items
        .map((i) => (i.platform || i.source_name || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 6);
  const topSnippet = items.find((i) => i.description)?.description;

  return (
    <div className="space-y-4">
      {/* Wow hero — mirrors the public "search your name" card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-4">
        <div className="flex items-start gap-3">
          <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden ring-2 ring-primary/30">
            <CreditThumb
              src={heroAvatar}
              title={query}
              platform={items[0]?.platform || items[0]?.source_name}
              className="absolute inset-0 w-full h-full"
              iconClassName="h-7 w-7"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">
              Found across the web
            </p>
            <h2 className="text-lg font-bold leading-tight truncate">{query}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {items.length} mention{items.length === 1 ? "" : "s"}
              {platformSet.length > 0 && ` · ${platformSet.length} platform${platformSet.length === 1 ? "" : "s"}`}
            </p>
            {topSnippet && (
              <p className="text-[11px] text-muted-foreground/90 mt-1.5 line-clamp-2 leading-snug italic">
                "{topSnippet}"
              </p>
            )}
          </div>
        </div>
        {platformSet.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {platformSet.map((p) => (
              <Badge
                key={p}
                variant="secondary"
                className="text-[9px] py-0 h-4 px-1.5 uppercase tracking-wide"
              >
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold">Which of these are yours?</h2>
        <p className="text-sm text-muted-foreground">
          Tap to select. Open the source link if unsure — we only add what you confirm.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const isSel = selected.has(item._id);
          const host = prettyHost(item.url);
          return (
            <div
              key={item._id}
              className={cn(
                "relative rounded-xl overflow-hidden border-2 bg-card transition-all flex flex-col",
                isSel ? "border-primary ring-2 ring-primary/30" : "border-border"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(item._id)}
                className="relative aspect-video w-full overflow-hidden text-left"
                aria-pressed={isSel}
              >
                <CreditThumb
                  src={item.thumbnail}
                  title={item.title}
                  platform={item.platform || item.source_name}
                  className="absolute inset-0 w-full h-full"
                  iconClassName="h-8 w-8"
                />
                {item.platform && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold uppercase tracking-wide bg-background/80 backdrop-blur px-1.5 py-0.5 rounded">
                    {item.platform}
                  </span>
                )}
                <div
                  className={cn(
                    "absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center transition-all",
                    isSel
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/80 backdrop-blur border border-border"
                  )}
                >
                  {isSel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggle(item._id)}
                className="flex-1 p-2.5 text-left space-y-1"
              >
                <p className="text-sm font-semibold leading-tight line-clamp-2">{item.title}</p>
                {item.role_suggestion && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {item.role_suggestion}
                    {item.year ? ` · ${item.year}` : ""}
                  </p>
                )}
                {item.description && (
                  <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-snug">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {item.source_name && (
                    <Badge variant="outline" className="text-[9px] py-0 h-4 px-1.5">
                      via {item.source_name}
                    </Badge>
                  )}
                </div>
              </button>

              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-between gap-1 px-2.5 py-1.5 border-t border-border bg-muted/30 hover:bg-muted/60 text-[11px] font-medium text-primary transition-colors"
                >
                  <span className="truncate">{host || "Open source"}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1 sticky bottom-0 bg-background pb-1">
        <Button variant="outline" onClick={onBack} size="lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          onClick={confirm}
          disabled={selected.size === 0}
          className="flex-1 bg-energy text-energy-foreground hover:brightness-110 font-bold uppercase tracking-wide shadow-glow-lime"
          size="lg"
        >
          {selected.size === 0
            ? "Select what's yours"
            : `Create my profile (${selected.size})`}
          {selected.size > 0 && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
