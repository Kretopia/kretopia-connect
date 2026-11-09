import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "viewer", email: "viewer@example.com", user_metadata: { full_name: "Viewer" } } as null | { id: string; email: string; user_metadata: { full_name: string } },
  invoke: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mocks.invoke(...args) } },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../StageGrid", () => ({
  StageGrid: ({ onJoinSoundStage }: { onJoinSoundStage: (stage: unknown) => void }) => (
    <button type="button" onClick={() => onJoinSoundStage({
      id: "stage-1",
      host_user_id: "host",
      title: "Live session",
      mode: "video",
      format: "open_group",
    })}>
      Join live Stage
    </button>
  ),
}));
vi.mock("../GoLiveSheet", () => ({ GoLiveSheet: () => null }));
vi.mock("../CreateStageSheet", () => ({ CreateStageSheet: () => null }));
vi.mock("../CallSheetUpcoming", () => ({ CallSheetUpcoming: () => null }));
vi.mock("../SoundStageRoom", () => ({
  SoundStageRoom: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="authorized-stage-room">{title}</div> : null,
}));
vi.mock("@/components/project/VideoCallSheet", () => ({ VideoCallSheet: () => null }));

import { LiveCallsPanel } from "../LiveCallsPanel";

function CurrentPath() {
  const { pathname, search } = useLocation();
  return <div data-testid="current-path">{pathname + search}</div>;
}

const renderPanel = () => render(
  <MemoryRouter initialEntries={["/circle"]}>
    <LiveCallsPanel />
    <CurrentPath />
  </MemoryRouter>,
);

beforeEach(() => {
  mocks.user = { id: "viewer", email: "viewer@example.com", user_metadata: { full_name: "Viewer" } };
  mocks.invoke.mockReset();
  mocks.toast.mockReset();
});

describe("LiveCallsPanel stage joins", () => {
  it("waits for the authorized server response and ignores duplicate clicks", async () => {
    let resolveJoin!: (result: { data: unknown; error: null }) => void;
    mocks.invoke.mockReturnValue(new Promise((resolve) => { resolveJoin = resolve; }));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Join live Stage" }));
    fireEvent.click(screen.getByRole("button", { name: "Join live Stage" }));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith("join-sound-stage", {
      body: { stage_id: "stage-1", user_name: "Viewer" },
    });
    expect(screen.queryByTestId("authorized-stage-room")).not.toBeInTheDocument();

    await act(async () => {
      resolveJoin({
        data: { room_url: "https://daily.example/room", room_name: "room", token: "scoped-token" },
        error: null,
      });
    });
    expect(await screen.findByTestId("authorized-stage-room")).toHaveTextContent("Live session");
  });

  it("shows a server denial and allows a later retry without opening a room", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: null, error: new Error("Stage ended") })
      .mockResolvedValueOnce({
        data: { room_url: "https://daily.example/room", room_name: "room", token: "scoped-token" },
        error: null,
      });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Join live Stage" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Couldn't walk on stage",
      description: "Stage ended",
      variant: "destructive",
    })));
    expect(screen.queryByTestId("authorized-stage-room")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Join live Stage" }));
    expect(await screen.findByTestId("authorized-stage-room")).toHaveTextContent("Live session");
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });

  it("routes an unauthenticated join to sign-in without requesting a room", () => {
    mocks.user = null;
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Join live Stage" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/auth?redirect=%2Fcircle%3Fjoin%3Dstage-1");
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.queryByTestId("authorized-stage-room")).not.toBeInTheDocument();
  });
});
