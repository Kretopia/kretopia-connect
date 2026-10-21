import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PassportShowcase } from "../PassportShowcase";

// embla needs layout APIs jsdom does not have; the carousel itself is the shared primitive, so it is stood in for
// with a plain region and list: what is tested is what goes into it.
vi.mock("@/components/ui/glass/GlassCarousel", () => ({
  GlassCarousel: ({ children, label }: { children: React.ReactNode; label: string }) => <div role="region" aria-label={label}><ul>{children}</ul></div>,
  GlassCarouselItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
}));

afterEach(cleanup);

const reel = { id: "v1", title: "Showreel 2025", media_type: "video", media_url: "https://x.test/reel", thumbnail_url: "https://x.test/reel.jpg" };
const demo = { id: "a1", title: "Demo track", media_type: "audio", media_url: "https://x.test/demo.mp3", thumbnail_url: null };
const poster = { id: "i1", title: "Campaign poster", media_type: "image", media_url: "https://x.test/poster.png", thumbnail_url: null };
const credits = [
  { id: "c1", project_name: "Night Train", role: "Director", year: 2024, evidence: "co_signed" as const },
  { id: "c2", project_name: "Open Road", role: "Editor", year: 2023, evidence: "self_claimed" as const },
];

describe("Passport showcase", () => {
  it("draws only the sections that have something, each as a labelled carousel", () => {
    render(<PassportShowcase pieces={[reel]} credits={credits} onOpenMedia={vi.fn()} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Video", "Projects"]);
    expect(screen.getByRole("region", { name: "Video, work samples" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Audio/ })).toBeNull();
  });

  it("draws nothing at all when there is no work yet", () => {
    const { container } = render(<PassportShowcase pieces={[]} credits={[]} onOpenMedia={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the player with the original piece, from a video or an audio card", () => {
    const onOpenMedia = vi.fn();
    render(<PassportShowcase pieces={[reel, demo]} credits={[]} onOpenMedia={onOpenMedia} />);
    fireEvent.click(screen.getByRole("button", { name: "Play Showreel 2025" }));
    fireEvent.click(screen.getByRole("button", { name: "Listen to Demo track" }));
    expect(onOpenMedia.mock.calls.map(([piece]) => piece)).toEqual([reel, demo]);
  });

  it("never starts media by itself: no audio or video element exists until the player is opened", () => {
    const { container } = render(<PassportShowcase pieces={[reel, demo]} credits={credits} onOpenMedia={vi.fn()} />);
    expect(container.querySelectorAll("video, audio, iframe")).toHaveLength(0);
  });

  it("shows a project's role, year and proof, and no proof for a portfolio image", () => {
    render(<PassportShowcase pieces={[poster]} credits={credits} onOpenMedia={vi.fn()} />);
    const night = within(screen.getByRole("heading", { name: "Night Train" }).closest("article") as HTMLElement);
    expect(night.getByText("Director · 2024")).toBeTruthy();
    expect(night.getByText("Co-signed")).toBeTruthy();
    const posterCard = within(screen.getByRole("heading", { name: "Campaign poster" }).closest("article") as HTMLElement);
    expect(posterCard.queryByText(/Co-signed|Verified|Self|Pending|sourced/i)).toBeNull();
  });

  it("falls back to a neutral tile when a cover fails to load, and loads covers lazily", () => {
    const { container } = render(<PassportShowcase pieces={[reel]} credits={[]} onOpenMedia={vi.fn()} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "Play Showreel 2025" })).toBeTruthy();
  });
});
