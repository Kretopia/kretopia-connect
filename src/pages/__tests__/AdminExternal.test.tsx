import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

/**
 * The curator's queue: import, review against the source, publish, and COPY a claim link. Nothing here sends a message
 * or an invitation, and the link is copied to the clipboard, never shown or stored.
 */
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: (p: { title: ReactNode; subtitle: string }) => <header><h1>{p.title}</h1><p>{p.subtitle}</p></header> }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const role = { isAdmin: true, loading: false };
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => role }));

type Reply = { data?: unknown; error?: unknown };
const replies: Record<string, Reply> = {};
const invoke = vi.fn(async (_fn: string, opts: { body: Record<string, unknown> }) => ({ data: replies[String(opts.body.action)]?.data ?? { ok: true }, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => (invoke as unknown as (...x: unknown[]) => unknown)(...a) } } }));

import AdminExternal from "../AdminExternal";

const item = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111", kind: "gig", status: "in_review", title: "Brand film editor", original_publisher: "Acme Studio", source_url: "https://remoteok.com/remote-jobs/x-1098765",
  source_type: "feed", flagged_instructions: false, possible_duplicates: [], extraction_issues: [], last_checked_at: null, ...over,
});
const renderPage = () => render(<MemoryRouter><AdminExternal /></MemoryRouter>);
const writeText = vi.fn(async () => {});

beforeEach(() => {
  invoke.mockClear(); toast.mockClear(); writeText.mockClear();
  role.isAdmin = true;
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  replies.list_review = { data: { ok: true, listings: [item()], claims: [] } };
  replies.list_mine = { data: { ok: true, listings: [] } };
});

