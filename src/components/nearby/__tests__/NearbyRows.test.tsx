import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// The block / report menu has its own tests and talks to the backend; here it only has to be given the right person and the name the viewer may see.
vi.mock("@/components/user/UserActionMenu", () => ({
  UserActionMenu: ({ targetUserId, targetUserName }: { targetUserId: string; targetUserName: string }) => (
    <button type="button" aria-label={`More actions for ${targetUserName}`} data-target={targetUserId}>more</button>
  ),
}));

import { CreatorCard, CreatorListItem, type NearbyCreator } from "../NearbyCreatorCard";
import { LocationListItem, type CreativeLocation } from "../LocationListItem";
import { SessionListItem, type NearbySession } from "../NearbySessionListItem";

const ana: NearbyCreator = {
  user_id: "u1", full_name: "Ana Ruiz", avatar_url: null, role: "Colorist", bio: "Colour for film.", location: "Lisbon",
  professional_skills: ["Grading", "Resolve", "Look dev", "Extra"], latitude: 0, longitude: 0, distance_km: 0.4,
};
const place: CreativeLocation = {
  id: "l1", name: "Studio Nine", location_type: "studio", latitude: 0, longitude: 0, distance_km: 1.2, is_verified: true,
  average_rating: 4.6, is_rentable: true, price_per_hour: 40, price_currency: "EUR",
};
const session: NearbySession = {
  id: "s1", title: "Beat Lab", category: "Music", start_time: "2026-11-20T18:30:00.000Z", latitude: 0, longitude: 0, distance_km: 2,
  participant_count: 3, max_participants: 10, creator_name: "Jo", created_by: "u9",
};
const km = (n: number) => `${n}km`;
const draw = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const part = (root: HTMLElement, name: string) => root.querySelector<HTMLElement>(`[data-card-part="${name}"]`);

describe("CreatorCard: a creator near the viewer, as a row of the shared card", () => {
  const card = (connected: boolean) => {
    const onViewProfile = vi.fn();
    const onMessage = vi.fn();
    draw(<CreatorCard creator={ana} isConnected={connected} onViewProfile={onViewProfile} onMessage={onMessage} />);
    return { onViewProfile, onMessage, row: screen.getByTestId("nearby-creator-u1") };
  };

  it("keeps a stranger private: a lock for the picture, a first name and an initial, and no bio", () => {
    const { row } = card(false);
    expect(within(row).getByText("Ana R.")).toBeInTheDocument();
    expect(row.textContent).not.toContain("Ana Ruiz");
    expect(row.textContent).not.toContain("Colour for film.");
    expect(part(row, "lead")!.querySelector("svg.lucide-lock")).not.toBeNull();
    // the block / report menu is given the masked name too
    expect(within(row).getByRole("button", { name: "More actions for Ana R." })).toHaveAttribute("data-target", "u1");
  });

  it("offers a stranger View and Connect, each doing what it did, and the card itself is not a link", () => {
    const { row, onViewProfile, onMessage } = card(false);
    fireEvent.click(within(row).getByRole("button", { name: "View" }));
    expect(onViewProfile).toHaveBeenCalledWith("u1");
    fireEvent.click(within(row).getByRole("button", { name: /Connect/ }));
    expect(onMessage).toHaveBeenCalledWith("u1");
    expect(within(row).queryByRole("link")).toBeNull();
    expect(within(row).queryByRole("button", { name: "Ana R." })).toBeNull();
  });

  it("shows a connection their name, bio and Profile / Message, with the distance and at most three skills", () => {
    const { row, onViewProfile, onMessage } = card(true);
    expect(within(row).getByText("Ana Ruiz")).toBeInTheDocument();
    expect(part(row, "description")).toHaveTextContent("Colour for film.");
    expect(part(row, "meta")).toHaveTextContent("Colorist");
    const tags = part(row, "tags")!;
    expect(tags).toHaveTextContent("400m away");
    for (const skill of ["Grading", "Resolve", "Look dev"]) expect(tags).toHaveTextContent(skill);
    expect(tags).not.toHaveTextContent("Extra");
    fireEvent.click(within(row).getByRole("button", { name: "Profile" }));
    expect(onViewProfile).toHaveBeenCalledWith("u1");
    fireEvent.click(within(row).getByRole("button", { name: /Message/ }));
    expect(onMessage).toHaveBeenCalledWith("u1");
  });
});

