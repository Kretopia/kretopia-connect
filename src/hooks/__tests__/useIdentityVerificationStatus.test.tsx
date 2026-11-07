import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  row: { id_verified: null } as { id_verified: unknown } | null,
  error: null as Error | null,
  from: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      db.from(table);
      return { select: (cols: string) => ({ eq: (col: string, val: string) => { db.eq(cols, col, val); return { maybeSingle: async () => ({ data: db.row, error: db.error }) }; } }) };
    },
  },
}));

import { useIdentityVerificationStatus } from "../useIdentityVerificationStatus";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  db.row = { id_verified: null };
  db.error = null;
  db.from.mockClear();
  db.eq.mockClear();
});

describe("useIdentityVerificationStatus", () => {
  it("reads only the member's own id_verified from their own profile row", async () => {
    db.row = { id_verified: true };
    const { result } = renderHook(() => useIdentityVerificationStatus("u1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBe("verified"));
    expect(db.from).toHaveBeenCalledWith("profiles");
    expect(db.eq).toHaveBeenCalledWith("id_verified", "user_id", "u1");
  });

  it("is not_started for a member the server has not verified, whatever the row holds", async () => {
    for (const id_verified of [false, null, "true", 1]) {
      db.row = { id_verified };
      const { result, unmount } = renderHook(() => useIdentityVerificationStatus("u1"), { wrapper });
      await waitFor(() => expect(result.current.data).toBe("not_started"));
      unmount();
    }
    db.row = null;
    const { result } = renderHook(() => useIdentityVerificationStatus("u1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBe("not_started"));
  });

  it("reads nothing without a signed-in member", () => {
    const { result } = renderHook(() => useIdentityVerificationStatus(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("reports a failed read as an error, never as verified", async () => {
    db.error = new Error("network");
    const { result } = renderHook(() => useIdentityVerificationStatus("u1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
