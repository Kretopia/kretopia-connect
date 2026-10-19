import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { PersistentCallWindow } from "../PersistentCallWindow";
import { VideoCallProvider, useVideoCall } from "@/contexts/VideoCallContext";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/components/media/PersonAvatar", () => ({ PersonAvatar: () => null }));
afterEach(cleanup);

describe("persistent call window", () => {
  function Harness() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate("/scout")}>Scout</button><PersistentCallWindow route="/studio" title="Studio" call={null} startedAt={Date.now() - 120000} recordingPhase="recording" onLeave={leave}><iframe title="single call" /></PersistentCallWindow></>;
  }
  const leave = vi.fn();
  it("keeps the identical iframe on navigation and miniature/full transitions", () => {
    render(<MemoryRouter initialEntries={["/studio"]}><Harness /></MemoryRouter>);
    const frame = screen.getByTitle("single call");
    fireEvent.click(screen.getByText("Scout"));
    expect(document.querySelector('[data-call-window="floating"]')).toBeTruthy();
    expect(screen.getByTitle("single call")).toBe(frame);
    fireEvent.click(screen.getAllByRole("button", { name: "Minimize call" })[0]);
    expect(document.querySelector('[data-call-window="minimized"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand miniature" }));
    expect(document.querySelector('[data-call-window="floating"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Return to full call" }));
    expect(document.querySelector('[data-call-window="full"]')).toBeTruthy();
    expect(screen.getByTitle("single call")).toBe(frame);
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });
  it("requires confirmation before leaving", () => {
    leave.mockClear();
    render(<MemoryRouter initialEntries={["/scout"]}><Harness /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Leave call" }));
    expect(leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stay in call" }));
    expect(leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave call" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Leave call" }));
    expect(leave).toHaveBeenCalledOnce();
  });
  it("owns one Studio call across routes, clears on end and starts idle after refresh", async () => {
    function StoreHarness() {
      const store = useVideoCall(); const navigate = useNavigate();
      return <><span data-testid="active">{store.studioCall?.roomUrl ?? "idle"}</span><button onClick={() => store.openStudioCall({open:true, onOpenChange:vi.fn(), projectName:"Studio", roomUrl:"room-one", token:null, callId:null, userName:"Creator"})}>Join</button><button onClick={() => navigate("/scout")}>Navigate</button><button onClick={() => store.closeStudioCall()}>Ended</button></>;
    }
    const view = render(<MemoryRouter><VideoCallProvider><StoreHarness /></VideoCallProvider></MemoryRouter>);
    expect(screen.getByTestId("active")).toHaveTextContent("idle");
    fireEvent.click(screen.getByText("Join")); fireEvent.click(screen.getByText("Navigate"));
    expect(screen.getByTestId("active")).toHaveTextContent("room-one");
    fireEvent.click(screen.getByText("Ended"));
    expect(screen.getByTestId("active")).toHaveTextContent("idle");
    view.unmount();
    render(<MemoryRouter><VideoCallProvider><StoreHarness /></VideoCallProvider></MemoryRouter>);
    expect(screen.getByTestId("active")).toHaveTextContent("idle");
  });
});