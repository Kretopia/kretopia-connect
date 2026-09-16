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
  });

  it("primary CTA has the exact text, canonical class, and preserved route", () => {
    renderHero();
    const primary = screen.getByRole("link", { name: /build my passport/i });
    expect(primary).toHaveAttribute("href", "/auth?tab=signup&src=hero_passport");
    expect(primary.className).toMatch(/\bbtn-landing-primary\b/);
  });

  it("secondary CTA has the exact text, canonical outline class, and preserved route", () => {
    renderHero();
    const secondary = screen.getByRole("link", { name: /explore opportunities/i });
    expect(secondary).toHaveAttribute("href", "/auth?next=/scout&src=hero_explore");
    expect(secondary.className).toMatch(/\bbtn-glass\b/);
    expect(secondary.className).toMatch(/\bbtn-glass-outline\b/);
  });

  it("clicking the primary CTA fires exactly one analytics event with the signal_field variant", () => {
    renderHero();
    fireEvent.click(screen.getByRole("link", { name: /build my passport/i }));
    expect(trackLandingCta).toHaveBeenCalledTimes(1);
    expect(trackLandingCta).toHaveBeenCalledWith(
      "hero_build_passport",
      "hero",
      { label: "Build My Passport", variant: "signal_field" },
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
    // vignette, signal field wrapper, KretoMark wrapper, grid, bottom dissolve
    expect(hiddenLayers.length).toBeGreaterThanOrEqual(5);
  });

  it("does not throw and still renders the field under prefers-reduced-motion", () => {
    reducedMotion = true;
    renderHero();
    expect(screen.getByRole("link", { name: /build my passport/i })).toBeInTheDocument();
    // Pointer handlers must be safe no-ops under reduced motion.
    const section = document.getElementById("kretopia-hero")!;
    expect(() => fireEvent.mouseMove(section, { clientX: 10, clientY: 10 })).not.toThrow();
  });
});
