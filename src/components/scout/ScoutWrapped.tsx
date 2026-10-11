import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Briefcase, CalendarCheck, CalendarClock, ClipboardCheck, Clock, Hourglass, MapPin, UserSearch, type LucideIcon } from "lucide-react";

import { KretoScene } from "@/components/brand/KretoScene";
import { Skeleton } from "@/components/ui/skeleton";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedSignals, type WrappedSignal } from "@/components/wrapped/WrappedSignals";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";
import { useNow } from "@/hooks/useNow";
import { LIVE_INTERVAL_MS } from "@/lib/scoutScan";
import { ScoutScanButton } from "./ScoutScanButton";
import { useScoutScan } from "./scoutScanContext";
import type { ScoutTab } from "./scout.types";
import { selectScoutWrappedSignals, type ScoutSignalId } from "./scoutWrapped.signals";

const ICON: Record<ScoutSignalId, LucideIcon> = {
  closing: CalendarClock,
  started: ClipboardCheck,
  saved: Bookmark,
  awaiting: Hourglass,
  posted: CalendarCheck,
  role: UserSearch,
  place: MapPin,
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
  const { gigs, actions, actionsReady, profile, loading, listError, lastRunAt, busy, scanning, liveRefreshing, scanElapsed, scanUnavailable, scanNote, lastResult } = scan;

  const signals: WrappedSignal[] = useMemo(
    () =>
      selectScoutWrappedSignals({ gigs, actions, profile, now: new Date(now) }, 4).map((s) => ({
        id: s.id,
        icon: ICON[s.id],
        value: s.value,
        state: "ready" as const,
        label: s.label,
        hint: s.hint,
        onSelect: () => onSelectTab(s.tab),
      })),
    [gigs, actions, profile, now, onSelectTab],
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
      brandFooter={false}
      aside={<KretoScene scene="scout" size="thumb" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />}
    >
      {signalsLoading ? (
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
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
          columnsClassName={signals.length === 1 ? "grid-cols-1" : signals.length === 2 ? "grid-cols-1 sm:grid-cols-2" : signals.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}
        />
      ) : null}

      {listError && (
        <p role="alert" className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Couldn't load your opportunities. Check your connection, then scan again.
        </p>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:items-center">
        <ScoutScanButton label={buttonLabel} busy={busy} onClick={() => void scan.scanNow()} />

        <p role="status" aria-live="polite" className="min-h-[1.25rem] text-center text-xs text-muted-foreground">
          {line}
        </p>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Every gig shows where it came from and how old it is. While this page is open, Scout checks again every {Math.round(LIVE_INTERVAL_MS / 60_000)} minutes.
      </p>
    </WrappedShell>
  );
}

export default ScoutWrapped;
