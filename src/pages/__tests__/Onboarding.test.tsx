import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  save: vi.fn(),
  claim: vi.fn(),
  toast: vi.fn(),
  updateUser: vi.fn(),
  auth: { user: { id: "creator-1", email: "", user_metadata: {}, app_metadata: {} } },
}));
vi.mock("@/lib/onboardingUsername", async original => ({
  ...(await original<typeof import("@/lib/onboardingUsername")>()),
  claimOnboardingUsername: (...args: unknown[]) => state.claim(...args),
  isOnboardingUsernameTaken: async () => false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("react-router-dom", async orig => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => state.navigate }));
vi.mock("@/lib/onboardingProfile", () => ({ ONBOARDING_PASSPORT_PATH: "/profile", saveOnboardingProfile: (...args: unknown[]) => state.save(...args) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({
    select: () => ({ eq: () => ({
      single: async () => ({ data: { full_name: "Creator Test", username: "creator_test", onboarding_started_at: "2026-10-30", onboarding_step: 3, role: "Creator", onboarding_completed: false } }),
      maybeSingle: async () => ({ data: { user_id: "creator-1" } }),
    }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
    insert: async () => ({ error: null }),
  }),
  // Intentionally never resolves: optional enrichment cannot block Passport.
  rpc: () => new Promise(() => {}),
  functions: { invoke: async () => ({ data: null, error: null }) },
  auth: { updateUser: (arg: unknown) => state.updateUser(arg) },
} }));
vi.mock("@/lib/analytics", () => ({ analytics: { onboardingStart: vi.fn(), onboardingStep: vi.fn(), onboardingComplete: vi.fn() } }));
vi.mock("@/components/profile/ProfileEditDialog", () => ({ ROLE_OPTIONS: [{ value: "Creator", label: "Creator" }] }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => null }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: any) => <main>{children}</main> }));
vi.mock("@/components/brand/KretoMark", () => ({ KretoMark: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/ImageCropDialog", () => ({ ImageCropDialog: () => null }));
vi.mock("@/components/onboarding/FirstStampReveal", () => ({ FirstStampReveal: () => null }));
vi.mock("@/components/intent/IntentPicker", () => ({ IntentPicker: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));

import Onboarding from "../Onboarding";
import { UsernameTakenError } from "@/lib/onboardingUsername";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  state.save.mockResolvedValue({ user_id: "creator-1", onboarding_completed: true });
  state.claim.mockResolvedValue("fresh_handle");
  state.updateUser.mockResolvedValue({ error: null });
  state.auth.user.user_metadata = {};
});

async function launch() {
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  await screen.findByDisplayValue("Creator Test");
  fireEvent.click(screen.getByRole("button", { name: "Set up manually — it's quick" }));
  await clickLaunch();
}

/** Accepts the Terms and Conditions (required once per version), then launches. */
async function clickLaunch() {
  fireEvent.click(await screen.findByRole("checkbox", { name: /Terms and Conditions/ }));
  fireEvent.click(screen.getByRole("button", { name: /Launch my .*Passport/ }));
}

describe("creator onboarding completion", () => {
  it("keeps entered details after 409 and allows a different handle through manual setup", async () => {
    state.claim.mockRejectedValueOnce(new UsernameTakenError());
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    await screen.findByDisplayValue("Creator Test");
    fireEvent.change(screen.getByLabelText("Claim your @handle"), { target: { value: "taken_handle" } });
    fireEvent.click(screen.getByRole("button", { name: "Set up manually — it's quick" }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Choose another @handle" })));
    expect(screen.getByDisplayValue("Creator Test")).toBeInTheDocument();
    expect(state.navigate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Claim your @handle"), { target: { value: "fresh_handle" } });
    fireEvent.click(screen.getByRole("button", { name: "Set up manually — it's quick" }));
    await clickLaunch();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/profile", { replace: true, state: { passportWelcome: true } }));
    expect(state.claim).toHaveBeenLastCalledWith("creator-1", "fresh_handle");
  });
  it("opens Passport immediately after a real save, without waiting for enrichment", async () => {
    await launch();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/profile", { replace: true, state: { passportWelcome: true } }));
    expect(state.save).toHaveBeenCalledWith("creator-1", expect.objectContaining({ full_name: "Creator Test", onboarding_completed: true }));
  });
  it("stays in onboarding when profile creation fails", async () => {
    state.save.mockRejectedValue(new Error("No owner profile"));
    await launch();
    await screen.findByText("Profile not saved yet. Try again.");
    expect(state.navigate).not.toHaveBeenCalled();
  });
});

describe("where the person was going when they signed up", () => {
  it("continues there once the Passport is saved (this browser remembered it), not to the Passport", async () => {
    sessionStorage.setItem("thrivein_post_auth_redirect", "/cosign/tok_1");
    await launch();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/cosign/tok_1", { replace: true }));
    expect(state.navigate).not.toHaveBeenCalledWith("/profile", expect.anything());
    expect(sessionStorage.getItem("thrivein_post_auth_redirect")).toBeNull();
  });

  it("continues there when only the account remembered it (the confirmation email was opened on another device), and forgets it", async () => {
    state.auth.user.user_metadata = { post_signup_next: "/opportunities/9" };
    await launch();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/opportunities/9", { replace: true }));
    expect(state.updateUser).toHaveBeenCalledWith({ data: { post_signup_next: null } });
  });

  it("does not continue to an address outside the app: the Passport opens, as before", async () => {
    state.auth.user.user_metadata = { post_signup_next: "https://evil.example" };
    await launch();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/profile", { replace: true, state: { passportWelcome: true } }));
    expect(state.navigate).not.toHaveBeenCalledWith("https://evil.example", expect.anything());
  });

  it("has nowhere to continue to: the Passport opens with its welcome, and the account is not touched", async () => {
    await launch();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/profile", { replace: true, state: { passportWelcome: true } }));
    expect(state.updateUser).not.toHaveBeenCalledWith({ data: { post_signup_next: null } });
  });
});

describe("Terms and Conditions at onboarding", () => {
  const openLaunchStep = async () => {
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    await screen.findByDisplayValue("Creator Test");
    fireEvent.click(screen.getByRole("button", { name: "Set up manually — it's quick" }));
    return screen.findByRole("button", { name: /Launch my .*Passport/ });
  };

  it("Launch stays disabled until the Terms are accepted, with links that open in a new tab", async () => {
    const launchButton = await openLaunchStep();
    expect(launchButton).toBeDisabled();
    expect(screen.getByRole("link", { name: "Terms and Conditions" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Terms and Conditions" })).toHaveAttribute("target", "_blank");
    fireEvent.click(screen.getByRole("checkbox", { name: /Terms and Conditions/ }));
    expect(launchButton).toBeEnabled();
  });

  it("records the accepted version on the account before saving the Passport", async () => {
    await openLaunchStep();
    await clickLaunch();
    await waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.updateUser).toHaveBeenCalledWith({ data: { terms_version: "2026-10-07", terms_accepted_at: expect.any(String) } });
    expect(state.updateUser.mock.invocationCallOrder[0]).toBeLessThan(state.save.mock.invocationCallOrder[0]);
  });

  it("if the acceptance cannot be recorded, nothing is saved and the person stays in onboarding", async () => {
    state.updateUser.mockResolvedValue({ error: { message: "network" } });
    await openLaunchStep();
    await clickLaunch();
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't record your acceptance" })));
    expect(state.save).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("someone who already accepted this version is not asked again", async () => {
    state.auth.user.user_metadata = { terms_version: "2026-10-07" };
    const launchButton = await openLaunchStep();
    expect(screen.queryByRole("checkbox", { name: /Terms and Conditions/ })).not.toBeInTheDocument();
    fireEvent.click(launchButton);
    await waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.updateUser).not.toHaveBeenCalled();
  });
});
