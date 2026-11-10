import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-up submit path, end to end in the page: the wizard's checks, the handler's checks, the server call and what is done with its answer.
 * Only the backend and the analytics are stood in for.
 */
const m = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
  errorOccurred: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : () => chain),
    apply: () => chain,
  });
  return {
    supabase: {
      from: () => chain,
      rpc: (...args: unknown[]) => m.rpc(...args),
      auth: {
        signUp: (...args: unknown[]) => m.signUp(...args),
        resend: (...args: unknown[]) => m.resend(...args),
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
  analytics: new Proxy({}, { get: (_t, prop) => (prop === "errorOccurred" ? m.errorOccurred : () => undefined) }),
  trackEvent: (...args: unknown[]) => m.trackEvent(...args),
  EventCategory: { AUTH: "auth" },
}));
vi.mock("@/lib/createDirectMatch", () => ({ createDirectMatch: vi.fn() }));
vi.mock("@/components/auth/AuthBrandingPanel", () => ({ AuthBrandingPanel: () => null }));
vi.mock("@/components/search/PublicPresenceSearch", () => ({ PublicPresenceSearch: () => null }));
vi.mock("@/components/landing/WaitlistForm", () => ({ WaitlistForm: () => null }));
vi.mock("@/components/landing/OAuthQuickButtons", () => ({ OAuthQuickButtons: () => null }));
vi.mock("@/components/auth/ForgotPasswordDialog", () => ({ ForgotPasswordDialog: () => null }));
vi.mock("@/components/onboarding/FunnelStepper", () => ({ FunnelStepper: () => null }));

import Auth from "../Auth";

const draw = (children?: ReactNode) => {
  // The page reads its starting mode from the address bar itself (not the router): classic email and password, not the one-tap claim.
  window.history.replaceState({}, "", "/auth?tab=signup&mode=classic");
  return render(
    <MemoryRouter initialEntries={["/auth?tab=signup&mode=classic"]}>
      <Auth />
      {children}
    </MemoryRouter>,
  );
};

const toasted = (title: string) => m.toast.mock.calls.map(([arg]) => arg).find((arg) => arg.title === title);

/** Fills step 1 (email) and step 2 (password twice), without pressing Create Account. */
const fill = async (password: string, email = "Dee@Example.com ") => {
  draw();
  fireEvent.change(await screen.findByLabelText("Email Address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.change(await screen.findByLabelText("Create Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: password } });
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

const GOOD = "Summer-2024-Night";

beforeEach(() => {
  m.signUp.mockReset().mockResolvedValue({ data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null }, error: null });
  m.resend.mockReset().mockResolvedValue({ data: {}, error: null });
  m.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  m.toast.mockReset();
  m.errorOccurred.mockReset();
  m.trackEvent.mockReset();
  sessionStorage.clear();
});

describe("sign-up: the form says what the submit will accept, before it is pressed", () => {
  it("a password the form calls fine is never turned down afterwards by a rule it did not mention", async () => {
    await fill("Summer2024"); // 10 characters, no symbol: what the old checklist and the old wizard check called strong
    // The checklist beside the field lists the rules the submit enforces, so none of them can be a surprise.
    expect(screen.getByText("At least 12 characters")).toBeInTheDocument();
    expect(screen.getByText("Contains a symbol")).toBeInTheDocument();
    submit();
    // The answer is under the field, in the form's own words, and nothing is sent to the server.
    expect(await screen.findByText("Use at least 12 characters.")).toBeInTheDocument();
    expect(m.signUp).not.toHaveBeenCalled();
  });

  it("each rule is named at the field with the same words the submit uses", async () => {
    for (const [password, message] of [
      ["alllowercase-1234", "Add an uppercase letter."],
      ["ALLUPPERCASE-1234", "Add a lowercase letter."],
      ["NoNumbersHere-abc", "Add a number."],
      ["NoSymbolsHere12345", "Add a symbol."],
    ] as const) {
      const { unmount } = render(<div />);
      unmount();
      await fill(password);
      submit();
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(m.signUp).not.toHaveBeenCalled();
      document.body.innerHTML = "";
    }
  });

  it("a password that meets every listed rule goes to the server, with the email trimmed and lower-cased", async () => {
    await fill(GOOD);
    submit();
    await waitFor(() => expect(m.signUp).toHaveBeenCalledTimes(1));
    const [args] = m.signUp.mock.calls[0];
    expect(args).toMatchObject({ email: "dee@example.com", password: GOOD });
    expect(args.options.emailRedirectTo).toMatch(/\/onboarding$/);
    expect(args.options.data).toMatchObject({ account_type: "individual" });
    expect(await screen.findByText("Confirm your email to continue")).toBeInTheDocument();
  });
});

