import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PWAInstallPrompt } from "../PWAInstallPrompt";

// jsdom has no matchMedia: answer only the desktop-width query, never "standalone".
function stubViewport(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === "(min-width: 1024px)" ? desktop : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

async function offerInstall() {
  await act(async () => {
    window.dispatchEvent(new Event("beforeinstallprompt"));
    await vi.advanceTimersByTimeAsync(61_000);
  });
}

describe("PWAInstallPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not shown on a phone, even once the browser offers the install", async () => {
    stubViewport(false);
    render(<PWAInstallPrompt />);
    await offerInstall();
    expect(screen.queryByText("Get Kretopia App")).not.toBeInTheDocument();
  });

  it("is still shown at desktop width", async () => {
    stubViewport(true);
    render(<PWAInstallPrompt />);
    await offerInstall();
    expect(screen.getByText("Get Kretopia App")).toBeInTheDocument();
  });
});
