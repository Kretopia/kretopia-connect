import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sign-up opens on the account options, not the public-source search, and where the person was going (a Co-Sign request, an event, an
 * opportunity) goes with the new account instead of being dropped by the confirmation email, which always opens /onboarding.
 */
const m = vi.hoisted(() => ({ signUp: vi.fn(), toast: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : () => chain),
    apply: () => chain,
  });
  return {
    supabase: {
      from: () => chain,
      rpc: async () => ({ data: null, error: null }),
      auth: {
        signUp: (...args: unknown[]) => m.signUp(...args),
        resend: vi.fn(),
        signInWithPassword: vi.fn(),
        signInWithOtp: vi.fn(),
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/analytics", () => ({
  analytics: new Proxy({}, { get: () => () => undefined }),
  trackEvent: () => undefined,
  EventCategory: { AUTH: "auth" },
}));
vi.mock("@/lib/createDirectMatch", () => ({ createDirectMatch: vi.fn() }));
vi.mock("@/components/auth/AuthBrandingPanel", () => ({ AuthBrandingPanel: () => null }));
vi.mock("@/components/search/PublicPresenceSearch", () => ({ PublicPresenceSearch: () => <div data-testid="public-source-search" /> }));
vi.mock("@/components/landing/WaitlistForm", () => ({ WaitlistForm: () => null }));
vi.mock("@/components/landing/OAuthQuickButtons", () => ({ OAuthQuickButtons: () => null }));
vi.mock("@/components/auth/ForgotPasswordDialog", () => ({ ForgotPasswordDialog: () => null }));
vi.mock("@/components/onboarding/FunnelStepper", () => ({ FunnelStepper: () => null }));

import Auth from "../Auth";

const draw = (query: string) => {
  window.history.replaceState({}, "", `/auth${query}`);
  return render(<MemoryRouter initialEntries={[`/auth${query}`]}><Auth /></MemoryRouter>);
};

const createAccount = async (password = "Summer-2024-Night") => {
  fireEvent.change(await screen.findByLabelText("Email Address"), { target: { value: "dee@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.change(await screen.findByLabelText("Create Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
};
const signUpData = () => (m.signUp.mock.calls[0]?.[0] as { options: { data: Record<string, unknown>; emailRedirectTo: string } }).options;

beforeEach(() => {
  m.signUp.mockReset().mockResolvedValue({ data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null }, error: null });
  m.toast.mockReset();
  sessionStorage.clear();
});

describe("sign-up opens on the account options", () => {
  it("by default: the account form, not the public-source search", async () => {
    draw("?tab=signup");
    expect(await screen.findByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.queryByTestId("public-source-search")).not.toBeInTheDocument();
  });

  it("the public-source search is still one choice away, and opens with ?mode=claim", async () => {
    draw("?tab=signup&mode=claim");
    expect(await screen.findByTestId("public-source-search")).toBeInTheDocument();
  });

  it("a search already typed (?q=) opens the public-source search", async () => {
    draw("?tab=signup&q=dee%20martin");
    expect(await screen.findByTestId("public-source-search")).toBeInTheDocument();
  });

  it("from the account form, the public-source search is offered as the other way in", async () => {
    draw("?tab=signup");
    fireEvent.click(await screen.findByRole("button", { name: "Find my public profile first instead" }));
    expect(await screen.findByTestId("public-source-search")).toBeInTheDocument();
  });
});

describe("where the person was going goes with the new account", () => {
  it("a destination (?next=) is kept in the account and in this browser", async () => {
    draw("?tab=signup&mode=classic&next=%2Fcosign%2Ftok_1");
    await createAccount();
    await vi.waitFor(() => expect(m.signUp).toHaveBeenCalled());
    expect(signUpData().data).toMatchObject({ post_signup_next: "/cosign/tok_1" });
    expect(sessionStorage.getItem("thrivein_post_auth_redirect")).toBe("/cosign/tok_1");
  });

  it("the confirmation email still opens onboarding, on kretopia.com", async () => {
    draw("?tab=signup&mode=classic&next=%2Fcosign%2Ftok_1");
    await createAccount();
    await vi.waitFor(() => expect(m.signUp).toHaveBeenCalled());
    expect(signUpData().emailRedirectTo).toMatch(/\/onboarding$/);
  });

  it("nothing is kept when there is nowhere to continue to (home, the Passport itself)", async () => {
    draw("?tab=signup&mode=classic&next=%2Fprofile");
    await createAccount();
    await vi.waitFor(() => expect(m.signUp).toHaveBeenCalled());
    expect(signUpData().data).not.toHaveProperty("post_signup_next");
    expect(sessionStorage.getItem("thrivein_post_auth_redirect")).toBeNull();
  });

  it("an address outside the app is never kept", async () => {
    draw("?tab=signup&mode=classic&next=https%3A%2F%2Fevil.example");
    await createAccount();
    await vi.waitFor(() => expect(m.signUp).toHaveBeenCalled());
    expect(signUpData().data).not.toHaveProperty("post_signup_next");
    expect(sessionStorage.getItem("thrivein_post_auth_redirect")).toBeNull();
  });
});
