import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { VideoCallProvider, useVideoCall } from "../VideoCallContext";
import { GlobalVideoCallHost } from "@/components/calls/GlobalVideoCallHost";

// A meeting opened from /meet, a guest link opened from /call, a Studio call and a Messages call are all the same call now: one entry in
// this context, one frame. These are the rules that hold for every one of them.
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
vi.mock("@/components/project/PreCallLobby", () => ({ PreCallLobby: ({ onJoin }: { onJoin: (prefs: { mic: boolean; cam: boolean }) => void }) => <button onClick={() => onJoin({ mic: true, cam: true })}>Join call</button> }));
vi.mock("@/components/project/CallInviteSheet", () => ({ CallInviteSheet: () => null }));

beforeEach(() => {
  fake.events.clear();
  for (const f of Object.values(fake.call) as any[]) f.mockClear?.();
  fake.create.mockClear(); invoke.mockReset(); sonner.toast.mockClear();
  invoke.mockImplementation(async () => ({ data: { results: [], since_ts: null }, error: null }));
});
afterEach(cleanup);

const meeting = { open: true, onOpenChange: vi.fn(), projectName: "Meet", roomUrl: "https://example.test/room", token: "t", callId: null, userName: "Me", isHost: true, sourceId: "meet:m1" };

function Probe() {
  const s = useVideoCall();
  return <>
    <span data-testid="studio">{s.studioCall ? "yes" : "no"}</span>
    <span data-testid="source">{s.studioCall?.sourceId ?? ""}</span>
    <button onClick={() => s.openStudioCall(meeting, "owner")}>open</button>
    <button onClick={() => s.openStudioCall({ ...meeting, roomUrl: "https://example.test/other", sourceId: null }, "someone-else")}>open another room</button>
    <button onClick={() => s.openStudioCall(meeting, "returning-page")}>open same room from the page that is back</button>
    <button onClick={() => s.closeStudioCall("someone-else")}>close as someone else</button>
    <button onClick={() => s.closeStudioCall("owner")}>close as owner</button>
    <button onClick={() => s.closeStudioCall()}>close unscoped</button>
  </>;
}
const shell = () => render(<MemoryRouter><VideoCallProvider><Probe /><GlobalVideoCallHost /></VideoCallProvider></MemoryRouter>);
const joined = async () => { fireEvent.click(await screen.findByText("Join call")); await waitFor(() => expect(fake.call.join).toHaveBeenCalled()); };
const emit = (event: string, payload?: unknown) => act(async () => { fake.events.get(event)?.(payload); });
const studio = () => screen.getByTestId("studio").textContent;

describe("a call's recording state belongs to that call", () => {
  it("leaving mid-recording leaves nothing behind: the next call opens with no recording", async () => {
    shell();
    fireEvent.click(screen.getByText("open"));
    await joined();
    await emit("recording-started", { recordingId: "r1", local: true });
    expect(await screen.findByText("Recording")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Leave call" })[0]);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Leave call" }));
    await waitFor(() => expect(studio()).toBe("no"));
    expect(screen.queryByText("Recording")).toBeNull();

    fireEvent.click(screen.getByText("open"));
    await joined();
    expect(screen.queryByText("Recording")).toBeNull();
    expect(screen.queryByRole("button", { name: /Stop recording/ })).toBeNull(); // the Record button is idle, not "Stop"
  });

  it("the next call starts idle even if the previous one never reported its recording ending", async () => {
    shell();
    fireEvent.click(screen.getByText("open"));
    await joined();
    await emit("recording-started", { recordingId: "r1", local: true });
    expect(await screen.findByText("Recording")).toBeTruthy();
    // the call is ended from outside, with no recording-stopped event (the host's tab reconnected, or the caller closed it)
    fireEvent.click(screen.getByText("close unscoped"));
    await waitFor(() => expect(studio()).toBe("no"));

    fireEvent.click(screen.getByText("open"));
    await joined();
    expect(screen.queryByText("Recording")).toBeNull();
  });
});

describe("a second call while one is live", () => {
  it("is refused with a message, whatever started the first one (a meeting here)", async () => {
    shell();
    fireEvent.click(screen.getByText("open"));
    await joined();
    fireEvent.click(screen.getByText("open another room"));
    expect(sonner.toast).toHaveBeenCalledWith("You're already in a call", expect.objectContaining({ description: expect.stringMatching(/Leave it/) }));
    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.call.leave).not.toHaveBeenCalled();
    expect(screen.getByTestId("source").textContent).toBe("meet:m1");
  });

  it("the page that started it, opened again for the same room, takes it over: no message, no second frame", async () => {
    shell();
    fireEvent.click(screen.getByText("open"));
    await joined();
    fireEvent.click(screen.getByText("open same room from the page that is back"));
    expect(sonner.toast).not.toHaveBeenCalled();
    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.call.leave).not.toHaveBeenCalled();
    expect(studio()).toBe("yes");
  });
});

describe("who may end the call", () => {
  const open = async () => { shell(); fireEvent.click(screen.getByText("open")); await waitFor(() => expect(studio()).toBe("yes")); };
  it("only the caller that started it, or the user leaving from inside it (unscoped)", async () => {
    await open();
    fireEvent.click(screen.getByText("close as someone else"));
    expect(studio()).toBe("yes");
    fireEvent.click(screen.getByText("close as owner"));
    expect(studio()).toBe("no");
  });
  it("an unscoped close (the Leave button) always ends it", async () => {
    await open();
    fireEvent.click(screen.getByText("close unscoped"));
    expect(studio()).toBe("no");
  });
});
