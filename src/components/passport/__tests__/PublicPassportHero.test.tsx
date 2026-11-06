import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/profile/AvailabilityIndicator", () => ({ AvailabilityIndicator: () => null }));
vi.mock("@/components/profile/TrustSignals", () => ({ TrustSignals: () => null }));

import { PublicPassportHero, type PublicPassportOwner } from "../PublicPassportHero";

const profile = {
  user_id: "11111111-2222-3333-4444-555555555555",
  full_name: "Maya Laurent",
  username: "maya",
  role: "Motion Designer",
  location: "Paris, France",
  professional_skills: ["After Effects"],
  // all of these are on the row; none of them may become a link
  instagram_url: "https://instagram.com/maya",
  linkedin_url: "https://linkedin.com/in/maya",
  twitter_url: "https://x.com/maya",
  youtube_url: "https://youtube.com/@maya",
  spotify_url: "https://open.spotify.com/artist/maya",
  website: "https://maya.example.com",
  calendly_url: null as string | null,
};

const render_ = (over: Partial<typeof profile> = {}) =>
  render(
    <PublicPassportHero
      profile={{ ...profile, ...over }}
      connectionStatus="none"
      isOwner={false}
      isSignedIn={false}
      isConnecting={false}
      onConnect={() => {}}
      onMessage={() => {}}
      onCollaborate={() => {}}
      onAddToProject={() => {}}
      onShare={() => {}}
      onJoin={() => {}}
    />,
  );

describe("PublicPassportHero", () => {
  it("shows the Passport: name, role, place, ID", () => {
    render_();
    expect(screen.getByRole("heading", { name: "Maya Laurent" })).toBeInTheDocument();
    expect(screen.getByText("Motion Designer")).toBeInTheDocument();
    expect(screen.getByText("Paris, France")).toBeInTheDocument();
    expect(screen.getByText("KRT-11111")).toBeInTheDocument();
  });

  it("has no link to Instagram, LinkedIn, X, YouTube, Spotify or a personal site", () => {
    const { container } = render_();
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    for (const host of ["instagram", "linkedin", "x.com", "twitter", "youtube", "spotify", "maya.example.com"]) {
      expect(hrefs.some((h) => h.includes(host))).toBe(false);
    }
    expect(screen.queryByRole("link", { name: /Open (Instagram|LinkedIn|Twitter|YouTube|Spotify|Website)/ })).not.toBeInTheDocument();
  });

  it("has no booking link either, even when the profile has one", () => {
    const { container } = render_({ calendly_url: "https://calendly.com/maya/intro" } as never);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes("calendly"))).toBe(false);
    expect(screen.queryByRole("link", { name: /Book/ })).not.toBeInTheDocument();
  });

  it("offers no outbound link of any kind from the Passport card", () => {
    const { container } = render_();
    expect(container.querySelectorAll("a[target=_blank]")).toHaveLength(0);
  });

  describe("booking", () => {
    const withBooking = (bookingPath: string | null, isOwner = false) =>
      render(
        <MemoryRouter>
          <PublicPassportHero
            profile={profile}
            connectionStatus="none"
            isOwner={isOwner}
            isSignedIn={false}
            isConnecting={false}
            onConnect={() => {}}
            onMessage={() => {}}
            onCollaborate={() => {}}
            onAddToProject={() => {}}
            onShare={() => {}}
            onJoin={() => {}}
            bookingPath={bookingPath}
          />
        </MemoryRouter>,
      );

    it("shows 'Available to book' and a Book link to the booking page only when the creative has booking hours", () => {
      withBooking("/@maya/book");
      expect(screen.getByText("Available to book")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/@maya/book");
    });

    it("shows no booking action, and no dead end, when there are no booking hours", () => {
      withBooking(null);
      expect(screen.queryByText("Available to book")).toBeNull();
      expect(screen.queryByRole("link", { name: "Book" })).toBeNull();
    });

    it("does not offer the owner a way to book themselves", () => {
      withBooking("/@maya/book", true);
      expect(screen.queryByRole("link", { name: "Book" })).toBeNull();
    });
  });
});

