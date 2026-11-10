import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KRETO_SCENES } from "@/components/brand/kretoScenes";
import { creditSceneFor } from "@/lib/passport/creditArt";
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
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Video", "Kretopia credits"]);
    expect(screen.getByRole("region", { name: "Video, work samples" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Audio/ })).toBeNull();
  });

  it("names the credits section Kretopia credits, never Projects", () => {
    render(<PassportShowcase pieces={[]} credits={credits} onOpenMedia={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 3, name: "Kretopia credits" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Projects" })).toBeNull();
    expect(screen.getByRole("region", { name: "Kretopia credits, work samples" })).toBeTruthy();
  });

  it("opens a credit's project from anywhere on its card, and not a portfolio image", () => {
    const onOpenCredit = vi.fn();
    render(<PassportShowcase pieces={[poster]} credits={credits} onOpenMedia={vi.fn()} onOpenCredit={onOpenCredit} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Night Train" }));
    expect(onOpenCredit).toHaveBeenCalledTimes(1);
    expect(onOpenCredit.mock.calls[0][0]).toMatchObject({ id: "c1", title: "Night Train", source: "credit" });
    // the portfolio image has no project page to open
    expect(screen.queryByRole("button", { name: "Open Campaign poster" })).toBeNull();
  });

  it("draws plain cards when the page gives it nothing to open", () => {
    render(<PassportShowcase pieces={[]} credits={credits} onOpenMedia={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Open / })).toBeNull();
    expect(screen.getByRole("heading", { name: "Night Train" })).toBeTruthy();
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

describe("a credit's cover: its own image, else one of Kreto's approved scenes chosen from its id, else a neutral tile", () => {
  const sceneSrc = (id: string) => KRETO_SCENES[creditSceneFor(id)].thumb!.src;
  const covers = (container: HTMLElement) => [...container.querySelectorAll("img")] as HTMLImageElement[];
  const cardOf = (title: string) => screen.getByRole("heading", { name: title }).closest("article") as HTMLElement;

  it("shows a Kreto scene for a credit with no image, the same one for the same credit on every render", () => {
    const { container, rerender } = render(<PassportShowcase pieces={[]} credits={credits} onOpenMedia={vi.fn()} />);
    const first = covers(container).map((img) => img.getAttribute("src"));
    expect(first).toEqual([sceneSrc("c1"), sceneSrc("c2")]);
    rerender(<PassportShowcase pieces={[]} credits={[...credits].reverse()} onOpenMedia={vi.fn()} />);
    expect(cardOf("Night Train").querySelector("img")?.getAttribute("src")).toBe(sceneSrc("c1"));
    expect(cardOf("Open Road").querySelector("img")?.getAttribute("src")).toBe(sceneSrc("c2"));
  });

  it("is decorative art: no alt text, hidden from assistive technology, loaded lazily", () => {
    const { container } = render(<PassportShowcase pieces={[]} credits={credits} onOpenMedia={vi.fn()} />);
    for (const img of covers(container)) {
      expect(img.getAttribute("alt")).toBe("");
      expect(img.getAttribute("aria-hidden")).toBe("true");
      expect(img.getAttribute("loading")).toBe("lazy");
    }
  });

  it("keeps a credit's own image when it has one", () => {
    const { container } = render(<PassportShowcase pieces={[]} credits={[{ ...credits[0], thumbnail_url: "https://x.test/night-train.jpg" }]} onOpenMedia={vi.fn()} />);
    expect(covers(container).map((img) => img.getAttribute("src"))).toEqual(["https://x.test/night-train.jpg"]);
  });

  it("falls back to the Kreto scene when the image cannot be loaded, once, and without looping", () => {
    const { container } = render(<PassportShowcase pieces={[]} credits={[{ ...credits[0], thumbnail_url: "https://x.test/broken.jpg" }]} onOpenMedia={vi.fn()} />);
    expect(covers(container)[0].getAttribute("src")).toBe("https://x.test/broken.jpg");
    fireEvent.error(covers(container)[0]);
    expect(covers(container).map((img) => img.getAttribute("src"))).toEqual([sceneSrc("c1")]);
    // the broken address is gone for good: nothing retries it
    expect(container.innerHTML).not.toContain("broken.jpg");
  });

  it("ends on a neutral tile if even the scene fails, and no further error can change anything", () => {
    const { container } = render(<PassportShowcase pieces={[]} credits={[{ ...credits[0], thumbnail_url: "https://x.test/broken.jpg" }]} onOpenMedia={vi.fn()} />);
    fireEvent.error(covers(container)[0]); // own image fails
    fireEvent.error(covers(container)[0]); // the scene fails
    expect(covers(container)).toHaveLength(0);
    const html = container.innerHTML;
    // nothing left to fail: the card is stable, still readable and still opens its project
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(within(cardOf("Night Train")).getByText("Director · 2024")).toBeTruthy();
    expect(container.innerHTML).toBe(html);
  });

  it("covers a portfolio card that has no image too, keeps one that has, and leaves a video or audio card's play tile alone", () => {
    const moodboard = { id: "i2", title: "Moodboard", media_type: "image", media_url: null, thumbnail_url: null };
    const { container } = render(<PassportShowcase pieces={[poster, moodboard, demo]} credits={[]} onOpenMedia={vi.fn()} />);
    expect(cardOf("Campaign poster").querySelector("img")?.getAttribute("src")).toBe("https://x.test/poster.png");
    expect(cardOf("Moodboard").querySelector("img")?.getAttribute("src")).toBe(sceneSrc("i2"));
    // the audio card has no thumbnail and keeps its icon tile, not a Kreto scene
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("gives different credits different scenes where their ids differ", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ id: `credit-${index}`, project_name: `Work ${index}`, role: "Editor", year: 2020 }));
    const { container } = render(<PassportShowcase pieces={[]} credits={many} onOpenMedia={vi.fn()} />);
    expect(new Set(covers(container).map((img) => img.getAttribute("src"))).size).toBeGreaterThan(1);
  });
});
