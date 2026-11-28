import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { MatchStateCard } from "../MatchStateCard";
import { MATCH_WAIT_STEPS, MATCH_WAIT_TIPS } from "../matchWaiting";

const renderCard = (props: React.ComponentProps<typeof MatchStateCard> = {}) => render(<MemoryRouter><MatchStateCard {...props} /></MemoryRouter>);

describe("the Match card for every moment that is not a profile", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is a complete Kretopia card: the brand, a Match chip, the scene, a message and the footer", () => {
    const { container } = renderCard({ title: "Finding your people", description: "Discovering real Kretopia profiles.", busy: true });
    const card = screen.getByRole("article", { name: "Finding your people" });
    expect(card.querySelector("header")).toHaveTextContent("kretopia");
    expect(card.querySelector("header")).toHaveTextContent("Match");
    expect(container.querySelector("[data-match-scene]")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Finding your people" })).toHaveClass("k-gradient-text");
    expect(screen.getByText("Discovering real Kretopia profiles.")).toBeVisible();
    expect(screen.getByText("People. Possibilities.")).toBeVisible();
  });

  it("the scene is decorative and keeps the footprint of a profile", () => {
    const { container } = renderCard({ busy: true });
    expect(container.querySelector("[data-match-scene]")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".k-match-stage")?.className).toContain("max-w-[460px]");
    expect(screen.getByRole("article", { name: "Kretopia Match" })).toBeInTheDocument();
  });

  it("while loading, three steps come together one after the other, and the card is busy for assistive technology", () => {
    const { container } = renderCard({ busy: true });
    expect(container.querySelector("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    for (const step of MATCH_WAIT_STEPS) expect(screen.getByText(step)).toBeInTheDocument();
    const current = () => Array.from(container.querySelectorAll("[data-match-progress] li")).findIndex((li) => li.className.includes("font-semibold"));
    expect(current()).toBe(0);
    act(() => { vi.advanceTimersByTime(1900); });
    expect(current()).toBe(1);
    act(() => { vi.advanceTimersByTime(1900); });
    expect(current()).toBe(2);
  });

  it("shows one true tip at a time and moves on", () => {
    const { container } = renderCard({ busy: true });
    const tip = () => container.querySelector("[data-match-tip]")?.textContent;
    expect(tip()).toBe(MATCH_WAIT_TIPS[0]);
    act(() => { vi.advanceTimersByTime(4200); });
    expect(tip()).toBe(MATCH_WAIT_TIPS[1]);
  });

  it("every tip is a rule of the deck, not a promise about who will appear", () => {
    for (const tip of MATCH_WAIT_TIPS) expect(tip).not.toMatch(/\\b(soon|guarantee|best match|perfect)\\b/i);
    expect(MATCH_WAIT_TIPS.join(" ")).toMatch(/mutual match/);
  });

  it("without a task in hand it shows no progress, and keeps the actions it is given", () => {
    const { container } = renderCard({ title: "Sign in to get your deck", children: <button type="button">Sign in</button> });
    expect(container.querySelector("[data-match-progress]")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(container.querySelector("[aria-busy]")).toHaveAttribute("aria-busy", "false");
  });
});
