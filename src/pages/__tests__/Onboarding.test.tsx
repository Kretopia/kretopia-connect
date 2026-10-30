import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  save: vi.fn(),
  auth: { user: { id: "creator-1", email: "", user_metadata: {}, app_metadata: {} } },
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
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import Onboarding from "../Onboarding";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  state.save.mockResolvedValue({ user_id: "creator-1", onboarding_completed: true });
});

async function launch() {
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  await screen.findByDisplayValue("Creator Test");
  fireEvent.click(screen.getByRole("button", { name: "Set up manually — it's quick" }));
  fireEvent.click(await screen.findByRole("button", { name: "Launch my Passport" }));
}

describe("creator onboarding completion", () => {
  it("opens Passport immediately after a real save, without waiting for enrichment", async () => {
    await launch();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/profile", { replace: true }));
    expect(state.save).toHaveBeenCalledWith("creator-1", expect.objectContaining({ full_name: "Creator Test", onboarding_completed: true }));
  });
  it("stays in onboarding when profile creation fails", async () => {
    state.save.mockRejectedValue(new Error("No owner profile"));
    await launch();
    await screen.findByText("Profile not saved yet. Try again.");
    expect(state.navigate).not.toHaveBeenCalled();
  });
});