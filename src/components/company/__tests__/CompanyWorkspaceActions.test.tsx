import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { user: { id: "company-1" } as null | { id: string } },
  row: null as null | Record<string, unknown>,
  fail: false,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => (state.fail ? Promise.reject(new Error("offline")) : Promise.resolve({ data: state.row, error: null })),
        }),
      }),
    }),
  },
}));

import { CompanyWorkspaceActions } from "../CompanyWorkspaceActions";

const labels = () => screen.getAllByRole("link").map((a) => a.textContent);
const DEFAULT_ORDER = ["Post a Gig", "Review applicants", "Find talent", "Pay creators"];

const renderActions = () =>
  render(
    <MemoryRouter>
      <CompanyWorkspaceActions />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.auth = { user: { id: "company-1" } };
  state.row = null;
  state.fail = false;
});

describe("CompanyWorkspaceActions: ordered for what the company said it is here to do", () => {
  it("keeps the usual order for a company that wants to hire, and for one with nothing saved", async () => {
    state.row = { primary_intents: ["hire"], primary_intent: "hire" };
    const { unmount } = renderActions();
    await waitFor(() => expect(labels()).toEqual(DEFAULT_ORDER));
    unmount();

    state.row = { primary_intents: null, primary_intent: null };
    renderActions();
    expect(labels()).toEqual(DEFAULT_ORDER);
  });

  it("starts from Find talent for a company that wants to sponsor or partner, with the same four links", async () => {
    state.row = { primary_intents: ["collaborate", "hire"], primary_intent: "collaborate" };
    renderActions();
    await waitFor(() => expect(labels()[0]).toBe("Find talent"));
    expect(labels()).toEqual(["Find talent", "Post a Gig", "Review applicants", "Pay creators"]);
    expect(screen.getByRole("link", { name: "Post a Gig" })).toHaveAttribute("href", "/post-opportunity");
    expect(screen.getByRole("link", { name: "Find talent" })).toHaveAttribute("href", "/talent-finder");
    expect(screen.getByRole("link", { name: "Pay creators" })).toHaveAttribute("href", "/thrivepay");
  });

  it("falls back to the usual order when the saved intent cannot be read", async () => {
    state.fail = true;
    renderActions();
    await new Promise((r) => setTimeout(r, 20));
    expect(labels()).toEqual(DEFAULT_ORDER);
  });

  it("shows the four links straight away, before anything has been read", () => {
    state.row = { primary_intents: ["collaborate"] };
    renderActions();
    expect(labels()).toEqual(DEFAULT_ORDER);
  });

  it("reads nothing without a signed-in user", () => {
    state.auth = { user: null };
    renderActions();
    expect(labels()).toEqual(DEFAULT_ORDER);
  });
});
