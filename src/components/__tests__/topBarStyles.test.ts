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

  it("keeps the hero search on the shared 0.875rem corner, not a pill", () => {
    expect(rule(".k-search-hero")).toMatch(/border-radius:\s*var\(--k-hero-radius\)/);
    expect(rule(".k-search-hero")).not.toMatch(/9999px/);
    expect(css).toMatch(/--k-hero-radius:\s*0\.875rem/);
  });

  it("gives the top-bar search no look of its own: it is the hero field", () => {
    expect(css).not.toMatch(/\.k-nav-search/);
  });
});

/** The body of the first CSS block that opens with the given selector line, or "". */
const block = (opener: string) => {
  const start = css.indexOf(opener);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return "";
};
const alpha = (body: string, property: string) => Number(body.match(new RegExp(`${property}:\\s*hsl\\(var\\(--foreground\\) / ([0-9.]+)\\)`))?.[1]);

describe("the top bar's one text token", () => {
  it("is the logo's own white on Midnight, the same white as the page's ink there", () => {
    expect(block("  .dark {")).toMatch(/--k-nav-text:\s*0 0% 100%/);
    expect(block("  .dark {")).toMatch(/--foreground:\s*0 0% 100%/);
  });

  it("is, on Daylight, the logo's wordmark at the brightness the stylesheet already darkens it to", () => {
    const wordmark = css.match(/:root:not\(\.dark\) \.brand-wordmark \{ filter: brightness\(([0-9.]+)\); \}/);
    expect(wordmark).not.toBeNull();
    const lightness = Math.round(Number(wordmark![1]) * 100);
    expect(block("  :root {")).toMatch(new RegExp(`--k-nav-text:\\s*0 0% ${lightness}%`));
  });

  it("is what the bar, its links and its sign-in and join buttons are written in: no other white, no dimmed word", () => {
    expect(rule(".k-top-bar")).toMatch(/color:\s*hsl\(var\(--k-nav-text\)\)/);
    expect(rule(".k-site-nav a")).toMatch(/color:\s*hsl\(var\(--k-nav-text\)\)/);
    expect(rule(".k-site-nav a[aria-current=\"page\"]")).toMatch(/color:\s*hsl\(var\(--k-nav-text\)\)/);
    // (the two share a base rule for their box; the colour is in each one's own rule, which starts with its padding)
    expect(css).toMatch(/\.k-nav-signin \{\s*padding: 0 14px;[^}]*color:\s*hsl\(var\(--k-nav-text\)\)/);
    expect(css).toMatch(/\.k-nav-join \{\s*padding: 0 17px;[^}]*color:\s*hsl\(var\(--k-nav-text\)\)/);
    expect(rule(".k-site-nav a")).not.toMatch(/color:\s*hsl\(var\(--foreground\)/);
  });

  it("lets the icon buttons inherit it, rather than each choosing its own", () => {
    expect(css).toMatch(/\[data-nav-chrome\] \.btn-glass:not\(\.glass-cta\):active \{\s*color: inherit !important;/);
  });
});

describe("the top bar's states stay distinguishable by their frame, not by shades of white", () => {
  const hover = block(".k-site-nav a:hover,");
  // a second, later rule for the current page alone
  const current = css.slice(css.indexOf("The current page is firmer than a hover"));
  const currentBody = current.slice(current.indexOf("{") + 1, current.indexOf("}"));

  it("a hover and a focus are a faint frame; the current page a firmer one; a press the firmest", () => {
    const pressed = rule(".k-site-nav a:active");
    expect(alpha(currentBody, "background-color")).toBeGreaterThan(alpha(hover, "background-color"));
    expect(alpha(currentBody, "border-color")).toBeGreaterThan(alpha(hover, "border-color"));
    expect(alpha(pressed, "background-color")).toBeGreaterThan(alpha(currentBody, "background-color"));
    expect(alpha(pressed, "border-color")).toBeGreaterThan(alpha(currentBody, "border-color"));
  });

  it("focus has a ring of its own, on every nav control", () => {
    const focus = block(".k-site-nav a:focus-visible,\n.k-nav-signin:focus-visible,");
    expect(focus).toMatch(/outline:\s*2px solid #ff3d7a/);
    expect(focus).toMatch(/outline-offset:\s*3px/);
  });

  it("a disabled link is dimmed, loses its frame, cannot be pressed and shows it", () => {
    const disabled = rule(".k-site-nav a[aria-disabled=\"true\"]");
    expect(Number(disabled.match(/opacity:\s*([0-9.]+)/)?.[1])).toBeLessThan(0.6);
    expect(disabled).toMatch(/pointer-events:\s*none/);
    expect(disabled).toMatch(/cursor:\s*not-allowed/);
    expect(disabled).toMatch(/border-color:\s*transparent/);
  });
});

describe("the hamburger", () => {
  const open = (part: string) => css.match(new RegExp(`\\.k-burger\\[data-open="true"\\] \\.k-burger-${part} \\{([^}]*)\\}`))?.[1] ?? "";
  const hoverMedia = css.slice(css.indexOf("@media (hover: hover) and (pointer: fine) {"), css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .k-burger-bar"));

  it("becomes an X when it is open: a state rule that no media query gates", () => {
    expect(open("top")).toMatch(/rotate\(45deg\)/);
    expect(open("bot")).toMatch(/rotate\(-45deg\)/);
    expect(open("mid")).toMatch(/opacity:\s*0/);
    // the open rules sit outside the hover media query
    expect(css.indexOf('.k-burger[data-open="true"] .k-burger-top')).toBeLessThan(css.indexOf("@media (hover: hover) and (pointer: fine) {\n  :is(button, a):hover > .k-burger"));
  });

  it("also becomes an X under a pointer, for a fine pointer only, never on focus", () => {
    expect(hoverMedia).toContain(":is(button, a):hover > .k-burger .k-burger-top");
    expect(hoverMedia).toMatch(/rotate\(45deg\)/);
    expect(hoverMedia).not.toMatch(/focus/);
    expect(css).not.toMatch(/\.k-burger[^{]*:focus/);
  });

  it("takes the same shape in both cases", () => {
    expect(hoverMedia).toContain(open("top").trim().replace(/\s+/g, " "));
    expect(hoverMedia).toContain(open("bot").trim().replace(/\s+/g, " "));
    expect(hoverMedia).toContain(open("mid").trim().replace(/\s+/g, " "));
  });

  it("stops moving for reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.k-burger-bar \{ transition: none; \}/);
  });
});
