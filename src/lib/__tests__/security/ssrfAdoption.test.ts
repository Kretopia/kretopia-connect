import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isBlockedIp } from "../../../../supabase/functions/_shared/ssrf";

const USER_URL_FETCHERS = ["analyze-profile-url", "import-profile-url", "import-profile-from-url", "scrape-thumbnail", "epk-og-image"];

describe("user-supplied URL fetches use the SSRF guard", () => {
  for (const fn of USER_URL_FETCHERS) {
    it(`${fn} never fetches a caller URL directly`, () => {
      const src = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
      expect(src).toContain("safeFetch(");
      expect(src).not.toMatch(/await fetch\((url|imageUrl)\b/);
      expect(src).not.toMatch(/redirect:\s*['"]follow['"]/);
    });
  }
  it("blocks metadata, loopback and private targets", () => {
    for (const ip of ["169.254.169.254", "127.0.0.1", "10.0.0.5", "192.168.1.1", "::1", "::ffff:7f00:1"]) expect(isBlockedIp(ip)).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});