describe("sign-up: what is done with the server's answer", () => {
  it("an email that is already registered sends the person to sign in, whether the server says so or hides it", async () => {
    m.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: "User already registered", status: 422 } });
    await fill(GOOD);
    submit();
    await waitFor(() => expect(toasted("Account Exists")).toBeTruthy());
    expect(screen.getByRole("tab", { name: "Sign In" })).toHaveAttribute("data-state", "active");
  });

  it("an existing address answered with an empty identity list (the server's way of not saying so) is the same", async () => {
    m.signUp.mockResolvedValueOnce({ data: { user: { id: "u1", identities: [] }, session: null }, error: null });
    await fill(GOOD);
    submit();
    await waitFor(() => expect(toasted("Account Exists")).toBeTruthy());
    expect(screen.queryByText("Confirm your email to continue")).not.toBeInTheDocument();
  });

  it("an email rate limit is reported as a rate limit, in the message and in the funnel, not as a bad email address", async () => {
    m.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: "email rate limit exceeded", status: 429, code: "over_email_send_rate_limit" } });
    await fill(GOOD);
    submit();
    await waitFor(() => expect(m.errorOccurred).toHaveBeenCalled());
    expect(m.errorOccurred).toHaveBeenCalledWith("signup_failed", "rate_limited", "auth");
    const toast = toasted("Too many sign-up attempts");
    expect(toast).toMatchObject({ variant: "destructive" });
    expect(toast.description).toMatch(/try again/i);
    // the form is usable again, with what the person typed still in it
    expect(screen.getByRole("button", { name: "Create Account" })).toBeEnabled();
    expect(screen.getByLabelText("Create Password")).toHaveValue(GOOD);
  });

  it("a call that fails outright leaves the button usable and says so, rather than spinning for ever", async () => {
    m.signUp.mockRejectedValueOnce(new Error("Failed to read the session from storage"));
    await fill(GOOD);
    submit();
    await waitFor(() => expect(toasted("Sign-up failed")).toBeTruthy());
    expect(toasted("Sign-up failed")).toMatchObject({ variant: "destructive" });
    expect(screen.getByRole("button", { name: "Create Account" })).toBeEnabled();
  });

  it("a network failure is reported as one", async () => {
    m.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: "Failed to fetch", status: 0 } });
    await fill(GOOD);
    submit();
    await waitFor(() => expect(toasted("Connection Error")).toBeTruthy());
    expect(m.errorOccurred).toHaveBeenCalledWith("signup_failed", "network_error", "auth");
  });
});

describe("sign-up: the screen after a confirmation email was sent", () => {
  const toConfirmScreen = async () => {
    await fill(GOOD);
    submit();
    await screen.findByText("Confirm your email to continue");
  };

  it("resending says it was sent only when the server accepted it", async () => {
    await toConfirmScreen();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(toasted("Verification email resent")).toBeTruthy());
    expect(m.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "dee@example.com" }));
  });

  it("…and when the server refuses (a limit, a failure) it says that, not that it was sent", async () => {
    m.resend.mockResolvedValueOnce({ data: {}, error: { message: "For security purposes, you can only request this after 42 seconds.", status: 429 } });
    await toConfirmScreen();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(toasted("Could not resend")).toBeTruthy());
    expect(toasted("Verification email resent")).toBeUndefined();
    expect(toasted("Could not resend")).toMatchObject({ variant: "destructive", description: expect.stringMatching(/42 seconds/) });
  });
});
