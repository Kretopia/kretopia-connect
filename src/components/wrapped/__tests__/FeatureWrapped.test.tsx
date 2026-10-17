import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeatureWrapped } from "../FeatureWrapped";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { SceneBanner } from "@/components/brand/SceneBanner";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("@/components/features/FeatureAITutorial", () => ({ FeatureAITutorial: () => null }));

describe("FeatureWrapped", () => {
  it("puts a feature's body on a panel named for it, with Kretopia's lockup at the foot", () => {
    const { container } = render(
      <FeatureWrapped name="Founding Circle">
        <p>body</p>
      </FeatureWrapped>,
    );
    const region = screen.getByRole("region", { name: /Everything in Founding Circle/ });
    expect(within(region).getByText("Kretopia · Founding Circle")).toBeInTheDocument();
    expect(within(region).getByText("body")).toBeInTheDocument();
    expect(container.querySelector('footer img[alt="Kretopia"]')).toBeInTheDocument();
  });

  it("draws no status line unless it is given a true one", () => {
    const { container, rerender } = render(<FeatureWrapped name="Perks"><p>x</p></FeatureWrapped>);
    expect(container.querySelector("header p + h2 + p")).toBeNull();
    rerender(<FeatureWrapped name="Perks" status="3 tiers"><p>x</p></FeatureWrapped>);
    expect(screen.getByText("3 tiers")).toBeInTheDocument();
  });
});

describe("StudioFeatureShell wrapped", () => {
  it("is the same container as before, with the children on the panel", () => {
    const { container } = render(
      <StudioFeatureShell wrapped={{ name: "Match" }}>
        <p>tabs</p>
      </StudioFeatureShell>,
    );
    expect(container.firstElementChild?.className).toContain("max-w-6xl");
    expect(screen.getByRole("region", { name: /Everything in Match/ })).toContainElement(screen.getByText("tabs"));
  });

  it("without the prop it renders its children exactly as before", () => {
    render(
      <StudioFeatureShell>
        <p>tabs</p>
      </StudioFeatureShell>,
    );
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("header card width", () => {
  it("the split banner is signed with the lockup and the feature's name", () => {
    const { container } = render(<SceneBanner scene="match" label="Match" layout="split" />);
    expect(container.querySelector('img[alt="Kretopia"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="scenes/match"]')).toBeInTheDocument();
    expect(screen.getAllByText(/Match/).length).toBeGreaterThan(0);
  });

  it("the header's scene card sits in the same max-w-6xl, px-4 container as the page body", () => {
    const { container } = render(<FeaturePageHeader eyebrow="Stages" title="Live" subtitle="x" scene="soundstages" />);
    const banner = container.querySelector('img[src*="scenes/soundstages"]')!.closest(".max-w-6xl");
    expect(banner).not.toBeNull();
    expect(banner!.className).toContain("px-4");
    expect(banner!.className).toContain("mx-auto");
  });
});
