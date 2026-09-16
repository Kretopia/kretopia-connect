import { useMemo, useState } from "react";
import { ChevronRight, ShieldCheck, ImageIcon, Loader2, Info, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";
import { SmartCardTitle } from "@/components/typography/Heading";

export type CreditsBoardGroup = string;

export interface CreditsBoardFilter {
  label: string;
  value: "all" | CreditsBoardGroup;
  hint: string;
}

export interface CreditsBoardRow {
  id: string;
  group: CreditsBoardGroup;
  title: string;
  /** Role, client or contributor line. */
  subtitle?: string | null;
  typeLabel?: string | null;
  year?: number | null;
  imageUrl?: string | null;
  verified?: boolean;
  /** Small badge for an AI-suggested (not yet confirmed) entry. */
  isAI?: boolean;
  /** Small badge for a result sourced from outside Kretopia. */
  isExternal?: boolean;
  onClick: () => void;
}

const DEFAULT_FILTERS: CreditsBoardFilter[] = [
  { label: "All work", value: "all", hint: "Everything in the database, newest first." },
  { label: "Featured", value: "featured", hint: "Credits that carry artwork or media." },
  { label: "Other credits", value: "other", hint: "Credits still waiting on visuals." },
  { label: "Recently added", value: "recent", hint: "The latest projects added to Kretopia." },
];

/**
 * One dashboard table used for both the browse-mode ledger and search
 * results on Verified Credits — a scannable table instead of scattered card
 * carousels, so results never hide behind a drag-to-scroll rail. `groups`
 * lets each caller define its own filter set (browse mode: Featured/Other/
 * Recent; search mode: Projects/Creators/Web) over the same component.
 */
export function CreditsBoard({
  rows,
  loading,
  className,
  groups = DEFAULT_FILTERS,
  title = "The credits board",
}: {
  rows: CreditsBoardRow[];
  loading?: boolean;
  className?: string;
  groups?: CreditsBoardFilter[];
  title?: string;
}) {
  const [filter, setFilter] = useState<"all" | CreditsBoardGroup>("all");

  const counts = useMemo(() => {
    return rows.reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r.group]: (acc[r.group] || 0) + 1, all: (acc.all || 0) + 1 }),
      {},
    );
  }, [rows]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.group === filter)),
    [rows, filter],
  );

  const activeHint = groups.find((f) => f.value === filter)?.hint;

  return (
    <Reveal className={cn("w-full", className)}>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
      >
        {/* Board header */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <span className="text-[11px] text-white/40">{counts.all || 0} entries</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {groups.map((f) => {
              const active = filter === f.value;
              const count = counts[f.value] || 0;
              if (f.value !== "all" && count === 0) return null;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors border",
                    active ? "text-white" : "text-white/55 hover:text-white/80",
                  )}
                  style={{
                    borderColor: active ? "hsl(var(--energy) / 0.4)" : "rgba(255,255,255,0.08)",
                    backgroundColor: active ? "hsl(var(--energy) / 0.1)" : "transparent",
                  }}
                >
                  {f.label}
                  <span className="ml-1.5 text-white/35">{count}</span>
                </button>
              );
            })}
          </div>

          {activeHint && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-white/45">
              <Info className="h-3 w-3 shrink-0" />
              {activeHint}
            </p>
          )}
        </div>

        {/* Column headers — desktop only */}
        <div
          className="hidden sm:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_64px_96px_28px] gap-3 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span>Work</span>
          <span>Type</span>
          <span>Year</span>
          <span>Status</span>
          <span aria-hidden />
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "hsl(var(--energy))" }} />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-white/50">Nothing here yet — search a project or person above.</p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {visible.map((row) => (
              <li key={`${row.group}-${row.id}`} className="divide-white/[0.06]">
                <button
                  type="button"
                  onClick={row.onClick}
                  className="group w-full text-left grid grid-cols-[minmax(0,1fr)_28px] sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_64px_96px_28px] items-center gap-3 px-4 sm:px-5 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  {/* Work */}
                  <span className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-10 w-10 shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    >
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt={row.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-white/25" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <SmartCardTitle as="h3" meta={row.subtitle}>{row.title}</SmartCardTitle>
                      {/* mobile meta line */}
                      <span className="sm:hidden block truncate text-[11px] text-white/35">
                        {[row.typeLabel, row.year].filter(Boolean).join(" · ")}
                        {row.verified ? " · Verified" : ""}
                      </span>
                    </span>
                  </span>

                  <span className="hidden sm:block truncate text-[12px] text-white/55">{row.typeLabel || "—"}</span>
                  <span className="hidden sm:block text-[12px] text-white/45">{row.year || "—"}</span>
                  <span className="hidden sm:flex items-center gap-1">
                    {row.verified ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: "hsl(var(--energy) / 0.12)", color: "hsl(var(--energy))" }}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </span>
                    ) : row.isAI ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: "hsl(var(--energy) / 0.1)", color: "hsl(var(--energy))" }}
                      >
                        <Sparkles className="h-3 w-3" />
                        AI found
                      </span>
                    ) : row.isExternal ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white/45" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                        <ExternalLink className="h-3 w-3" />
                        Web
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/30">Unverified</span>
                    )}
                  </span>

                  <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/60 transition-colors justify-self-end" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Reveal>
  );
}

export default CreditsBoard;
