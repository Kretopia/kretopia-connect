import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectWithinBudget } from "@/test/cardBudget";
import { AchievementCard, type AchievementCardProps } from "../AchievementCard";

const LONG = "An extremely long credit title for a very long-running series that has had many seasons and many crews ".repeat(4);

const base = (over: Partial<AchievementCardProps> = {}): AchievementCardProps => ({
  variant: "credit",
  title: LONG,
  subtitle: LONG,
  description: LONG,
  year: 2025,
  url: "https://example.com/work",
  verificationStatus: "unverified",
  endorsementCount: 0,
  isFeatured: true,
  isOwnProfile: true,
  onDelete: vi.fn(),
  onRequestEndorsement: vi.fn(),
  onCardClick: vi.fn(),
  metadata: { Platform: "Netflix", Format: "Series", Territory: "UK", Language: "English", Runtime: "52 min" },
  category: "film",
  ...over,
});

const renderCard = (props: Partial<AchievementCardProps> = {}) => render(<AchievementCard {...base(props)} />);

describe("the credit card keeps to the card budget", () => {
  it("whatever the credit holds, on a credit and on an award", () => {
    const credit = renderCard();
    expectWithinBudget(credit.container);
    credit.unmount();
    const award = renderCard({ variant: "award", title: "Winner, best editing" });
    expectWithinBudget(award.container);
  });

  it("draws three facts at most", () => {
    const { container } = renderCard();
    const tags = container.querySelector('[data-card-part="tags"]')!;
    expect(tags.children).toHaveLength(3);
    expect(tags).toHaveTextContent("Netflix");
    expect(tags).toHaveTextContent("UK"); // the third
    expect(tags).not.toHaveTextContent("English"); // the fourth is not drawn
  });

  it("keeps how far the credit can be trusted on the front, whatever else is cut", () => {
    const { container } = renderCard({ verificationStatus: "verified", endorsementCount: 2, source: "IMDb" });
    const trust = container.querySelector('[data-card-part="trust"]')!;
    expect(trust).toHaveTextContent("Verified");
  });

  it("has one primary (ask for verification) and one secondary (delete) on your own unverified credit", () => {
    const onRequestEndorsement = vi.fn();
    const onDelete = vi.fn();
    const { container } = renderCard({ onRequestEndorsement, onDelete });
    fireEvent.click(screen.getByRole("button", { name: /Request verify/ }));
    expect(onRequestEndorsement).toHaveBeenCalledTimes(1);
    const footer = container.querySelector('[data-card-part="footer"]')!;
    expect(footer.querySelectorAll("a, button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^Delete / }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("offers no verification request once verified, and no delete on someone else's credit", () => {
    const { container } = renderCard({ verificationStatus: "verified", isOwnProfile: false });
    expect(screen.queryByRole("button", { name: /Request verify/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete / })).toBeNull();
    expectWithinBudget(container);
  });

  it("opens the media in place when it can, and the project's link beside it; otherwise the title is the link", () => {
    const onCardClick = vi.fn();
    const first = renderCard({ onCardClick, isOwnProfile: false });
    expect(screen.getByRole("link", { name: /Open .* in a new tab/ })).toHaveAttribute("href", "https://example.com/work");
    fireEvent.click(first.container.querySelector('[data-card-part="title"]')!);
    expect(onCardClick).toHaveBeenCalledTimes(1);
    first.unmount();
    renderCard({ onCardClick: undefined, isOwnProfile: false });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com/work");
  });
});
