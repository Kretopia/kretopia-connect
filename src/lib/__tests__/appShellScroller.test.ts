import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The app has ONE scroller (the div around every route in App.tsx); html and body do not scroll. If that scroller hands its overscroll to
// the document, any stray absolutely positioned element that stretches the document drags the whole app up when someone scrolls past the
// bottom, and an empty band shows under it. (Today's sr-only live region did exactly that.) Containing the overscroll keeps it from
// happening again whatever a page adds.
const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");

describe("the app shell scroller", () => {
  it("does not chain its vertical overscroll into the document", () => {
    const m = app.match(/<div className="([^"]*\boverflow-auto\b[^"]*)">\s*<ModeThemeSync \/>/);
    expect(m, "the shell scroller followed by ModeThemeSync").not.toBeNull();
    expect(m![1].split(/\s+/)).toEqual(expect.arrayContaining(["h-full", "overflow-auto", "overscroll-y-contain"]));
  });
});
