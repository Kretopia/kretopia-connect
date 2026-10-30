import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCatalog, type ExternalRow, type KretopiaRow, type CatalogItem } from "@/lib/scoutCatalog";

type State = { data?: { items: CatalogItem[]; partial: boolean }; isLoading: boolean; isError: boolean };
let state: State = { isLoading: false, isError: false };
vi.mock("@/hooks/useScoutCatalog", () => ({ useScoutCatalog: () => state, SCOUT_CATALOG_KEY: ["scout-catalog"] }));

vi.mock("@/components/brand/KretoScene", () => ({ KretoScene: () => null }));
vi.mock("../ScoutFieldCarousel", () => ({ ScoutFieldCarousel: ({ children, heading }: { children: React.ReactNode; heading?: React.ReactNode }) => <div>{heading}<ul>{children}</ul></div> }));

import { ScoutAllSources } from "../ScoutAllSources";

const DAY = 86_400_000;
const ago = (n: number) => new Date(Date.now() - n * DAY).toISOString();
let n = 0;
const ext = (title: string, over: Partial<ExternalRow> = {}): ExternalRow => ({
  id: `e${++n}`,
  title,
  original_publisher: `Co ${n}`,
  location: "Lisbon",
  remote_scope: "remote",
  source_published_at: ago(n % 20),
  deadline_at: null,
  apply_url: `https://jobicy.com/jobs/${n}-x`,
  excerpt: "Join our team.",
  last_checked_at: ago(1),
  source_provider: "jobicy",
  claimed: false,
  budget: null,
  ...over,
});
const kre = (over: Partial<KretopiaRow> = {}): KretopiaRow => ({ id: "k1", title: "Wedding photographer wanted", type: "job", description: "Two days in Porto.", compensation: "$800", location: "Porto", created_at: ago(1), ...over });

const show = (rows: ExternalRow[], k: KretopiaRow[] = [], partial = false) => {
  state = { isLoading: false, isError: false, data: { items: buildCatalog(rows, k), partial } };
  return render(
    <MemoryRouter>
      <ScoutAllSources />
    </MemoryRouter>,
  );
};
const cards = () => screen.queryAllByTestId("catalog-card");
const openFilter = (name: string) => {
  const filters = screen.getByRole("button", { name: /^Filters/ });
  if (filters.getAttribute("aria-expanded") === "false") fireEvent.click(filters);
  const trigger = screen.getByRole("button", { name: new RegExp(`^${name}`) });
  if (trigger.getAttribute("aria-expanded") === "false") fireEvent.click(trigger);
};
const family = (name: string) => { openFilter("Creative field"); return within(screen.getByRole("group", { name: "Field" })).getByRole("button", { name: new RegExp(`^${name}`) }); };

beforeEach(() => {
  n = 0;
  state = { isLoading: false, isError: false };
});

describe("ScoutAllSources: the states", () => {
  it("says it is loading, says when the read failed, and says when there is nothing", () => {
    state = { isLoading: true, isError: false };
    const { unmount } = render(<MemoryRouter><ScoutAllSources /></MemoryRouter>);
    expect(screen.getByRole("status", { name: "Loading every opportunity" })).toBeInTheDocument();
    unmount();

    state = { isLoading: false, isError: true };
    const second = render(<MemoryRouter><ScoutAllSources /></MemoryRouter>);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    second.unmount();

    state = { isLoading: false, isError: false, data: { items: [], partial: false } };
    render(<MemoryRouter><ScoutAllSources /></MemoryRouter>);
    expect(screen.getByText(/nothing to list yet/i)).toBeInTheDocument();
  });

  it("tells the person when only part of the list loaded", () => {
    show([ext("Art Director")], [], true);
    expect(screen.getByText(/some opportunities may be missing/i)).toBeInTheDocument();
  });
});

