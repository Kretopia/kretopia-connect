import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));
vi.mock("@/components/brand/KretoScene", () => ({ KretoScene: () => <span aria-hidden /> }));
import { MatchProfileCard } from "../MatchProfileCard";
import { MatchPulse } from "../MatchPulse";
import type { SwipeProfile } from "@/hooks/useSwipeProfiles";
const profile = { user_id: "creator", full_name: "Ava Chen", role: "Designer", bio: "Product designer", avatar_url: null, cover_image_url: null, professional_skills: ["UX"], location: "Bali" } as SwipeProfile;

describe("Match discovery controls", () => {
  it("flips both ways without expressing interest, passing or opening another profile", () => {
    const like = vi.fn(), pass = vi.fn(), open = vi.fn();
    render(<MemoryRouter><MatchProfileCard profile={profile} busy={false} onLike={like} onPass={pass} onViewProfile={open} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Quick look" }));
    expect(screen.getByRole("group", { name: "Ava Chen: profile details" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Flip back" }));
    expect(screen.getByRole("button", { name: "Quick look" })).toBeVisible();
    expect(like).not.toHaveBeenCalled(); expect(pass).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  });
  it("uses the exact selected profile and prevents actions while saving", () => {
    const like = vi.fn(), pass = vi.fn();
    const { rerender } = render(<MemoryRouter><MatchProfileCard profile={profile} busy={false} onLike={like} onPass={pass} onViewProfile={vi.fn()} /></MemoryRouter>);
    fireEvent.keyDown(screen.getByRole("group", { name: "Discover Ava Chen" }), { key: "ArrowRight" });
    expect(like).toHaveBeenCalledWith(profile, { type: "profile", label: "their profile" });
    rerender(<MemoryRouter><MatchProfileCard profile={profile} busy onLike={like} onPass={pass} onViewProfile={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(pass).not.toHaveBeenCalled();
  });
  it("uses both original photo URLs and reveals all supplied profile skills", () => {
    const detailed = { ...profile, avatar_url: '/original-portrait.jpg', cover_image_url: '/original-cover.jpg', professional_skills: ['UX', 'Research', 'Prototyping', 'Accessibility'], passion_skills: ['Photography'], level: 12, credits_count: 7, awards_count: 2 };
    render(<MemoryRouter><MatchProfileCard profile={detailed} busy={false} onLike={vi.fn()} onPass={vi.fn()} onViewProfile={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('img', { name: 'Ava Chen, photo 1' })).toHaveAttribute('src', '/original-portrait.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('img', { name: 'Ava Chen, photo 2' })).toHaveAttribute('src', '/original-cover.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Quick look' }));
    const details = screen.getByRole('group', { name: 'Ava Chen: profile details' });
    expect(details).toHaveTextContent(/accessibility/i); expect(details).toHaveTextContent(/photography/i);
    expect(details).toHaveTextContent('Credits7'); expect(details).toHaveTextContent('Awards2');
  });
  it("dispatches one Match scan, disables repeats and allows retry after a real error", () => {
    const listener = vi.fn(); window.addEventListener("match:scan", listener);
    render(<MemoryRouter><MatchPulse /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Scan now" }));
    fireEvent.click(screen.getByRole("button", { name: "Scanning creators…" }));
    expect(listener).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new CustomEvent("match:scanned", { detail: { count: 0, error: "unavailable" } })); });
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByText("Scan unavailable")).toBeVisible();
    window.removeEventListener("match:scan", listener);
  });
});