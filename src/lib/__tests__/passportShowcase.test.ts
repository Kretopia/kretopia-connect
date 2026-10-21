import { describe, expect, it } from "vitest";
import { buildShowcase, playableKind, SHOWCASE_SECTION_LIMIT, type ShowcaseCredit, type ShowcasePiece } from "../passport/showcase";

const piece = (id: string, over: Partial<ShowcasePiece> = {}): ShowcasePiece => ({
  id, title: `Piece ${id}`, media_type: "video", media_url: `https://example.com/${id}`, thumbnail_url: null, ...over,
});
const credit = (id: string, over: Partial<ShowcaseCredit> = {}): ShowcaseCredit => ({ id, project_name: `Project ${id}`, role: "Director", year: 2024, ...over });

describe("playableKind", () => {
  it("reads video and audio from the saved media type, and only with a link that can be opened", () => {
    expect(playableKind("video", "https://x.test/a")).toBe("video");
    expect(playableKind("YouTube", "https://youtu.be/a")).toBe("video");
    expect(playableKind(" vimeo ", "http://vimeo.com/1")).toBe("video");
    expect(playableKind("audio", "https://x.test/a.mp3")).toBe("audio");
  });
  it("is null for an image, an unknown type, a missing type, or no usable link", () => {
    expect(playableKind("image", "https://x.test/a.png")).toBeNull();
    expect(playableKind("podcast", "https://x.test/a")).toBeNull();
    expect(playableKind(null, "https://x.test/a")).toBeNull();
    expect(playableKind("video", null)).toBeNull();
    expect(playableKind("video", "")).toBeNull();
    expect(playableKind("video", "javascript:alert(1)")).toBeNull();
    expect(playableKind("audio", "/relative/path.mp3")).toBeNull();
  });
});

describe("buildShowcase", () => {
  it("returns Video, Audio and Projects in that order, and omits the empty ones", () => {
    const all = buildShowcase([piece("a"), piece("b", { media_type: "audio" })], [credit("c")]);
    expect(all.map((s) => s.label)).toEqual(["Video", "Audio", "Projects"]);
    expect(buildShowcase([piece("a", { media_type: "audio" })], []).map((s) => s.kind)).toEqual(["audio"]);
    expect(buildShowcase([], [credit("c")]).map((s) => s.kind)).toEqual(["project"]);
    expect(buildShowcase([], [])).toEqual([]);
  });

  it("keeps the kind of content, the project and the proof apart", () => {
    const [video, projects] = buildShowcase([piece("v")], [credit("c", { evidence: "co_signed", credit_category: "music", platform: "Spotify" })]);
    // a credit about music on Spotify is a project with a proof, never audio
    expect(video.items[0]).toMatchObject({ kind: "video", id: "v" });
    expect("proof" in video.items[0]).toBe(false);
    expect(projects.items[0]).toMatchObject({ kind: "project", id: "c", proof: "co_signed", category: "music", subtitle: "Director · 2024" });
  });

  it("shows a piece that cannot be played (image, or no link) as a project card, with no proof", () => {
    const [projects] = buildShowcase(
      [piece("img", { media_type: "image", media_url: "https://x.test/p.png" }), piece("dead", { media_type: "video", media_url: null })],
      [],
    );
    expect(projects.kind).toBe("project");
    expect(projects.items.map((i) => i.id)).toEqual(["img", "dead"]);
    expect(projects.items[0]).toMatchObject({ proof: null, thumbnailUrl: "https://x.test/p.png" });
    expect(projects.items[1]).toMatchObject({ proof: null, thumbnailUrl: null });
  });

  it("builds the subtitle from whichever of role and year exist, and skips a credit with no name", () => {
    const [projects] = buildShowcase([], [credit("a", { year: null }), credit("b", { role: "", year: 2020 }), credit("c", { role: null, year: null }), credit("d", { project_name: "  ", title: null })]);
    expect(projects.items.map((i) => (i as { subtitle: string | null }).subtitle)).toEqual(["Director", "2020", null]);
    expect(projects.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("never lists the same record twice, and keeps the order it was given", () => {
    const [video, projects] = buildShowcase([piece("a"), piece("b"), piece("a")], [credit("b"), credit("c"), credit("c")]);
    expect(video.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(projects.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("caps each section", () => {
    const many = Array.from({ length: SHOWCASE_SECTION_LIMIT + 5 }, (_, i) => piece(`p${i}`));
    expect(buildShowcase(many, [])[0].items).toHaveLength(SHOWCASE_SECTION_LIMIT);
    expect(buildShowcase(many, [], 3)[0].items.map((i) => i.id)).toEqual(["p0", "p1", "p2"]);
  });

  it("drops an unsafe thumbnail instead of rendering it", () => {
    const [video] = buildShowcase([piece("v", { thumbnail_url: "javascript:alert(1)" })], []);
    expect(video.items[0]).toMatchObject({ thumbnailUrl: null });
  });
});
