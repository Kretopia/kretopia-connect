import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { VideoCallProvider, useVideoCall } from "../VideoCallContext";
import { GlobalVideoCallHost } from "@/components/calls/GlobalVideoCallHost";

const fake = vi.hoisted(() => {
  const events = new Map<string, (...args: any[]) => void>();
  const call: any = {
    on: vi.fn((e: string, fn: any) => { events.set(e, fn); return call; }), off: vi.fn(),
    join: vi.fn(async () => {}), leave: vi.fn(async () => { events.get("left-meeting")?.(); }), destroy: vi.fn(async () => {}),
    participants: vi.fn(() => ({ local: { local: true, audio: true, video: true } })),
    setLocalAudio: vi.fn(), setActiveSpeakerMode: vi.fn(), setTheme: vi.fn(async () => ({})), startRecording: vi.fn(), stopRecording: vi.fn(),
  };
  return { call, events, create: vi.fn(async (c: HTMLElement) => { c.appendChild(document.createElement("iframe")); return call; }) };
});
const invoke = vi.hoisted(() => vi.fn());
const sonner = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("sonner", () => sonner);
vi.mock("@/lib/dailyFrame", () => ({ createDailyFrameAsync: fake.create, destroyExistingDailyFrameAsync: vi.fn(), teardownDailyCall: vi.fn(async () => {}) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/components/media/PersonAvatar", () => ({ PersonAvatar: () => null }));
vi.mock("@/components/calls/CallPreflightGate", () => ({ CallPreflightGate: ({ children }: any) => children }));
vi.mock("@/components/project/PreCallLobby", () => ({ PreCallLobby: () => null }));
vi.mock("@/components/project/CallInviteSheet", () => ({ CallInviteSheet: () => null }));

beforeEach(() => {
  fake.events.clear();
  for (const f of Object.values(fake.call) as any[]) f.mockClear?.();
  fake.create.mockClear(); invoke.mockReset(); sonner.toast.mockClear();
  invoke.mockImplementation(async (name: string) => name === "mint-meeting-token"
    ? { data: { token: "t", room_url: "https://example.test/room", title: "Meet", role: "host" }, error: null }
    : { data: { results: [], since_ts: null }, error: null });
});
afterEach(cleanup);

function Probe() {
  const s = useVideoCall();
  return <>
    <span data-testid="rec">{s.recordingPhase}</span><span data-testid="phase">{s.phase}</span><span data-testid="reminder">{String(s.recordingReminder)}</span><span data-testid="error">{s.error ?? ""}</span><span data-testid="studio">{s.studioCall ? "yes" : "no"}</span>
    <button onClick={() => void s.openMeeting("m1", undefined, "Me")}>open</button>
    <button onClick={() => s.joinLive({ mic: true, cam: true }, "Me")}>join</button>
    <button onClick={() => void s.leave()}>leave</button>
    <button onClick={() => void s.openMeeting("m2", undefined, "Me")}>open other</button>
    <button onClick={() => s.openStudioCall({ open: true, onOpenChange: vi.fn(), projectName: "S", roomUrl: "https://example.test/s", token: null, callId: null, userName: "Me" }, "owner")}>open studio</button>
    <button onClick={() => s.closeStudioCall("someone-else")}>close as someone else</button>
    <button onClick={() => s.closeStudioCall("owner")}>close as owner</button>
    <button onClick={() => s.closeStudioCall()}>close unscoped</button>
  </>;
}
const shell = () => render(<MemoryRouter><VideoCallProvider><Probe /><GlobalVideoCallHost /></VideoCallProvider></MemoryRouter>);
const startMeeting = async () => {
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(screen.getByTestId("phase").textContent).toBe("lobby"));
  fireEvent.click(screen.getByText("join"));
  await waitFor(() => expect(fake.call.join).toHaveBeenCalled());
};
const emit = (event: string, payload?: unknown) => act(async () => { fake.events.get(event)?.(payload); });

describe("/meet call: recording state belongs to one call", () => {
  it("leaving mid-recording leaves nothing behind", async () => {
    shell();
    await startMeeting();
    await emit("recording-started", { recordingId: "r1", local: true });
    expect(screen.getByTestId("rec").textContent).toBe("recording");
    fireEvent.click(screen.getByText("leave"));
    await waitFor(() => expect(screen.getByTestId("phase").textContent).toBe("ended"));
    expect(screen.getByTestId("rec").textContent).toBe("idle");
    expect(screen.getByTestId("reminder").textContent).toBe("false");
  });

  it("the next call starts idle even if the previous one never reported its recording ending", async () => {
    shell();
    await startMeeting();
    await emit("recording-started", { recordingId: "r1", local: true });
    // a call that ended without a left-meeting (the host tab reconnected): the new join must still start clean
    fireEvent.click(screen.getByText("join"));
    expect(screen.getByTestId("rec").textContent).toBe("idle");
  });
});

describe("a call while another one is live", () => {
  it("tells the user, and does not leave the page waiting on 'Loading meeting…'", async () => {
    shell();
    fireEvent.click(screen.getByText("open studio"));
    await waitFor(() => expect(screen.getByTestId("studio").textContent).toBe("yes"));
    fireEvent.click(screen.getByText("open"));
    await waitFor(() => expect(sonner.toast).toHaveBeenCalledWith("You're already in a call", expect.anything()));
    expect(screen.getByTestId("phase").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toMatch(/already in a call/);
    expect(invoke).not.toHaveBeenCalledWith("mint-meeting-token", expect.anything());
  });

  it("a live meeting refuses a Studio call with a message", async () => {
    shell();
    await startMeeting();
    fireEvent.click(screen.getByText("open studio"));
    expect(sonner.toast).toHaveBeenCalledWith("You're already in a call", expect.anything());
    expect(fake.create).toHaveBeenCalledTimes(1);
  });
});

describe("who may end the Studio call", () => {
  const open = async () => { shell(); fireEvent.click(screen.getByText("open studio")); await waitFor(() => expect(screen.getByTestId("studio").textContent).toBe("yes")); };
  it("only the caller that started it, or the user leaving from inside it (unscoped)", async () => {
    await open();
    fireEvent.click(screen.getByText("close as someone else"));
    expect(screen.getByTestId("studio").textContent).toBe("yes");
    fireEvent.click(screen.getByText("close as owner"));
    expect(screen.getByTestId("studio").textContent).toBe("no");
  });
  it("an unscoped close (the Leave button) always ends it", async () => {
    await open();
    fireEvent.click(screen.getByText("close unscoped"));
    expect(screen.getByTestId("studio").textContent).toBe("no");
  });
});
