-- M8 (docs/roadmap/schema-impact-report.md): "one call_transcripts row per recording" was enforced only in code
-- (_shared/recordingRow.ts), and the recording functions running in production are older and have no such check.
-- A unique index makes the database enforce it. A plain unique index allows several NULL recording ids, so rows
-- without a recording id are unaffected. Production had 30 rows, 30 distinct ids, no duplicates and no nulls when
-- it was applied, so the build had nothing to repair.
-- Applied to production on 2026-10-20 with approval; this file records it so the migrations match.
-- Rollback: DROP INDEX public.call_transcripts_recording_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS call_transcripts_recording_id_key
  ON public.call_transcripts (recording_id);
