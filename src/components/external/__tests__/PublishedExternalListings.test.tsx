import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

let rows: Record<string, unknown>[] = [];
let error: { message: string } | null = null;
const eqCalls: [string, unknown][] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe("public_external_listings");
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (c: string, v: unknown) => (eqCalls.push([c, v]), q);
      q.order = () => q;
      q.limit = () => Promise.resolve({ data: rows, error });
      return q;
    },
  },
}));

import { PublishedExternalListings } from "../PublishedExternalListings";

const row = (over: Record<string, unknown> = {}) => ({
  id: "l1", kind: "gig", status: "published", title: "Brand film editor", original_publisher: "Acme Studio", location: "Lisbon", remote_scope: "remote",
  source_published_at: null, deadline_at: null, apply_url: "https://acme-studio.com/careers/editor", excerpt: "A short summary.", last_checked_at: new Date(Date.now() - 86_400_000).toISOString(),
  source_provider: "remoteok", claimed: false, ...over,
});

beforeEach(() => { rows = []; error = null; eqCalls.length = 0; });
const renderList = () => render(<MemoryRouter><PublishedExternalListings kind="gig" /></MemoryRouter>);

describe("PublishedExternalListings", () => {
  it("shows each listing labelled External and Unclaimed, linked to its page, with Apply at source to the real destination", async () => {
    rows = [row(), row({ id: "l2", title: "Colourist", claimed: true })];
    renderList();
    expect(await screen.findByRole("link", { name: "Brand film editor" })).toHaveAttribute("href", "/listing/l1");
    const labels = screen.getAllByTestId("listing-labels");
    expect(labels[0]).toHaveTextContent("External");
    expect(labels[0]).toHaveTextContent("Unclaimed");
    expect(labels[0]).toHaveTextContent("Last checked yesterday");
    expect(labels[1]).toHaveTextContent("Claimed");
    const apply = screen.getAllByRole("link", { name: /apply at source/i })[0];
    expect(apply).toHaveAttribute("href", "https://acme-studio.com/careers/editor");
    expect(apply.getAttribute("rel")).toMatch(/noopener/);
  });

  it("a Himalayas job is credited by name and its Apply link is the job's own Himalayas page with utm_source=api", async () => {
    const page = "https://himalayas.app/companies/customer-io/jobs/senior-brand-designer";
    rows = [row({ source_provider: "himalayas", apply_url: page })];
    renderList();
    await screen.findByText("Brand film editor");
    expect(screen.getByTestId("listing-labels")).toHaveTextContent("via Himalayas");
    const apply = screen.getByRole("link", { name: /apply at source/i });
    expect(apply).toHaveAttribute("href", `${page}?utm_source=api`);
    expect(apply.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("asks for one kind only: gigs are never mixed with events or talent", async () => {
    rows = [row()];
    renderList();
    await screen.findByText("Brand film editor");
    expect(eqCalls).toEqual([["kind", "gig"]]);
  });

  it("an empty list says so honestly, and an error says it could not load", async () => {
    renderList();
    expect(await screen.findByText(/nothing sourced here yet/i)).toBeInTheDocument();
  });

  it("a failed load is not shown as an empty list of results", async () => {
    error = { message: "boom" };
    renderList();
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing sourced here yet/i)).not.toBeInTheDocument();
  });
});
