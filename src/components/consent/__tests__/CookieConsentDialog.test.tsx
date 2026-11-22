import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentDialog } from "../CookieConsentDialog";
import { __resetCookieConsentMemory, hasAnalyticsConsent, openCookieSettings, readCookieConsent } from "@/lib/cookieConsent";

/**
 * First visit on a device: a centred choice. "Essential only" is as easy as "Accept all", analytics stay off until a yes,
 * the choice is remembered on this device, Escape or a click outside never counts as a choice, and it can be reopened.
 */
beforeEach(() => {
  localStorage.clear();
  __resetCookieConsentMemory();
});

describe("cookie consent dialog", () => {
  it("opens on a device with no choice, with both answers equally available", () => {
    render(<CookieConsentDialog />);
    expect(screen.getByRole("dialog", { name: "Cookies on Kretopia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Essential only" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept all" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy#s08");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("'Essential only' keeps analytics off and is remembered; the dialog does not come back", () => {
    const { unmount } = render(<CookieConsentDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    expect(readCookieConsent()).toMatchObject({ version: 1, analytics: false });
    expect(hasAnalyticsConsent()).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    render(<CookieConsentDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("'Accept all' turns analytics on", () => {
    render(<CookieConsentDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("Escape does not close it without a choice", () => {
    render(<CookieConsentDialog />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(readCookieConsent()).toBeNull();
  });

  it("Customise shows Essential (always on) and Analytics (off by default), and saves exactly what was chosen", () => {
    render(<CookieConsentDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Customise" }));
    expect(screen.getByRole("switch", { name: "Essential cookies, always on" })).toBeDisabled();
    const analytics = screen.getByRole("switch", { name: "Analytics cookies" });
    expect(analytics).toHaveAttribute("aria-checked", "false");
    fireEvent.click(analytics);
    fireEvent.click(screen.getByRole("button", { name: "Save my choices" }));
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("'Cookie settings' reopens it with the current choice, and it can be withdrawn", () => {
    localStorage.setItem("kretopia:cookie-consent", JSON.stringify({ version: 1, analytics: true, decidedAt: "x" }));
    render(<CookieConsentDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => openCookieSettings());
    const analytics = screen.getByRole("switch", { name: "Analytics cookies" });
    expect(analytics).toHaveAttribute("aria-checked", "true");
    fireEvent.click(analytics);
    fireEvent.click(screen.getByRole("button", { name: "Save my choices" }));
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("an old or unreadable stored choice counts as no choice", () => {
    localStorage.setItem("kretopia:cookie-consent", JSON.stringify({ version: 0, analytics: true }));
    expect(readCookieConsent()).toBeNull();
    localStorage.setItem("kretopia:cookie-consent", "{not json");
    expect(readCookieConsent()).toBeNull();
  });
});

describe("no measurement without a yes", () => {
  it("trackEvent writes nothing while analytics consent is missing", async () => {
    vi.resetModules();
    const insert = vi.fn(async () => ({ error: null }));
    vi.doMock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert }), auth: { getUser: async () => ({ data: { user: null } }) } } }));
    const { trackEvent } = await import("@/lib/analytics");
    await trackEvent({ eventName: "test_event", eventCategory: "profile" });
    expect(insert).not.toHaveBeenCalled();
    vi.doUnmock("@/integrations/supabase/client");
  });
});
