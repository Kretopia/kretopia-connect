import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { FeaturePageHeader } from "../FeaturePageHeader";

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("../FeatureAITutorial", () => ({ FeatureAITutorial: () => <button type="button">How it works</button> }));

const renderHeader = (scene?: "krepay" | "match") =>
  render(
    <MemoryRouter>
      <FeaturePageHeader eyebrow="Pay" title="Get paid" accentTitle="on time." subtitle="One place for the money." scene={scene} />
    </MemoryRouter>,
  );

describe("FeaturePageHeader scene", () => {
  it("omits the Company mode sticker while preserving the feature heading", () => {
    render(<MemoryRouter><FeaturePageHeader company eyebrow="Gigs" title="Gigs" accentTitle="Hire your team" subtitle="Your listings." /></MemoryRouter>);
    expect(screen.queryByText("Company mode")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
  it("keeps the centered tutorial without a Company sticker", () => {
    render(<MemoryRouter><FeaturePageHeader company eyebrow="Pay" title="Pay your team" subtitle="Keep work moving" scene="krepay" tutorial={{ featureKey: "krepay-brand", label: "How KrePay works", steps: [] }} /></MemoryRouter>);
    expect(screen.queryByText("Company mode")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByText("Kretopia · Pay")).toBeInTheDocument();
  });
  it("shows Kreto in the feature's expression, signed Kretopia and named for the feature", () => {
    const { container } = renderHeader("krepay");
    expect(container.querySelector('img[src*="scenes/krepay"]')).toBeInTheDocument();
    expect(screen.getByText("Kretopia · Pay")).toBeInTheDocument();
  });

  it("draws nothing extra without a scene", () => {
    const { container } = renderHeader();
    expect(container.querySelector('img[src*="scenes/"]')).toBeNull();
    expect(screen.queryByText("Kretopia · Pay")).not.toBeInTheDocument();
  });

  it("keeps the heading, which is still the page's one h1", () => {
    renderHeader("match");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Get paid on time.");
  });
});
