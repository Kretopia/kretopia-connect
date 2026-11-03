import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// compare_clipboard.sh tells an operator whether production's copy of a file can safely be overwritten. It once answered "DIFFERENT" about text
// that was not the file at all (the wrong thing on the clipboard), which reads as "production has its own changes". These tests run the real
// script against a throwaway repository: a wrong input must be REFUSED (exit 2, no verdict, nothing written), a right one must get exactly
// one of the three honest verdicts, and a candidate left by an earlier run must never survive to be mistaken for this run's.
vi.setConfig({ testTimeout: 60_000 });

const SCRIPT = resolve(__dirname, "../../../docs/security/phase5/paste-kit/compare_clipboard.sh");
const suite = process.platform === "win32" ? describe.skip : describe;

const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.test",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.test",
} as NodeJS.ProcessEnv;

const BASE_TS = `// Demo guard: a stand-in for a shared helper.
import { createClient } from "npm:@supabase/supabase-js@2";

export const LIMIT_PER_HOUR = 20;
export const WINDOW_MINUTES = 60;

export function decide(count: number | null): { ok: boolean; status?: number } {
  if (count === null) return { ok: false, status: 503 };
  if (count >= LIMIT_PER_HOUR) return { ok: false, status: 429 };
  return { ok: true };
}

export async function countSends(db: unknown, actor: string): Promise<number | null> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  void db; void actor; void since; void createClient;
  return 0;
}
`;
const HEAD_TS = `${BASE_TS}export const EXTRA_TEMPLATE = "extra-direct"; // added by the branch\n`;
const OTHER_TS = `// A different shared helper.
export type Role = "owner" | "editor" | "viewer";
export const ROLE_ORDER: Role[] = ["viewer", "editor", "owner"];
export function atLeast(role: Role, needed: Role): boolean {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(needed);
}
export function label(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
export const DEFAULT_ROLE: Role = "viewer";
`;
// Production moved a constant (a change the branch does not know about), in a different place from the branch's own addition.
const PROD_AHEAD_TS = BASE_TS.replace("LIMIT_PER_HOUR = 20", "LIMIT_PER_HOUR = 10");

const REL = "supabase/functions/_shared/demo.ts";
const RATE = "supabase/functions/_shared/aiRateLimit.ts"; // a path the script's export table knows
const NEWF = "supabase/functions/_shared/brandNew.ts";
const OUT = "docs/security/phase5/paste-kit";

const scratch: string[] = [];
afterEach(() => { while (scratch.length) rmSync(scratch.pop()!, { recursive: true, force: true }); });

const git = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, env, encoding: "utf8" });

