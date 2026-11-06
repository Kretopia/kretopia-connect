import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyCall } from "@daily-co/daily-js";
import { CallMediaControls } from "../CallMediaControls";
import { CallWindowContext, type CallWindowMode } from "../callWindowContext";

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
  describe("toolbar mode", () => {
    // Daily's own tray already has mic, camera, screen share, people and chat, so the app's bar must not repeat them.
    const toolbarCall = () => ({ participants: vi.fn(() => ({ local: { audio: true, video: true } })), on: vi.fn(), off: vi.fn(), setActiveSpeakerMode: vi.fn(), setTheme: vi.fn(async () => ({})), setLocalAudio: vi.fn(), setLocalVideo: vi.fn(), setSidebarView: vi.fn() });
    const inWindow = (mode: CallWindowMode, minimize: () => void, call = toolbarCall()) => (
      <CallWindowContext.Provider value={{ mode, rootRef: { current: null }, minimize }}>
        <CallMediaControls call={call as unknown as DailyCall} toolbar><button>extra</button></CallMediaControls>
      </CallWindowContext.Provider>
    );
    const labels = () => Array.from(screen.getByRole("toolbar", { name: "Call controls" }).querySelectorAll("button")).map((b) => b.getAttribute("aria-label") ?? b.textContent);

    it("holds the one minimize arrow, then the page's own actions, and nothing Daily's tray already has", () => {
      const minimize = vi.fn();
      const call = toolbarCall();
      render(inWindow("full", minimize, call));
      expect(labels()).toEqual(["Minimize call", "extra"]);
      fireEvent.click(screen.getByRole("button", { name: "Minimize call" }));
      expect(minimize).toHaveBeenCalledOnce();
      expect(call.setLocalAudio).not.toHaveBeenCalled();
    });

    it("has no minimize arrow when the call is already a miniature, or outside the persistent window", () => {
      const { rerender } = render(inWindow("floating", vi.fn()));
      expect(labels()).toEqual(["extra"]);
      rerender(inWindow("minimized", vi.fn()));
      expect(labels()).toEqual(["extra"]);
      rerender(<CallMediaControls call={toolbarCall() as unknown as DailyCall} toolbar><button>extra</button></CallMediaControls>);
      expect(labels()).toEqual(["extra"]);
    });
  });
  it("unsubscribes on unmount without destroying the call", () => {
    const { call, unmount } = setup(); unmount();
    expect(call.off.mock.calls.map(([event]) => event)).toEqual(["participant-updated", "joined-meeting"]);
    expect(call.leave).not.toHaveBeenCalled();
  });
  describe("Daily's own bars follow the app's theme", () => {
    // Daily accepts #RRGGBB only: given hsl(...) it logged a warning and kept its white tray under the app's dark header.
    const TOKENS = { "--primary": "0 0% 100%", "--primary-foreground": "225 44% 4%", "--background": "225 44.4444% 3.5294%", "--secondary": "222 22% 13%", "--foreground": "0 0% 100%", "--border": "222 22% 13%", "--card": "222 24% 9%", "--muted-foreground": "222 16% 71%" };
    const style = () => document.documentElement.style;
    afterEach(() => { for (const token of Object.keys(TOKENS)) style().removeProperty(token); document.documentElement.removeAttribute("data-theme"); });

    it("sends hex colours only, and sends them again when the theme changes during the call", async () => {
      for (const [token, value] of Object.entries(TOKENS)) style().setProperty(token, value);
      const { call } = setup();
      expect(call.setTheme).toHaveBeenCalledOnce();
      const sent = (call.setTheme.mock.calls[0] as unknown as [{ colors: Record<string, string> }])[0].colors;
      expect(Object.keys(sent).sort()).toEqual(["accent", "accentText", "background", "backgroundAccent", "baseText", "border", "mainAreaBg", "mainAreaBgAccent", "mainAreaText", "supportiveText"]);
      for (const color of Object.values(sent)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(sent.background).toBe("#05070d");

      style().setProperty("--background", "36 27% 97%");
      document.documentElement.setAttribute("data-theme", "daylight");
      await waitFor(() => expect(call.setTheme).toHaveBeenCalledTimes(2));
      const next = (call.setTheme.mock.calls[1] as unknown as [{ colors: Record<string, string> }])[0].colors;
      expect(next.background).toMatch(/^#f/);
      expect(next.mainAreaBg).toBe(next.background);
    });

    it("sends nothing when the document has no theme to read, rather than values Daily rejects", () => {
      const { call } = setup();
      expect(call.setTheme).not.toHaveBeenCalled();
    });
  });
});
