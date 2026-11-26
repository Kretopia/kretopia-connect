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
import { HERO_SEARCH_PLACEHOLDER } from "@/lib/searchIntent";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname}{l.search}</output>;
}
const renderHero = (props: Partial<React.ComponentProps<typeof UnifiedSearchDropdown>> = {}) =>
  render(
    <MemoryRouter>
      <UnifiedSearchDropdown variant="hero" intentSearch placeholder={HERO_SEARCH_PLACEHOLDER} {...props} />
      <Where />
    </MemoryRouter>,
  );
const where = () => screen.getByTestId("where").textContent;
const type = (value: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value } });
const results = () => screen.getByRole("region", { name: "Search results" });

const ada = { user_id: "p1", full_name: "Ada Lovelace", role: "Motion Designer", location: "Bali", avatar_url: null };
const filmEditor = { id: "g1", title: "Film editor", type: "Paid Job", compensation: null, location: "Remote" };

beforeEach(() => {
  mocks.people.mockReset();
  mocks.gigs.mockReset();
  mocks.people.mockResolvedValue({ users: [], hasMore: false });
  mocks.gigs.mockResolvedValue({ data: [], error: null });
});

describe("hero search: one field, no mode to pick", () => {
  it("has no People / Skills / Opportunities buttons above the bar, and says what it finds", () => {
    renderHero();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Search people, skills and opportunities");
  });

  it("is off unless asked for: the navbar and share dialog keep their own search", () => {
    renderHero({ intentSearch: false, placeholder: "Search" });
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryByText("Explore by")).toBeNull();
  });
});

describe("Explore by, from an empty field", () => {
  it("opens as soon as the field is focused, with the five ways in and no 'Roles' list, and fetches nothing", () => {
    renderHero();
    fireEvent.focus(screen.getByRole("combobox"));
    const region = results();
    expect(within(region).getByText("Explore by")).toBeInTheDocument();
    for (const label of ["Creative Disciplines", "Production & Crew", "Skills & Expertise", "Studios & Companies", "Music & Sound"]) {
      expect(within(region).getByRole("button", { name: new RegExp(label.replace("&", "\\&")) })).toBeInTheDocument();
    }
    expect(within(region).queryByText("Roles")).toBeNull();
    expect(mocks.people).not.toHaveBeenCalled();
    expect(mocks.gigs).not.toHaveBeenCalled();
  });

  it("Explore by → Creative Disciplines → Motion Design → the Grid, with the word in its search bar", () => {
    renderHero();
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("button", { name: /Creative Disciplines/ }));
    fireEvent.click(screen.getByRole("button", { name: /Motion Design/ }));
    expect(where()).toBe("/match?tab=browse&view=grid&q=Motion");
  });

  it("goes back from an area to the list", () => {
    renderHero();
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("button", { name: /Music & Sound/ }));
    expect(screen.getByRole("button", { name: /Beatmakers/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Explore by/ }));
    expect(screen.getByRole("button", { name: /Production & Crew/ })).toBeInTheDocument();
  });
});

describe("typing: the answers arrive in sections", () => {
  it("shows People, Skills and Opportunities together, each titled with its feature", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    mocks.gigs.mockResolvedValue({ data: [filmEditor], error: null });
    renderHero();
    type("motion");
    await screen.findByRole("button", { name: /Ada Lovelace/ });
    await screen.findByRole("button", { name: /Film editor/ });
    expect(mocks.people).toHaveBeenCalledWith("motion", 0);
    for (const title of ["People", "Skills", "Opportunities"]) {
      expect(within(results()).getByRole("region", { name: title })).toBeInTheDocument();
    }
    expect(within(results()).getByText("Passports on Kretopia")).toBeInTheDocument();
    expect(within(results()).getByText("Professionals in Match")).toBeInTheDocument();
    expect(within(results()).getByText("Open now in Scout")).toBeInTheDocument();
    expect(within(within(results()).getByRole("region", { name: "Skills" })).getByRole("button", { name: /Motion Design/ })).toBeInTheDocument();
  });

  it("leaves out a section that has nothing to say", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    renderHero();
    type("Ada");
    await screen.findByRole("button", { name: /Ada Lovelace/ });
    expect(within(results()).queryByRole("region", { name: "Opportunities" })).toBeNull();
  });

  it("opens a person's Passport straight from the answers", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    renderHero();
    type("Ada");
    fireEvent.click(await screen.findByRole("button", { name: /Ada Lovelace/ }));
    expect(where()).toBe("/profile/p1");
  });

  it("opens an opportunity straight from the answers", async () => {
    mocks.gigs.mockResolvedValue({ data: [filmEditor], error: null });
    renderHero();
    type("film");
    fireEvent.click(await screen.findByRole("button", { name: /Film editor/ }));
    expect(where()).toBe("/opportunity/g1");
  });

  it("a skill area opens the Grid with that term", async () => {
    renderHero();
    type("motion");
    const skills = await screen.findByRole("region", { name: "Skills" });
    fireEvent.click(within(skills).getByRole("button", { name: /Motion Design/ }));
    expect(where()).toBe("/match?tab=browse&view=grid&q=Motion");
  });

  it("each section's 'see all' opens its own full search with the words", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    mocks.gigs.mockResolvedValue({ data: [filmEditor], error: null });
    renderHero();
    type("motion");
    await screen.findByRole("button", { name: /Film editor/ });
    fireEvent.click(screen.getByRole("button", { name: /Search Scout for “motion”/ }));
    expect(where()).toBe("/scout?q=motion");
  });
});

describe("Enter, with nothing picked", () => {
  it("goes to the Grid with the words typed in, for a name or a skill", async () => {
    mocks.people.mockResolvedValue({ users: [ada], hasMore: false });
    renderHero();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Ada" } });
    await screen.findByRole("button", { name: /Ada Lovelace/ });
    fireEvent.submit(input.closest("form")!);
    expect(where()).toBe("/match?tab=browse&view=grid&q=Ada");
  });

  it("goes to Scout when the only answer is an open opportunity", async () => {
    mocks.gigs.mockResolvedValue({ data: [{ ...filmEditor, title: "Hiring: gaffer wanted" }], error: null });
    renderHero();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "hiring" } });
    await screen.findByRole("button", { name: /Hiring: gaffer wanted/ });
    fireEvent.submit(input.closest("form")!);
    expect(where()).toBe("/scout?q=hiring");
  });

  it("does nothing on an empty field", () => {
    renderHero();
    fireEvent.submit(screen.getByRole("combobox").closest("form")!);
    expect(where()).toBe("/");
  });
});

describe("when nothing matches", () => {
  it("says so and still offers the full searches", async () => {
    renderHero();
    type("Zzyzx");
    await screen.findByText(/Nothing matches “Zzyzx” yet/);
    fireEvent.click(screen.getByRole("button", { name: /Search opportunities for “Zzyzx”/ }));
    await waitFor(() => expect(where()).toBe("/scout?q=Zzyzx"));
  });
});
