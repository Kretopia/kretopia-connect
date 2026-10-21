import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { VideoCallProvider } from "@/contexts/VideoCallContext";
import { GlobalVideoCallHost } from "../GlobalVideoCallHost";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";

const fake = vi.hoisted(() => {
  const events = new Map<string, (...args: unknown[]) => void>();
  const call = { on: vi.fn((event, fn) => { events.set(event, fn); return call; }), off: vi.fn(), join: vi.fn(async () => {}), leave: vi.fn(async () => { events.get("left-meeting")?.(); }), destroy: vi.fn(async () => {}), participants: vi.fn(() => ({local:{local:true,audio:true,video:true}})), setLocalAudio: vi.fn(), setActiveSpeakerMode: vi.fn(), setTheme: vi.fn(async () => ({})) };
  return {call, events, create: vi.fn(async (container: HTMLElement) => { container.appendChild(document.createElement("iframe")); return call; })};
});
vi.mock("@/lib/dailyFrame", () => ({ createDailyFrameAsync: fake.create, destroyExistingDailyFrameAsync: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/components/calls/CallPreflightGate", () => ({ CallPreflightGate: ({children}: {children: React.ReactNode}) => children }));
vi.mock("@/components/project/PreCallLobby", () => ({ PreCallLobby: ({onJoin}: {onJoin: (prefs: {mic: boolean;cam: boolean}) => void}) => <button onClick={() => onJoin({mic:true,cam:true})}>Join Studio</button> }));
vi.mock("@/components/project/CallInviteSheet", () => ({ CallInviteSheet: () => null }));
vi.mock("@/components/media/PersonAvatar", () => ({ PersonAvatar: () => null }));
afterEach(cleanup);

describe("Studio single-frame lifetime", () => {
  it("retains the session on route/minimize changes and destroys only after confirmed leave", async () => {
    fake.create.mockClear(); fake.call.join.mockClear(); fake.call.destroy.mockClear();
    function App() {
      const navigate = useNavigate();
      return <><button onClick={() => navigate("/scout")}>Navigate</button><VideoCallSheet open onOpenChange={vi.fn()} projectName="Studio" roomUrl="https://example.test/room" token={null} callId={null} userName="Creator" /><GlobalVideoCallHost /></>;
    }
    render(<MemoryRouter initialEntries={["/studio"]}><VideoCallProvider><App /></VideoCallProvider></MemoryRouter>);
    fireEvent.click(await screen.findByText("Join Studio"));
    await waitFor(() => expect(fake.call.join).toHaveBeenCalledOnce());
    const iframe = document.querySelector("iframe"); expect(iframe).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name:"Minimize call"}));
    expect(document.querySelector('[data-call-window="minimized"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name:"Return to full call"}));
    expect(document.querySelector('[data-call-window="full"]')).toBeTruthy();
    fireEvent.click(screen.getByText("Navigate"));
    expect(document.querySelector('[data-call-window="floating"]')).toBeTruthy();
    expect(document.querySelector("iframe")).toBe(iframe);
    expect(fake.create).toHaveBeenCalledOnce(); expect(fake.call.join).toHaveBeenCalledOnce();
    expect(fake.call.destroy).not.toHaveBeenCalled();
    const mini = document.querySelector('.k-call-mini-header');
    if (!mini) throw new Error("Miniature missing");
    fireEvent.click(within(mini as HTMLElement).getByRole("button", {name:"Leave call"}));
    expect(fake.call.leave).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", {name:"Leave call"}));
    await waitFor(() => expect(document.querySelector("iframe")).toBeNull());
    expect(fake.call.destroy).toHaveBeenCalled();
  });
});