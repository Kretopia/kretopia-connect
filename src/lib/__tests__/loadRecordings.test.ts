import { beforeEach, describe, expect, it, vi } from "vitest";

const plan = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  not: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  is: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = { select: plan.select, not: plan.not, order: plan.order, limit: plan.limit, is: plan.is };
  plan.from.mockReturnValue(chain);
  plan.select.mockReturnValue(chain);
  plan.not.mockReturnValue(chain);
  plan.order.mockReturnValue(chain);
  return { supabase: { from: plan.from } };
});

import { loadRecordings, type RecordingRow } from "../loadRecordings";
import { describeStoredRecording, TRANSCRIPT_STALLED_AFTER_MS } from "../recordingState";

const NOW = Date.parse("2026-10-19T03:15:00Z");
const row = (over: Partial<RecordingRow> = {}): RecordingRow => ({
  id: "a", call_kind: "project", status: "ready", recording_id: "rec-a",
  duration_seconds: 120, created_at: new Date(NOW - 60_000).toISOString(),
  project_id: "project-a", summary: "Stored recap", error: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  plan.limit.mockResolvedValue({ data: [row()], error: null });
});

describe("loadRecordings", () => {
  it("loads stored recordings with one canonical query and never queries recording_deleted_at", async () => {
    const rows = [row(), row({ id: "b", recording_id: "rec-b" })];
    plan.limit.mockResolvedValue({ data: rows, error: null });
    expect(await loadRecordings()).toEqual({ rows, error: null });
    expect(plan.from).toHaveBeenCalledExactlyOnceWith("call_transcripts");
    expect(plan.select).toHaveBeenCalledExactlyOnceWith("id, call_kind, status, duration_seconds, created_at, recording_id, project_id, summary, error");
    expect(plan.not).toHaveBeenCalledExactlyOnceWith("recording_id", "is", null);
    expect(plan.order).toHaveBeenCalledExactlyOnceWith("created_at", { ascending: false });
    expect(plan.limit).toHaveBeenCalledExactlyOnceWith(100);
    expect(plan.is).not.toHaveBeenCalled();
  });

  it("preserves the caller's limit", async () => {
    await loadRecordings(25);
    expect(plan.limit).toHaveBeenCalledExactlyOnceWith(25);
  });

  it.each([
    ["ready", {}, { transcript: "ready", canReplay: true, canOpenRecap: true }],
    ["queued", { status: "pending", summary: null }, { transcript: "queued", canReplay: true, inProgress: true }],
    ["processing", { status: "transcribing", summary: null }, { transcript: "processing", canReplay: true, inProgress: true }],
    ["delayed", { status: "pending", summary: null, created_at: new Date(NOW - TRANSCRIPT_STALLED_AFTER_MS - 1000).toISOString() }, { transcript: "stalled", canReplay: true, inProgress: false }],
    ["no recap", { status: "failed", summary: null, error: "Recording too large for inline transcription (42529331 bytes, max 8388608). Chunking not yet implemented." }, { transcript: "skipped", canReplay: true, canOpenRecap: false }],
    ["failed recap", { status: "failed", summary: null, error: "Gemini error 500: boom" }, { transcript: "failed", canReplay: true, canOpenRecap: false, tone: "danger" }],
  ] satisfies [string, Partial<RecordingRow>, object][])("preserves replay and %s state after loading", async (_name, over, expected) => {
    const stored = row(over);
    plan.limit.mockResolvedValue({ data: [stored], error: null });
    const result = await loadRecordings();
    expect(result).toEqual({ rows: [stored], error: null });
    const loaded = result.rows[0];
    expect(loaded).toBeDefined();
    if (!loaded) throw new Error("Recording did not load");
    expect(describeStoredRecording(loaded, NOW)).toMatchObject(expected);
  });

  it("returns query errors distinctly and allows the next explicit retry to load", async () => {
    plan.limit.mockResolvedValueOnce({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
    expect(await loadRecordings()).toEqual({ rows: [], error: "JWT expired" });
    expect(plan.from).toHaveBeenCalledTimes(1);
    expect(await loadRecordings()).toEqual({ rows: [row()], error: null });
    expect(plan.from).toHaveBeenCalledTimes(2);
    expect(plan.is).not.toHaveBeenCalled();
  });

  it("preserves the fallback error message", async () => {
    plan.limit.mockResolvedValue({ data: null, error: { message: "" } });
    expect(await loadRecordings()).toEqual({ rows: [], error: "Couldn't load recordings" });
  });

  it("returns an empty list only when the query succeeds without rows", async () => {
    plan.limit.mockResolvedValue({ data: null, error: null });
    expect(await loadRecordings()).toEqual({ rows: [], error: null });
  });
});
