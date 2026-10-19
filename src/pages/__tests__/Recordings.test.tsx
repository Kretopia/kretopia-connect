import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  auth: { user: { id: "u1" } }, // one stable object: the page's load effect depends on `user`
  load: vi.fn(),
  invoke: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => world.toastError(...a), success: (...a: unknown[]) => world.toastSuccess(...a) } }));

vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => world.auth }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/agent/KretoTip", () => ({ KretoTip: () => null }));
vi.mock("@/components/calls/CallRecapSheet", () => ({ CallRecapSheet: () => null }));
vi.mock("@/components/calls/WatchReplayButton", () => ({
  WatchReplayButton: ({ transcriptId }: { transcriptId: string }) => <button>Replay {transcriptId}</button>,
}));
vi.mock("@/lib/loadRecordings", () => ({ loadRecordings: (...a: unknown[]) => world.load(...a) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => world.invoke(...a) } } }));

import Recordings from "../Recordings";

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  call_kind: "project",
  status: "ready",
  duration_seconds: 125,
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  recording_id: "rec_1",
  project_id: "p1",
  summary: "We agreed on the storyboard.",
  error: null,
  ...over,
});
const renderPage = () =>
  render(
    <MemoryRouter>
      <Recordings />
    </MemoryRouter>,
  );

beforeEach(() => {
  world.load.mockReset();
  world.invoke.mockReset();
  world.toastError.mockReset();
  world.toastSuccess.mockReset();
});

describe("Recordings page: stored recordings are shown, honestly", () => {
  it("lists a recording whose transcript was skipped because it is too long, with its replay (the 22 rows production holds)", async () => {
    const legacy = "Recording too large for inline transcription (42529331 bytes, max 8388608). Chunking not yet implemented.";
    world.load.mockResolvedValue({ rows: [row({ id: "long", status: "failed", error: legacy, summary: null, duration_seconds: 72 })], error: null });
    renderPage();
    expect(await screen.findByText("No recap")).toBeInTheDocument();
    expect(screen.getByText(/too long for automatic transcription/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay long" })).toBeInTheDocument();
    // not the old red "Failed" that made a good recording look broken
    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.queryByRole("button", { name: /Recap$/ })).toBeNull();
  });

  it("a ready recap offers both the replay and the recap; a real failure keeps the replay and says it failed", async () => {
    world.load.mockResolvedValue({
      rows: [row({ id: "ok" }), row({ id: "bad", status: "failed", error: "Gemini error 500: boom", summary: null })],
      error: null,
    });
    renderPage();
    expect(await screen.findByText("Recap ready")).toBeInTheDocument();
    expect(screen.getByText("Recap failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay ok" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay bad" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Recap/ })).toHaveLength(1);
  });

  it("an expired recording has no replay button and says so", async () => {
    world.load.mockResolvedValue({ rows: [row({ id: "old", recording_deleted_at: "2026-09-01T00:00:00Z" })], error: null });
    renderPage();
    expect(await screen.findByText("Replay expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replay old" })).toBeNull();
  });

  it("a recap still being produced shows progress, not a failure", async () => {
    world.load.mockResolvedValue({ rows: [row({ id: "wip", status: "transcribing", summary: null })], error: null });
    renderPage();
    expect(await screen.findByText("Kreto listening…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay wip" })).toBeInTheDocument();
  });
});

describe("Recordings page: an empty list and a failed load are different things", () => {
  it("really empty", async () => {
    world.load.mockResolvedValue({ rows: [], error: null });
    renderPage();
    expect(await screen.findByText("No recordings yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a failed load is an error with a retry, never 'No recordings yet'", async () => {
    world.load.mockResolvedValueOnce({ rows: [], error: "JWT expired" });
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't load your recordings")).toBeInTheDocument();
    expect(screen.queryByText("No recordings yet")).toBeNull();

    world.load.mockResolvedValueOnce({ rows: [row()], error: null });
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Recap ready")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Recordings page: Sync now", () => {
  const sync = async (data: unknown) => {
    world.load.mockResolvedValue({ rows: [], error: null });
    world.invoke.mockResolvedValue({ data, error: null });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Sync now/ }));
    await waitFor(() => expect(world.invoke).toHaveBeenCalledWith("sync-daily-recordings", { body: { limit: 50 } }));
    await waitFor(() => expect(world.load).toHaveBeenCalledTimes(2)); // the list is reloaded afterwards
  };

  it("reports a recording that could not be saved instead of 'All caught up'", async () => {
    await sync({ ok: false, scanned: 2, results: [{ recording_id: "x", error: "insert failed" }] });
    expect(world.toastError).toHaveBeenCalledWith("1 recording could not be saved", expect.anything());
    expect(world.toastSuccess).not.toHaveBeenCalled();
  });

  it("says a recording is still being finalised rather than 'All caught up'", async () => {
    await sync({ ok: true, scanned: 1, results: [{ recording_id: "x", skipped: "status=processing" }] });
    expect(world.toastSuccess).toHaveBeenCalledWith("Still processing", expect.objectContaining({ description: expect.stringMatching(/Longer calls take longer/) }));
  });

  it("reports what was pulled", async () => {
    await sync({ ok: true, scanned: 3, results: [{ recording_id: "x", transcript_id: "t1" }, { recording_id: "y", transcript_id: "t2" }] });
    expect(world.toastSuccess).toHaveBeenCalledWith("Pulled 2 new recordings", expect.anything());
  });
});
