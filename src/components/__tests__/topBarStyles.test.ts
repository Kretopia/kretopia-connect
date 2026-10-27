import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");

/** The rule body for a selector, or "" when there is none. Selectors are matched whole, not as substrings. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n|,\\s*)${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`));
  return match ? match[1] : "";
};

describe("top bar and search styles", () => {
  it("draws no gradient underline under the rubrics", () => {
    expect(css).not.toMatch(/\.k-site-nav a::after/);
  });

  it("gives a rubric a transparent frame on hover, focus and the current page, and a firmer one on click", () => {
    const hover = rule(".k-site-nav a[aria-current=\"page\"]");
    expect(hover).toMatch(/background-color:\s*hsl\(var\(--foreground\) \/ 0\.04\)/);
    expect(hover).toMatch(/border-color:\s*hsl\(var\(--foreground\) \/ 0\.12\)/);
    expect(rule(".k-site-nav a:active")).toMatch(/border-color/);
    expect(rule(".k-site-nav a")).toMatch(/border:\s*1px solid transparent/);
  });

  it("lays the rubrics out as a left-aligned row that scrolls without a scrollbar, centred from lg", () => {
    const base = rule(".k-site-nav");
    expect(base).toMatch(/justify-content:\s*flex-start/);
    expect(base).toMatch(/overflow-x:\s*auto/);
    expect(base).toMatch(/scrollbar-width:\s*none/);
    expect(base).not.toMatch(/display:/);
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.k-site-nav \{\s*justify-content: center;/);
  });

  it("has no multicolour hover on the microphone: only the recording state wears the gradient", () => {
    expect(css).not.toMatch(/\.k-mic-button:hover/);
    expect(rule(".k-mic-button")).toMatch(/color:\s*hsl\(var\(--foreground\)\)/);
    expect(rule(".k-mic-button.is-active")).toMatch(/linear-gradient/);
  });

  it("keeps the hero search a 0.75rem rectangle, not a pill", () => {
    expect(rule(".k-search-hero")).toMatch(/border-radius:\s*0\.75rem/);
    expect(rule(".k-search-hero")).not.toMatch(/9999px/);
  });

  it("gives the top-bar search no look of its own: it is the hero field", () => {
    expect(css).not.toMatch(/\.k-nav-search/);
  });
});
