import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// What a request to Kreto opens is decided once, in lib/kretoInstantRoute.ts (a request for work opens Scout, a named page opens that page, an
// explicit people search opens the results page with its term). These surfaces take typed requests; each must go through that router and open
// the page before any model call, and none may build a search address of its own, so a request to find opportunities cannot end up on /search.
const ROOT = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const CHAT_SURFACES = [
  { name: "the inline chat", file: "src/components/kreto/InlineKretoChat.tsx" },
  { name: "the floating agent", file: "src/components/desk/ThriveAgentFab.tsx" },
  { name: "the desktop copilot rail", file: "src/components/desk/DesktopCopilotRail.tsx" },
];
const ALL_SURFACES = [...CHAT_SURFACES, { name: "an approved plan whose executor fails", file: "src/components/agent/CopilotPlanCard.tsx" }];

describe("Kreto's typed requests share one router", () => {
  it.each(ALL_SURFACES)("$name takes the router from lib/kretoInstantRoute and opens the page it names", ({ file }) => {
    const source = read(file);
    expect(source).toMatch(/import \{ matchKretoRoute \} from "@\/lib\/kretoInstantRoute"/);
    expect(source).toMatch(/navigate\(instant\.path\)/);
  });

  it.each(CHAT_SURFACES)("$name opens the page before it asks the model anything", ({ file }) => {
    const source = read(file);
    const route = source.indexOf("matchKretoRoute(");
    const model = source.indexOf("await streamCopilot(");
    expect(route).toBeGreaterThan(-1);
    expect(model).toBeGreaterThan(-1);
    expect(route).toBeLessThan(model);
  });

  it.each(ALL_SURFACES)("$name builds no search address of its own", ({ file }) => {
    expect(read(file)).not.toMatch(/navigate\([^)]*\/search/);
  });

  it("the router sends a request for work to Scout and keeps /search for an explicit people search", () => {
    const router = read("src/lib/kretoInstantRoute.ts");
    expect(router).toContain("/scout?tab=all");
    // the only search address it builds is the results page with the term (never the bare landing)
    const searchPaths = router.match(/\/search[^"`'\s)]*/g) ?? [];
    expect(searchPaths.every((p) => p.startsWith("/search?q="))).toBe(true);
  });
});
