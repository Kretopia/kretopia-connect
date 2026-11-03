import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Mic } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { expectWithinBudget } from "@/test/cardBudget";
import { EventCard, type EventCardProps } from "../EventCard";
import { StageCard, type StageCardData } from "../StageCard";

const LONG = "An open-air showcase of new work from many people across several cities and many different crafts, hosted by a very patient host ".repeat(3);

const base = (over: Partial<EventCardProps> = {}): EventCardProps => ({
  testId: "card",
  title: LONG,
  coverUrl: null,
  kindLabel: "Showcase",
  kindIcon: <Mic aria-hidden />,
  live: true,
  host: { name: LONG, avatarUrl: null },
  when: "Live now",
  attendance: "12/40",
  note: LONG,
  open: { onClick: vi.fn() },
  primary: { label: "Join Stage", onClick: vi.fn() },
  ...over,
});

const renderCard = (props: Partial<EventCardProps> = {}) => render(<MemoryRouter><EventCard {...base(props)} /></MemoryRouter>);

describe("the event card keeps to the card budget", () => {
  it("whatever the event holds", () => {
    renderCard();
    expectWithinBudget(screen.getByTestId("card"));
  });

  it("says Live in words, with the kind of event, and draws when and how many as its facts", () => {
    renderCard({ title: "Friday showcase", host: { name: "@ava", avatarUrl: null } });
    const card = screen.getByTestId("card");
    expect(card.querySelector('[data-card-part="cover"]')).toHaveTextContent("Live");
    expect(card.querySelector('[data-card-part="cover"]')).toHaveTextContent("Showcase");
    expect(card.querySelector('[data-card-part="meta"]')).toHaveTextContent("Host: @ava");
    const tags = card.querySelector('[data-card-part="tags"]')!;
    expect(tags.children).toHaveLength(2);
    expect(tags).toHaveTextContent("Live now");
    expect(tags).toHaveTextContent("12/40");
  });

  it("is not live unless it is: no badge, and nothing made up for a missing host or count", () => {
    const { container } = renderCard({ live: false, host: null, attendance: null, note: null, when: "Fri, Nov 6 · 7:00PM" });
    expect(container.querySelector('[data-card-part="cover"]')).not.toHaveTextContent("Live");
    expect(container.querySelector('[data-card-part="meta"]')).toBeNull();
    expect(container.querySelector('[data-card-part="description"]')).toBeNull();
    expect(container.querySelector('[data-card-part="tags"]')!.children).toHaveLength(1);
  });

  it("wears its picture, or Kreto's Sound Stages scene when it has none", () => {
    const { container, rerender } = renderCard({ coverUrl: "https://cdn.example/stage.jpg" });
    expect(container.querySelector('[data-card-part="cover"] img')).toHaveAttribute("src", "https://cdn.example/stage.jpg");
    rerender(<MemoryRouter><EventCard {...base({ coverUrl: null })} /></MemoryRouter>);
    expect(container.querySelector('[data-card-part="cover"] img')!.getAttribute("src")).toContain("soundstages");
  });
});

describe("the Stage card is an event card with the Stage's own words", () => {
  const stage = (over: Partial<StageCardData> = {}): StageCardData => ({
    id: "s1", title: "Late set", coverUrl: null, hostName: "@kai", hostAvatarUrl: null, status: "live", when: new Date().toISOString(),
    participantCount: 7, capacity: null, kind: "sound_stage", mode: "audio", ...over,
  });

  it("offers to join a live Stage and to save a place at an upcoming one, and hands the Stage to the caller either way", () => {
    const onAction = vi.fn();
    const live = render(<MemoryRouter><StageCard stage={stage()} onAction={onAction} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Join Stage" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    live.unmount();
    render(<MemoryRouter><StageCard stage={stage({ status: "upcoming", when: new Date(Date.now() + 3 * 86_400_000).toISOString(), kind: "curated_stage", curatedType: "scout", participantCount: 5, capacity: 20 })} onAction={onAction} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Save your place" })).toBeInTheDocument();
    expect(screen.getByText("Scout Stage")).toBeInTheDocument();
    expect(screen.getByText("5/20")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save your place" }));
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("names what the card does for assistive technology once: action, title, kind and time", () => {
    render(<MemoryRouter><StageCard stage={stage()} onAction={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Join Stage — Late set, Sound Stage, Live now" })).toBeInTheDocument();
  });
});
