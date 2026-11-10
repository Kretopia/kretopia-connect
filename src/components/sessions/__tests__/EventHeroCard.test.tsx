import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventHeroCard } from "../EventHeroCard";

vi.mock("@/components/brand/KretoScene", () => ({ KretoScene: () => <div data-testid="scene" /> }));

const event = { title: "Studio Night", category: "music", cover_image_url: "https://img.example.com/c.jpg" };

const draw = (props: Partial<Parameters<typeof EventHeroCard>[0]> = {}) =>
  render(<EventHeroCard event={event} hasPass={false} onShare={vi.fn()} onShowGuestPass={vi.fn()} {...props} />);

describe("EventHeroCard: the cover and the name, and nothing the booking block says", () => {
  it("is the page's h1 over the cover, with the category", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Studio Night" })).toHaveAttribute("id", "event-title");
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", "https://img.example.com/c.jpg");
  });

  it("falls back to the brand scene when the cover cannot load, and when there is none", () => {
    const { unmount } = draw();
    fireEvent.error(document.querySelector("img")!);
    expect(screen.getByTestId("scene")).toBeInTheDocument();
    unmount();
    draw({ event: { ...event, cover_image_url: null } });
    expect(screen.getByTestId("scene")).toBeInTheDocument();
  });

  it("states no date, place, price, host, count or booking control: those are said once, in the booking block", () => {
    draw();
    const hero = document.getElementById("hero")!;
    expect(hero.textContent?.trim()).toBe("MoreMusicStudio Night");
    expect(hero.querySelector("[data-booking-cta]")).toBeNull();
    expect(screen.queryByRole("button", { name: /going|waitlist|cancel rsvp|tickets/i })).not.toBeInTheDocument();
    expect(hero).not.toHaveTextContent(/Free|going|Hosted by|Starts in/);
  });

  it("offers Share, and My pass only to someone who has one, and never a second way to cancel", async () => {
    const onShare = vi.fn();
    const onShowGuestPass = vi.fn();
    const { unmount } = draw({ onShare, onShowGuestPass });
    fireEvent.keyDown(screen.getByRole("button", { name: "More event actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Share event" }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: "My pass" })).not.toBeInTheDocument();
    unmount();

    draw({ hasPass: true, onShare, onShowGuestPass });
    fireEvent.keyDown(screen.getByRole("button", { name: "More event actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "My pass" }));
    expect(onShowGuestPass).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: /cancel/i })).not.toBeInTheDocument();
  });
});
