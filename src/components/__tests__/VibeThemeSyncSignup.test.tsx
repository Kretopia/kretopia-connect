import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A new account's profile row holds the database default look (Daylight), not a choice. Signing up used to flip a visitor who had been
// looking at Midnight (the product default) to Daylight the moment the session started. The look on the device stays through sign-up.
const world = vi.hoisted(() => ({
  profile: null as null | { ui_vibe: string; onboarding_completed: boolean },
  updates: [] as unknown[],
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: world.setTheme }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "member-1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "member-1" } } }) },
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: world.profile, error: null });
      chain.update = (patch: unknown) => {
        world.updates.push(patch);
        return chain;
      };
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
      return chain;
    },
  },
}));

import { VibeThemeSync } from "../VibeThemeSync";

beforeEach(() => {
  world.profile = null;
  world.updates = [];
  world.setTheme.mockReset();
  localStorage.clear();
  document.documentElement.removeAttribute("data-vibe");
});

describe("the look through sign-up", () => {
  it("keeps the look on the device for a profile that is still being set up, and saves it to the profile", async () => {
    localStorage.setItem("ui_vibe", "midnight");
    world.profile = { ui_vibe: "daylight", onboarding_completed: false }; // the database default
    render(<VibeThemeSync />);

    await waitFor(() => expect(world.updates).toEqual([{ ui_vibe: "midnight" }]));
    expect(document.documentElement.getAttribute("data-vibe")).toBe("midnight");
    expect(world.setTheme).not.toHaveBeenCalledWith("light");
    expect(localStorage.getItem("ui_vibe")).toBe("midnight");
  });

  it("does not write anything when the profile already matches the device", async () => {
    localStorage.setItem("ui_vibe", "daylight");
    world.profile = { ui_vibe: "daylight", onboarding_completed: false };
    render(<VibeThemeSync />);
    await waitFor(() => expect(document.documentElement.getAttribute("data-vibe")).toBe("daylight"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(world.updates).toEqual([]);
  });

  it("still lets a member's saved look win on a new device once they have finished setting up", async () => {
    localStorage.setItem("ui_vibe", "midnight");
    world.profile = { ui_vibe: "daylight", onboarding_completed: true };
    render(<VibeThemeSync />);

    await waitFor(() => expect(document.documentElement.getAttribute("data-vibe")).toBe("daylight"));
    expect(world.setTheme).toHaveBeenLastCalledWith("light");
    expect(world.updates).toEqual([]);
  });
});
