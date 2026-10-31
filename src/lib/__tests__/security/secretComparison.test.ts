import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "supabase/functions");

describe("secret comparison hardening", () => {
  it("removes the VAPID private-key generator endpoint", () => {
    expect(existsSync(join(root, "generate-vapid-keys"))).toBe(false);
  });

  it.each(["preview-transactional-email", "auth-email-hook", "inbox-triage-agent"])(
    "%s compares its shared secret in constant time",
    (name) => {
      const src = readFileSync(join(root, name, "index.ts"), "utf8");
      expect(src).toContain("constantTimeEqual(");
    },
  );

  it("no entrypoint compares a key or secret with plain equality", () => {
    const offenders: string[] = [];
    for (const dir of readdirSync(root)) {
      const file = join(root, dir, "index.ts");
      if (!existsSync(file)) continue;
      const src = readFileSync(file, "utf8");
      if (/(!==|===)\s*(\w*(Key|Secret|SECRET|KEY)\b|`Bearer \$\{)/.test(src)) offenders.push(dir);
    }
    expect(offenders).toEqual([]);
  });
});
