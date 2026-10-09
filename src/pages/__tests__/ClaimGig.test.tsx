import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/**
 * Claiming a gig by link: the card is fetched by token through a function (the
 * token is not readable from the table), the claim is one atomic call, and the
 * page says exactly what happened.
 */

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const auth = { user: { id: "me" } as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

const card = { id: "opp1", title: "Colorist for a feature", type: "gig", description: "Grade a feature.", compensation: null, location: "Paris", tags: ["color"], claim_status: "unclaimed", scouted_by: "scout1" };
let cardRow: typeof card | null = card;
let claimReply: { data: unknown; error: { message: string } | null } = { data: { claimed: true, opportunity_id: "opp1" }, error: null };
const rpc = vi.fn();
const fromTables: string[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      rpc(name, args);
      if (name === "get_scouted_opportunity_by_token") return Promise.resolve({ data: cardRow ? [cardRow] : [], error: null });
      if (name === "claim_scouted_opportunity") return Promise.resolve(claimReply);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      fromTables.push(table);
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = () => Promise.resolve({ data: { full_name: "Maya" }, error: null });
      return q;
    },
  },
}));

import ClaimGig from "../ClaimGig";

const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/claim-gig/tok_0123456789abcdef"]}>
      <Routes>
        <Route path="/claim-gig/:token" element={<ClaimGig />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const claimButton = () => screen.findByRole("button", { name: /claim this gig/i });
const calls = (name: string) => rpc.mock.calls.filter(([n]) => n === name);

beforeEach(() => {
  toast.mockClear();
  rpc.mockClear();
  fromTables.length = 0;
  sessionStorage.clear();
  auth.user = { id: "me" };
  cardRow = card;
  claimReply = { data: { claimed: true, opportunity_id: "opp1" }, error: null };
});

describe("ClaimGig", () => {
  it("fetches the card by token through the function, and never reads the table for it", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Colorist for a feature" })).toBeInTheDocument();
    expect(calls("get_scouted_opportunity_by_token")).toEqual([["get_scouted_opportunity_by_token", { p_token: "tok_0123456789abcdef" }]]);
    expect(fromTables).not.toContain("opportunities");
  });

  it("an unknown token reads as not found", async () => {
    cardRow = null;
    renderPage();
    expect(await screen.findByText("Gig Not Found")).toBeInTheDocument();
  });

  it("claims with one call and, only when it claimed, thanks, tells the scout and opens the gig", async () => {
    renderPage();
    fireEvent.click(await claimButton());

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/opportunity/opp1"));
    expect(calls("claim_scouted_opportunity")).toEqual([["claim_scouted_opportunity", { p_token: "tok_0123456789abcdef" }]]);
    expect(toast.mock.calls.map(([t]) => t.title)).toEqual(["Gig claimed!"]);
    expect(calls("notify_scout_event")).toEqual([["notify_scout_event", { _opportunity_id: "opp1", _event: "claimed", _actor_name: "Maya" }]]);
  });

  it("someone else got there first: honest message, no notification, no navigation, and the page now says it is claimed", async () => {
    claimReply = { data: { claimed: false, reason: "not_available" }, error: null };
    renderPage();
    fireEvent.click(await claimButton());

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Couldn't claim this gig", description: "Someone else claimed this gig first.", variant: "destructive" });
    expect(toast.mock.calls.map(([t]) => t.title)).not.toContain("Gig claimed!");
    expect(calls("notify_scout_event")).toHaveLength(0);
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
    // the card was reloaded so the page can show the real state
    await waitFor(() => expect(calls("get_scouted_opportunity_by_token")).toHaveLength(2));
  });

  it("an invalid link is said to be invalid", async () => {
    claimReply = { data: { claimed: false, reason: "invalid_token" }, error: null };
    renderPage();
    fireEvent.click(await claimButton());
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0].description).toMatch(/not valid/i);
  });

  it("a failing call shows its real error", async () => {
    claimReply = { data: null, error: { message: "permission denied" } };
    renderPage();
    fireEvent.click(await claimButton());
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Claim failed", description: "permission denied" });
  });

  it("a guest is sent to sign up first and nothing is claimed", async () => {
    auth.user = null;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /sign up & claim this gig/i }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/claim?source=gig"));
    expect(sessionStorage.getItem("pending_claim_token")).toBe("tok_0123456789abcdef");
    expect(calls("claim_scouted_opportunity")).toHaveLength(0);
  });
});
