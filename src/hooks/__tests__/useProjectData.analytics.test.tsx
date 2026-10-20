import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Opening a project" is counted once per project and user, not every time fetchProjectData changes identity.
const h = vi.hoisted(() => {
  const result = { data: null as unknown, error: { message: "stubbed: no data" } as unknown };
  // Every query method returns the same chainable stand-in; awaiting it yields the stubbed error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = new Proxy(() => chain, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve(result) : chain),
    apply: () => chain,
  });
  return {
    chain,
    nav: { fn: (() => {}) as (...a: unknown[]) => void },
    toast: () => {},
    pageView: undefined as unknown as ReturnType<typeof vi.fn>,
    featureUsed: undefined as unknown as ReturnType<typeof vi.fn>,
  };
});

vi.mock("react-router-dom", () => ({ useNavigate: () => h.nav.fn }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" }, subscriptionInfo: { tier: "free" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => h.chain, rpc: () => h.chain, channel: () => h.chain, removeChannel: () => {} },
}));
vi.mock("@/lib/analytics", () => ({
  analytics: {
    pageView: (...a: unknown[]) => h.pageView(...a),
    featureUsed: (...a: unknown[]) => h.featureUsed(...a),
  },
}));
vi.spyOn(console, "error").mockImplementation(() => {});

import { useProjectData } from "@/hooks/useProjectData";

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 15)); });

describe("useProjectData: opening a project is counted once", () => {
  beforeEach(() => {
    h.pageView = vi.fn();
    h.featureUsed = vi.fn();
    h.nav.fn = () => {};
  });

  it("counts it once on open, and not again when navigate (and so fetchProjectData) changes identity", async () => {
    const { rerender } = renderHook(({ id }) => useProjectData(id), { initialProps: { id: "p1" } });
    await waitFor(() => expect(h.pageView).toHaveBeenCalledTimes(1));
    expect(h.pageView).toHaveBeenCalledWith("thrivedesk");
    expect(h.featureUsed).toHaveBeenCalledWith("thrivedesk_opened", { project_id: "p1" });

    for (let i = 0; i < 3; i++) {
      h.nav.fn = () => {}; // the router hands out a new navigate when the URL changes
      rerender({ id: "p1" });
      await settle();
    }
    expect(h.pageView).toHaveBeenCalledTimes(1);
    expect(h.featureUsed).toHaveBeenCalledTimes(1);
  });

  it("counts again when a different project is opened", async () => {
    const { rerender } = renderHook(({ id }) => useProjectData(id), { initialProps: { id: "p1" } });
    await waitFor(() => expect(h.pageView).toHaveBeenCalledTimes(1));
    rerender({ id: "p2" });
    await waitFor(() => expect(h.pageView).toHaveBeenCalledTimes(2));
    expect(h.featureUsed).toHaveBeenLastCalledWith("thrivedesk_opened", { project_id: "p2" });
  });
});
