import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyCall } from "@daily-co/daily-js";
import { CallMediaControls } from "../CallMediaControls";

afterEach(cleanup);
const setup = () => {
  const listeners = new Map<string, () => void>();
  const local = { audio: true, video: true };
  const call = {
    participants: vi.fn(() => ({ local })),
    on: vi.fn((event, listener) => listeners.set(event, listener)), off: vi.fn(),
    setActiveSpeakerMode: vi.fn(), setTheme: vi.fn(async () => ({})),
    setLocalAudio: vi.fn(), setLocalVideo: vi.fn(), setSidebarView: vi.fn(),
    startRecording: vi.fn(), stopRecording: vi.fn(), leave: vi.fn(),
  };
  const view = render(<CallMediaControls call={call as unknown as DailyCall} />);
  return { call, local, listeners, ...view };
};
describe("Daily-backed call controls", () => {
  it("routes mic/camera actions to Daily and reads their confirmed states", () => {
    const { call, local, listeners } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mute microphone" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn camera off" }));
    expect(call.setLocalAudio).toHaveBeenCalledExactlyOnceWith(false);
    expect(call.setLocalVideo).toHaveBeenCalledExactlyOnceWith(false);
    local.audio = false; local.video = false;
    act(() => listeners.get("participant-updated")?.());
    fireEvent.click(screen.getByRole("button", { name: "Unmute microphone" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn camera on" }));
    expect(call.setLocalAudio).toHaveBeenLastCalledWith(true);
    expect(call.setLocalVideo).toHaveBeenLastCalledWith(true);
  });
  it("opens existing people/chat sidebars without ending or recording the call", () => {
    const { call } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Participants" }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(call.setSidebarView.mock.calls).toEqual([["people"], ["chat"]]);
    expect(call.leave).not.toHaveBeenCalled();
    expect(call.startRecording).not.toHaveBeenCalled();
    expect(call.stopRecording).not.toHaveBeenCalled();
  });
  it("unsubscribes on unmount without destroying the call", () => {
    const { call, unmount } = setup(); unmount();
    expect(call.off.mock.calls.map(([event]) => event)).toEqual(["participant-updated", "joined-meeting"]);
    expect(call.leave).not.toHaveBeenCalled();
  });
});