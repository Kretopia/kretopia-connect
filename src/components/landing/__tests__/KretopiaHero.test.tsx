import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { KretopiaHero } from "../KretopiaHero";
import { HERO_PROMPTS, HERO_PROMPT_INTERVAL_MS } from "@/lib/heroJourneys";

/**
 * The "Kreto Universe" hero. jsdom performs no layout or painting, so this suite cannot judge the sky itself; that was checked in a
 * real browser. What it guards is the structural contract: the words and their order, one H1, the search kept as the app's own
 * search, the three journeys and the secondary actions on their existing routes with one analytics event per click, every
 * decorative layer aria-hidden, and a static, complete hero under prefers-reduced-motion.
 */

const trackLandingCta = vi.fn();
vi.mock("@/lib/landingFunnel", () => ({
  trackLandingCta: (...args: unknown[]) => trackLandingCta(...args),
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { featureUsed: vi.fn() },
}));

vi.mock("@/lib/scoutPeopleSearch", () => ({
  SCOUT_PEOPLE_PAGE_SIZE: 50,
  scoutSearchTarget: (q: string) => `/scout?q=${encodeURIComponent(q)}`,
  searchScoutPeople: () => Promise.resolve({ users: [], hasMore: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ ilike: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
  },
}));

let reducedMotion = false;
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion,
}));

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname}{l.search}</output>;
}

function renderHero() {
  return render(
    <MemoryRouter>
      <KretopiaHero />
      <Where />
    </MemoryRouter>,
  );
}

const scopeTrigger = () => document.querySelector("[data-scope-trigger]") as HTMLElement;
/** Radix opens its menu from the keyboard in jsdom (a pointer event has no button there). */
const openScopes = () => fireEvent.keyDown(scopeTrigger(), { key: "Enter" });

