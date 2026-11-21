import { describe, expect, it } from "vitest";
import { parseIntroVideo, withIntroTrim } from "../introVideoTrim";

describe("intro video trim", () => {
  it("stores a cut as a media fragment and reads it back", () => {
    const url = withIntroTrim("https://x.test/v.mp4?v=1", { start: 2.04, end: 12.5 }, 30);
    expect(url).toBe("https://x.test/v.mp4?v=1#t=2,12.5");
    expect(parseIntroVideo(url)).toEqual({ src: "https://x.test/v.mp4?v=1", trim: { start: 2, end: 12.5 } });
  });
  it("drops the fragment when the cut covers the whole video", () => {
    expect(withIntroTrim("https://x.test/v.mp4#t=3,9", { start: 0, end: 30 }, 30)).toBe("https://x.test/v.mp4");
  });
  it("keeps only the start when the end is the video's end", () => {
    expect(withIntroTrim("https://x.test/v.mp4", { start: 4, end: 30 }, 30)).toBe("https://x.test/v.mp4#t=4");
  });
});
