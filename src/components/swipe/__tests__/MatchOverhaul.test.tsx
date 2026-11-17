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
  it("shows the Passport directly with only Pass and Connect, without an eye, preview or flip", () => {
    const like = vi.fn(), pass = vi.fn();
    render(<MemoryRouter><MatchProfileCard profile={profile} busy={false} onLike={like} onPass={pass} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Quick look" })).toBeNull();
    expect(screen.queryByRole("button", { name: "View profile" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(like).toHaveBeenCalledWith(profile, { type: "profile", label: "their profile" });
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(pass).toHaveBeenCalledWith(profile);
  });
  it("uses the exact selected profile and prevents actions while saving", () => {
    const like = vi.fn(), pass = vi.fn();
    const { rerender } = render(<MemoryRouter><MatchProfileCard profile={profile} busy={false} onLike={like} onPass={pass} /></MemoryRouter>);
    fireEvent.keyDown(screen.getByRole("group", { name: "Discover Ava Chen" }), { key: "ArrowRight" });
    expect(like).toHaveBeenCalledWith(profile, { type: "profile", label: "their profile" });
    rerender(<MemoryRouter><MatchProfileCard profile={profile} busy onLike={like} onPass={pass} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(pass).not.toHaveBeenCalled();
  });
  it("uses both original photo URLs and shows every supplied skill and Passport statistic upfront", () => {
    const detailed = { ...profile, avatar_url: '/original-portrait.jpg', cover_image_url: '/original-cover.jpg', professional_skills: ['UX', 'Research', 'Prototyping', 'Accessibility'], passion_skills: ['Photography'], level: 12, credits_count: 7, awards_count: 2, portfolio_count: 4, twitter_followers: 1250, collab_intent: 'seeking_collaborators' };
    render(<MemoryRouter><MatchProfileCard profile={detailed} busy={false} onLike={vi.fn()} onPass={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('img', { name: 'Ava Chen, photo 1' })).toHaveAttribute('src', '/original-portrait.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('img', { name: 'Ava Chen, photo 2' })).toHaveAttribute('src', '/original-cover.jpg');
    expect(screen.getByText(/accessibility/i)).toBeVisible(); expect(screen.getByText(/photography/i)).toBeVisible();
    expect(screen.getByText('Credits')).toBeVisible(); expect(screen.getByText('7')).toBeVisible();
    expect(screen.getByText('Awards')).toBeVisible(); expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('Portfolio')).toBeVisible(); expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('X / Twitter followers')).toBeVisible(); expect(screen.getByText('1,250')).toBeVisible();
    expect(screen.getByText(/Seeking collaborators/)).toBeVisible();
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