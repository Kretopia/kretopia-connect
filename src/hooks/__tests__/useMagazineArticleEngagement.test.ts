import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMagazineArticleEngagement } from "../useMagazineArticleEngagement";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  likeRow: null as { id: string } | null,
  insertLike: vi.fn(() => Promise.resolve({ error: null })),
  deleteLike: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// A minimal thenable query-builder stand-in: every chain method returns
// `this`, and the object resolves like a real Postgrest builder would when
// awaited directly (VoiceFirstCreateModal.test.tsx uses the same shape for
// its own supabase mock).
interface QueryChain {
  select: () => QueryChain;
  eq: () => QueryChain;
  order: () => QueryChain;
  maybeSingle: () => Promise<unknown>;
  single: () => Promise<unknown>;
  then: (resolve: (v: unknown) => void) => Promise<unknown>;
}

function chain(result: unknown): QueryChain {
  const builder: QueryChain = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "magazine_article_likes") {
        return {
          ...chain({ data: mocks.likeRow }),
          insert: mocks.insertLike,
          delete: () => ({ eq: () => ({ eq: mocks.deleteLike }) }),
        };
      }
      if (table === "magazine_article_comments") {
        return {
          ...chain({ data: [] }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "c1", article_id: "a1", user_id: "user-1", content: "hi", created_at: new Date().toISOString() }, error: null }),
            }),
          }),
        };
      }
      if (table === "profiles") return chain({ data: [] });
      return chain({ data: null });
    },
  },
}));

describe("useMagazineArticleEngagement", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.likeRow = null;
    mocks.insertLike.mockClear();
    mocks.deleteLike.mockClear();
  });

  it("optimistically likes, then rolls back if the insert fails", async () => {
    mocks.insertLike.mockResolvedValueOnce({ error: new Error("nope") });
    const { result } = renderHook(() => useMagazineArticleEngagement("a1", 3, 0));

    await waitFor(() => expect(result.current.liked).toBe(false));

    await act(async () => {
      await result.current.toggleLike();
    });

    // Rolled back to the pre-click state after the failed insert.
    expect(result.current.liked).toBe(false);
    expect(result.current.likeCount).toBe(3);
  });

  it("likes successfully and increments the count", async () => {
    const { result } = renderHook(() => useMagazineArticleEngagement("a1", 3, 0));
    await waitFor(() => expect(result.current.liked).toBe(false));

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(mocks.insertLike).toHaveBeenCalledWith({ article_id: "a1", user_id: "user-1" });
    expect(result.current.liked).toBe(true);
    expect(result.current.likeCount).toBe(4);
  });

  it("refuses to like when signed out, without touching the count", async () => {
    mocks.user = null;
    const { result } = renderHook(() => useMagazineArticleEngagement("a1", 3, 0));

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(mocks.insertLike).not.toHaveBeenCalled();
    expect(result.current.likeCount).toBe(3);
  });

  it("won't submit a blank or whitespace-only comment", async () => {
    const { result } = renderHook(() => useMagazineArticleEngagement("a1", 0, 0));
    const ok = await act(async () => result.current.addComment("   "));
    expect(ok).toBe(false);
    expect(result.current.commentCount).toBe(0);
  });
});