describe("ScoutAllSources: the list", () => {
  it("shows every opportunity with its count and source count, creative fields before other roles", () => {
    show([ext("Art Director"), ext("Video Editor"), ext("Senior Software Engineer", { source_provider: "remoteok", apply_url: "https://remoteok.com/x" })], [kre()]);
    expect(screen.getByTestId("catalog-count")).toHaveTextContent("4 opportunities · 3 sources");
    expect(cards()).toHaveLength(4);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Creative direction1", "Video & motion1", "Photography1", "Engineering1"]);
    expect(screen.getByText("Creative fields")).toBeInTheDocument();
    expect(screen.getByText("Other roles")).toBeInTheDocument();
  });

  it("never caps the creative families: twenty designers are twenty cards", () => {
    show(Array.from({ length: 20 }, (_, i) => ext(`Graphic Designer ${i + 1}`)));
    expect(cards()).toHaveLength(20);
    expect(screen.queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });

  it("opens a long section outside the creative families only on request, and shows every match when searching", () => {
    show(Array.from({ length: 9 }, (_, i) => ext(`Backend Engineer ${i + 1}`)));
    expect(cards()).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Show all 9" }));
    expect(cards()).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(cards()).toHaveLength(6);
    // a search is a question: every match is shown, with nothing to open
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "engineer" } });
    expect(cards()).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /show/i })).not.toBeInTheDocument();
  });
});

describe("ScoutAllSources: sorting it out", () => {
  const rows = () => [
    ext("Motion Designer", { source_provider: "jobicy" }),
    ext("Graphic Designer & Video Editor", { source_provider: "remoteok", apply_url: "https://remoteok.com/g" }),
    ext("Senior Software Engineer", { source_provider: "remoteok", apply_url: "https://remoteok.com/s", location: "Berlin", remote_scope: null }),
    ext("Copywriter", { source_provider: "himalayas", apply_url: "https://himalayas.app/companies/a/jobs/c" }),
  ];

  it("a family pill shows its count, narrows the list, and a second-family posting is found under both", () => {
    show(rows());
    expect(family("All")).toHaveTextContent("4");
    expect(family("Video & motion")).toHaveTextContent("2"); // the motion designer and the graphic designer who also edits video
    fireEvent.click(family("Video & motion"));
    expect(cards()).toHaveLength(2);
    expect(family("Video & motion")).toHaveAttribute("aria-pressed", "true");
    // a filtered list is flat: one heading, no 'Other roles' group
    expect(screen.queryByText("Other roles")).not.toBeInTheDocument();
  });

  it("the counts next to a filter ignore that filter itself", () => {
    show(rows());
    openFilter("Sources");
    fireEvent.click(screen.getByRole("button", { name: /^Remote OK/ }));
    expect(cards()).toHaveLength(2);
    // with Remote OK on, the family pills count what is left, and the source pills still count every source's own share
    expect(family("Engineering")).toHaveTextContent("1");
    openFilter("Sources");
    expect(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: /^Jobicy/ })).toHaveTextContent("1");
    // the pill that has nothing left disappears; the pressed one stays
    openFilter("Creative field");
    expect(within(screen.getByRole("group", { name: "Field" })).queryByRole("button", { name: /^Writing/ })).not.toBeInTheDocument();
  });

  it("search narrows across fields and Clear filters brings everything back", () => {
    show(rows());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "berlin" } });
    expect(cards()).toHaveLength(1);
    expect(screen.getByTestId("catalog-count")).toHaveTextContent("1 opportunity · 1 source");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(cards()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("says plainly when nothing matches, and offers the way back", () => {
    show(rows());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "zzzz" } });
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/no opportunity matches/i);
    expect(cards()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("offers the work-mode filter only when it would separate something, and applies it", () => {
    show(rows());
    openFilter("Work & experience");
    const work = screen.getByRole("group", { name: "Work" });
    fireEvent.click(within(work).getByRole("button", { name: /^On-site/ }));
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent("Senior Software Engineer");
  });

  it("progressively applies filters without exposing every group", () => {
    show(rows());
    expect(screen.queryByRole("group", { name: "Source" })).not.toBeInTheDocument();
    openFilter("Work & experience");
    fireEvent.click(within(screen.getByRole("group", { name: "Work" })).getByRole("button", { name: /^Remote/ }));
    expect(cards()).toHaveLength(3);
    openFilter("Sources");
    expect(screen.queryByRole("group", { name: "Work" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: /^Jobicy/ }));
    expect(cards()).toHaveLength(1);
  });

  it("hides the pay filter when no posting states a pay, shows it when one does", () => {
    const initial = show(rows());
    openFilter("Pay, language & freshness");
    expect(screen.queryByRole("group", { name: "Pay" })).not.toBeInTheDocument();
    initial.unmount();
    show([ext("Art Director", { budget: { min: 90000, max: 120000, currency: "USD", period: "year" } }), ext("Illustrator")]);
    openFilter("Pay, language & freshness");
    fireEvent.click(within(screen.getByRole("group", { name: "Pay" })).getByRole("button", { name: /^Pay listed/ }));
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent("$90K–$120K / yr");
  });
});

