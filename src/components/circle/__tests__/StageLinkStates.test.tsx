import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A shared Stage link (?join=<id>) says what is true: "ended" only when the host ended it (ended_at), "hasn't opened yet" while
 * the host is backstage (is_live false, no ended_at), nothing while the session is still loading, and a signed-out visitor goes
 * to sign-in with the link kept. A scheduled Stage whose start time passed says it is waiting for the host, not "doors open".
 */
const mocks = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string; user_metadata: Record<string, unknown> }, loading: false },
  row: null as null | Record<string, unknown>,
  invoke: vi.fn(),
  toast: vi.fn(),
  selects: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mocks.invoke(...args) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { mocks.selects++; return { data: mocks.row, error: null }; } }) }) }),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../StageGrid", () => ({ StageGrid: () => null }));
vi.mock("../GoLiveSheet", () => ({ GoLiveSheet: () => null }));
vi.mock("../CreateStageSheet", () => ({ CreateStageSheet: () => null }));
vi.mock("../CallSheetUpcoming", () => ({ CallSheetUpcoming: () => null }));
vi.mock("../SoundStageRoom", () => ({ SoundStageRoom: ({ open }: { open: boolean }) => (open ? <div data-testid="in-stage" /> : null) }));
vi.mock("@/components/project/VideoCallSheet", () => ({ VideoCallSheet: () => null }));

import { LiveCallsPanel } from "../LiveCallsPanel";
import { StageDoorsCountdown } from "../StageDoorsCountdown";
import { stageLinkState } from "@/lib/stageLinkState";

const STAGE = "11111111-1111-4111-8111-111111111111";
const member = { id: "viewer", email: "v@example.com", user_metadata: { full_name: "Viewer" } };
function Where() { const { pathname, search } = useLocation(); return <div data-testid="where">{pathname + search}</div>; }
const open = () => render(<MemoryRouter initialEntries={[`/circle?join=${STAGE}`]}><LiveCallsPanel joinStageId={STAGE} /><Where /></MemoryRouter>);
const row = (over: Record<string, unknown>) => ({ id: STAGE, host_user_id: "host", title: "Night set", mode: "audio", format: "audience", participant_count: 0, started_at: "2026-12-17T20:00:00Z", is_live: true, ended_at: null, ...over });

beforeEach(() => {
  mocks.auth = { user: member, loading: false };
  mocks.row = null;
  mocks.invoke.mockReset().mockResolvedValue({ data: { room_url: "https://daily.test/r", room_name: "r", token: "t" }, error: null });
  mocks.toast.mockReset();
  mocks.selects = 0;
});

describe("stageLinkState", () => {
  it("only ended_at means ended; is_live false without it means not open yet", () => {
    expect(stageLinkState({ is_live: false, ended_at: "2026-12-17T22:00:00Z" })).toBe("ended");
    expect(stageLinkState({ is_live: false, ended_at: null })).toBe("not_open");
    expect(stageLinkState({ is_live: true, ended_at: null })).toBe("live");
  });
});

describe("shared Stage link", () => {
  it("a backstage Stage (host soundchecking) is 'hasn't opened yet', never 'ended', and nobody is let in", async () => {
    mocks.row = row({ is_live: false });
    open();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "This Stage hasn't opened yet" })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "This Stage has ended" }));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("a Stage the host ended says so", async () => {
    mocks.row = row({ is_live: false, ended_at: "2026-12-17T22:00:00Z" });
    open();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "This Stage has ended" })));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("a live Stage joins through the server (which re-checks access)", async () => {
    mocks.row = row({});
    open();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("join-sound-stage", expect.anything()));
  });

  it("while the session loads, nothing is decided: no lookup, no message, no redirect", async () => {
    mocks.auth = { user: null, loading: true };
    open();
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.selects).toBe(0);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent(`/circle?join=${STAGE}`);
  });

  it("signed out: sign in first, then come back to this exact Stage", async () => {
    mocks.auth = { user: null, loading: false };
    open();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(`/auth?redirect=${encodeURIComponent(`/circle?join=${STAGE}`)}`));
    expect(mocks.selects).toBe(0);
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

describe("scheduled Stage countdown", () => {
  it("reaching the start time says it's waiting for the host, not that the doors are open", () => {
    render(<StageDoorsCountdown startsAt={new Date(Date.now() - 60_000).toISOString()} />);
    expect(screen.getByText("Waiting for the host to open the doors")).toBeInTheDocument();
    expect(screen.queryByText("Doors are open")).not.toBeInTheDocument();
  });

  it("before the start time it counts down", () => {
    render(<StageDoorsCountdown startsAt={new Date(Date.now() + 3 * 3_600_000).toISOString()} />);
    expect(screen.getByText("Doors open in")).toBeInTheDocument();
  });
});
