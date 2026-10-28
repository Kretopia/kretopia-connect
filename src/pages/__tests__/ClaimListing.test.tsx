import { StrictMode, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Claiming a discovered listing: the link only starts a verification. It never makes anyone the owner, owner controls
 * appear only after the server says the claim is verified, and the link leaves the address bar once it is used.
 */
const seo = vi.fn();
vi.mock("@/components/SEO", () => ({ SEO: (p: Record<string, unknown>) => (seo(p), null) }));
vi.mock("react-helmet-async", () => ({ Helmet: ({ children }: { children: ReactNode }) => <div data-testid="helmet">{children}</div> }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: (p: { title: ReactNode; subtitle: string }) => <header><h1>{p.title}</h1><p>{p.subtitle}</p></header> }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

type Reply = { data?: unknown; error?: unknown };
const replies: Record<string, Reply | ((body: Record<string, unknown>) => Reply)> = {};
const invoke = vi.fn(async (_fn: string, opts: { body: Record<string, unknown> }) => {
  const r = replies[String(opts.body.action)];
  const out = typeof r === "function" ? r(opts.body) : r;
  return { data: out?.data ?? null, error: out?.error ?? null };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => (invoke as unknown as (...x: unknown[]) => unknown)(...a) } } }));

import ClaimListing from "../ClaimListing";

