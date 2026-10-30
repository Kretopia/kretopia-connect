import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ result: {} as any, eq: vi.fn(), update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: (fields: unknown) => {
    state.update(fields);
    return { eq: (key: string, id: string) => {
      state.eq(key, id);
      return { select: () => ({ single: async () => state.result }) };
    } };
  } }) },
}));

import { ONBOARDING_PASSPORT_PATH, saveOnboardingProfile } from "../onboardingProfile";

beforeEach(() => {
  state.result = { data: { user_id: "creator-1", onboarding_completed: true }, error: null };
  vi.clearAllMocks();
});

describe("onboarding Passport handoff", () => {
  it("uses the owner's Passport, not the directory or home", () => {
    expect(ONBOARDING_PASSPORT_PATH).toBe("/profile");
  });
  it("confirms a completed owner row before permitting the handoff", async () => {
    await expect(saveOnboardingProfile("creator-1", { onboarding_completed: true })).resolves.toEqual(state.result.data);
    expect(state.eq).toHaveBeenCalledWith("user_id", "creator-1");
  });
  it("does not treat a zero-row update as successful profile creation", async () => {
    state.result = { data: null, error: null };
    await expect(saveOnboardingProfile("creator-1", {})).rejects.toThrow("could not be saved");
  });
  it("rejects another owner's row", async () => {
    state.result.data.user_id = "creator-2";
    await expect(saveOnboardingProfile("creator-1", {})).rejects.toThrow();
  });
  it("rejects an incomplete profile", async () => {
    state.result.data.onboarding_completed = false;
    await expect(saveOnboardingProfile("creator-1", {})).rejects.toThrow();
  });
  it("keeps a rejected save on onboarding", async () => {
    state.result = { data: null, error: new Error("Save rejected") };
    await expect(saveOnboardingProfile("creator-1", {})).rejects.toThrow("Save rejected");
  });
});