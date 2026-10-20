import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { MyCredit } from "@/hooks/useMyCredits";

const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
const db = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: db.requests, error: null }) }) }) }) },
}));
vi.mock("@/components/profile/CreditEndorsementDialog", () => ({
  CreditEndorsementDialog: ({ credit, onOpenChange }: any) => (
    <div role="dialog" aria-label="ask dialog"><span>asking for {credit.project_name}</span><button onClick={() => onOpenChange(false)}>close ask</button></div>
  ),
}));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => nav.navigate }));
vi.mock("@/lib/thumbnailExtractor", () => ({ resolveCreditThumbnail: () => null }));

import { CreditsStampsPanel } from "../CreditsStampsPanel";

const credit = (over: Partial<MyCredit> & { id: string; project_name: string }): MyCredit => ({
  role: "Editor",
  year: 2025,
  verification_status: "unverified",
  credit_category: null,
  project_type: null,
  platform: null,
  client_brand: null,
  location: null,
  thumbnail_url: null,
  primary_media_url: null,
  url: null,
  endorsement_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

const renderPanel = (credits: MyCredit[]) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <CreditsStampsPanel credits={credits} query="" />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const row = (name: string) => screen.getByRole("heading", { name }).closest("li")!;

describe("Credits stamps: what proof each credit has", () => {
  const credits = [
    credit({ id: "v", project_name: "Verified film", verification_status: "verified", url: "https://example.com/v" }),
    credit({ id: "c", project_name: "Cosigned video", endorsement_count: 2, url: "https://example.com/c" }),
    credit({ id: "p", project_name: "Pending doc", verification_status: "pending_review", url: "https://example.com/p" }),
    credit({ id: "s", project_name: "Self logo", url: "https://example.com/s" }),
    credit({ id: "n", project_name: "Bare claim" }),
  ];

  it("says verified, co-signed, pending or self-declared on every row, always visible", () => {
    renderPanel(credits);
    expect(within(row("Verified film")).getByText("Verified")).toBeInTheDocument();
    expect(within(row("Cosigned video")).getByText(/Co-signed · 2/)).toBeInTheDocument();
    expect(within(row("Pending doc")).getByText("Pending")).toBeInTheDocument();
    expect(within(row("Self logo")).getByText("Self-declared")).toBeInTheDocument();
    expect(within(row("Bare claim")).getByText("Self-declared")).toBeInTheDocument();
  });

  it("no longer calls a co-signed credit 'Pending co-sign' (it has co-signs), nor shows 'Verified' for anything else", () => {
    renderPanel(credits);
    expect(screen.queryByText(/Pending co-sign/)).toBeNull();
    expect(screen.getAllByText("Verified").filter((el) => !el.closest("details"))).toHaveLength(1);
  });

  it("explains each status in its tooltip with what it does and does not prove", () => {
    renderPanel(credits);
    expect(within(row("Self logo")).getByText("Self-declared")).toHaveAttribute("title", expect.stringMatching(/Nothing independent confirms it/));
    expect(within(row("Pending doc")).getByText("Pending")).toHaveAttribute("title", expect.stringMatching(/does not count as proof/));
  });

  it("gives the next step, and says why a credit counts", () => {
    renderPanel(credits);
    expect(within(row("Self logo")).getByText(/Self-declared · Ask a collaborator to co-sign it\./)).toBeInTheDocument();
    expect(within(row("Bare claim")).getByText(/Add a link or a file as evidence\./)).toBeInTheDocument();
    expect(within(row("Cosigned video")).getByText(/Co-signed by 2 collaborators/)).toBeInTheDocument();
    expect(within(row("Pending doc")).getByText(/Waiting on a reply or a review\./)).toBeInTheDocument();
    // nothing to ask of a verified credit
    expect(within(row("Verified film")).queryByText(/Ask a collaborator/)).toBeNull();
  });

  it("flags a credit with no evidence at all, but not one that has a link", () => {
    renderPanel(credits);
    expect(within(row("Bare claim")).getByText("No evidence yet")).toBeInTheDocument();
    expect(within(row("Self logo")).queryByText("No evidence yet")).toBeNull();
    expect(within(row("Verified film")).queryByText("No evidence yet")).toBeNull();
  });

  it("leads every credit to its own entry on the Passport", () => {
    renderPanel(credits);
    expect(within(row("Verified film")).getByRole("link", { name: /View on Passport/ })).toHaveAttribute("href", "/profile?credit=v");
    expect(within(row("Bare claim")).getByRole("link", { name: /View on Passport/ })).toHaveAttribute("href", "/profile?credit=n");
  });

  it("opens the Passport itself from the panel header, next to adding a credit", () => {
    renderPanel(credits);
    fireEvent.click(screen.getByRole("button", { name: /Open Passport/ }));
    expect(nav.navigate).toHaveBeenLastCalledWith("/profile");
    fireEvent.click(screen.getByRole("button", { name: /Add credit/ }));
    expect(nav.navigate).toHaveBeenLastCalledWith("/profile?add=credit");
  });

  it("keeps the evidence link, and the empty state when there is nothing", () => {
    renderPanel(credits);
    expect(within(row("Verified film")).getByRole("link", { name: "Open evidence for Verified film" })).toHaveAttribute("href", "https://example.com/v");
    const { unmount } = renderPanel([]);
    expect(screen.getAllByText("No credits on your record yet").length).toBeGreaterThan(0);
    unmount();
  });
});

describe("Credits stamps: asking for a co-sign and seeing where it stands", () => {
  const credits = [
    credit({ id: "v", project_name: "Verified film", verification_status: "verified" }),
    credit({ id: "n", project_name: "Bare claim" }),
    credit({ id: "w", project_name: "Waiting doc" }),
    credit({ id: "a", project_name: "Answered clip", endorsement_count: 1 }),
    credit({ id: "d", project_name: "Declined reel" }),
  ];
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  it("offers Ask for a co-sign on a credit nobody confirmed, not on a verified one, and opens the existing request flow", async () => {
    db.requests = [];
    renderPanel(credits);
    expect(within(row("Verified film")).queryByRole("button", { name: /Ask/ })).toBeNull();
    fireEvent.click(within(row("Bare claim")).getByRole("button", { name: "Ask for a co-sign" }));
    expect(await screen.findByText("asking for Bare claim")).toBeInTheDocument();
    fireEvent.click(screen.getByText("close ask"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "ask dialog" })).toBeNull());
  });

  it("shows pending, accepted and declined with who and when, and never offers a second request to someone who has not answered", async () => {
    db.requests = [
      { credit_id: "w", token: "t1", endorser_name: "Ada", status: "pending", requested_at: ago(3), responded_at: null },
      { credit_id: "a", token: "t2", endorser_name: "Grace", status: "accepted", requested_at: ago(9), responded_at: ago(8) },
      { credit_id: "d", token: "t3", endorser_name: "Linus", status: "declined", requested_at: ago(9), responded_at: ago(7) },
      { credit_id: "n", token: "t4", endorser_name: "Odd", status: "something_new", requested_at: ago(1), responded_at: null },
    ];
    renderPanel(credits);
    expect(await within(row("Waiting doc")).findByText("Request sent to Ada · Pending, asked 3 days ago")).toBeInTheDocument();
    expect(within(row("Waiting doc")).queryByRole("button", { name: /Ask/ })).toBeNull();
    expect(within(row("Answered clip")).getByText(/^Co-signed by Grace on /)).toBeInTheDocument();
    expect(within(row("Answered clip")).queryByRole("button", { name: /Ask/ })).toBeNull();
    expect(within(row("Declined reel")).getByText(/^Linus declined on /)).toBeInTheDocument();
    expect(within(row("Declined reel")).getByRole("button", { name: "Ask someone else" })).toBeInTheDocument();
    expect(within(row("Bare claim")).queryByText(/Odd/)).toBeNull();
    expect(within(row("Bare claim")).getByRole("button", { name: "Ask for a co-sign" })).toBeInTheDocument();
  });

  it("explains the statuses once, in plain words, without claiming certainty", () => {
    db.requests = [];
    renderPanel(credits);
    const legend = document.querySelector("details")!;
    expect(legend.textContent).toContain("Verified means the contribution was confirmed by the relevant collaborator or client");
    expect(legend.textContent).toContain("never proof and never 100% certain");
    for (const label of ["Self-declared", "Co-signed", "AI-checked", "Verified"]) expect(within(legend).getByText(label)).toBeInTheDocument();
  });
});