/** A repository where demo.ts has a baseline commit and a later one, and brandNew.ts exists only after the baseline. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "kretopia-compare-"));
  scratch.push(dir);
  git(dir, "init", "-q", "-b", "main");
  const put = (path: string, body: string) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  const commit = (message: string, ...paths: string[]) => {
    expect(git(dir, "add", "--", ...paths).status).toBe(0);
    expect(git(dir, "commit", "-q", "-m", message).status).toBe(0);
    return git(dir, "rev-parse", "HEAD").stdout.trim();
  };
  put(REL, BASE_TS);
  put(RATE, "export function checkAiFeatureRateLimit(userId: string): boolean {\n  const window = 60;\n  return userId.length > 0 && window > 0;\n}\n// the rest of the module is unrelated filler to give it some size\nexport const RATE_WINDOW_SECONDS = 3600;\nexport const RATE_MAX_CALLS = 100;\nexport const RATE_LABEL = \"ai-feature-rate-limit\";\nexport const RATE_NOTE = \"calls are counted per user\";\n");
  const base = commit("baseline", REL, RATE);
  put(REL, HEAD_TS);
  put(NEWF, OTHER_TS);
  commit("branch", REL, NEWF);
  const compare = (path: string, clipboard: string, extra: Record<string, string> = {}) => {
    const r = spawnSync("bash", [SCRIPT, path], { cwd: dir, env: { ...env, COMPARE_BASE: base, ...extra }, input: clipboard, encoding: "utf8" });
    return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
  };
  const artifact = (kind: "production" | "merged", path = REL) => join(dir, OUT, kind, path);
  const plant = (kind: "production" | "merged", path = REL) => {
    mkdirSync(join(artifact(kind, path), ".."), { recursive: true });
    writeFileSync(artifact(kind, path), "STALE CANDIDATE FROM AN EARLIER RUN\n");
  };
  return { dir, compare, artifact, plant, put };
}

suite("compare_clipboard.sh: the three honest verdicts", () => {
  it("says identical when production already has this branch's version, and writes nothing", () => {
    const { compare, artifact } = makeRepo();
    const r = compare(REL, HEAD_TS);
    expect(r.status).toBe(0);
    expect(r.out).toContain("RESULT: identical to this branch");
    expect(existsSync(artifact("merged"))).toBe(false);
    expect(existsSync(artifact("production"))).toBe(false);
  });

  it("says identical to the baseline when production is not ahead: safe to overwrite", () => {
    const { compare } = makeRepo();
    const r = compare(REL, BASE_TS);
    expect(r.status).toBe(0);
    expect(r.out).toContain("RESULT: identical to the baseline");
    expect(r.out).toContain("safe to overwrite");
  });

  it("reads a Windows (CRLF) copy as the same file", () => {
    const { compare } = makeRepo();
    expect(compare(REL, HEAD_TS.replace(/\n/g, "\r\n")).out).toContain("RESULT: identical to this branch");
  });

  it("says DIFFERENT only for a real production change, keeps it, and writes a merge candidate with both sides", () => {
    const { compare, artifact } = makeRepo();
    const r = compare(REL, PROD_AHEAD_TS);
    expect(r.status).toBe(0);
    expect(r.out).toContain("RESULT: DIFFERENT from this branch and from the baseline");
    expect(r.out).toContain("Do NOT overwrite");
    expect(r.out).toContain("MERGE: clean");
    expect(readFileSync(artifact("production"), "utf8")).toBe(PROD_AHEAD_TS);
    const merged = readFileSync(artifact("merged"), "utf8");
    expect(merged).toContain("LIMIT_PER_HOUR = 10"); // what production added is kept
    expect(merged).toContain("EXTRA_TEMPLATE"); // and what the branch changes is applied
  });

  it("a file the repository only knows from this branch on is reported as new, with no merge", () => {
    const { compare, artifact } = makeRepo();
    const r = compare(NEWF, OTHER_TS.replace("DEFAULT_ROLE: Role = \"viewer\"", "DEFAULT_ROLE: Role = \"editor\""));
    expect(r.status).toBe(0);
    expect(r.out).toContain("RESULT: DIFFERENT from this branch");
    expect(r.out).not.toContain("and from the baseline");
    expect(r.out).toContain("this file is new in the branch");
    expect(existsSync(artifact("merged", NEWF))).toBe(false);
  });
});

suite("compare_clipboard.sh: what is not the file is refused, never judged", () => {
  const never = (out: string) => {
    expect(out).not.toContain("RESULT:");
    expect(out).not.toContain("DIFFERENT");
    expect(out).not.toContain("identical");
  };

  it("refuses another module of the project, which is what a wrong clipboard usually is", () => {
    const { compare, artifact } = makeRepo();
    const r = compare(REL, OTHER_TS);
    expect(r.status).toBe(2);
    expect(r.out).toContain(`REFUSED: what is on the clipboard is not ${REL}`);
    expect(r.out).toMatch(/shares only \d+% of its lines/);
    expect(r.out).toContain("Nothing was compared and nothing was written");
    never(r.out);
    expect(existsSync(artifact("merged"))).toBe(false);
    expect(existsSync(artifact("production"))).toBe(false);
  });

  it("refuses Markdown, such as a pasted note or chat message", () => {
    const { compare } = makeRepo();
    const r = compare(REL, "# Notes\n\nHere is the file I meant to copy:\n\n| a | b |\n| --- | --- |\n");
    expect(r.status).toBe(2);
    expect(r.out).toContain("Markdown");
    never(r.out);
  });

  it("refuses text with no import, no export and not the file's own first line", () => {
    const { compare } = makeRepo();
    const r = compare(REL, "const x = 1;\nconst y = 2;\n// just some code\nlet z = x + y;\n");
    expect(r.status).toBe(2);
    expect(r.out).toContain("no import, no export");
    never(r.out);
  });

  it("refuses an empty clipboard", () => {
    const { compare } = makeRepo();
    const r = compare(REL, "");
    expect(r.status).toBe(2);
    expect(r.out).toContain("clipboard is empty");
    never(r.out);
  });

  it("refuses a path outside the repository or a file that does not exist", () => {
    const { compare } = makeRepo();
    for (const bad of ["../outside.ts", "/etc/passwd", "supabase/functions/_shared/missing.ts"]) {
      const r = compare(bad, HEAD_TS);
      expect(r.status, bad).toBe(2);
      expect(r.out, bad).toContain("REFUSED");
      never(r.out);
    }
  });

  it("compares anyway only when told that production really rewrote the file", () => {
    const { compare } = makeRepo();
    const r = compare(REL, OTHER_TS, { COMPARE_SKIP_IDENTITY: "1" });
    expect(r.status).toBe(0);
    expect(r.out).toContain("RESULT: DIFFERENT");
  });
});

suite("compare_clipboard.sh: nothing stale survives, the export table still works", () => {
  it("removes a candidate left by an earlier run, whatever this run says", () => {
    const { compare, artifact, plant } = makeRepo();
    for (const [clipboard, status] of [[HEAD_TS, 0], [OTHER_TS, 2], ["", 2]] as const) {
      plant("merged"); plant("production");
      expect(compare(REL, clipboard).status).toBe(status);
      expect(existsSync(artifact("merged"))).toBe(false);
      expect(existsSync(artifact("production"))).toBe(false);
    }
  });

  it("still checks that the names the batch imports are exported by the production copy", () => {
    const { compare } = makeRepo();
    const base = readFileSync(join(__dirname, "../../../docs/security/phase5/paste-kit/compare_clipboard.sh"), "utf8");
    expect(base).toContain("supabase/functions/_shared/aiRateLimit.ts|checkAiFeatureRateLimit"); // the table is intact
    const ok = "export function checkAiFeatureRateLimit(userId: string): boolean {\n  const window = 60;\n  return userId.length > 0 && window > 0;\n}\n// the rest of the module is unrelated filler to give it some size\nexport const RATE_WINDOW_SECONDS = 3600;\nexport const RATE_MAX_CALLS = 100;\nexport const RATE_LABEL = \"ai-feature-rate-limit\";\nexport const RATE_NOTE = \"calls are counted per user\";\n";
    expect(compare(RATE, ok).out).toContain("EXPORTS: the batch imports 1 name(s) from this file and all appear exported");
    const renamed = ok.replace("checkAiFeatureRateLimit", "checkRate");
    expect(compare(RATE, renamed).out).toContain("EXPORTS MISSING in the production copy: checkAiFeatureRateLimit");
  });
});
