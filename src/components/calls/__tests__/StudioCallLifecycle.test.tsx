import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import { VideoCallProvider, useVideoCall } from "@/contexts/VideoCallContext";
import { GlobalVideoCallHost } from "../GlobalVideoCallHost";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";

// The real provider, host and sheet with a fake Daily frame: how a call behaves for the pages that start one.
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
const sonner = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("sonner", () => sonner);
vi.mock("@/lib/dailyFrame", () => ({ createDailyFrameAsync: fake.create, destroyExistingDailyFrameAsync: vi.fn(), teardownDailyCall: vi.fn(async () => {}) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn(async () => ({ data: null, error: null })) }, from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }) } }));
vi.mock("@/components/calls/CallPreflightGate", () => ({ CallPreflightGate: ({ children }: any) => children }));
vi.mock("@/components/project/PreCallLobby", () => ({ PreCallLobby: ({ onJoin }: any) => <button onClick={() => onJoin({ mic: true, cam: true })}>Join Studio</button> }));
vi.mock("@/components/project/CallInviteSheet", () => ({ CallInviteSheet: () => null }));
vi.mock("@/components/media/PersonAvatar", () => ({ PersonAvatar: () => null }));
vi.mock("@/components/calls/AdmitQueue", () => ({ AdmitQueue: ({ isHost }: { isHost: boolean }) => <div data-testid="admit-queue" data-host={String(isHost)} /> }));

beforeEach(() => {
  fake.events.clear();
  for (const f of Object.values(fake.call) as any[]) f.mockClear?.();
  fake.create.mockClear();
  sonner.toast.mockClear();
});
afterEach(cleanup);

const baseProps = { projectName: "Studio", roomUrl: "https://example.test/room", token: null, callId: null, userName: "Creator" };
const settle = (ms = 40) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const joined = async () => { fireEvent.click(await screen.findByText("Join Studio")); await waitFor(() => expect(fake.call.join).toHaveBeenCalled()); };
const shell = (children: React.ReactNode) => render(<MemoryRouter><VideoCallProvider>{children}<GlobalVideoCallHost /></VideoCallProvider></MemoryRouter>);

