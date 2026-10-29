import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * A discovered listing's public page: it says External and Unclaimed, where it came from and when it was last checked,
 * sends the applicant to the source, collects nothing, and tells search engines the truth.
 */
const seo = vi.fn();
vi.mock("@/components/SEO", () => ({ SEO: (p: Record<string, unknown>) => (seo(p), null) }));
vi.mock("react-helmet-async", () => ({ Helmet: ({ children }: { children: ReactNode }) => <div data-testid="helmet">{children}</div> }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: (p: { title: ReactNode; subtitle: string }) => <header><h1>{p.title}</h1><p>{p.subtitle}</p></header> }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const auth = { user: null as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

let row: Record<string, unknown> | null = null;
let selected = "";
const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe("public_external_listings");
      const q: Record<string, unknown> = {};
      q.select = (cols: string) => ((selected = cols), q);
      q.eq = () => q;
      q.maybeSingle = () => Promise.resolve({ data: row, error: null });
      return q;
    },
    functions: { invoke: (...a: unknown[]) => (invoke as unknown as (...x: unknown[]) => unknown)(...a) },
  },
}));

import ExternalListing from "../ExternalListing";

const LONG = "A real summary of the role at the studio, with enough permitted content to be worth showing and indexing. ".repeat(3);
const base = () => ({
  id: "l1", kind: "gig", status: "published", title: "Brand film editor", original_publisher: "Acme Studio", location: "Lisbon", remote_scope: null,
  source_published_at: "2026-10-20T00:00:00Z", deadline_at: null, deadline_tz: null, budget: null, apply_url: "https://acme-studio.com/careers/editor",
  excerpt: LONG, description_full: null, starts_at: null, ends_at: null, verification_status: "source_checked", last_checked_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  source_provider: "remoteok", source_url: "https://remoteok.com/remote-jobs/x-1098765", applications_enabled: false, claimed: false,
});

const page = () => (
  <MemoryRouter initialEntries={["/listing/l1"]}>
    <Routes><Route path="/listing/:id" element={<ExternalListing />} /></Routes>
  </MemoryRouter>
);
const renderPage = () => render(page());
const lastSeo = () => seo.mock.calls[seo.mock.calls.length - 1][0] as Record<string, unknown>;
const ld = () => document.querySelector('script[type="application/ld+json"]');
const canonical = () => document.querySelector('link[rel="canonical"]')?.getAttribute("href");

beforeEach(() => {
  seo.mockClear(); toast.mockClear(); invoke.mockClear();
  row = base();
  auth.user = null;
});

describe("ExternalListing", () => {
  it("labels the listing External, Unclaimed, with its source and when it was last checked", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Brand film editor" })).toBeInTheDocument();
    const labels = screen.getByTestId("listing-labels");
    expect(labels).toHaveTextContent("External");
    expect(labels).toHaveTextContent("Unclaimed");
    expect(labels).toHaveTextContent("Last checked 3 days ago");
    expect(labels).toHaveTextContent("via Remote OK");
    expect(screen.getByText(/does not verify this listing and does not collect applications/i)).toBeInTheDocument();
  });

  it("Apply at source opens the real destination and nothing is collected here", async () => {
    renderPage();
    const apply = await screen.findByRole("link", { name: /apply at source/i });
    expect(apply).toHaveAttribute("href", "https://acme-studio.com/careers/editor");
    expect(apply).toHaveAttribute("target", "_blank");
    expect(apply.getAttribute("rel")).toMatch(/noopener/);
    expect(screen.queryByRole("button", { name: /^apply( now)?$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); // no application form
  });

  it("shows the posting date only when the source stated one", async () => {
    row = { ...base(), source_published_at: null };
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    expect(screen.queryByText("Posted at the source")).not.toBeInTheDocument();
  });

  it("an unclaimed listing has no JobPosting and its canonical is the ORIGINAL source", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    expect(ld()).toBeNull();
    expect(canonical()).toBe("https://remoteok.com/remote-jobs/x-1098765");
    expect(lastSeo().noindex).toBe(false); // enough permitted content, a publisher and a destination
  });

  it("a thin import is noindex", async () => {
    row = { ...base(), excerpt: "Short." };
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    expect(lastSeo().noindex).toBe(true);
  });

  it("a claimed gig with its owner's full description gets JobPosting from real facts, and is its own canonical", async () => {
    row = { ...base(), status: "claimed", claimed: true, description_full: LONG, location: "Lisbon" };
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    const jp = JSON.parse(ld()!.textContent!);
    expect(jp["@type"]).toBe("JobPosting");
    expect(jp.hiringOrganization.name).toBe("Acme Studio");
    expect(jp.datePosted).toBe("2026-10-20");
    expect(JSON.stringify(jp)).not.toMatch(/"name":"Kretopia"/);
    expect(canonical()).toBe("https://www.kretopia.com/listing/l1");
    expect(screen.getByTestId("listing-labels")).toHaveTextContent("Claimed");
  });

  it("an expired listing is noindex and has no markup", async () => {
    row = { ...base(), status: "claimed", claimed: true, description_full: LONG, deadline_at: "2026-10-01T00:00:00Z" };
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    expect(lastSeo().noindex).toBe(true);
    expect(ld()).toBeNull();
  });

  it("a listing that is not public says so, honestly, and is noindex", async () => {
    row = null;
    renderPage();
    expect(await screen.findByRole("heading", { name: /not available/i })).toBeInTheDocument();
    expect(lastSeo().noindex).toBe(true);
  });

  it("reads only public columns: no importer, owner, provenance or identity", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    for (const hidden of ["created_by", "owner_user_id", "provenance", "identity_key", "token", "possible_duplicates", "extraction_issues"]) expect(selected).not.toContain(hidden);
  });

  it("reporting needs a sign-in, and once signed in sends a dispute", async () => {
    const { rerender } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /report a problem/i }));
    expect(toast).toHaveBeenCalledWith({ title: "Sign in to report a listing" });
    expect(invoke).not.toHaveBeenCalled();
    auth.user = { id: "u1" };
    rerender(page());
    fireEvent.click(screen.getByRole("button", { name: /report a problem/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("external-claim", { body: expect.objectContaining({ action: "dispute", listing_id: "l1" }) }));
  });

  it("says 'Listed until', not 'Deadline': the source's validThrough is when the posting stops being valid, not an application deadline", async () => {
    row = { ...base(), deadline_at: "2027-01-11T00:00:06Z" };
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    expect(screen.getByText("Listed until")).toBeInTheDocument();
    expect(screen.queryByText(/^deadline$/i)).not.toBeInTheDocument();
  });

  it("shows a stated salary readably, as stated at the source, and nothing when none was stated", async () => {
    row = { ...base(), budget: { min: 80000, max: 155000, currency: "USD", period: "year" } };
    const { unmount } = renderPage();
    expect(await screen.findByText("USD 80,000 – 155,000 / year")).toBeInTheDocument();
    expect(screen.getByText("Pay stated at the source")).toBeInTheDocument();
    unmount();
    row = base();
    renderPage();
    await screen.findByRole("heading", { name: "Brand film editor" });
    expect(screen.queryByText(/pay stated/i)).not.toBeInTheDocument();
  });
});
