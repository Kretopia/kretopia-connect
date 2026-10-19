import { supabase } from "@/integrations/supabase/client";
import type { TranscriptStatus } from "@/lib/recordingState";

export interface RecordingRow {
  id: string;
  call_kind: string;
  status: TranscriptStatus;
  duration_seconds: number | null;
  created_at: string;
  recording_id: string | null;
  project_id: string | null;
  summary: string | null;
  /** Only read to tell a deliberately skipped transcript from a failed one; never displayed. */
  error: string | null;
}

const COLUMNS = "id, call_kind, status, duration_seconds, created_at, recording_id, project_id, summary, error";

/**
 * `call_transcripts.recording_deleted_at` comes from migration 20260915110000. A backend that has not
 * applied it answers any query that mentions the column with HTTP 400 / 42703, and the Recordings page
 * used to read that as "no recordings" for everyone, whatever was stored. The column is only a filter
 * for media that purge-expired-recordings already deleted, so without it there is nothing to filter.
 */
export const isMissingRetentionColumn = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === "42703" || /recording_deleted_at/i.test(e.message ?? ""));

let retentionColumnMissing = false;

export interface LoadedRecordings {
  rows: RecordingRow[];
  /** Set when the list could not be loaded at all; never conflated with an empty list. */
  error: string | null;
}

/**
 * The caller's playable recordings, newest first. Authorization is entirely the table's RLS
 * (user_can_view_call_transcript): this adds no role or kind filter of its own.
 */
export async function loadRecordings(limit = 100): Promise<LoadedRecordings> {
  const base = () =>
    supabase
      .from("call_transcripts")
      .select(COLUMNS)
      .not("recording_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

  if (!retentionColumnMissing) {
    // Hide recordings whose media purge-expired-recordings already deleted: "Watch replay" would fail.
    const { data, error } = await base().is("recording_deleted_at", null);
    if (!error) return { rows: (data as RecordingRow[]) ?? [], error: null };
    if (!isMissingRetentionColumn(error)) return { rows: [], error: error.message || "Couldn't load recordings" };
    retentionColumnMissing = true;
  }

  const { data, error } = await base();
  if (error) return { rows: [], error: error.message || "Couldn't load recordings" };
  return { rows: (data as RecordingRow[]) ?? [], error: null };
}

/** Test seam: forget what a previous call learned about the backend. */
export const resetLoadRecordingsCache = () => {
  retentionColumnMissing = false;
};