describe("AdminExternal", () => {
  it("is for admins only: anyone else sees that, and nothing is requested", async () => {
    role.isAdmin = false;
    renderPage();
    expect(await screen.findByRole("heading", { name: /admins only/i })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("lists what needs review with its source, and approving publishes through the server", async () => {
    renderPage();
    expect(await screen.findByText("Brand film editor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /approve and publish/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("external-import", { body: { action: "review", listing_id: item().id, decision: "approve" } }));
  });

  it("warns about instruction-like text, and about possible duplicates as advice only", async () => {
    replies.list_review = { data: { ok: true, listings: [item({ flagged_instructions: true, possible_duplicates: [{ id: "22222222-2222-2222-2222-222222222222", reasons: ["title 90% alike"] }], extraction_issues: [{ code: "invalid_date", message: "Not an ISO date; left unknown." }] })], claims: [] } };
    renderPage();
    expect(await screen.findByText(/instruction-like text/i)).toBeInTheDocument();
    expect(screen.getByText(/advice only, nothing was merged/i)).toBeInTheDocument();
    expect(screen.getByText(/left unknown/i)).toBeInTheDocument();
  });

  it("copying a claim link puts it on the clipboard, says it was NOT sent, and never renders it", async () => {
    replies.list_review = { data: { ok: true, listings: [item({ status: "published" })], claims: [] } };
    replies.claim_link = { data: { ok: true, link: "https://www.kretopia.com/claim-listing/abc/kc_secret_token_value", expires_at: "2026-11-11T00:00:00Z" } };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /copy claim link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://www.kretopia.com/claim-listing/abc/kc_secret_token_value"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/not sent to anyone/i) }));
    expect(document.body.textContent).not.toContain("kc_secret_token_value");
    expect(invoke.mock.calls.every((c) => !JSON.stringify(c).match(/email|send|invite/i))).toBe(true);
  });

  it("only an approved, unclaimed listing can be offered for claiming", async () => {
    renderPage(); // status in_review
    await screen.findByText("Brand film editor");
    expect(screen.queryByRole("button", { name: /copy claim link/i })).not.toBeInTheDocument();
  });

  it("decides claims through the server, and a declined link creation says why", async () => {
    replies.list_review = { data: { ok: true, listings: [], claims: [{ id: "c1aaaaaa-0000-0000-0000-000000000000", listing_id: "33333333-3333-3333-3333-333333333333", status: "pending" }] } };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /verify claimant/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("external-import", { body: { action: "decide_claim", claim_id: "c1aaaaaa-0000-0000-0000-000000000000", decision: "approve" } }));
  });

  it("an import of an address goes through the pipeline, which only fetches approved sources", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText(/address of an approved source/i), { target: { value: "https://remoteok.com/remote-jobs/x-1" } });
    fireEvent.click(screen.getByRole("button", { name: /import address/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("external-import", { body: { action: "ingest", input: { type: "url", url: "https://remoteok.com/remote-jobs/x-1" } } }));
  });

  describe("a fresh import is a private draft, and it is visible", () => {
    const draft = (over: Record<string, unknown> = {}) => item({ id: "44444444-4444-4444-4444-444444444444", status: "draft", title: "Graphic Designer & Video Editor", original_publisher: "BlueTuskr", ...over });

    it("shows my drafts apart from the queue, with what was left unknown, and sends one to review through the server", async () => {
      replies.list_review = { data: { ok: true, listings: [], claims: [] } };
      replies.list_mine = { data: { ok: true, listings: [draft({ extraction_issues: [{ code: "no_currency", message: "An amount needs an ISO 4217 currency code (not a symbol)." }] })] } };
      renderPage();
      const section = await screen.findByRole("region", { name: /your drafts/i });
      expect(section).toHaveTextContent("Graphic Designer & Video Editor");
      expect(section).toHaveTextContent(/left unknown: an amount needs an iso 4217 currency code/i);
      expect(screen.getByText(/nothing to review/i)).toBeInTheDocument(); // the queue itself is still empty
      fireEvent.click(screen.getByRole("button", { name: /send to review/i }));
      await waitFor(() => expect(invoke).toHaveBeenCalledWith("external-import", { body: { action: "review", listing_id: draft().id, decision: "send_to_review" } }));
    });

    it("lists only drafts from my own list: a published or in-review listing of mine is not duplicated", async () => {
      replies.list_mine = { data: { ok: true, listings: [draft({ id: "55555555-5555-5555-5555-555555555555", status: "published", title: "Already live" }), draft({ id: "66666666-6666-6666-6666-666666666666", status: "in_review", title: "In the queue" })] } };
      renderPage();
      await screen.findByText("Brand film editor");
      expect(screen.queryByRole("region", { name: /your drafts/i })).not.toBeInTheDocument();
      expect(screen.queryByText("Already live")).not.toBeInTheDocument();
    });

    it("a draft can be published or rejected after reading it, but not given a claim link", async () => {
      replies.list_mine = { data: { ok: true, listings: [draft()] } };
      renderPage();
      const section = await screen.findByRole("region", { name: /your drafts/i });
      expect(section).toHaveTextContent(/approve and publish/i);
      expect(section).toHaveTextContent(/reject/i);
      expect(screen.queryByRole("button", { name: /copy claim link/i })).not.toBeInTheDocument();
    });

    it("if my drafts cannot be read, the queue still works", async () => {
      replies.list_mine = { data: { ok: false, code: "unavailable" } };
      renderPage();
      expect(await screen.findByText("Brand film editor")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: /your drafts/i })).not.toBeInTheDocument();
    });

    it("after an import, the drafts are read again so the new one appears", async () => {
      renderPage();
      fireEvent.change(await screen.findByLabelText(/address of an approved source/i), { target: { value: "https://remoteok.com/remote-jobs/x-1" } });
      const before = invoke.mock.calls.filter((c) => (c[1] as { body: { action: string } }).body.action === "list_mine").length;
      fireEvent.click(screen.getByRole("button", { name: /import address/i }));
      await waitFor(() => expect(invoke.mock.calls.filter((c) => (c[1] as { body: { action: string } }).body.action === "list_mine").length).toBe(before + 1));
    });
  });

  it("a posting already in Scouted is shown as advice with a member count and no member ids; another external listing stays as before", async () => {
    replies.list_review = { data: { ok: true, listings: [item({ possible_duplicates: [{ id: "22222222-2222-2222-2222-222222222222", reasons: ["title 90% alike"] }, { id: "scouted", lane: "scouted", count: 2, reasons: ["same address", "shown to 2 members"] }] })], claims: [] } };
    renderPage();
    expect(await screen.findByText(/possible duplicate of 22222222/i)).toBeInTheDocument();
    expect(screen.getByText(/also in scouted: same address; shown to 2 members\. advice only, nothing was hidden or merged/i)).toBeInTheDocument();
    expect(screen.queryByText(/possible duplicate of .*scouted/i)).not.toBeInTheDocument();
  });
});
