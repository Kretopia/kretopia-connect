import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PulseGlassCtaButton } from "../pulse-glass-cta";
import { ScoutScanButton } from "@/components/scout/ScoutScanButton";

// One pulse for a surface's main action (Scout's Scan now, Studio's Open a New Room): decoration that never changes
// the button's name or role, and that the stylesheet animates only when the person has not asked for reduced motion.
describe("PulseGlassCtaButton", () => {
  it("keeps the label as the button's name and hides every decoration", () => {
    const onClick = vi.fn();
    const { container } = render(<PulseGlassCtaButton onClick={onClick}>Open a New Room</PulseGlassCtaButton>);
    const button = screen.getByRole("button", { name: "Open a New Room" });
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    const decorations = container.querySelectorAll(".k-pulse-cta-ring, .k-pulse-cta-sheen, .k-pulse-cta-beam");
    expect(decorations).toHaveLength(4);
    decorations.forEach((d) => expect(d).toHaveAttribute("aria-hidden"));
    expect(container.querySelector(".k-pulse-cta")).toHaveAttribute("data-busy", "false");
  });

  it("Scout's Scan now is this button, busy while a scan runs", () => {
    const { container } = render(<ScoutScanButton label="Scanning" busy onClick={() => {}} />);
    const button = screen.getByRole("button", { name: /Scanning/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".k-pulse-cta")).toHaveAttribute("data-busy", "true");
  });

  it("animates only under prefers-reduced-motion: no-preference, and the old Scout-only rules are gone", () => {
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    expect(css).not.toContain("scout-scan");
    const animated = [...css.matchAll(/\.k-pulse-cta[\w-]*[^{]*\{[^}]*animation:/g)];
    expect(animated.length).toBeGreaterThan(0);
    const motionBlock = css.indexOf("@media (prefers-reduced-motion: no-preference)", css.indexOf(".k-pulse-cta-ring"));
    for (const m of animated) expect(m.index!).toBeGreaterThan(motionBlock);
  });
});
