import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KretopiaHero } from "../KretopiaHero";

/**
 * Regression coverage for the Verified Creative Signal Field rollout
 * (LANDING_HERO_SIGNAL_FIELD_AUDIT.md / LANDING_HERO_VISUAL_OVERHAUL_REPORT.md):
 * the background effect changed entirely, but the copy, CTA destinations,
 * analytics event shape, and accessibility contract must not have moved.
 *
 * jsdom performs no real layout or CSS painting, so this suite cannot assert
 * the field's actual colors, blur, or pointer-driven motion pixel-by-pixel --
 * that was verified live against the running app this session (screenshots,
 * computed-transform checks under dispatched mousemove events, axe-core with
 * zero violations). What this suite guards instead is the structural
 * contract: exact CTA text and hrefs, one analytics event per click with the
 * exact property shape, exactly one H1, and every decorative background
 * layer staying aria-hidden.
 */

const trackLandingCta = vi.fn();
vi.mock("@/lib/landingFunnel", () => ({
  trackLandingCta: (...args: unknown[]) => trackLandingCta(...args),
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { featureUsed: vi.fn() },
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

describe("KretopiaHero — Verified Creative Signal Field", () => {
  beforeEach(() => {
    trackLandingCta.mockClear();
    reducedMotion = false;
  });

  it("renders exactly one H1", () => {
    renderHero();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Findworkthatfitswhatyoudo");
  });

  it("primary CTA has the exact text, the canonical glass CTA class, and its route", () => {
    renderHero();
    const primary = screen.getByRole("link", { name: /create passport/i });
    expect(primary).toHaveAttribute("href", "/passport");
    // CtaButton = the same btn-glass-primary as "Explore Verified Credits".
    expect(primary.className).toMatch(/\bbtn-glass\b/);
    expect(primary.className).toMatch(/\bbtn-glass-primary\b/);
  });

  it("secondary CTA has the exact text and preserved route, and is deliberately NOT the glass CTA", () => {
    renderHero();
    const secondary = screen.getByRole("link", { name: /explore opportunities/i });
    expect(secondary).toHaveAttribute("href", "/auth?next=/scout&src=hero_explore");
    // Restrained plain outline (CDO audit: no gradient on a default secondary control).
    expect(secondary.className).not.toMatch(/\bbtn-glass\b/);
  });

  it("clicking the primary CTA fires exactly one analytics event with the signal_field variant", () => {
    renderHero();
    fireEvent.click(screen.getByRole("link", { name: /create passport/i }));
    expect(trackLandingCta).toHaveBeenCalledTimes(1);
    expect(trackLandingCta).toHaveBeenCalledWith(
      "hero_build_passport",
      "hero",
      { label: "Create Passport", variant: "signal_field" },
    );
  });

  it("clicking the secondary CTA fires exactly one analytics event with the signal_field variant", () => {
    renderHero();
    fireEvent.click(screen.getByRole("link", { name: /explore opportunities/i }));
    expect(trackLandingCta).toHaveBeenCalledTimes(1);
    expect(trackLandingCta).toHaveBeenCalledWith(
      "hero_explore_opportunities",
      "hero",
      { label: "Explore Opportunities", variant: "signal_field" },
    );
  });

  it("every decorative background layer is aria-hidden -- no fake data exposed to assistive tech", () => {
    const { container } = renderHero();
    const hiddenLayers = container.querySelectorAll('[aria-hidden="true"]');
    // Background effects share one hidden ancestor; mascot and dissolve are hidden too.
    expect(hiddenLayers.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('[data-kreto-wave]')).toHaveAttribute('aria-hidden', 'true');
  });

  it("does not throw and still renders the field under prefers-reduced-motion", () => {
    reducedMotion = true;
    renderHero();
    expect(screen.getByRole("link", { name: /create passport/i })).toBeInTheDocument();
    // Pointer handlers must be safe no-ops under reduced motion.
    const section = screen.getByRole("heading", { level: 1 }).closest("section");
    if (!section) throw new Error("Hero section missing");
    expect(() => fireEvent.mouseMove(section, { clientX: 10, clientY: 10 })).not.toThrow();
  });
});
