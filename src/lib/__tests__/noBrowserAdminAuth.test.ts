import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// `supabase.auth.admin.*` needs the service-role key. In the browser it can only fail (production answers 403 `not_admin`),
// and putting a service key in the bundle would be far worse. Server-side code lives under supabase/functions, outside src/.
const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("browser code and the Supabase admin API", () => {
  it("never calls auth.admin from src/", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => /\bauth\s*\.\s*admin\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  it("both Delete Account handlers go through the shared RPC helper", () => {
    for (const file of ["src/pages/Settings.tsx", "src/components/profile/SettingsTab.tsx"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain("deleteOwnAccount");
      expect(source, file).not.toMatch(/deleteUser/);
    }
  });
});
