import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// project_collaborators.role is constrained to member, client, creative and guest
// (project_collaborators_role_check, 20260825100000). Code that wrote 'collaborator' (the @mention invite in a
// project chat) or 'owner' (a row the creator never needs: the owner is derived from projects.created_by) had every
// write rejected by the constraint. This reads the latest constraint from the migrations and fails when code writes
// a literal role it does not list, so a new role cannot ship without the constraint (the same drift class as
// credits.verification_status, see creditStatusWrites.test.ts).
const root = resolve(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

function allowedRoles(): string[] {
  const dir = join(root, "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const latest = [...files].reverse().find((f) => readFileSync(join(dir, f), "utf8").includes("ADD CONSTRAINT project_collaborators_role_check"));
  expect(latest).toBeTruthy();
  const sql = readFileSync(join(dir, latest!), "utf8");
  const from = sql.indexOf("ADD CONSTRAINT project_collaborators_role_check");
  return [...sql.slice(from, sql.indexOf(";", from)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function callBody(text: string, open: number): string {
  let depth = 1;
  let i = open;
  while (i < text.length && depth > 0) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
    i += 1;
  }
  return text.slice(open, i - 1);
}

describe("every literal role written to project_collaborators is one the constraint allows", () => {
  const allowed = allowedRoles();
  const writes: { file: string; role: string }[] = [];
  const re = /from\((['"])project_collaborators\1\)\s*\.(insert|upsert|update)\(/g;
  for (const file of [...walk(join(root, "src")), ...walk(join(root, "supabase/functions"))]) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(re)) {
      for (const r of callBody(text, m.index! + m[0].length).matchAll(/\brole:\s*(['"])([a-z_]+)\1/g)) {
        writes.push({ file: file.replace(root + "/", ""), role: r[2] });
      }
    }
  }

  it("reads the four roles", () => {
    expect(allowed.sort()).toEqual(["client", "creative", "guest", "member"]);
  });

  it("finds the writes it is supposed to check", () => {
    expect(writes.length).toBeGreaterThan(3);
  });

  it("none writes a role outside the constraint", () => {
    expect(writes.filter((w) => !allowed.includes(w.role))).toEqual([]);
  });
});
