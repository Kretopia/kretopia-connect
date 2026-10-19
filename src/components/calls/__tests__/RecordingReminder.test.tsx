import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { RecordingReminder } from "../RecordingReminder";
import { PersistentCallWindow } from "../PersistentCallWindow";

vi.mock("@/components/media/PersonAvatar", () => ({ PersonAvatar: () => null }));
afterEach(cleanup);

describe("RecordingReminder: dismissible, never automatic", () => {
  it("'Not now' hides it without stopping or saving, and so does Escape", () => {
    const stop = vi.fn(), save = vi.fn(), dismiss = vi.fn();
    render(<RecordingReminder visible segment={null} onStop={stop} onSave={save} onDismiss={dismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss reminder" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByLabelText("Recording reminder"), { key: "Escape" });
    expect(dismiss).toHaveBeenCalledTimes(2);
    expect(stop).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });

  it("a read segment notice can be dismissed; one still processing cannot", () => {
    const clear = vi.fn();
    const { rerender } = render(<RecordingReminder visible={false} segment="processing" onStop={vi.fn()} onSave={vi.fn()} onClearSegment={clear} />);
    expect(screen.queryByRole("button", { name: "Dismiss notice" })).toBeNull();
    rerender(<RecordingReminder visible={false} segment="failed" onStop={vi.fn()} onSave={vi.fn()} onClearSegment={clear} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<RecordingReminder visible={false} segment={null} onStop={vi.fn()} onSave={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RecordingReminder next to the call window", () => {
  // jsdom has no layout: stand in for the window's box.
  let rect = { left: 692, top: 440, right: 1012, bottom: 727, width: 320, height: 287 }; // inside jsdom's 1024x768 viewport
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-call-window") ? ({ ...rect, x: rect.left, y: rect.top, toJSON() {} } as DOMRect) : ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect);
    });
    class RO { constructor(private cb: () => void) {} observe() {} disconnect() {} }
    (globalThis as any).ResizeObserver = RO;
  });

  function Harness() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate("/scout")}>away</button>
      <PersistentCallWindow route="/studio" title="Studio" call={null} startedAt={Date.now()} recordingPhase="recording" onLeave={() => {}}>
        <RecordingReminder visible segment={null} onStop={vi.fn()} onSave={vi.fn()} onDismiss={vi.fn()} />
      </PersistentCallWindow></>;
  }
  const away = () => { render(<MemoryRouter initialEntries={["/studio"]}><Harness /></MemoryRouter>); fireEvent.click(screen.getByText("away")); return screen.getByLabelText("Recording reminder"); };

  it("in the call window's own full-screen view it sits over the video, as before", () => {
    render(<MemoryRouter initialEntries={["/studio"]}><Harness /></MemoryRouter>);
    const card = screen.getByLabelText("Recording reminder");
    expect(card.className).toMatch(/absolute/);
    expect(card.style.position).not.toBe("fixed");
  });

  it("in the miniature it is anchored just ABOVE the window, so it cannot cover the mute / return / leave buttons", () => {
    const card = away();
    expect(card.style.position).toBe("fixed");
    expect(["", "auto"]).toContain(card.style.top);
    // distance from the viewport bottom to the card's bottom edge = window top + gap
    expect(parseFloat(card.style.bottom)).toBeCloseTo(window.innerHeight - rect.top + 8, 0);
    expect(parseFloat(card.style.left)).toBe(rect.left);
  });

  it("goes below the window when there is no room above it", () => {
    rect = { left: 12, top: 40, right: 332, bottom: 327, width: 320, height: 287 };
    const card = away();
    expect(["", "auto"]).toContain(card.style.bottom);
    expect(parseFloat(card.style.top)).toBe(rect.bottom + 8);
  });
});
