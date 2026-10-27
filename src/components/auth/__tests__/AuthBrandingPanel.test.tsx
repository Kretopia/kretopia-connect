import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";

const renderPanel = () =>
  render(
    <MemoryRouter>
      <AuthBrandingPanel />
    </MemoryRouter>,
  );

describe("the Auth page's left panel", () => {
  it("is one landmark, named for what it is", () => {
    renderPanel();
    expect(screen.getByRole("complementary", { name: "Welcome to Kretopia" })).toBeInTheDocument();
  });

  it("carries the Kretopia promise: lockup linking home, the headline with its gradient word, the plan", () => {
    renderPanel();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Where creativity lives.");
    expect(screen.getByText("lives.")).toHaveClass("k-gradient-text");
    expect(screen.getByText("The Creative Economy OS")).toBeInTheDocument();
    expect(screen.getByText(/One Passport\. Every credit\. Every opportunity\./)).toBeInTheDocument();
    expect(screen.getByText("60-second setup · No credit card · Free forever to start")).toBeInTheDocument();
    expect(screen.getByText("Kretopia · by Thrive Collective")).toBeInTheDocument();
  });

  it("lists the four steps from a name to being found, in order", () => {
    renderPanel();
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((li) => li.querySelector("p")?.textContent)).toEqual([
      "Sign up in 30 seconds",
      "We find your work",
      "Claim your first Stamp",
      "Get discovered",
    ]);
  });

  it("keeps Kreto's promise in one banner: the scene is decorative, the quote is real text", () => {
    renderPanel();
    const banner = screen.getByRole("figure");
    expect(banner.querySelector("img")).toHaveAttribute("aria-hidden", "true");
    expect(within(banner).getByText(/I’ll line up your first three opportunities the moment you sign in\./)).toBeInTheDocument();
  });

  it("is exactly one screen tall and never a scroll container", () => {
    renderPanel();
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("lg:h-screen");
    expect(panel.className).toContain("lg:sticky");
    expect(panel.className).toContain("overflow-clip");
    expect(panel.className).not.toMatch(/overflow-(y-)?(auto|scroll|hidden)/);
  });

  it("gives up what does not fit by height, in this order: banner, descriptions, paragraph, steps", () => {
    renderPanel();
    const banner = screen.getByRole("figure");
    const paragraph = screen.getByText(/One Passport\./);
    const description = screen.getByText("Just your name. Kreto takes it from there.");
    const steps = screen.getByRole("list").parentElement as HTMLElement;
    expect(banner.className).toContain("[@media(max-height:899px)]:hidden");
    expect(description.className).toContain("[@media(max-height:719px)]:hidden");
    expect(paragraph.className).toContain("[@media(max-height:679px)]:hidden");
    expect(steps.className).toContain("[@media(max-height:599px)]:hidden");
  });

  it("never gives up the lockup, the headline or the promise at any height", () => {
    renderPanel();
    for (const el of [screen.getByRole("heading", { level: 2 }), screen.getByText(/60-second setup/), screen.getByText("The Creative Economy OS")]) {
      expect(el.className).not.toMatch(/max-height/);
    }
  });
});
