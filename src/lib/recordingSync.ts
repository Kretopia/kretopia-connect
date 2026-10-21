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

/**
 * When the sync runs after leaving or stopping. The first looks come within seconds, because a short recording is often
 * ready almost at once and a 45 s wait was the slowest part; the gaps then widen for long recordings, up to ten minutes.
 */
export const POST_CALL_SYNC_DELAYS_MS = [3_000, 7_000, 12_000, 20_000, 30_000, 45_000, 70_000, 2 * 60_000, 5 * 60_000, 10 * 60_000] as const;
/** After this long without the recording being stored, the interface says it is not confirmed. */
export const POST_CALL_SYNC_GIVE_UP_MS = POST_CALL_SYNC_DELAYS_MS[POST_CALL_SYNC_DELAYS_MS.length - 1];

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

/**
 * Reads the answer of `sync-daily-recordings` for ONE known recording (a segment saved with "Save").
 * The recording's own id is the proof, so no timestamp is involved: comparing the device's clock with
 * Daily's start time drops a recording whenever the device heard "recording started" a second after
 * Daily began it, or its clock is ahead. It counts as stored only when that recording has its row and is
 * not still being finalised.
 */
export function readSegmentOutcome(data: unknown, recordingId: string): RecordingSyncOutcome {
  const d = data as { results?: Array<{ recording_id?: string; transcript_id?: string; skipped?: string; error?: string }> } | null;
  const results = Array.isArray(d?.results) ? d!.results! : [];
  const mine = results.find((r) => r.recording_id === recordingId);
  if (!mine || mine.error || !mine.transcript_id) return { stored: false };
  const processing = typeof mine.skipped === "string" && mine.skipped.startsWith("status=");
  return { stored: !processing };
}
