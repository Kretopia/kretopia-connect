import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const reads: string[] = [];
const world = vi.hoisted(() => ({ signedInAs: null as string | null, rows: {} as Record<string, unknown[]> }));
const profileRow = { user_id: "u1", full_name: "Dee Marshall", role: "Cinematographer", bio: "I light films.", avatar_url: null, username: "dee" };

vi.mock("@/integrations/supabase/client", () => {
  const make = (table: string) => {
    reads.push(table);
    // A portfolio read is the credits table filtered on source=portfolio; the credits list is the same table without that filter.
    let portfolio = false;
    const rows = () => (table === "credits" && portfolio ? (world.rows.portfolio ?? []) : (world.rows[table] ?? []));
    const result = () => ({ data: table === "public_profiles_safe" ? profileRow : null, error: null, count: 0 });
    const chain: unknown = new Proxy(() => undefined, {
      get: (_t, prop) => {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ ...result(), data: table === "public_profiles_safe" ? profileRow : rows() });
        if (prop === "maybeSingle" || prop === "single") return async () => result();
        if (prop === "eq") return (column: string, value: unknown) => { if (column === "source" && value === "portfolio") portfolio = true; return chain; };
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
vi.mock("@/hooks/useFirstTimeUser", () => ({ useFirstTimeUser: () => ({ isFirstTime: false, loading: false }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => <div data-testid="seo" /> }));
// The three flows a visitor can start are stood in for with markers: what is tested here is who gets them mounted, not how they work.
vi.mock("@/components/DirectMessageDialog", () => ({ DirectMessageDialog: () => <div data-testid="message-flow" /> }));
vi.mock("@/components/project/StartProjectFromMatchDialog", () => ({ StartProjectFromMatchDialog: () => <div data-testid="start-project-flow" /> }));
vi.mock("@/components/project/InviteToProjectDialog", () => ({ InviteToProjectDialog: () => <div data-testid="invite-flow" /> }));

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

  it("folds Featured In and Awards into the Expertise section: no band of their own, no standalone counts", async () => {
    world.rows = {
      press_links: [{ id: "p1", title: "Dee lights a short", publication: "Frame Weekly", url: "https://example.com/a" }],
      awards: [{ id: "a1", title: "Best Cinematography", organization: "Lyon Festival", year: 2024 }],
      industry_stats: [{ id: "s1", title: "IMDb Pro rank", value: "#1,204", issuer: "IMDb" }],
    };
    renderView(true);
    const expertise = within(await screen.findByRole("region", { name: "Expertise" }));
    expect(expertise.getByText("Featured in")).toBeInTheDocument();
    expect(expertise.getByRole("link", { name: /Dee lights a short/ })).toHaveAttribute("href", "https://example.com/a");
    expect(expertise.getByText("Awards")).toBeInTheDocument();
    expect(expertise.getByText(/Best Cinematography/)).toBeInTheDocument();
    expect(expertise.getByText("Credentials")).toBeInTheDocument();
    expect(expertise.getByText("#1,204")).toBeInTheDocument();
    // none of the old standalone pieces
    expect(screen.queryByRole("region", { name: "Featured in and awards" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Passport record" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Featured In" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Credentials & stats" })).toBeNull();
    // still inside the one Passport frame, after the card
    const card = screen.getByRole("heading", { name: "Dee Marshall" }).closest("article") as HTMLElement;
    expect(card).not.toContainElement(screen.getByRole("region", { name: "Expertise" }));
    expect(screen.getByRole("region", { name: /Dee's Creative Passport/ })).toContainElement(screen.getByRole("region", { name: "Expertise" }));
  });

  it("draws no Expertise section for a visitor when there are no roles, skills or recognition", async () => {
    renderView(true);
    await screen.findAllByText("Dee Marshall");
    // the profile row has a role, so Roles is there; but never an empty Featured in / Awards row
    const expertise = within(screen.getByRole("region", { name: "Expertise" }));
    expect(expertise.queryByText("Featured in")).toBeNull();
    expect(expertise.queryByText("Awards")).toBeNull();
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

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
};
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderPage = (props: { embedded?: boolean; owner?: React.ComponentProps<typeof PublicPassportView>["owner"] } = {}) =>
  render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={["/epk/u1"]}>
        <PublicPassportView userId="u1" {...props} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("the public Passport page: the shared header, and a link back only for the owner", () => {
  beforeEach(() => {
    reads.length = 0;
    world.signedInAs = null;
    world.rows = {};
  });

  it("draws the shared Passport header above the document, the card's name a level below it", async () => {
    renderPage();
    await screen.findAllByText("Dee Marshall");
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("Passport.");
    expect(h1[0]).toHaveTextContent("Work, verified.");
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Dee Marshall" })).toBeInTheDocument();
  });

  it("draws no header of its own when it sits inside the owner's page, which draws the same one itself", async () => {
    renderPage({ embedded: true });
    await screen.findAllByText("Dee Marshall");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("button", { name: /How this works/i })).toBeNull();
  });

  it("offers the owner the way back to the private Passport, and no redundant 'view public' action", async () => {
    world.signedInAs = "u1";
    renderPage();
    const back = await screen.findByRole("link", { name: "Back to my private Passport" });
    expect(back).toHaveAttribute("href", "/profile");
    expect(screen.queryByText(/View (my|your) public Passport/)).toBeNull();
  });

  it("offers another member, or a signed-out visitor, no link to any private page: it is not in the page at all", async () => {
    for (const viewer of ["u2", null]) {
      world.signedInAs = viewer;
      const { container, unmount } = renderPage();
      await screen.findAllByText("Dee Marshall");
      await waitFor(() => expect(reads).toContain("public_profiles_safe"));
      expect(screen.queryByRole("link", { name: /private Passport/ })).toBeNull();
      expect(container.innerHTML).not.toContain('href="/profile"');
      expect(container.innerHTML).not.toMatch(/private Passport/i);
      unmount();
    }
  });
});

describe("the compact record: Expertise, one Kretopia credits section, no 'credited as'", () => {
  const credits = [
    { id: "c1", project_name: "Night Train", role: "Director", year: 2024, verification_status: "verified" },
    { id: "c2", project_name: "Open Road", role: "Editor", year: 2023 },
  ];
  beforeEach(() => {
    reads.length = 0;
    world.signedInAs = null;
    world.rows = { credits };
  });

  it("lists the credits once, as Kretopia credits, and opens a credit's project from its card", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 3, name: "Kretopia credits" });
    expect(screen.getAllByRole("heading", { name: /kretopia credits/i })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Projects" })).toBeNull();
    // the old second list (with its "N confirmed" badge) is gone
    expect(screen.queryByText(/\d+ confirmed/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Night Train" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/production?name=Night%20Train");
  });

  it("keeps each credit's own attribution in its detail and states no 'credited as' line", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 3, name: "Kretopia credits" });
    const section = within(screen.getByRole("region", { name: "Kretopia credits, work samples" }));
    expect(section.getByText("Director · 2024")).toBeInTheDocument();
    expect(section.getByText("Editor · 2023")).toBeInTheDocument();
    expect(screen.queryByText(/credited as/i)).toBeNull();
  });

  it("gives only the owner contextual edit actions where 'credited as' used to be: manage credits, and edit roles", async () => {
    world.signedInAs = "u1";
    const onEdit = vi.fn();
    renderPage({ embedded: true, owner: { onEdit, onShowQR: vi.fn(), onDownloadEPK: vi.fn(), onChangePhoto: vi.fn() } });
    const manage = await screen.findByRole("link", { name: "Manage credits" });
    expect(manage).toHaveAttribute("href", "/credits");
    fireEvent.click(screen.getByRole("button", { name: "Edit roles" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("gives a visitor, and another member, none of those actions", async () => {
    for (const viewer of [null, "u2"]) {
      world.signedInAs = viewer;
      const { unmount } = renderPage({ embedded: true, owner: { onEdit: vi.fn(), onShowQR: vi.fn(), onDownloadEPK: vi.fn(), onChangePhoto: vi.fn() } });
      await screen.findByRole("heading", { level: 3, name: "Kretopia credits" });
      expect(screen.queryByRole("link", { name: "Manage credits" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Edit roles" })).toBeNull();
      unmount();
    }
  });
});

describe("what a visitor can do from somebody else's Passport, and what the owner cannot do to themselves", () => {
  const credits = [{ id: "c1", project_name: "Night Train", role: "Director", year: 2024 }];
  const work = () => within(screen.getByRole("group", { name: /Work with Dee/ }));
  beforeEach(() => {
    reads.length = 0;
    world.signedInAs = null;
    world.rows = { credits };
  });

  it("signed out: the three buttons send to sign in and come back here, and never connect the two accounts", async () => {
    renderPage();
    await screen.findByRole("group", { name: /Work with Dee/ });
    fireEvent.click(work().getByRole("button", { name: "Claim Credits" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/auth?redirect=%2Fepk%2Fu1");
    expect(screen.getByTestId("where").textContent).not.toContain("connect=");
    // no flow was mounted for a signed-out visitor
    expect(screen.queryByTestId("message-flow")).toBeNull();
    expect(screen.queryByTestId("start-project-flow")).toBeNull();
  });

  it("signed in but not connected: Connect is offered, Message and Start a project wait for it, Claim Credits lists the Passport's projects", async () => {
    world.signedInAs = "u2";
    renderPage();
    await screen.findByRole("button", { name: /Connect with Dee/ });
    expect(work().getByRole("button", { name: "Message" })).toBeDisabled();
    expect(work().getByRole("button", { name: "Start a project" })).toBeDisabled();
    fireEvent.click(work().getByRole("button", { name: "Claim Credits" }));
    const dialog = await screen.findByRole("dialog", { name: "Claim a credit" });
    expect(within(dialog).getByText("Night Train")).toBeInTheDocument();
    // the project start and invitation flows are only mounted for an accepted connection
    expect(screen.queryByTestId("start-project-flow")).toBeNull();
    expect(screen.queryByTestId("invite-flow")).toBeNull();
    // choosing a project opens that project's own page, where the claim is made and confirmed
    fireEvent.click(within(dialog).getByRole("button", { name: /Night Train/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/production?name=Night%20Train");
  });

  it("signed in and connected: Message and Start a project are open, with the invitation flow beside them", async () => {
    world.signedInAs = "u2";
    world.rows = { credits, connections: [{ status: "accepted" }] };
    renderPage();
    await waitFor(() => expect(work().getByRole("button", { name: "Message" })).toBeEnabled());
    expect(work().getByRole("button", { name: "Start a project" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Invite to an existing project" })).toBeInTheDocument();
    expect(screen.getByTestId("message-flow")).toBeInTheDocument();
    expect(screen.getByTestId("start-project-flow")).toBeInTheDocument();
    expect(screen.getByTestId("invite-flow")).toBeInTheDocument();
  });

  it("the owner gets none of it: no buttons, no flow mounted, nothing to message, project with or claim on oneself", async () => {
    world.signedInAs = "u1";
    world.rows = { credits, connections: [{ status: "accepted" }] };
    renderPage();
    await screen.findByRole("link", { name: "Back to my private Passport" });
    expect(screen.queryByRole("group", { name: /Work with/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Claim Credits" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Collaborate on Kretopia" })).toBeNull();
    for (const id of ["message-flow", "start-project-flow", "invite-flow"]) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
