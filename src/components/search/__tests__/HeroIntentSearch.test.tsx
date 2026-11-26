import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  people: vi.fn(),
  gigs: vi.fn(),
}));

vi.mock("@/lib/scoutPeopleSearch", () => ({
  SCOUT_PEOPLE_PAGE_SIZE: 50,
  scoutSearchTarget: (q: string) => `/scout?q=${encodeURIComponent(q)}`,
  searchScoutPeople: mocks.people,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ ilike: () => ({ limit: () => mocks.gigs() }) }),
      }),
    }),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useVoiceSearch", () => ({ useVoiceSearch: () => ({ supported: false, status: "idle" }) }));

import { UnifiedSearchDropdown } from "../UnifiedSearchDropdown";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname}{l.search}</output>;
}
const renderHero = (props: Partial<React.ComponentProps<typeof UnifiedSearchDropdown>> = {}) =>
  render(
    <MemoryRouter>
      <UnifiedSearchDropdown variant="hero" intentSearch {...props} />
      <Where />
    </MemoryRouter>,
  );
const where = () => screen.getByTestId("where").textContent;
const tab = (name: RegExp) => screen.getByRole("tab", { name });

beforeEach(() => {
  mocks.people.mockReset();
  mocks.gigs.mockReset();
  mocks.people.mockResolvedValue({ users: [], hasMore: false });
  mocks.gigs.mockResolvedValue({ data: [], error: null });
});

describe("hero search: what are you looking for?", () => {
  it("offers People, Skills and Opportunities, each saying where it leads, with People first", () => {
    renderHero();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["PeoplePassport", "SkillsMatch", "OpportunitiesScout"]);
    expect(tab(/^People/)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Find someone by name…");
  });

  it("changes what the field asks for with the intent", () => {
    renderHero();
    fireEvent.click(tab(/^Skills/));
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "A discipline, skill or expertise…");
    fireEvent.click(tab(/^Opportunities/));
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Jobs, projects, collaborations…");
  });

  it("is off unless asked for: the navbar and share dialog keep their own search", () => {
    renderHero({ intentSearch: false });
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("Skills → Explore by", () => {
  it("opens 'Explore by' with the five ways in, and no 'Roles' list", () => {
    renderHero();
    fireEvent.click(tab(/^Skills/));
    const region = screen.getByRole("region", { name: "Search results" });
    expect(within(region).getByText("Explore by")).toBeInTheDocument();
    for (const label of ["Creative Disciplines", "Production & Crew", "Skills & Expertise", "Studios & Companies", "Music & Sound"]) {
      expect(within(region).getByRole("button", { name: new RegExp(label.replace("&", "\\&")) })).toBeInTheDocument();
    }
    expect(within(region).queryByText("Roles")).toBeNull();
    expect(mocks.people).not.toHaveBeenCalled();
  });

  it("Skills → Creative Disciplines → Motion Design → the matching professionals in Match", () => {
    renderHero();
    fireEvent.click(tab(/^Skills/));
    fireEvent.click(screen.getByRole("button", { name: /Creative Disciplines/ }));
    fireEvent.click(screen.getByRole("button", { name: /Motion Design/ }));
    expect(where()).toBe("/match?tab=directory&q=Motion");
  });

  it("goes back from a category to the list", () => {
    renderHero();
    fireEvent.click(tab(/^Skills/));
    fireEvent.click(screen.getByRole("button", { name: /Music & Sound/ }));
    expect(screen.getByRole("button", { name: /Beatmakers/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Explore by/ }));
    expect(screen.getByRole("button", { name: /Production & Crew/ })).toBeInTheDocument();
  });

  it("typing narrows the areas, and Enter searches Match for the words", () => {
    renderHero();
    fireEvent.click(tab(/^Skills/));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "motion" } });
    expect(screen.getByRole("button", { name: /Motion Design/ })).toBeInTheDocument();
    fireEvent.submit(input.closest("form")!);
    expect(where()).toBe("/match?tab=directory&q=motion");
  });
});

describe("People → Passport", () => {
  it("previews real people for a guest and sends the words to the Passport directory", async () => {
    mocks.people.mockResolvedValue({ users: [{ user_id: "p1", full_name: "Ada Lovelace", role: "Motion Designer", location: "Bali", avatar_url: null }], hasMore: false });
    renderHero();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Ada" } });
    await screen.findByRole("button", { name: /Ada Lovelace/ });
    expect(mocks.people).toHaveBeenCalledWith("Ada", 0);
    fireEvent.click(screen.getByRole("button", { name: "Search Passport for people Ada" }));
    expect(where()).toBe("/match?tab=directory&q=Ada");
  });

  it("opens a person's Passport straight from the preview", async () => {
    mocks.people.mockResolvedValue({ users: [{ user_id: "p1", full_name: "Ada Lovelace", role: "Editor", location: null, avatar_url: null }], hasMore: false });
    renderHero();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Ada" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ada Lovelace/ }));
    expect(where()).toBe("/profile/p1");
  });

  it("says so when nobody matches, and still offers the directory", async () => {
    renderHero();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Zzyzx" } });
    await screen.findByText(/No one by that name yet/);
    expect(screen.getByRole("button", { name: "Search Passport for people Zzyzx" })).toBeInTheDocument();
  });
});

describe("Opportunities → Scout", () => {
  it("previews real open opportunities and sends the words to Scout", async () => {
    mocks.gigs.mockResolvedValue({ data: [{ id: "g1", title: "Film editor", type: "Paid Job", compensation: null, location: "Remote" }], error: null });
    renderHero();
    fireEvent.click(tab(/^Opportunities/));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "film" } });
    fireEvent.click(await screen.findByRole("button", { name: /Film editor/ }));
    expect(where()).toBe("/opportunity/g1");
  });

  it("Enter searches Scout for the words, not people", async () => {
    renderHero();
    fireEvent.click(tab(/^Opportunities/));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "film editor" } });
    await waitFor(() => expect(mocks.gigs).toHaveBeenCalled());
    fireEvent.submit(input.closest("form")!);
    expect(where()).toBe("/scout?q=film%20editor");
    expect(mocks.people).not.toHaveBeenCalled();
  });
});
