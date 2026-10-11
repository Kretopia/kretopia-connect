import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ read: vi.fn(), user: { id: "company-switch-test" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mocks.read }) }) }) }) },
}));
import { useAccountTone } from "../useAccountTone";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("shared account mode", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.user = { id: "company-switch-test" };
    mocks.read.mockReset().mockResolvedValue({ data: { account_type: "individual" }, error: null });
  });
  it("shares one profile read and immediately updates every consumer in both directions", async () => {
    const { result } = renderHook(() => ({ nav: useAccountTone(), page: useAccountTone() }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.page.loading).toBe(false));
    expect(mocks.read).toHaveBeenCalledTimes(1);
    await act(() => result.current.nav.updateAccountType("company"));
    await waitFor(() => expect(result.current.page.isBusiness).toBe(true));
    expect(result.current.nav.isBusiness).toBe(true);
    expect(localStorage.getItem("tone:v1:company-switch-test")).toBe("business");
    await act(() => result.current.page.updateAccountType("individual"));
    await waitFor(() => expect(result.current.nav.isCreative).toBe(true));
  });
  it("does not reuse Company mode for a signed-out visitor", () => {
    localStorage.setItem("tone:v1:company-switch-test", "business");
    mocks.user = null;
    const { result } = renderHook(useAccountTone, { wrapper: wrapper() });
    expect(result.current.isCreative).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});