describe("a caller that closes the sheet itself (Speed Session pair ended, Stage ended)", () => {
  it("ends the call: the room is left and the frame is gone", async () => {
    function Caller() { const [open, setOpen] = useState(true); return <><button onClick={() => setOpen(false)}>caller closes</button><VideoCallSheet open={open} onOpenChange={setOpen} {...baseProps} /></>; }
    shell(<Caller />);
    await joined();
    fireEvent.click(screen.getByText("caller closes"));
    await waitFor(() => expect(fake.call.leave).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector("iframe")).toBeNull());
  });

  it("does not end the call when the caller merely unmounts (navigating away)", async () => {
    function Page() { const [mounted, setMounted] = useState(true); return <><button onClick={() => setMounted(false)}>navigate away</button>{mounted && <VideoCallSheet open onOpenChange={() => {}} {...baseProps} />}</>; }
    shell(<Page />);
    await joined();
    fireEvent.click(screen.getByText("navigate away"));
    await settle();
    expect(fake.call.leave).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeTruthy();
  });

  it("closing it from the inside still tells the caller", async () => {
    const onOpenChange = vi.fn();
    shell(<VideoCallSheet open onOpenChange={onOpenChange} {...baseProps} />);
    await joined();
    fireEvent.click(screen.getAllByRole("button", { name: "Leave call" })[0]);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Leave call" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("close, then open again with a different configuration (Stage: backstage to live)", () => {
  it("honours the new props", async () => {
    function Caller() {
      const [open, setOpen] = useState(true); const [backstage, setBackstage] = useState(true);
      return <><button onClick={() => { setOpen(false); setTimeout(() => { setBackstage(false); setOpen(true); }, 20); }}>go live</button>
        <VideoCallSheet open={open} onOpenChange={setOpen} {...baseProps} backstage={backstage} /></>;
    }
    shell(<Caller />);
    await joined();
    expect(screen.queryByRole("button", { name: /Start recording/ })).toBeNull(); // backstage hides Record
    fireEvent.click(screen.getByText("go live"));
    await settle(150);
    await joined(); // the lobby is shown again, as it was when the sheet re-opened
    await waitFor(() => expect(screen.queryByRole("button", { name: /Start recording/ })).not.toBeNull());
    expect(fake.create).toHaveBeenCalledTimes(2);
  });

  it("a different room while open leaves the old room and tells the caller, as the sheet did (the caller then opens the new one)", async () => {
    const onOpenChange = vi.fn();
    function Caller() { const [room, setRoom] = useState("https://example.test/one"); return <><button onClick={() => setRoom("https://example.test/two")}>next</button><VideoCallSheet open onOpenChange={onOpenChange} {...baseProps} roomUrl={room} /></>; }
    shell(<Caller />);
    await joined();
    fireEvent.click(screen.getByText("next"));
    await waitFor(() => expect(fake.call.leave).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("overlay actions that change while the call is live (Speed Session Connect / Save)", () => {
  it("shows the current overlay without leaving or rejoining the room", async () => {
    function Caller() { const [n, setN] = useState(0); return <><button onClick={() => setN(n + 1)}>tick</button><VideoCallSheet open onOpenChange={() => {}} {...baseProps} overlayActions={<span>overlay-{n}</span>} /></>; }
    shell(<Caller />);
    await joined();
    expect(screen.getByText("overlay-0")).toBeTruthy();
    for (let i = 1; i <= 3; i++) { fireEvent.click(screen.getByText("tick")); await settle(); expect(screen.getByText(`overlay-${i}`)).toBeTruthy(); }
    expect(fake.call.leave).not.toHaveBeenCalled();
    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.call.join).toHaveBeenCalledTimes(1);
  });
});

describe("a second call while one is live", () => {
  it("is refused with a message, and the first call is untouched", async () => {
    function Second() { const s = useVideoCall(); return <button onClick={() => s.openStudioCall({ open: true, onOpenChange: vi.fn(), ...baseProps, roomUrl: "https://example.test/second" }, "someone-else")}>open second</button>; }
    shell(<><VideoCallSheet open onOpenChange={() => {}} {...baseProps} /><Second /></>);
    await joined();
    fireEvent.click(screen.getByText("open second"));
    await settle();
    expect(sonner.toast).toHaveBeenCalledWith("You're already in a call", expect.objectContaining({ description: expect.stringMatching(/Leave it/) }));
    expect(fake.call.leave).not.toHaveBeenCalled();
    expect(fake.create).toHaveBeenCalledTimes(1);
  });

  it("the page that started it, left and opened again for the same room, takes it over: no message, no second frame", async () => {
    function Page() { const [mounted, setMounted] = useState(true); return <><button onClick={() => setMounted((m) => !m)}>toggle page</button>{mounted && <VideoCallSheet open onOpenChange={() => {}} {...baseProps} />}</>; }
    shell(<Page />);
    await joined();
    fireEvent.click(screen.getByText("toggle page")); await settle();   // navigate away
    fireEvent.click(screen.getByText("toggle page")); await settle();   // come back
    expect(sonner.toast).not.toHaveBeenCalled();
    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.call.leave).not.toHaveBeenCalled();
  });

  it("another sheet closing never ends a call it did not start", async () => {
    function Pair() { const [bOpen, setBOpen] = useState(true); return <><button onClick={() => setBOpen(false)}>b closes</button>
      <VideoCallSheet open onOpenChange={() => {}} {...baseProps} /><VideoCallSheet open={bOpen} onOpenChange={setBOpen} {...baseProps} roomUrl="https://example.test/b" /></>; }
    shell(<Pair />);
    await joined();
    fireEvent.click(screen.getByText("b closes"));
    await settle();
    expect(fake.call.leave).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeTruthy();
  });
});

describe("the lobby", () => {
  it("is a named dialog, whichever entry started the call", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} />);
    expect(await screen.findByRole("dialog", { name: "Ready to join Studio" })).toBeTruthy();
  });

  it("keeps 'Invite people' out of the flow: Button's own position class would otherwise win over `absolute` and push it off-screen", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} />);
    const invite = await screen.findByRole("button", { name: /Invite people/ });
    expect(invite.className).toMatch(/(^|\s)!absolute(\s|$)/);
  });
});