describe("CreatorListItem: a creator in the map's sidebar", () => {
  it("selects the creator on the map from the row, and opens the profile from the icon without selecting", () => {
    const onClick = vi.fn();
    const onViewProfile = vi.fn();
    draw(<CreatorListItem creator={ana} isSelected={false} isConnected={false} onClick={onClick} onViewProfile={onViewProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "Ana R." }));
    expect(onClick).toHaveBeenCalledTimes(1);
    const icon = screen.getByRole("button", { name: "View Ana R.'s profile" });
    fireEvent.click(icon);
    expect(onViewProfile).toHaveBeenCalledWith("u1");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks the chosen creator, and keeps a stranger's name masked", () => {
    draw(<CreatorListItem creator={ana} isSelected isConnected={false} onClick={vi.fn()} onViewProfile={vi.fn()} />);
    const row = screen.getByTestId("nearby-creator-row-u1");
    expect(row).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Ana R." })).toHaveAttribute("aria-current", "true");
    expect(row.textContent).not.toContain("Ana Ruiz");
  });
});

describe("LocationListItem: a creative location in the map's sidebar", () => {
  it("says what it is, whether it is verified, how it is rated, how far and what it costs", () => {
    draw(<LocationListItem location={place} isSelected={false} onClick={vi.fn()} formatDistance={km} />);
    const row = screen.getByTestId("nearby-location-l1");
    expect(part(row, "eyebrow")).toHaveTextContent("Studio");
    expect(part(row, "eyebrow")).toHaveTextContent("Verified");
    const tags = part(row, "tags")!;
    expect(tags).toHaveTextContent("1.2km");
    expect(tags).toHaveTextContent("4.6");
    expect(tags).toHaveTextContent("40/EUR/hr");
  });

  it("leaves out what the place does not have", () => {
    draw(<LocationListItem location={{ ...place, is_verified: false, average_rating: 0, is_rentable: false }} isSelected={false} onClick={vi.fn()} formatDistance={km} />);
    const row = screen.getByTestId("nearby-location-l1");
    expect(row.textContent).not.toMatch(/Verified|\/hr/);
    expect(part(row, "tags")).not.toHaveTextContent("0.0");
  });

  it("selects on the map from the row; the bookmark saves without selecting, and says whether it is saved", () => {
    const onClick = vi.fn();
    const toggle = vi.fn();
    const { rerender } = draw(<LocationListItem location={place} isSelected={false} onClick={onClick} formatDistance={km} isBookmarked={false} onToggleBookmark={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Studio Nine" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    const bookmark = screen.getByRole("button", { name: "Bookmark Studio Nine" });
    expect(bookmark).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bookmark);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<MemoryRouter><LocationListItem location={place} isSelected onClick={onClick} formatDistance={km} isBookmarked onToggleBookmark={toggle} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Remove Studio Nine from your bookmarks" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("nearby-location-l1")).toHaveAttribute("data-selected", "true");
  });

  it("has no bookmark control when it cannot be saved", () => {
    draw(<LocationListItem location={place} isSelected={false} onClick={vi.fn()} formatDistance={km} />);
    expect(screen.queryByRole("button", { name: /ookmark/ })).toBeNull();
  });
});

describe("SessionListItem: a session in the map's sidebar", () => {
  it("names the session, its category, when it is and how many are going, and selects it on the map", () => {
    const onClick = vi.fn();
    draw(<SessionListItem session={session} isSelected onClick={onClick} formatDistance={km} />);
    const row = screen.getByTestId("nearby-session-s1");
    expect(part(row, "meta")).toHaveTextContent("Music");
    expect(part(row, "tags")).toHaveTextContent(/Nov/);
    expect(within(part(row, "lead")!).getByTitle("3 going")).toHaveTextContent("3");
    expect(row).toHaveAttribute("data-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Beat Lab" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
