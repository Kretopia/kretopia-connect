import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Briefcase, CalendarClock, ClipboardCheck, Clock, Hourglass, RefreshCw, type LucideIcon } from "lucide-react";

import { KretoScene } from "@/components/brand/KretoScene";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { GlassCtaButton, OutlineCtaButton } from "@/components/ui/glass-cta";
import { Skeleton } from "@/components/ui/skeleton";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedSignals, type WrappedSignal } from "@/components/wrapped/WrappedSignals";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";
import { useNow } from "@/hooks/useNow";
import { LIVE_INTERVAL_MS } from "@/lib/scoutScan";
import { useScoutScan } from "./scoutScanContext";
import type { ScoutTab } from "./scout.types";
import { selectScoutWrappedSignals, type ScoutSignalId } from "./scoutWrapped.signals";

const ICON: Record<ScoutSignalId, LucideIcon> = {
  closing: CalendarClock,
  started: ClipboardCheck,
  saved: Bookmark,
  awaiting: Hourglass,
  fresh: Clock,
  listed: Briefcase,
};

/** How long what the last scan said stays on the line under the button. */
const RESULT_VISIBLE_MS = 10 * 60_000;

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true }).replace("about ", "");

interface ScoutWrappedProps {
  /** Switch the page to a tab (the page owns the tab state and the URL). */
  onSelectTab: (tab: ScoutTab) => void;
}

/**
 * Scout's top section: the same Wrapped frame as Today's Radar, with Scout's
 * own facts in it.
 *
 *   header      what this is and when Scout last checked, from `last_run_at`
 *   signals     at most three counts of the person's own list, each a way in
 *   Scan now    the one big action; it calls the same scan the For You list
 *               used to own, and cannot be fired twice
 *   one line    what the last scan did, or why it could not
 *
 * It claims only what Scout does today: public job boards, matched against the
 * Passport, re-checked every ten minutes while the page is open. It never says
 * it applies for anyone.
 */
export function ScoutWrapped({ onSelectTab }: ScoutWrappedProps) {
  const scan = useScoutScan();
  const now = useNow(30_000);
  const { gigs, actions, actionsReady, loading, listError, lastRunAt, busy, scanning, liveRefreshing, scanElapsed, scanUnavailable, scanNote, lastResult, progress } = scan;

  const signals: WrappedSignal[] = useMemo(
    () =>
      selectScoutWrappedSignals({ gigs, actions, now: new Date(now) }).map((s) => ({
        id: s.id,
        icon: ICON[s.id],
        value: s.value,
        state: "ready" as const,
        label: s.label,
        hint: s.hint,
        onSelect: () => onSelectTab(s.tab),
      })),
    [gigs, actions, now, onSelectTab],
  );
  const signalsLoading = loading || !actionsReady;

  const recentResult = lastResult && now - lastResult.at < RESULT_VISIBLE_MS ? lastResult : null;
  const failed = !busy && !!scanUnavailable;

  const buttonLabel = scanning ? "Scanning job boards…" : liveRefreshing ? "Checking job boards…" : failed ? "Try again" : "Scan now";

  const statusLabel = busy ? (
    "Checking the job boards…"
  ) : listError ? (
    "Couldn't load your list"
  ) : lastRunAt ? (
    `Checked ${ago(lastRunAt)}`
  ) : (
    "Not checked yet"
  );

  const line = busy
    ? scanning
      ? `${scanElapsed}s elapsed. New gigs appear below as they're found.`
      : null
    : failed
      ? `Couldn't refresh opportunities. ${scanUnavailable}`
      : recentResult
        ? [recentResult.title, recentResult.description].filter(Boolean).join(". ")
        : scanNote;

  return (
    <WrappedShell
      titleId="scout-wrapped-title"
      eyebrow="Scout"
      title={
        <>
          Find your <span className="k-gradient-text">next opportunity</span>
        </>
      }
      subtitle={
        <p className="mt-1 text-sm text-muted-foreground">
          Scout checks public job boards for roles that match your Passport. It never applies for you.
        </p>
      }
      status={
        <WrappedStatus
          active={!listError && (busy || !!lastRunAt)}
          pinging={busy}
          label={statusLabel}
        />
      }
      aside={<KretoScene scene="campaign" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />}
    >
      {signalsLoading ? (
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card p-4">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
          ))}
        </div>
      ) : signals.length > 0 ? (
        <WrappedSignals
          label="Scout priority signals"
          compactOnMobile
          signals={signals}
          columnsClassName={signals.length === 1 ? "grid-cols-1" : signals.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}
        />
      ) : null}

      {listError && (
        <p role="alert" className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Couldn't load your opportunities. Check your connection, then scan again.
        </p>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:items-center">
        <GlassCtaButton
          size="lg"
          onClick={() => void scan.scanNow()}
          disabled={busy}
          aria-busy={busy}
          icon={busy ? <KretopiaSpinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          className="min-h-12 w-full justify-center sm:w-auto sm:min-w-[18rem]"
        >
          {buttonLabel}
        </GlassCtaButton>

        <p role="status" aria-live="polite" className="min-h-[1.25rem] text-center text-xs text-muted-foreground">
          {line}
        </p>

        {progress.saved > 0 && (
          <OutlineCtaButton size="sm" onClick={() => onSelectTab("shortlist")} className="min-h-11 w-full sm:w-auto">
            View saved opportunities ({progress.saved})
          </OutlineCtaButton>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Every gig shows where it came from and how old it is. While this page is open, Scout checks again every {Math.round(LIVE_INTERVAL_MS / 60_000)} minutes.
      </p>
    </WrappedShell>
  );
}

export default ScoutWrapped;