describe("one call toolbar", () => {
  // Daily's own tray (inside the frame) has mic, camera, screen share, people and chat. The app's top bar only adds
  // what the tray cannot do, so no control exists twice on the screen.
  it("holds the minimize arrow, record, the menu and leave once each, and nothing Daily's tray already has", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} />);
    await joined();
    const bar = within(screen.getByRole("toolbar", { name: "Call controls" }));
    for (const name of ["Minimize call", "Start recording", "More call options", "Leave call"]) {
      expect(bar.getAllByRole("button", { name })).toHaveLength(1);
    }
    for (const name of ["Mute microphone", "Turn camera off", "Share screen", "Participants", "Chat"]) {
      expect(bar.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getAllByRole("toolbar")).toHaveLength(1);
    expect(document.querySelector(".k-call-footer")).toBeNull();
    expect(document.querySelector(".k-call-controls")).toBeNull();
    expect(screen.getByRole("toolbar").closest("header")).toBeTruthy();
  });

  it("puts the minimize arrow first in the bar, so it never sits over the frame's own view and settings controls", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} />);
    await joined();
    const bar = screen.getByRole("toolbar", { name: "Call controls" });
    expect(bar.querySelector("button")?.getAttribute("aria-label")).toBe("Minimize call");
    expect(document.querySelector('[data-call-window="full"] > button[aria-label="Minimize call"]')).toBeNull();
    expect(document.querySelectorAll('button[aria-label="Minimize call"]')).toHaveLength(1);
  });

  it("keeps the toolbar actions working: record and the invite entry in the menu", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} />);
    await joined();
    fireEvent.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Start recording" }));
    await waitFor(() => expect(fake.call.startRecording).toHaveBeenCalled());
    expect(within(screen.getByRole("toolbar")).getByRole("button", { name: "More call options" })).toBeTruthy();
  });

  it("minimizes into the miniature without touching the frame", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} />);
    await joined();
    const iframe = document.querySelector("iframe");
    fireEvent.click(screen.getByRole("button", { name: "Minimize call" }));
    expect(document.querySelector('[data-call-window="minimized"]')).toBeTruthy();
    expect(document.querySelector("iframe")).toBe(iframe);
    expect(fake.call.leave).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Minimize call" })).toBeNull();
  });
});

describe("a meeting or a guest link starts this same call", () => {
  // /meet/:id and /call/:token fetch the person's access and open the call through the sheet, so what they get is the Studio call: the host
  // keeps the list of people knocking at the door, and a recording left behind by a call never outlives it.
  it("shows the host the people knocking, while the call fills the page", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} isHost admitKnockers />);
    await joined();
    expect(screen.getByTestId("admit-queue")).toHaveAttribute("data-host", "true");
  });

  it("hides that list in the miniature, where it would cover the picture", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} isHost admitKnockers />);
    await joined();
    fireEvent.click(screen.getByRole("button", { name: "Minimize call" }));
    expect(screen.queryByTestId("admit-queue")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Return to full call" }));
    expect(screen.getByTestId("admit-queue")).toBeTruthy();
  });

  it("shows it to nobody else, and to no call that did not ask for it", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} admitKnockers />); // not the host
    await joined();
    expect(screen.queryByTestId("admit-queue")).toBeNull();
  });

  it("does not show it on a host's call that is not a meeting with a waiting room (a Studio or Stage call)", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} isHost />);
    await joined();
    expect(screen.queryByTestId("admit-queue")).toBeNull();
  });

  it("leaving mid-recording clears the recording even when the caller keeps the call mounted", async () => {
    shell(<VideoCallSheet open onOpenChange={() => {}} {...baseProps} />);
    await joined();
    await act(async () => { fake.events.get("recording-started")?.({ recordingId: "r1", local: true }); });
    expect(await screen.findByText("Recording")).toBeTruthy();
    await act(async () => { fake.events.get("left-meeting")?.(); });
    expect(screen.queryByText("Recording")).toBeNull();
  });

  it("carries what started it, so the page that did can recognise its own call", async () => {
    function Peek() { const { studioCall } = useVideoCall(); return <span data-testid="source">{studioCall?.sourceId ?? "none"}</span>; }
    shell(<><VideoCallSheet open onOpenChange={() => {}} {...baseProps} sourceId="meet:m1" /><Peek /></>);
    await joined();
    expect(screen.getByTestId("source").textContent).toBe("meet:m1");
  });
});
