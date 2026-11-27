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

  it("says it in order: eyebrow, 'Find Your People.', subheading, search, supporting line, one CTA, one company link", () => {
    renderHero();
    expect(screen.getByText("The Creative Economy OS")).toBeInTheDocument();
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Find Your People.");
    expect(h1[0]).toHaveAttribute("aria-label", "Find Your People.");
    const sub = screen.getByText("Find paid work, meet collaborators and hire creative talent for your next project.");
    const field = screen.getByRole("combobox");
    const support = screen.getByText("Your work, experience and creative credits. One shareable profile.");
    const cta = screen.getByRole("link", { name: "Create your free Passport" });
    const company = screen.getByRole("link", { name: "Hiring? Post an opportunity free." });
    const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(h1[0], sub)).toBe(true);
    expect(follows(sub, field)).toBe(true);
    expect(follows(field, support)).toBe(true);
    expect(follows(support, cta)).toBe(true);
    expect(follows(cta, company)).toBe(true);
  });

  it("'People.' wears the page's own gradient class, with nothing of its own added to the gradient", () => {
    renderHero();
    const word = screen.getByRole("heading", { level: 1 }).querySelector(".k-gradient-text") as HTMLElement;
    expect(word).toHaveTextContent("People.");
    const style = word.getAttribute("style") ?? "";
    for (const own of ["gradient", "background", "animation"]) expect(style).not.toContain(own);
  });

  it("the CTA and the company link go to the sign-up and to Post an opportunity, one analytics event each", () => {
    renderHero();
    const cta = screen.getByRole("link", { name: "Create your free Passport" });
    expect(cta).toHaveAttribute("href", "/auth?tab=signup");
    fireEvent.click(cta);
    expect(trackLandingCta).toHaveBeenLastCalledWith("hero_create_passport", "hero", { label: "Create your free Passport" });
    const company = screen.getByRole("link", { name: "Hiring? Post an opportunity free." });
    expect(company).toHaveAttribute("href", "/post-opportunity");
    fireEvent.click(company);
    expect(trackLandingCta).toHaveBeenLastCalledWith("hero_post_opportunity", "hero", { label: "Hiring? Post an opportunity free." });
    expect(trackLandingCta).toHaveBeenCalledTimes(2);
  });

  it("keeps the app's own search with the requested placeholder and a Search button", () => {
    renderHero();
    const field = screen.getByRole("combobox");
    expect(field).toHaveAttribute("placeholder", "Search creatives, skills or opportunities…");
    expect(field.className).toContain("rounded-[var(--k-hero-radius)]");
    expect(field.closest(".k-search-hero")).not.toBeNull();
    const submit = field.closest("form")?.querySelector('button[type="submit"]') as HTMLElement;
    expect(submit).toHaveTextContent("Search");
    expect(submit).toHaveAttribute("aria-label", "Search");
  });

  it("shows four compact topic labels on the bar, All first and selected, and nothing else about what to search", () => {
    const { container } = renderHero();
    const group = screen.getByRole("radiogroup", { name: "Search topic" });
    const radios = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(radios.map((r) => r.textContent)).toEqual(["All", "Scouts", "People", "Match"]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios.slice(1).every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
    // The labels belong to the search bar: same wrapper as the field.
    expect(group.parentElement?.contains(screen.getByRole("combobox"))).toBe(true);
    // No events or SoundStages promotion, no cards, no explanatory paragraph under the field.
    const hero = container.querySelector("#kretopia-hero") as HTMLElement;
    expect(hero.textContent).not.toMatch(/SoundStages|Sound Stages|Events/);
    expect(screen.queryByText("Search all of Kretopia, or narrow it to one area.")).toBeNull();
    expect(container.querySelector("[data-hero-dock]")).toBeNull();
  });

  it("choosing a topic selects it; for a guest, Search keeps them here with the sign-up prompt and does not leave", () => {
    renderHero();
    fireEvent.click(document.querySelector('[data-scope-pill="scout"]') as HTMLElement);
    expect(document.querySelector('[data-scope-pill="scout"]')).toHaveAttribute("aria-checked", "true");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "photographer" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(screen.getByText("Sign up free to view full results.")).toBeInTheDocument();
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

  it("tints the sky when the search is narrowed to Scouts, People or Match, and clears it for All", () => {
    const { container } = renderHero();
    const sky = container.querySelector("[data-universe]") as HTMLElement;
    expect(sky).not.toHaveAttribute("data-tint");
    fireEvent.click(document.querySelector('[data-scope-pill="scout"]') as HTMLElement);
    expect(sky).toHaveAttribute("data-tint", "opportunities");
    fireEvent.click(document.querySelector('[data-scope-pill="all"]') as HTMLElement);
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
    expect(screen.getByRole("link", { name: "Create your free Passport" })).toBeInTheDocument();
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
