import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Clients may not read every column of `opportunities` (guest contact and claim-token columns are revoked: 20260905110000,
 * 20261009100000). A query on that table that asks for all columns, a bare select() or select("*"), is refused by the database
 * with "permission denied for table opportunities". On an insert that means the whole post fails, which is how a company's brief
 * could not be posted in production. Ask for named columns.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("queries on the opportunities table name their columns", () => {
  it("no client query on opportunities selects every column", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\.from\((["'])opportunities\1\)/g)) {
        // The chain of this one query: what follows up to the next .from( or the end of the statement.
        const rest = text.slice(m.index! + m[0].length, m.index! + m[0].length + 4000);
        const chain = rest.split(/\.from\(/)[0].split(/;\s*\n/)[0];
        if (/\.select\(\s*\)/.test(chain) || /\.select\(\s*(["'])\*\1/.test(chain)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
