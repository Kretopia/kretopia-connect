import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Two build settings that exist for speed and are easy to lose in a refactor: the early connection to the backend, and merging the tiny
// shared chunks. Measured on a production build before and after (see the pull request): requests and the wait before the first paint.
const config = readFileSync(resolve(__dirname, "../../../vite.config.ts"), "utf8");
const code = config.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("build settings kept for speed", () => {
  it("opens the connection to the backend while the page's scripts download, to the origin the app really uses", () => {
    expect(code).toContain('name: "preconnect-backend"');
    // The hint is built from the same value that is compiled into the app, never from a second copy of the URL.
    expect(code).toMatch(/rel: "preconnect", href: supabaseUrl, crossorigin: ""/);
    // Early, so it is the first thing the browser sees in <head>.
    expect(code).toMatch(/injectTo: "head-prepend"/);
  });

  it("merges tiny shared chunks instead of serving one file per icon", () => {
    const size = Number(/experimentalMinChunkSize:\s*([\d_]+)/.exec(code)?.[1]?.replace(/_/g, ""));
    // Big enough to fold one-icon files together, small enough not to pull other code into pages that do not need it: at 10 KB the
    // home page got slower on every measured run (see the note in vite.config.ts).
    expect(size).toBeGreaterThanOrEqual(2_000);
    expect(size).toBeLessThanOrEqual(5_000);
    // Vendor splitting is still in place next to it: CommonJS helpers stay in the React chunk.
    expect(code).toContain("manualChunks: vendorChunk");
  });

  it("keeps the font preconnects and the non-blocking font loading in the page", () => {
    const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
    expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
    expect(html).toMatch(/rel="preload" as="style" href="https:\/\/fonts\.googleapis\.com[^"]*" onload=/);
  });
});
