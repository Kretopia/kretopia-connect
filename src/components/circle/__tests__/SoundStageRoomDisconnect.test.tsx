import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A Stage call can end without anyone choosing it: the person is ejected, the room's time runs out, the connection can't be
 * recovered. The room must say so and close, and it must NEVER end the stage for everyone on the host's behalf: a host whose
 * Wi-Fi dropped re-enters from the stage list and the stage keeps running. Choosing to leave still ends the stage, as before.
 */
const m = vi.hoisted(() => ({
  handlers: {} as Record<string, Array<() => void>>,
  invoke: vi.fn(),
  toast: vi.fn(),
  leave: vi.fn(),
  destroy: vi.fn(),
}));

const fakeCall = () => ({
  on: (event: string, fn: () => void) => { (m.handlers[event] ||= []).push(fn); return fakeCall; },
  join: async () => ({}),
  participants: () => ({ local: { session_id: "local", user_id: "u1", user_name: "Me", audio: true, video: false, owner: true, tracks: {} } }),
  setLocalAudio: async () => {},
  setLocalVideo: async () => {},
  sendAppMessage: () => {},
  leave: async () => { m.leave(); },
  destroy: async () => { m.destroy(); },
  localAudio: () => true,
  localVideo: () => false,
});

vi.mock("@daily-co/daily-js", () => ({ default: { createCallObject: () => fakeCall() } }));
vi.mock("@/lib/dailyFrame", () => ({ destroyExistingDailyFrameAsync: async () => {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "me@example.com" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/components/messages/ShareToMessageDialog", () => ({ ShareToMessageDialog: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "eq", "in", "order", "limit"]) chain[k] = () => chain;
  chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
  chain.maybeSingle = async () => ({ data: null, error: null });
  return { supabase: { from: () => chain, functions: { invoke: (...a: unknown[]) => m.invoke(...a) } } };
});

import { SoundStageRoom } from "../SoundStageRoom";

class FakeAudioContext {
  createMediaStreamSource() { return { connect() {} }; }
  createAnalyser() { return { fftSize: 0, frequencyBinCount: 4, getByteTimeDomainData() {} }; }
  async close() {}
}

beforeEach(() => {
  for (const k of Object.keys(m.handlers)) delete m.handlers[k];
  m.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
  m.toast.mockReset();
  m.leave.mockReset();
  m.destroy.mockReset();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [] }) },
  });
});

// The parent closes the sheet when asked; mirror that so the room's own close effect runs.
function Harness({ isHost }: { isHost: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <MemoryRouter>
      <SoundStageRoom
        open={open} onOpenChange={setOpen} roomUrl="https://daily.test/ss-abc" token="t" title="Night set" mode="audio"
        format="audience" isHost={isHost} stageId="stage-1" hostUserId="u1" userName="Me"
      />
    </MemoryRouter>
  );
}

const enter = async (isHost: boolean) => {
  render(<Harness isHost={isHost} />);
  fireEvent.click(await screen.findByRole("button", { name: isHost ? /go live on stage/i : /join the room/i }));
  await waitFor(() => expect(m.handlers["left-meeting"]?.length).toBeGreaterThan(0));
};
const endedStage = () => m.invoke.mock.calls.some((c) => c[0] === "end-sound-stage");

describe("Stage room: the call ends by itself", () => {
  it("a host who loses the connection is told, the room closes, and the stage is NOT ended for everyone", async () => {
    await enter(true);
    await act(async () => { m.handlers["left-meeting"].forEach((fn) => fn()); });
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "You were disconnected", description: expect.stringContaining("Your stage is still open") }));
    await waitFor(() => expect(m.leave).toHaveBeenCalled());
    expect(endedStage()).toBe(false);
  });

  it("an audience member is told the stage may still be live", async () => {
    await enter(false);
    await act(async () => { m.handlers["error"].forEach((fn) => fn()); });
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "You were disconnected", description: expect.stringContaining("may still be live") }));
    expect(endedStage()).toBe(false);
  });

  it("two events for one loss say it once", async () => {
    await enter(false);
    await act(async () => { m.handlers["left-meeting"].forEach((fn) => fn()); m.handlers["error"].forEach((fn) => fn()); });
    expect(m.toast.mock.calls.filter((c) => (c[0] as { title: string }).title === "You were disconnected")).toHaveLength(1);
  });
});

describe("Stage room: leaving on purpose is unchanged", () => {
  it("the host who chooses to leave ends the stage, and no disconnection notice appears", async () => {
    await enter(true);
    fireEvent.click(screen.getByRole("button", { name: "Leave Stage" }));
    await waitFor(() => expect(endedStage()).toBe(true));
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "You were disconnected" }));
  });

  it("an audience member who chooses to leave ends nothing", async () => {
    await enter(false);
    fireEvent.click(screen.getByRole("button", { name: "Leave Stage" }));
    await waitFor(() => expect(m.leave).toHaveBeenCalled());
    expect(endedStage()).toBe(false);
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "You were disconnected" }));
  });
});
