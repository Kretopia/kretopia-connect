import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// credits, awards and press_links each have a CHECK constraint on verification_status, and application code has
// shipped a new status without the constraint more than once (peer, self_reported, then manual, imported and
// ai_imported): every such write is rolled back, and a caller that ignores the error loses the row without a word.
// This reads the LATEST constraint of each table from the migrations and fails when code inserts a row with a status
// the constraint does not list.
const root = resolve(__dirname, "../../..");

const TABLES = [
  { table: "credits", constraint: "credits_verification_status_check" },
  { table: "awards", constraint: "awards_verification_status_check" },
  { table: "press_links", constraint: "press_links_verification_status_check" },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

function allowedStatuses(constraint: string): string[] {
  const dir = join(root, "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const latest = [...files].reverse().find((f) => readFileSync(join(dir, f), "utf8").includes(`ADD CONSTRAINT ${constraint}`));
  expect(latest, `a migration defining ${constraint}`).toBeTruthy();
  const sql = readFileSync(join(dir, latest!), "utf8");
  const from = sql.indexOf(`ADD CONSTRAINT ${constraint}`);
  const block = sql.slice(from, sql.indexOf(";", from));
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

/** The text between the parentheses of the `.insert(` that starts at `open` (the index just after the `(`). */
function insertBody(text: string, open: number): string {
  let depth = 1;
  let i = open;
  while (i < text.length && depth > 0) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
    i += 1;
  }
  return text.slice(open, i - 1);
}

const files = [...walk(join(root, "src")), ...walk(join(root, "supabase/functions"))];

describe("every insert uses a verification_status its table's constraint allows", () => {
  for (const { table, constraint } of TABLES) {
    describe(table, () => {
      const allowed = allowedStatuses(constraint);
      const writes: { file: string; status: string }[] = [];
      const re = new RegExp(`from\\((['"])${table}\\1\\)\\s*\\.insert\\(`, "g");
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(re)) {
          const body = insertBody(text, m.index! + m[0].length);
          for (const s of body.matchAll(/verification_status:\s*(['"])([a-z_]+)\1/g)) {
            writes.push({ file: file.replace(root + "/", ""), status: s[2] });
          }
        }
      }

      it("reads a plausible constraint", () => {
        expect(allowed).toEqual(expect.arrayContaining(["unverified", "pending"]));
      });

      it("none writes a status outside the constraint", () => {
        expect(writes.filter((w) => !allowed.includes(w.status))).toEqual([]);
      });

      if (table === "credits") {
        it("finds the credit inserts it is supposed to check", () => {
          expect(writes.length).toBeGreaterThan(5);
        });
      }
    });
  }
});
