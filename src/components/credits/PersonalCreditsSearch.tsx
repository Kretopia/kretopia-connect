import { Search, Loader2, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  searching?: boolean;
  resultCount: number;
}

/**
 * PersonalCreditsSearch — searches ONLY the signed-in person's own record.
 *
 * The query goes to `search_my_credits`, which derives the user from
 * auth.uid() server-side and never accepts a user_id from the browser. No
 * public profile directory and no global user search is reachable here.
 */
export function PersonalCreditsSearch({ value, onChange, searching, resultCount }: Props) {
  return (
    <div className="w-full">
      <label htmlFor="credits-search" className="sr-only">
        Search your own credits
      </label>
      <div className="relative flex w-full items-center">
        <Search className="pointer-events-none absolute left-4 h-4 w-4 text-[hsl(var(--energy))]" aria-hidden />
        <input
          id="credits-search"
          type="search"
          inputMode="search"
          maxLength={120}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search your credits — project, role, client, year"
          className="h-14 w-full min-w-0 rounded-2xl border bg-card/80 backdrop-blur-sm pl-11 pr-20 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
          style={{ borderColor: "hsl(var(--energy) / 0.25)" }}
        />
        <div className="absolute right-3 flex items-center gap-1.5">
          {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange("")}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
        {value
          ? `${resultCount} of your credits match "${value.slice(0, 40)}"`
          : "Private search — only your own record is searched here."}
      </p>
    </div>
  );
}
