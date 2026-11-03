import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { expectWithinBudget } from "@/test/cardBudget";
import { CardPill } from "@/components/cards/CardShell";
import { ProfileCard, type ProfileCardProps } from "../ProfileCard";

const LONG = "A person with an extremely long name and a very long line about everything they have ever made and where ".repeat(4);

const base = (over: Partial<ProfileCardProps> = {}): ProfileCardProps => ({
  testId: "card",
  name: LONG,
  meta: LONG,
  coverUrl: null,
  avatarUrl: null,
  standing: "Verified",
  badge: <CardPill tone="origin">You</CardPill>,
  bio: LONG,
  tags: ["Lighting", "Sound", "Colour", "Editing", "Grip", "Gaffer"].map((t) => <CardPill key={t}>{t}</CardPill>),
  reasons: [1, 2, 3, 4, 5].map((n) => ({ key: `r${n}`, label: `Reason number ${n}` })),
  open: { onClick: vi.fn() },
  primary: { label: "View Passport", onClick: vi.fn() },
  secondary: { icon: <MessageCircle aria-hidden />, label: "Message", onClick: vi.fn() },
  ...over,
});

const renderCard = (props: Partial<ProfileCardProps> = {}) => render(<MemoryRouter><ProfileCard {...base(props)} /></MemoryRouter>);

describe("the profile card keeps to the card budget", () => {
  it("whatever a person has filled in", () => {
    renderCard();
    expectWithinBudget(screen.getByTestId("card"));
  });

  it("draws three skills, and lists every reason it was given, in order, under the person's name", () => {
    renderCard({ name: "Ava Chen" });
    const card = screen.getByTestId("card");
    expect(card.querySelector('[data-card-part="tags"]')!.children).toHaveLength(3);
    const reasons = within(card).getByRole("list", { name: "Why Ava Chen is suggested" });
    expect(within(reasons).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Reason number 1", "Reason number 2", "Reason number 3", "Reason number 4", "Reason number 5"]);
  });

  it("invents no reason: no list at all when there is none", () => {
    renderCard({ reasons: [] });
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("is one target: the whole card opens the Passport; the primary and the secondary do their own thing", () => {
    const open = vi.fn();
    const message = vi.fn();
    const primary = vi.fn();
    renderCard({ name: "Ava Chen", open: { onClick: open }, primary: { label: "View Passport", onClick: primary }, secondary: { icon: <MessageCircle aria-hidden />, label: "Message Ava", onClick: message } });
    fireEvent.click(screen.getByRole("button", { name: "Ava Chen" }));
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Message Ava" }));
    expect(message).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /View Passport/ }));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("wears their picture, falls back to Kreto's scene when it will not load, and shows an initial for the avatar", () => {
    const { container } = renderCard({ name: "ava", coverUrl: "https://cdn.example/ava.jpg", avatarUrl: null });
    const cover = container.querySelector('[data-card-part="cover"]')!;
    const img = cover.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://cdn.example/ava.jpg");
    fireEvent.error(img);
    expect(cover.querySelector('img[src="https://cdn.example/ava.jpg"]')).toBeNull();
    expect(cover).toHaveTextContent("A");
  });

  it("disables an action that is waiting for an answer", () => {
    renderCard({ primary: { label: "Match", onClick: vi.fn(), disabled: true }, secondary: { icon: <MessageCircle aria-hidden />, label: "Pass", onClick: vi.fn(), disabled: true } });
    expect(screen.getByRole("button", { name: /Match/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pass" })).toBeDisabled();
  });
});
