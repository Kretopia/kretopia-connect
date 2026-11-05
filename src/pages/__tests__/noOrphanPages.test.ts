import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A page module that nothing imports is a page the app cannot reach: it never renders, but it is still built, read and maintained, and it misleads
// the next person (18 of them, about 4,800 lines, were removed in one go). The way this codebase retires a page is to delete the file and leave a
// <Navigate> route behind in App.tsx, so that old links, bookmarks and emails keep landing somewhere.
const SRC = resolve(__dirname, "../..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const isTest = (file: string) => /\/__tests__\//.test(file) || /\.(test|spec)\.tsx?$/.test(file);
const production = walk(SRC).filter((file) => /\.tsx?$/.test(file) && !isTest(file));
const known = new Set(production);

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const resolveSpecifier = (from: string, specifier: string): string | null => {
  const base = specifier.startsWith("@/") ? join(SRC, specifier.slice(2)) : specifier.startsWith(".") ? resolve(dirname(from), specifier) : null;
  return base ? (EXTENSIONS.map((ext) => base + ext).find((path) => known.has(path)) ?? null) : null;
};

const IMPORT = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const importedBy = new Map<string, Set<string>>();
for (const file of production) {
  for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) {
    const target = resolveSpecifier(file, match[1] ?? match[2]);
    if (target && target !== file) importedBy.set(target, (importedBy.get(target) ?? new Set()).add(file));
  }
}

describe("every page module is imported by the app", () => {
  const pages = production.filter((file) => relative(SRC, file).startsWith("pages/"));

  it("finds the pages (so the check below is not vacuous)", () => {
    expect(pages.length).toBeGreaterThan(100);
  });

  it.each(pages.map((file) => relative(SRC, file)))("%s", (page) => {
    expect(importedBy.get(join(SRC, page))?.size ?? 0, `${page} is imported by nothing: delete it, or route it in App.tsx`).toBeGreaterThan(0);
  });
});

describe("the Guide page is gone, and its old path only redirects", () => {
  const app = readFileSync(join(SRC, "App.tsx"), "utf8");

  it("has no page file, no import and no prefetch entry", () => {
    expect(existsSync(join(SRC, "pages/Guide.tsx"))).toBe(false);
    expect(app).not.toMatch(/pages\/Guide["']/);
    expect(readFileSync(join(SRC, "lib/routePrefetch.ts"), "utf8")).not.toMatch(/pages\/Guide["']/);
  });

  it("keeps /guide as a redirect, because the welcome email still links to it", () => {
    expect(app).toMatch(/<Route path="\/guide" element=\{<Navigate to="\/" replace \/>\} \/>/);
  });
});
