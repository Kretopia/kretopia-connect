import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "t" } } }), getUser: () => Promise.resolve({ data: { user: { id: "brand" } } }) },
    functions: { invoke: (...a: unknown[]) => mocks.invoke(...a) },
    from: () => {
      const chain: any = { select: () => chain, eq: () => chain, maybeSingle: () => Promise.resolve({ data: null }), then: (ok: any) => Promise.resolve({ data: [] }).then(ok) };
      return chain;
    },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useFeatureGate", () => ({ useFeatureGate: () => ({ guard: () => true, remaining: 9, cap: 9 }) }));
vi.mock("@/lib/analytics", () => ({
  analytics: new Proxy({}, { get: () => () => {} }),
}));

import { MilestoneBoard } from "../MilestoneBoard";

const milestone = {
  id: "m1",
  title: "Logo",
  description: null,
  amount: 250,
  status: "completed",
  due_date: null,
  paid_to: null,
  paid_at: null,
  created_at: "2026-10-01T00:00:00Z",
  payment_intent_id: null,
  escrow_status: "none",
};

const http409 = (body: unknown) => ({ message: "non-2xx", context: { json: () => Promise.resolve(body) } });

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.toast.mockReset();
  vi.spyOn(window, "open").mockImplementation(() => null);
});

const renderBoard = () =>
  render(
    <MilestoneBoard
      milestones={[milestone as any]}
      projectId="p1"
      onUpdate={() => {}}
      userRole="client"
      collaborators={[]}
      projectOwnerId="brand"
    />,
  );

describe("MilestoneBoard: choosing who a payment is for", () => {
  it("asks which creative when the server cannot tell, and charges nothing until one is picked", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: http409({
        code: "PAYEE_UNCLEAR",
        error: "Choose which creative this payment is for.",
        candidates: [
          { user_id: "c1", full_name: "Ada Lovelace", avatar_url: null },
          { user_id: "c2", full_name: "Grace Hopper", avatar_url: null },
        ],
      }),
    });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /Pay Now/ }));

    expect(await screen.findByText("Who is this payment for?")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
    // The first call named nobody; no error toast for what is just a question.
    expect(mocks.invoke.mock.calls[0][1].body.payeeUserId).toBeUndefined();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("retries the same payment with the picked creative, keeping escrow as chosen", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        data: null,
        error: http409({ code: "PAYEE_UNCLEAR", error: "x", candidates: [{ user_id: "c2", full_name: "Grace Hopper", avatar_url: null }] }),
      })
      .mockResolvedValueOnce({ data: { url: "https://checkout.example/s" }, error: null });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /Pay with Escrow/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Grace Hopper/ }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    const retry = mocks.invoke.mock.calls[1];
    expect(retry[0]).toBe("create-milestone-payment");
    expect(retry[1].body).toMatchObject({ milestoneId: "m1", useEscrow: true, payeeUserId: "c2" });
    await waitFor(() => expect(window.open).toHaveBeenCalledWith("https://checkout.example/s", "_blank"));
  });

  it("explains, rather than asking, when no creative is on the project", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: http409({ code: "PAYEE_NONE", error: "Add the creative this milestone pays to the project before paying.", candidates: [] }),
    });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /Pay Now/ }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("Add the creative"), variant: "destructive" })),
    );
    expect(screen.queryByText("Who is this payment for?")).toBeNull();
  });
});
