import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Claiming a gig must say what actually happened: a write that changed no row
 * (someone else claimed first, or RLS refused it) is not a success.
 */

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

const opportunity = { id: "opp1", title: "Colorist for a feature", claim_status: "unclaimed", scouted_by: null };
let updateResult: { data: Array<{ id: string }> | null; error: { message: string } | null } = { data: [], error: null };
const notify = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = (cols?: string) => {
        if (cols === "id") return Promise.resolve(updateResult); // end of the update chain
        return q;
      };
      q.eq = () => q;
      q.maybeSingle = () => Promise.resolve({ data: table === "opportunities" ? opportunity : { full_name: "Maya" }, error: null });
      q.update = () => q;
      return q;
    },
    rpc: (...args: unknown[]) => {
      notify(...args);
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

import ClaimGig from "../ClaimGig";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/claim-gig/tok123"]}>
      <Routes>
        <Route path="/claim-gig/:token" element={<ClaimGig />} />
        <Route path="/opportunity/:id" element={<div data-testid="opportunity-page" />} />
      </Routes>
    </MemoryRouter>,
  );

const claimButton = () => screen.findByRole("button", { name: /claim/i });

beforeEach(() => {
  toast.mockClear();
  notify.mockClear();
});

describe("ClaimGig", () => {
  it("does not say 'Gig claimed!' when the update changed no row, and does not navigate", async () => {
    updateResult = { data: [], error: null };
    renderPage();
    fireEvent.click(await claimButton());

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const titles = toast.mock.calls.map(([t]) => t.title);
    expect(titles).toContain("Couldn't claim this gig");
    expect(titles).not.toContain("Gig claimed!");
    expect(toast.mock.calls[0][0].variant).toBe("destructive");
    expect(screen.queryByTestId("opportunity-page")).not.toBeInTheDocument();
  });

  it("a null result is treated the same as no row", async () => {
    updateResult = { data: null, error: null };
    renderPage();
    fireEvent.click(await claimButton());
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls.map(([t]) => t.title)).toEqual(["Couldn't claim this gig"]);
  });

  it("shows the real error when the write fails", async () => {
    updateResult = { data: null, error: { message: "permission denied" } };
    renderPage();
    fireEvent.click(await claimButton());
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Claim failed", description: "permission denied" });
  });

  it("only celebrates, and goes to the gig, when a row was really claimed", async () => {
    updateResult = { data: [{ id: "opp1" }], error: null };
    renderPage();
    fireEvent.click(await claimButton());
    await waitFor(() => expect(screen.getByTestId("opportunity-page")).toBeInTheDocument());
    expect(toast.mock.calls.map(([t]) => t.title)).toEqual(["Gig claimed!"]);
  });
});
