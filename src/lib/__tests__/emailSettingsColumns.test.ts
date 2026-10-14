import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_SETTINGS_COLUMNS } from "../outreach/emailSettingsColumns";

const SRC = resolve(__dirname, "../../");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/legacyTypes|types\.ts$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("the browser never loads the stored Gmail app password", () => {
  it("the allowed column list does not contain the credential", () => {
    expect(EMAIL_SETTINGS_COLUMNS).not.toMatch(/password|secret|token/i);
    expect(EMAIL_SETTINGS_COLUMNS.split(",").map((c) => c.trim())).toEqual(
      expect.arrayContaining(["gmail_email", "is_configured", "provider"]),
    );
  });

  it("no client code reads user_email_settings with select('*')", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("user_email_settings")) continue;
      // a `.from("user_email_settings" ...)` followed, before the next statement,
      // by a select of "*" or of a column list that names the credential
      const re = /\.from\(\s*["']user_email_settings["'][^)]*\)\s*\.select\(\s*([^)]*)\)/g;
      for (const m of source.matchAll(re)) {
        const arg = m[1].trim();
        if (arg === '"*"' || arg === "'*'" || /password/i.test(arg) || arg === "") {
          offenders.push(`${file.replace(SRC, "src")}: .select(${arg})`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // Walks the whole source tree: it takes seconds under a parallel full run,
    // so it carries its own timeout instead of the 5 s default.
  }, 60_000);

  it("the two outreach readers use the shared column list", () => {
    const read = (p: string) => readFileSync(resolve(SRC, p), "utf8");
    expect(read("components/sales/GmailSettings.tsx")).toContain(".select(EMAIL_SETTINGS_COLUMNS)");
    expect(read("components/thrive-ai/outreach/useOutreachData.ts")).toContain(".select(EMAIL_SETTINGS_COLUMNS)");
  });
});