const TOKEN = "kc_" + "a".repeat(43);
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/claim-listing/l1/${TOKEN}`]}>
      <Routes><Route path="/claim-listing/:id/:token" element={<ClaimListing />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  invoke.mockClear(); toast.mockClear(); seo.mockClear();
  for (const k of Object.keys(replies)) delete replies[k];
  replies.preview = { data: { ok: true, listing: { title: "Brand film editor", original_publisher: "Acme Studio" } } };
  replies.redeem = { data: { ok: true, claim_id: "c1", verified: false } };
  replies.start = { data: { ok: true, options: [{ method: "source_domain", domain: "acme-studio.com", file_url: "https://acme-studio.com/.well-known/kretopia-claim.txt", line: "kretopia-claim=abc123" }, { method: "admin_review" }] } };
});

describe("ClaimListing", () => {
  it("says the link is not proof of ownership and offers no owner controls yet", async () => {
    renderPage();
    expect(await screen.findByText("Brand film editor")).toBeInTheDocument();
    expect(screen.getByText(/does not make you the owner/i)).toBeInTheDocument();
    expect(screen.queryByTestId("owner-controls")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument();
    expect(seo.mock.calls[0][0]).toMatchObject({ noindex: true });
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute("content")).toBe("no-referrer");
  });

  it("starting verification redeems the link for THIS listing, then takes the link out of the address bar", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start verification/i }));
    await screen.findByTestId("proof-line");
    expect(invoke).toHaveBeenCalledWith("external-claim", { body: { action: "redeem", listing_id: "l1", token: TOKEN } });
    expect(replace).toHaveBeenCalledWith(null, "", "/claim-listing/l1");
    expect(String(replace.mock.calls[0][2])).not.toContain(TOKEN);
    expect(screen.queryByTestId("owner-controls")).not.toBeInTheDocument(); // redeeming proves nothing
    replace.mockRestore();
  });

  it("an invalid, expired or used link says so and starts nothing", async () => {
    replies.redeem = { data: { ok: false, code: "invalid_or_used" } };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start verification/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid, expired or already used/i);
    expect(screen.queryByTestId("proof-line")).not.toBeInTheDocument();
    expect(invoke.mock.calls.some((c) => (c[1].body as { action: string }).action === "start")).toBe(false);
  });

  it("shows the exact proof line for the publisher's own domain, and a wrong proof does not unlock anything", async () => {
    replies.verify_domain = { data: { ok: false, code: "proof_mismatch" } };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start verification/i }));
    expect(await screen.findByTestId("proof-line")).toHaveTextContent("kretopia-claim=abc123");
    expect(screen.getByText(/prove control of acme-studio.com/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /i have added it/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/does not contain the expected line/i);
    expect(screen.queryByTestId("owner-controls")).not.toBeInTheDocument();
  });

  it("owner controls appear only after the server verifies the claim, and only edit the three allowed fields", async () => {
    replies.verify_domain = { data: { ok: true, verified: true, listing_id: "l1" } };
    replies.owner_update = { data: { ok: true } };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start verification/i }));
    fireEvent.click(await screen.findByRole("button", { name: /i have added it/i }));
    expect(await screen.findByTestId("owner-controls")).toBeInTheDocument();
    expect(screen.getByText(/applications through kretopia stay off until a curator reviews/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Our description" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("external-claim", { body: { action: "owner_update", listing_id: "l1", edits: { description_full: "Our description" } } }));
  });

  it("asking for a review leaves the claimant a visitor and says so", async () => {
    replies.request_review = { data: { ok: true, verified: false } };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start verification/i }));
    fireEvent.click(await screen.findByRole("button", { name: /request a review/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/not the owner of this listing until a curator approves/i);
    expect(screen.queryByTestId("owner-controls")).not.toBeInTheDocument();
  });

  it("a listing that is not available to claim says so and offers no start button", async () => {
    replies.preview = { data: { ok: false, code: "not_found" } };
    renderPage();
    expect(await screen.findByText(/not available to claim/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start verification/i })).not.toBeInTheDocument();
  });
});

/**
 * The screen a claimant sees when the link is opened, BEFORE "Start verification". Seen live with a second, non-admin
 * account: one button, no owner controls, and the link still in the address bar. Looking at the page must change nothing:
 * the link is spent only by the click, and it is never shown, sent to the public preview or put in the page.
 */
describe("ClaimListing before Start", () => {
  const actions = () => invoke.mock.calls.map((c) => (c[1].body as { action: string }).action);

  it("says whose listing this is and why Start is not ownership, with Start as the only thing to do", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /is this your listing/i })).toBeInTheDocument();
    expect(screen.getByText("Brand film editor")).toBeInTheDocument();
    expect(screen.getByText("Acme Studio")).toBeInTheDocument();
    expect(screen.getByText("Starting a verification does not make you the owner. You will be asked to prove control of the publisher's own website, or to request a review by a Kretopia curator.")).toBeInTheDocument();
    // one button, nothing to type into: no proof, review, save or edit controls exist yet
    expect(screen.getAllByRole("button").map((b) => b.textContent?.trim())).toEqual(["Start verification"]);
    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(screen.queryByRole("button", { name: /request a review|verify|save/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("proof-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("owner-controls")).not.toBeInTheDocument();
  });

  it("opening the page only asks the public preview about the listing: the link is not spent, started or sent", async () => {
    renderPage();
    await screen.findByText("Brand film editor");
    expect(invoke.mock.calls).toEqual([["external-claim", { body: { action: "preview", listing_id: "l1" } }]]);
    expect(actions()).not.toContain("redeem");
    expect(actions()).not.toContain("start");
    expect(JSON.stringify(invoke.mock.calls)).not.toContain(TOKEN); // the public preview never receives the link
  });

  it("the link is never shown or put in the page, and it is not taken from the address bar until it is used", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    renderPage();
    await screen.findByText("Brand film editor");
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(document.body.innerHTML).not.toContain("kc_");
    expect(JSON.stringify(seo.mock.calls)).not.toContain(TOKEN);
    expect(document.querySelector("a[href]")).toBeNull(); // nothing on the screen links away (or carries the link in an href)
    expect(replace).not.toHaveBeenCalled(); // the address is only rewritten once the link is spent
    replace.mockRestore();
  });

  it("is a page nobody indexes or leaks from, before anything is clicked", async () => {
    renderPage();
    await screen.findByText("Brand film editor");
    expect(seo.mock.calls[0][0]).toMatchObject({ noindex: true });
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute("content")).toBe("no-referrer");
  });

  it("effects that run twice (React StrictMode) still never spend the link", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/claim-listing/l1/${TOKEN}`]}>
          <Routes><Route path="/claim-listing/:id/:token" element={<ClaimListing />} /></Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    await screen.findByText("Brand film editor");
    expect(new Set(actions())).toEqual(new Set(["preview"]));
    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });

  it("while the listing is still being read there is nothing to click, so the link cannot be spent on an unknown listing", async () => {
    invoke.mockImplementationOnce(() => new Promise(() => {})); // the preview never answers
    renderPage();
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /start verification/i })).not.toBeInTheDocument();
    expect(actions()).toEqual(["preview"]);
  });

  it("only the click spends the link, for this listing, exactly once", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start verification/i }));
    await screen.findByTestId("proof-line");
    expect(actions().filter((a) => a === "redeem")).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("external-claim", { body: { action: "redeem", listing_id: "l1", token: TOKEN } });
    expect(screen.queryByRole("button", { name: /start verification/i })).not.toBeInTheDocument(); // the screen has moved on
  });
});
