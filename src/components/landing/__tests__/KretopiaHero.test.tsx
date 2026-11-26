import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KretopiaHero } from "../KretopiaHero";
import { SCOUT_PATH } from "@/lib/opportunityRoutes";
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

function renderHero() {
  return render(
    <MemoryRouter>
      <KretopiaHero />
    </MemoryRouter>,
  );
}

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

  it("keeps the app's own search as the one thing to do, with the requested placeholder", () => {
    renderHero();
    const field = screen.getByRole("combobox");
    expect(field).toHaveAttribute("placeholder", "Search people, skills and opportunities");
    expect(field.className).toContain("rounded-[var(--k-hero-radius)]");
    expect(field.closest(".k-search-hero")).not.toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("offers People, Skills and Opportunities as links to existing routes", () => {
    renderHero();
    const nav = screen.getByRole("navigation", { name: "Start with" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/match?tab=browse&view=grid", "/match", SCOUT_PATH]);
    expect(links.map((a) => a.textContent)).toEqual(["PeoplePassport", "SkillsMatch", "OpportunitiesScout"]);
  });

  it("clicking a journey fires exactly one analytics event naming it", () => {
    renderHero();
    fireEvent.click(screen.getByRole("link", { name: /^Skills/ }));
    expect(trackLandingCta).toHaveBeenCalledTimes(1);
    expect(trackLandingCta).toHaveBeenCalledWith("hero_journey_skills", "hero", { label: "Skills", destination: "Match" });
  });

  it("has three secondary actions, outlined (not the glass CTA), in equal grid tracks, on the navbar's own routes", () => {
    renderHero();
    const labels = ["Explore Kretopia", "For Creatives", "For Companies"];
    const hrefs = ["/discover", "/passport", "/post-opportunity"];
    labels.forEach((label, i) => {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", hrefs[i]);
      expect(link.className).not.toMatch(/\bbtn-glass\b/);
      expect(link.className).toContain("rounded-[var(--k-hero-radius)]");
    });
    const grid = screen.getByRole("link", { name: "For Creatives" }).parentElement as HTMLElement;
    expect(grid.className).toMatch(/\bgrid\b/);
    expect(grid.className).toContain("sm:grid-cols-3");
    // None of them is a primary: the search is.
    expect(document.querySelector('[data-cta="primary"]')).toBeNull();
  });

  it("clicking a secondary action fires exactly one analytics event", () => {
    renderHero();
    fireEvent.click(screen.getByRole("link", { name: "For Companies" }));
    expect(trackLandingCta).toHaveBeenCalledTimes(1);
    expect(trackLandingCta).toHaveBeenCalledWith("hero_for_companies", "hero", { label: "For Companies", variant: "kreto_universe" });
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

  it("draws the sky as SVG, with no image to download", () => {
    const { container } = renderHero();
    const sky = container.querySelector("[data-universe]") as HTMLElement;
    expect(sky.querySelector("svg")).not.toBeNull();
    expect(sky.querySelector("img, image, canvas, video")).toBeNull();
  });

  it("under prefers-reduced-motion the sky is still and the hero is complete", () => {
    reducedMotion = true;
    const { container } = renderHero();
    expect(container.querySelectorAll("[data-universe] [data-anim]")).toHaveLength(0);
    expect(container.querySelector("[data-universe] [style*='animation']")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Kretopia" })).toBeInTheDocument();
    // Pointer handlers must be safe no-ops under reduced motion.
    const section = screen.getByRole("heading", { level: 1 }).closest("section");
    if (!section) throw new Error("Hero section missing");
    expect(() => fireEvent.mouseMove(section, { clientX: 10, clientY: 10 })).not.toThrow();
  });

  it("with motion allowed the sky has its slow loops", () => {
    const { container } = renderHero();
    expect(container.querySelectorAll("[data-universe] [data-anim]").length).toBeGreaterThan(0);
  });
});
