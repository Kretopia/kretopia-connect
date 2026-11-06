import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const reads: string[] = [];
const world = vi.hoisted(() => ({ signedInAs: null as string | null, rows: {} as Record<string, unknown[]> }));
const profileRow = { user_id: "u1", full_name: "Dee Marshall", role: "Cinematographer", bio: "I light films.", avatar_url: null, username: "dee" };

vi.mock("@/integrations/supabase/client", () => {
  const make = (table: string) => {
    reads.push(table);
    const result = () => ({ data: table === "public_profiles_safe" ? profileRow : null, error: null, count: 0 });
    const chain: unknown = new Proxy(() => undefined, {
      get: (_t, prop) => {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ ...result(), data: table === "public_profiles_safe" ? profileRow : (world.rows[table] ?? []) });
        if (prop === "maybeSingle" || prop === "single") return async () => result();
        return () => chain;
      },
      apply: () => chain,
    });
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => make(table),
      rpc: () => make("rpc"),
      channel: () => make("channel"),
      removeChannel: () => undefined,
      auth: { getUser: async () => ({ data: { user: world.signedInAs ? { id: world.signedInAs } : null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) },
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => <div data-testid="seo" /> }));

import { PublicPassportView } from "../PublicPassportView";

const renderView = (embedded: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PublicPassportView userId="u1" embedded={embedded} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("PublicPassportView: one Passport for visitors and for its owner", () => {
  beforeEach(() => {
    reads.length = 0;
    world.signedInAs = null;
    world.rows = {};
  });

  it("draws the same document embedded in the owner's page, minus the page-level extras", async () => {
    const page = renderView(false);
    expect((await screen.findAllByText("Dee Marshall")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("seo")).toBeInTheDocument();
    expect(screen.getByText(/Operating System for Creative Careers/i)).toBeInTheDocument();
    page.unmount();

    renderView(true);
    expect((await screen.findAllByText("Dee Marshall")).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("seo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Operating System for Creative Careers/i)).not.toBeInTheDocument();
  });

  it("draws Featured In and Awards as a band under the card and the record, side by side, not stacked inside the card", async () => {
    world.rows = {
      press_links: [{ id: "p1", title: "Dee lights a short", publication: "Frame Weekly", url: "https://example.com/a" }],
      awards: [{ id: "a1", title: "Best Cinematography", organization: "Lyon Festival", year: 2024 }],
    };
    renderView(true);
    const band = await screen.findByRole("region", { name: "Featured in and awards" });
    expect(within(band).getByRole("heading", { name: "Featured In" })).toBeInTheDocument();
    expect(within(band).getByRole("heading", { name: "Awards" })).toBeInTheDocument();
    expect(within(band).getByText("Dee lights a short")).toBeInTheDocument();
    expect(within(band).getByText("Best Cinematography")).toBeInTheDocument();
    // not in the card: the band is no descendant of the Passport card, and it comes after the record
    const card = screen.getByRole("heading", { name: "Dee Marshall" }).closest("article") as HTMLElement;
    expect(card).not.toContainElement(band);
    expect(Boolean(card.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    // still inside the one Passport frame
    expect(screen.getByRole("region", { name: /Dee's Creative Passport/ })).toContainElement(band);
  });

  it("draws no band when there is neither press nor an award", async () => {
    renderView(true);
    await screen.findAllByText("Dee Marshall");
    expect(screen.queryByRole("region", { name: "Featured in and awards" })).toBeNull();
  });

  it("reads the profile only through the public-safe view, never the private profiles table", async () => {
    renderView(true);
    await screen.findAllByText("Dee Marshall");
    await waitFor(() => expect(reads).toContain("public_profiles_safe"));
    expect(reads).not.toContain("profiles");
  });
});

describe("the owner's controls on the shared Passport card", () => {
  const owner = {
    onEdit: vi.fn(), onShowQR: vi.fn(), onDownloadEPK: vi.fn(), onChangePhoto: vi.fn(),
    privateBand: <p>private overview</p>,
  };
  const renderOwned = (props: { owner?: typeof owner } = { owner }) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <PublicPassportView userId="u1" embedded {...props} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    reads.length = 0;
    world.signedInAs = null;
    world.rows = {};
  });

  it("draws them on the card for the signed-in owner, inside the very document visitors see", async () => {
    world.signedInAs = "u1";
    renderOwned();
    expect(await screen.findByRole("button", { name: "Change photo" })).toBeInTheDocument();
    const tiles = within(screen.getByRole("list", { name: "Passport actions" }));
    // Edit, Share, QR, press kit and, because the document holds the data it is made of, the PDF
    expect(tiles.getAllByRole("listitem")).toHaveLength(5);
    expect(tiles.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    // one document: the Passport's own heading and record are there around the controls, not a second page
    expect(screen.getByRole("region", { name: /Dee's Creative Passport/ })).toBeInTheDocument();
  });

  it("lays the owner's private blocks out as a band under the card, labelled, inside the same Passport frame", async () => {
    world.signedInAs = "u1";
    renderOwned();
    const band = await screen.findByRole("region", { name: "Only you see this" });
    expect(within(band).getByText("private overview")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: "Change photo" }).closest("article") as HTMLElement;
    expect(card).not.toContainElement(band);
    expect(Boolean(card.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByRole("region", { name: /Dee's Creative Passport/ })).toContainElement(band);
  });

  it("makes the PDF from the button on the card, and shows no second PDF bar", async () => {
    world.signedInAs = "u1";
    renderOwned();
    await screen.findByRole("button", { name: "Download PDF" });
    expect(screen.queryByText("Kretopia · Creative Passport PDF")).toBeNull();
    expect(screen.getAllByRole("button", { name: /PDF/ })).toHaveLength(2); // the press kit and the PDF, both on the card
  });

  it("keeps the PDF bar for an owner looking at the public page, where the card has no controls of its own", async () => {
    world.signedInAs = "u1";
    renderOwned({});
    expect(await screen.findByText("Kretopia · Creative Passport PDF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download PDF/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Only you see this" })).toBeNull();
  });

  it("never draws any of it for another signed-in member, although the page passed it", async () => {
    world.signedInAs = "u2";
    renderOwned();
    await screen.findAllByText("Dee Marshall");
    // the connection lookup only runs once the view knows who is signed in: from here the answer is settled
    await waitFor(() => expect(reads).toContain("connections"));
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Passport actions" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Only you see this" })).toBeNull();
    expect(screen.queryByText("private overview")).toBeNull();
    expect(screen.queryByText("Kretopia · Creative Passport PDF")).toBeNull();
    expect(screen.queryByRole("button", { name: /Download PDF/ })).toBeNull();
  });

  it("never draws any of it for a visitor who is not signed in", async () => {
    renderOwned();
    await screen.findAllByText("Dee Marshall");
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Only you see this" })).toBeNull();
    expect(screen.queryByText("private overview")).toBeNull();
    expect(screen.queryByRole("button", { name: /Download PDF/ })).toBeNull();
  });
});
