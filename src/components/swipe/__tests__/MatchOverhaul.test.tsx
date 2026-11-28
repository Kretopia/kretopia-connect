import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));
vi.mock("@/components/brand/KretoScene", () => ({ KretoScene: () => <span aria-hidden /> }));
vi.mock("@/components/brand/KretoCharacter", () => ({ KretoCharacter: () => <span aria-label="Kreto robot" /> }));
import { MatchProfileCard } from "../MatchProfileCard";
import { MatchPulse } from "../MatchPulse";
import type { SwipeProfile } from "@/hooks/useSwipeProfiles";
const profile = { user_id: "creator", full_name: "Ava Chen", role: "Designer", bio: "Product designer", avatar_url: null, cover_image_url: null, professional_skills: ["UX"], location: "Bali" } as SwipeProfile;

describe("Match discovery controls", () => {
  it("shows a flippable Passport with equal Pass and Connect decisions and no profile preview", () => {
    const like = vi.fn(), pass = vi.fn();
    render(<MemoryRouter><MatchProfileCard profile={profile} busy={false} onLike={like} onPass={pass} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "View profile" })).toBeNull();
    const flip = screen.getByRole("button", { name: "View full Passport" });
    expect(flip).toBeVisible();
    const passButton = screen.getByRole("button", { name: "Pass" });
    const connectButton = screen.getByRole("button", { name: "Connect" });
    expect(passButton.className).toBe(connectButton.className);
    fireEvent.click(flip);
    expect(screen.getByRole("group", { name: "Ava Chen: full public Passport" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to Passport photos" }));
    fireEvent.click(connectButton);
    expect(like).toHaveBeenCalledWith(profile, { type: "profile", label: "their profile" });
    fireEvent.click(passButton);
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
  it("uses both original photo URLs and shows every supplied skill and Passport statistic on the full Passport", () => {
    const detailed = { ...profile, avatar_url: '/original-portrait.jpg', cover_image_url: '/original-cover.jpg', professional_skills: ['UX', 'Research', 'Prototyping', 'Accessibility'], passion_skills: ['Photography'], level: 12, credits_count: 7, awards_count: 2, portfolio_count: 4, twitter_followers: 1250, collab_intent: 'seeking_collaborators' };
    render(<MemoryRouter><MatchProfileCard profile={detailed} busy={false} onLike={vi.fn()} onPass={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('img', { name: 'Ava Chen, photo 1' })).toHaveAttribute('src', '/original-portrait.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('img', { name: 'Ava Chen, photo 2' })).toHaveAttribute('src', '/original-cover.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'View full Passport' }));
    expect(screen.getAllByText(/accessibility/i).length).toBeGreaterThan(0); expect(screen.getAllByText(/photography/i).length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Scanning…" }));
    expect(listener).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new CustomEvent("match:scanned", { detail: { count: 0, error: "unavailable" } })); });
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByText("Refresh unavailable")).toBeVisible();
    window.removeEventListener("match:scan", listener);
  });
  it("explains Match in the panel: what it promises, how it works in three steps, and how to use a card", () => {
    render(<MemoryRouter><MatchPulse /></MemoryRouter>);
    expect(screen.getByText("Kretopia Match")).toBeVisible();
    expect(screen.getByRole("heading", { name: /Your Creative Universe/ })).toBeVisible();
    const promises = screen.getByRole("list", { name: "What Match promises" });
    expect(Array.from(promises.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["Real Passports", "Mutual only", "Private passes"]);
    expect(screen.getByRole("heading", { name: "How Match works" })).toBeVisible();
    const steps = Array.from(document.querySelectorAll("ol > li")).map((li) => li.querySelector("p")?.textContent);
    expect(steps).toEqual(["1.Discover real Passports", "2.Connect or Pass", "3.Match and talk"]);
    expect(screen.getByText(/flip a card to read the full public Passport/i)).toBeVisible();
    // the promises are the deck's own rules: messaging only after a mutual match, nothing sent without the member
    expect(screen.getByText(/messaging opens only when the interest is mutual/i)).toBeVisible();
    expect(screen.getByText(/Nothing is ever sent without you/)).toBeVisible();
  });

  it("answers a matching question instantly without an AI request", () => {
    render(<MemoryRouter><MatchPulse /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Ask Kreto Match about matching"), { target: { value: "How do messages work?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Kreto" }));
    expect(screen.getByText("Messaging opens after a mutual match. That way, interest never becomes unwanted contact.")).toBeVisible();
    expect(screen.getByLabelText("Ask Kreto Match about matching")).toHaveValue("");
  });
});