describe("ScoutAllSources: a card", () => {
  it("an external card names its source and links the publisher's own page, with the terms' link rules", () => {
    show([
      ext("Art Director", { source_provider: "himalayas", apply_url: "https://himalayas.app/companies/a/jobs/b" }),
      ext("Illustrator", { source_provider: "remoteok", apply_url: "https://remoteok.com/remote-jobs/x-1" }),
      ext("Copywriter", { source_provider: "jobicy", apply_url: "https://jobicy.com/jobs/9-z" }),
    ]);
    const him = screen.getByRole("link", { name: "Apply at source: Art Director" });
    expect(him).toHaveAttribute("href", "https://himalayas.app/companies/a/jobs/b?utm_source=api");
    expect(him).toHaveAttribute("target", "_blank");
    expect(him.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(screen.getByRole("link", { name: "Apply at source: Illustrator" }).getAttribute("rel")).toBe("noopener noreferrer"); // Remote OK asks for a followed link
    const card = cards().find((c) => c.textContent?.includes("Art Director"))!;
    expect(within(card).getByTestId("listing-labels")).toHaveTextContent("via Himalayas");
    expect(within(card).getByTestId("listing-labels")).toHaveTextContent("Unclaimed");
    // the title goes to Kretopia's own page for the listing
    expect(within(card).getByRole("link", { name: "Art Director" }).getAttribute("href")).toMatch(/^\/listing\/e\d+$/);
  });

  it("a card shows the family, the level, where, the working mode and the pay or that none is listed", () => {
    show([ext("Senior Product Designer", { location: "Lisbon", remote_scope: "remote" })]);
    const card = cards()[0];
    expect(card).toHaveTextContent("Product & UX design");
    expect(card).toHaveTextContent("Senior");
    expect(card).toHaveTextContent("Lisbon");
    expect(card).toHaveTextContent("Remote");
    expect(card).toHaveTextContent("Pay not listed");
  });

  it("a job posted for several places is one card that lists the other places with their own links", () => {
    show(["Armenia", "Estonia", "Italy"].map((l, i) => ext("Creative Design Team Lead", { original_publisher: "CapsLock", location: l, apply_url: `https://jobicy.com/jobs/${i}-cap`, source_published_at: ago(i + 1) })));
    expect(cards()).toHaveLength(1);
    const card = cards()[0];
    const more = within(card).getByText("Also posted for 2 more places");
    expect(more.closest("details")).toBeInTheDocument();
    const links = within(card).getAllByRole("link", { name: /^Apply at source for / });
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual(["Apply at source for Estonia: Creative Design Team Lead", "Apply at source for Italy: Creative Design Team Lead"]);
    expect(links[0]).toHaveAttribute("href", "https://jobicy.com/jobs/1-cap");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer nofollow");
    // searching any of its places finds it
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "italy" } });
    expect(cards()).toHaveLength(1);
  });

  it("a Kretopia gig is labelled Kretopia and opens on Kretopia, not at a source", () => {
    show([], [kre()]);
    const card = cards()[0];
    expect(card).toHaveTextContent("Kretopia");
    expect(card).toHaveTextContent("$800");
    expect(within(card).getByRole("link", { name: "View gig" })).toHaveAttribute("href", "/opportunity/k1");
    expect(within(card).queryByText(/Apply at source/)).not.toBeInTheDocument();
    expect(within(card).queryByTestId("listing-labels")).not.toBeInTheDocument();
  });
});
