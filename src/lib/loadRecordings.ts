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
  // Use only production-supported fields; do not probe optional schema capabilities while loading.
  const { data, error } = await supabase
    .from("call_transcripts")
    .select(COLUMNS)
    .not("recording_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { rows: [], error: error.message || "Couldn't load recordings" };
  return { rows: (data as RecordingRow[]) ?? [], error: null };
}