describe("the owner's card: the owner card's controls, grafted onto the Passport card everybody sees", () => {
  // jsdom has no PointerEvent, and without it clientX/clientY are dropped from the events below.
  class TestPointerEvent extends MouseEvent {}
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce") ? false : true, // a fine pointer that can hover, no reduced motion
      media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    vi.stubGlobal("PointerEvent", TestPointerEvent);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  const controls = (over: Partial<PublicPassportOwner> = {}): PublicPassportOwner => ({
    onEdit: vi.fn(), onShowQR: vi.fn(), onDownloadEPK: vi.fn(), onChangePhoto: vi.fn(),
    ...over,
  });
  const draw = (owner: PublicPassportOwner | undefined, { isOwner = true, onShare = vi.fn(), children }: { isOwner?: boolean; onShare?: () => void; children?: React.ReactNode } = {}) => ({
    onShare,
    ...render(
      <PublicPassportHero
        profile={profile}
        owner={owner}
        connectionStatus="none"
        isOwner={isOwner}
        isSignedIn
        isConnecting={false}
        onConnect={() => {}}
        onMessage={() => {}}
        onCollaborate={() => {}}
        onAddToProject={() => {}}
        onShare={onShare}
        onJoin={() => {}}
        showActions={false}
      >{children}</PublicPassportHero>,
    ),
  });

  it("puts the photo button on the avatar and the Edit, Share, QR and press kit buttons on the card", () => {
    const owner = controls();
    draw(owner);
    fireEvent.click(screen.getByRole("button", { name: "Change photo" }));
    expect(owner.onChangePhoto).toHaveBeenCalledOnce();

    const tiles = within(screen.getByRole("list", { name: "Passport actions" }));
    expect(tiles.getAllByRole("listitem")).toHaveLength(4);
    // Edit says "Edit" and nothing else, and opens the editor
    const edit = tiles.getByRole("button", { name: "Edit Passport" });
    expect(edit).toHaveTextContent(/^Edit$/);
    fireEvent.click(edit);
    expect(owner.onEdit).toHaveBeenCalledOnce();
    fireEvent.click(tiles.getByRole("button", { name: "Show QR code" }));
    expect(owner.onShowQR).toHaveBeenCalledOnce();
    fireEvent.click(tiles.getByRole("button", { name: "Download press kit PDF" }));
    expect(owner.onDownloadEPK).toHaveBeenCalledOnce();
  });

  it("shares through the owner's own flow when there is one, from the card's tile and from its corner icon", () => {
    const owner = controls({ onShare: vi.fn() });
    const { onShare } = draw(owner);
    const shareButtons = screen.getAllByRole("button", { name: "Share Passport" });
    expect(shareButtons).toHaveLength(2); // the icon on the cover and the tile
    shareButtons.forEach((button) => fireEvent.click(button));
    expect(owner.onShare).toHaveBeenCalledTimes(2);
    expect(onShare).not.toHaveBeenCalled();
  });

  it("falls back to the plain share the document gives everybody when the owner has no flow of their own", () => {
    const { onShare } = draw(controls());
    screen.getAllByRole("button", { name: "Share Passport" }).forEach((button) => fireEvent.click(button));
    expect(onShare).toHaveBeenCalledTimes(2);
  });

  it("adds the PDF to the same line when the document gives the card one, and presses it through", () => {
    const pdf = { onDownload: vi.fn() };
    draw(controls({ pdf }));
    const tiles = within(screen.getByRole("list", { name: "Passport actions" }));
    expect(tiles.getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(tiles.getByRole("button", { name: "Download PDF" }));
    expect(pdf.onDownload).toHaveBeenCalledOnce();
  });

  it("has no PDF button until the document gives it one", () => {
    draw(controls());
    expect(within(screen.getByRole("list", { name: "Passport actions" })).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
  });

  it("does not draw the owner's private blocks itself: the document lays them out under the card and the record", () => {
    draw(controls({ privateBand: <p>private overview</p> }), { children: <p>public record</p> });
    expect(screen.queryByText("private overview")).toBeNull();
    expect(screen.queryByRole("region", { name: "Only you see this" })).toBeNull();
    expect(screen.getByText("public record")).toBeInTheDocument();
  });

  it("says how many credits other people tagged to the owner, and nothing when there are none", () => {
    const { unmount } = draw(controls({ taggedCount: 2 }));
    expect(screen.getByText("2 unclaimed credits tagged to you")).toBeInTheDocument();
    unmount();
    const one = draw(controls({ taggedCount: 1 }));
    expect(screen.getByText("1 unclaimed credit tagged to you")).toBeInTheDocument();
    one.unmount();
    draw(controls({ taggedCount: 0 }));
    expect(screen.queryByText(/unclaimed credit/)).toBeNull();
  });

  it("disables the photo button while a photo uploads", () => {
    draw(controls({ isUploadingAvatar: true }));
    expect(screen.getByRole("button", { name: "Change photo" })).toBeDisabled();
  });

  it("does not tilt for its owner (it holds buttons now), while the same card still tilts for a visitor", () => {
    const tiltOf = (root: HTMLElement) => {
      const wrapper = root.firstElementChild as HTMLElement;
      wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) });
      fireEvent.pointerMove(wrapper, { clientX: 150, clientY: 20 });
      const m = (wrapper.firstElementChild as HTMLElement).style.transform.match(/rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/);
      return m ? { x: Math.abs(Number(m[1])), y: Math.abs(Number(m[2])) } : null;
    };
    const owner = draw(controls());
    expect(tiltOf(owner.container)).toEqual({ x: 0, y: 0 });
    owner.unmount();
    const visitor = draw(undefined, { isOwner: false });
    const visitorTilt = tiltOf(visitor.container);
    expect(visitorTilt?.x).toBeGreaterThan(0);
    expect(visitorTilt?.y).toBeGreaterThan(0);
  });

  it("is exactly the public card for anyone who is not the owner, even if controls are passed", () => {
    draw(controls({ privateBand: <p>private overview</p>, taggedCount: 3, pdf: { onDownload: vi.fn() } }), { isOwner: false });
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Passport actions" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Only you see this" })).toBeNull();
    expect(screen.queryByText("private overview")).toBeNull();
    expect(screen.queryByText(/unclaimed credit/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
  });

  it("is the plain public card for an owner who was given no controls", () => {
    draw(undefined);
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Passport actions" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Only you see this" })).toBeNull();
  });
});
