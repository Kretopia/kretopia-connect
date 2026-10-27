import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { auth } = vi.hoisted(() => ({
  auth: {
    user: { id: "u1", email: "maya@example.com" } as { id: string; email: string } | null,
    subscriptionInfo: { subscribed: false, tier: "free" },
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/useOnboarding", () => ({ useOnboarding: () => ({ restartOnboarding: vi.fn(), loading: false }) }));
vi.mock("@/hooks/useTrinidadVoice", () => ({ useTrinidadVoice: () => ({ optIn: false, setOptIn: vi.fn(), isTTGeo: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ analytics: { pageView: vi.fn() } }));

// Every read ends in an empty, successful result.
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_target, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : () => chain),
    apply: () => chain,
  });
  return { supabase: { from: () => chain, rpc: () => chain, auth: { getUser: () => chain, signOut: () => chain } } };
});

vi.mock("@/components/features/FeaturePageHeader", () => ({
  FeaturePageHeader: ({ title, accentTitle, eyebrow }: { title: string; accentTitle?: string; eyebrow: string }) => (
    <header>
      <p>{eyebrow}</p>
      <h1>
        {title} {accentTitle}
      </h1>
    </header>
  ),
}));
vi.mock("@/components/AccountSwitcher", () => ({ AccountSwitcher: () => <div>account switcher</div> }));
vi.mock("@/components/account/ManualMergeAccountPanel", () => ({ ManualMergeAccountPanel: () => <div>merge panel</div> }));
vi.mock("@/components/settings/CreatorSiteSettings", () => ({ CreatorSiteSettings: () => <div>creator site</div> }));
vi.mock("@/components/settings/TelegramConnectCard", () => ({ TelegramConnectCard: () => <div>telegram</div> }));
vi.mock("@/components/settings/BlockedUsersCard", () => ({ BlockedUsersCard: () => <div>blocked users</div> }));
vi.mock("@/components/profile/NotificationSettings", () => ({ NotificationSettings: () => <div>notification settings</div> }));
vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => <div>language</div> }));
vi.mock("@/components/onboarding/VibePicker", () => ({ VibePicker: () => <div>vibe picker</div> }));

import Settings from "../Settings";

const renderSettings = (props: { embedded?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <Settings {...props} />
    </MemoryRouter>,
  );

describe("Settings page", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    auth.user = { id: "u1", email: "maya@example.com" };
    auth.subscriptionInfo = { subscribed: false, tier: "free" };
  });

  it("wears the shared page header and says its name once, with no generic 'Everything in Settings' panel", () => {
    renderSettings();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings. Make Kretopia yours.");
    expect(screen.queryByText(/Everything in/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Your account");
  });

  it("has no close row above the panel: Settings is a page, not a dialog", () => {
    renderSettings();
    expect(screen.queryByRole("button", { name: "Close settings" })).not.toBeInTheDocument();
  });

  it("says who and what plan this is, from the account's own data", () => {
    renderSettings();
    expect(screen.getByText(/Personal Creator · Spark plan/)).toBeInTheDocument();
    expect(screen.getByText(/maya@example\.com/)).toBeInTheDocument();
  });

  it("switches section from the nav, and the panel's title follows", () => {
    renderSettings();
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    const expectations: Array<[string, string]> = [
      ["Preferences", "Your preferences"],
      ["Connections", "Your connections"],
      ["Billing", "Your plan"],
      ["Data & Apps", "Your data and apps"],
      ["About", "About Kretopia"],
      ["Account", "Your account"],
    ];
    for (const [label, title] of expectations) {
      fireEvent.click(within(nav).getByRole("button", { name: label }));
      expect(within(nav).getByRole("button", { name: label })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(title);
    }
  });

  it("keeps every section's cards reachable", () => {
    renderSettings();
    expect(screen.getByText("account switcher")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    fireEvent.click(within(nav).getByRole("button", { name: "Connections" }));
    expect(screen.getByText("creator site")).toBeInTheDocument();
    expect(screen.getByText("telegram")).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: "Preferences" }));
    expect(screen.getByText("notification settings")).toBeInTheDocument();
  });

  it("in the navbar drawer (embedded) shows every section and none of the page chrome", () => {
    renderSettings({ embedded: true });
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Settings sections" })).not.toBeInTheDocument();
    expect(screen.getByText("account switcher")).toBeInTheDocument();
    expect(screen.getByText("creator site")).toBeInTheDocument();
    expect(screen.getByText("notification settings")).toBeInTheDocument();
  });
});
