import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({ analytics: { pageView: vi.fn(), featureUsed: vi.fn() } }));

import Install from "../Install";

// Google Play Protect blocks the package Samsung Internet makes for an installed web app ("Unsafe app blocked: this app was built for an older
// version of Android"). On /install, Samsung Internet is sent to Chrome; Chrome keeps its own install button.
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36";
const CHROME = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

const originalUserAgent = navigator.userAgent;
const as = (userAgent: string) => Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
afterEach(() => Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent }));

const renderInstall = () => render(<MemoryRouter><Install /></MemoryRouter>);
const browserOffersInstall = () => act(async () => { window.dispatchEvent(new Event("beforeinstallprompt")); });

describe("the install page", () => {
  it("sends Samsung Internet to Chrome, and never offers its own installer, even when the browser says it could", async () => {
    as(SAMSUNG);
    renderInstall();
    await browserOffersInstall();
    expect(screen.getByTestId("open-in-chrome")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Chrome/ }).getAttribute("href")).toMatch(/^intent:\/\/.*package=com\.android\.chrome/);
    expect(screen.queryByRole("button", { name: /Install App/ })).toBeNull();
    expect(screen.queryByText(/Add to Home screen/)).toBeNull();
  });

  it("keeps Chrome's install button, and does not mention Chrome to Chrome users", async () => {
    as(CHROME);
    renderInstall();
    await browserOffersInstall();
    expect(screen.getByRole("button", { name: /Install App/ })).toBeInTheDocument();
    expect(screen.queryByTestId("open-in-chrome")).toBeNull();
  });
});
