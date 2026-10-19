/**
 * Post-call recording sync.
 *
 * A cloud recording becomes downloadable some time AFTER the call ends, and that time grows with the
 * recording's length. The call sheet used to look twice (45 s and 120 s after leaving) and then give
 * up, so any recording that was still being finalised at the second look never got a Recordings entry
 * unless someone pressed "Sync now". This keeps looking, with a widening gap, for about ten minutes,
 * and stops as soon as the sync confirms the recording is stored.
 *
 * The sync itself is `sync-daily-recordings` (it lists Daily's recordings for the room and creates the
 * canonical call_transcripts row, idempotently). Nothing here creates or marks a recording.
 */

/** Seconds after leaving at which the sync runs: 45 s, 2 min, 5 min, 10 min. */
export const POST_CALL_SYNC_DELAYS_MS = [45_000, 2 * 60_000, 5 * 60_000, 10 * 60_000] as const;

export interface RecordingSyncOutcome {
  /** The recording started at/after `sinceTs` is stored and nothing in its room is still processing. */
  stored: boolean;
}

export interface ScheduleRecordingSyncOptions {
  /** Daily room to look in. */
  roomName?: string;
  /** Only recordings that started at or after this unix-seconds timestamp count (the call's start). */
  sinceTs?: number;
  /** Performs one sync. A rejection is logged and the schedule carries on. */
  run: (args: { roomName?: string; sinceTs?: number }) => Promise<RecordingSyncOutcome | void>;
  /** Called once, when a run reports the recording stored. */
  onStored?: () => void;
  delaysMs?: readonly number[];
}

// One schedule per room: a second call in the same room replaces the first instead of doubling the polls.
const active = new Map<string, () => void>();

/** Starts the schedule and returns a function that cancels it. Not tied to any component's lifetime. */
export function scheduleRecordingSync(opts: ScheduleRecordingSyncOptions): () => void {
  const delays = opts.delaysMs ?? POST_CALL_SYNC_DELAYS_MS;
  const key = opts.roomName ?? "*";
  active.get(key)?.();

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (active.get(key) === cancel) active.delete(key);
  };

  const step = (i: number, elapsed: number) => {
    if (cancelled || i >= delays.length) {
      cancel();
      return;
    }
    timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const out = await opts.run({ roomName: opts.roomName, sinceTs: opts.sinceTs });
        if (out && out.stored) {
          cancel();
          opts.onStored?.();
          return;
        }
      } catch (e) {
        console.warn("[recordingSync] run failed", e);
      }
      step(i + 1, delays[i]);
    }, delays[i] - elapsed);
  };

  active.set(key, cancel);
  step(0, 0);
  return cancel;
}

/**
 * Reads the answer of `sync-daily-recordings`. The recording counts as stored only when the function
 * echoed this call's `since_ts` (an older deployment ignores it and would answer for the room's whole
 * history, which says nothing about THIS call), found at least one recording, and has none still processing.
 */
export function readSyncOutcome(data: unknown, sinceTs?: number): RecordingSyncOutcome {
  const d = data as { since_ts?: number | null; results?: Array<{ transcript_id?: string; skipped?: string; error?: string }> } | null;
  if (!d || sinceTs === undefined || d.since_ts !== sinceTs) return { stored: false };
  const results = Array.isArray(d.results) ? d.results : [];
  const stored = results.filter((r) => r.transcript_id && !r.error);
  const processing = results.some((r) => typeof r.skipped === "string" && r.skipped.startsWith("status="));
  return { stored: stored.length > 0 && !processing };
}