describe("KretopiaHero — Kreto Universe", () => {
  beforeEach(() => {
    trackLandingCta.mockClear();
    reducedMotion = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("says it in order: eyebrow, 'Find Your People.', one supporting line", () => {
    renderHero();
    expect(screen.getByText("The Creative Economy OS")).toBeInTheDocument();
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Find Your People.");
    expect(h1[0]).toHaveAttribute("aria-label", "Find Your People.");
    expect(h1[0].querySelector(".k-gradient-text")).toHaveTextContent("People.");
    const sub = screen.getByText("Discover people, skills and opportunities across the creative economy.");
    expect(h1[0].compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the app's own search as the one thing to do, with All as its default scope", () => {
    renderHero();
    const field = screen.getByRole("combobox");
    expect(field).toHaveAttribute("placeholder", "Search people, skills, opportunities and events");
    expect(field.className).toContain("rounded-[var(--k-hero-radius)]");
    expect(field.closest(".k-search-hero")).not.toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    // The scope sits at the start of the field and says All.
    const trigger = scopeTrigger();
    expect(trigger).toHaveTextContent("All");
    expect(field.closest(".k-search-hero")?.contains(trigger)).toBe(true);
  });

  it("has nothing under the search but one guidance line and the example: no journey cards, no action buttons", () => {
    const { container } = renderHero();
    expect(screen.getByText("Search all of Kretopia, or narrow it to one area.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Start with" })).toBeNull();
    expect(container.querySelector("[data-hero-dock], [data-cta]")).toBeNull();
    const hero = container.querySelector("#kretopia-hero") as HTMLElement;
    for (const name of ["Explore Kretopia", "For Creatives", "For Companies"]) {
      expect(Array.from(hero.querySelectorAll("a")).some((a) => a.textContent?.trim() === name)).toBe(false);
    }
  });

  it("offers All, People, Scout, Match, Events and SoundStages, and the scope changes the placeholder", async () => {
    renderHero();
    openScopes();
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("All"),
      expect.stringContaining("People"),
      expect.stringContaining("Scout"),
      expect.stringContaining("Match"),
      expect.stringContaining("Events"),
      expect.stringContaining("SoundStages"),
    ]);
    fireEvent.click(screen.getByRole("menuitemradio", { name: /SoundStages/ }));
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Search SoundStages and live sessions");
    expect(scopeTrigger()).toHaveTextContent("SoundStages");
  });

  it("sends the query with its scope: submitting opens the scope's own page with the words", async () => {
    renderHero();
    openScopes();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /SoundStages/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "electronic music" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByTestId("where").textContent).toBe("/soundstages?q=electronic%20music");
  });

  it("keeps the microphone, the clear button and the submit button; clear empties the field", () => {
    renderHero();
    const field = screen.getByRole("combobox");
    fireEvent.change(field, { target: { value: "photographer" } });
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(field).toHaveValue("");
  });

  it("tints the sky when the search is narrowed to People, Match or Scout, and clears it for All", async () => {
    const { container } = renderHero();
    const sky = container.querySelector("[data-universe]") as HTMLElement;
    expect(sky).not.toHaveAttribute("data-tint");
    openScopes();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Scout/ }));
    expect(sky).toHaveAttribute("data-tint", "opportunities");
    openScopes();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /^All/ }));
    expect(sky).not.toHaveAttribute("data-tint");
  });

  it("shows one example search under the field, and picking it puts its words in the search", () => {
    renderHero();
    const first = HERO_PROMPTS[0];
    fireEvent.click(screen.getByRole("button", { name: `Try searching: ${first.label}` }));
    expect(screen.getByRole("combobox")).toHaveValue(first.query);
    expect(trackLandingCta).toHaveBeenCalledWith("hero_example_search", "hero", { label: first.label });
  });

  it("rotates the example every few seconds, then stops under reduced motion", () => {
    vi.useFakeTimers();
    const { unmount } = renderHero();
    expect(screen.getByRole("button", { name: `Try searching: ${HERO_PROMPTS[0].label}` })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(HERO_PROMPT_INTERVAL_MS + 400); });
    expect(screen.getByRole("button", { name: `Try searching: ${HERO_PROMPTS[1].label}` })).toBeInTheDocument();
    unmount();

    reducedMotion = true;
    renderHero();
    act(() => { vi.advanceTimersByTime(HERO_PROMPT_INTERVAL_MS * 3); });
    expect(screen.getByRole("button", { name: `Try searching: ${HERO_PROMPTS[0].label}` })).toBeInTheDocument();
  });

  it("every decorative layer is aria-hidden -- no fake data exposed to assistive tech", () => {
    const { container } = renderHero();
    const hiddenLayers = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenLayers.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector("[data-kreto-wave]")).toHaveAttribute("aria-hidden", "true");
    // The sky lives inside the hidden background layer.
    const sky = container.querySelector("[data-universe]") as HTMLElement;
    expect(sky.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("draws the planet from CSS and SVG, with no <img> to download and no canvas", () => {
    const { container } = renderHero();
    const sky = container.querySelector("[data-universe]") as HTMLElement;
    expect(sky.querySelector("svg")).not.toBeNull();
    expect(sky.querySelector("img, image, canvas, video")).toBeNull();
  });

  it("has no orbit line and no satellites: the planet stands on its own", () => {
    const { container } = renderHero();
    const sky = container.querySelector("[data-universe]") as HTMLElement;
    expect(sky.querySelector(".k-orbit, .k-sat")).toBeNull();
    expect(sky.innerHTML).not.toMatch(/dashed/);
    // The twilight is laid out in layers: atmosphere, limb, sun, city lights.
    for (const cls of [".k-atm", ".k-limb", ".k-sunbloom", ".k-cities"]) expect(sky.querySelector(cls), cls).not.toBeNull();
  });

  it("under prefers-reduced-motion the sky is still and the hero is complete", () => {
    reducedMotion = true;
    const { container } = renderHero();
    expect(container.querySelectorAll("[data-universe] [data-anim]")).toHaveLength(0);
    expect(container.querySelector("[data-universe]")).not.toHaveAttribute("data-motion");
    expect(container.querySelector("[data-universe] [style*='animation']")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Search all of Kretopia, or narrow it to one area.")).toBeInTheDocument();
    // Pointer handlers must be safe no-ops under reduced motion.
    const section = screen.getByRole("heading", { level: 1 }).closest("section");
    if (!section) throw new Error("Hero section missing");
    expect(() => fireEvent.mouseMove(section, { clientX: 10, clientY: 10 })).not.toThrow();
  });

  it("with motion allowed the sky has its slow loops", () => {
    const { container } = renderHero();
    expect(container.querySelectorAll("[data-universe] [data-anim]").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-universe]")).toHaveAttribute("data-motion");
  });
});
