import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// The guards are shell scripts, so these tests run them for real: every case builds a throwaway repository and a bare "remote" in the temp
// directory, installs the guards with the real installer, and tries the commits and pushes that caused the incident of 2026-11-03 (18 SQL
// files swept in by a bulk add and pushed straight to main). Nothing here touches the repository the tests run from.
vi.setConfig({ testTimeout: 60_000 });

const ROOT = resolve(__dirname, "../../..");
const suite = process.platform === "win32" ? describe.skip : describe;

// Hooks run by git inherit GIT_DIR and friends; a throwaway repo must not see the caller's, nor the machine's own git configuration.
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.test",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.test",
} as NodeJS.ProcessEnv;

const run = (cwd: string, cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
};
const git = (cwd: string, ...args: string[]) => run(cwd, "git", args);
const installer = (cwd: string, ...args: string[]) => run(cwd, "sh", ["scripts/install-git-hooks.sh", ...args]);

const scratch: string[] = [];
afterEach(() => { while (scratch.length) rmSync(scratch.pop()!, { recursive: true, force: true }); });

const PREVIOUS_HOOK = (code: number) => `#!/bin/sh\ncat >> "$(dirname "$0")/previous-push.log"\nexit ${code}\n`;

/** A repository with one commit on main already pushed to its bare remote, the guards copied in but not yet installed. */
function makeRepo(opts: { previousPrePush?: number; install?: boolean } = {}) {
  const base = mkdtempSync(join(tmpdir(), "kretopia-guards-"));
  scratch.push(base);
  const remote = join(base, "remote.git");
  const work = join(base, "work");
  mkdirSync(work);
  git(base, "init", "-q", "--bare", "-b", "main", remote);
  git(work, "init", "-q", "-b", "main");
  git(work, "remote", "add", "origin", remote);

  for (const file of ["scripts/git-hooks/pre-commit", "scripts/git-hooks/pre-push", "scripts/install-git-hooks.sh"]) {
    mkdirSync(join(work, file, ".."), { recursive: true });
    copyFileSync(join(ROOT, file), join(work, file));
    chmodSync(join(work, file), 0o755);
  }
  mkdirSync(join(work, "security"));
  writeFileSync(join(work, "security/old.sql"), "select 1;\n");
  mkdirSync(join(work, "supabase/migrations"), { recursive: true });
  writeFileSync(join(work, "supabase/migrations/a.sql"), "select 2;\n");
  git(work, "add", "--", "security/old.sql", "supabase/migrations/a.sql", "scripts");
  expect(git(work, "commit", "-q", "-m", "baseline").status).toBe(0); // before the guards exist: main is allowed
  expect(git(work, "push", "-q", "origin", "main").status).toBe(0);

  const hooks = join(work, ".git/hooks");
  if (opts.previousPrePush !== undefined) {
    writeFileSync(join(hooks, "pre-push"), PREVIOUS_HOOK(opts.previousPrePush));
    chmodSync(join(hooks, "pre-push"), 0o755);
  }
  if (opts.install !== false) expect(installer(work).status).toBe(0);
  return { base, work, remote, hooks, remoteRef: (ref: string) => git(remote, "rev-parse", "--verify", "-q", ref) };
}

/** Writes `path` (creating folders), stages exactly that path, and tries to commit it. */
function commitFile(work: string, path: string, body = "select 3;\n") {
  mkdirSync(join(work, path, ".."), { recursive: true });
  writeFileSync(join(work, path), body);
  expect(git(work, "add", "-f", "--", path).status).toBe(0);
  return git(work, "commit", "-q", "-m", `add ${path}`);
}
const onBranch = (work: string, name = "feature") => expect(git(work, "switch", "-q", "-c", name, "--no-track", "main").status).toBe(0);

suite("install-git-hooks.sh", () => {
  it("installs both guards, keeps the hook that was already there, and does it again without losing it", () => {
    const { work, hooks } = makeRepo({ previousPrePush: 0 });
    for (const hook of ["pre-commit", "pre-push"]) expect(readFileSync(join(hooks, hook), "utf8")).toContain("kretopia-guard-shim");
    expect(readFileSync(join(hooks, "pre-push.before-kretopia-guard"), "utf8")).toBe(PREVIOUS_HOOK(0));

    const again = installer(work);
    expect(again.status).toBe(0);
    expect(readFileSync(join(hooks, "pre-push.before-kretopia-guard"), "utf8")).toBe(PREVIOUS_HOOK(0)); // not replaced by our own shim
    expect(installer(work, "--check").status).toBe(0);
  });

  it("--uninstall removes the guards and puts the previous hook back byte for byte", () => {
    const { work, hooks } = makeRepo({ previousPrePush: 0 });
    expect(installer(work, "--uninstall").status).toBe(0);
    expect(existsSync(join(hooks, "pre-commit"))).toBe(false);
    expect(readFileSync(join(hooks, "pre-push"), "utf8")).toBe(PREVIOUS_HOOK(0));
    expect(existsSync(join(hooks, "pre-push.before-kretopia-guard"))).toBe(false);
    expect(installer(work, "--check").status).toBe(1);
  });

  it("refuses to install where git would ignore the hooks directory (core.hooksPath)", () => {
    const { work, hooks } = makeRepo({ install: false });
    git(work, "config", "core.hooksPath", "elsewhere");
    const result = installer(work);
    expect(result.status).toBe(1);
    expect(result.out).toContain("core.hooksPath");
    expect(existsSync(join(hooks, "pre-commit"))).toBe(false);
  });
});

suite("pre-commit: main", () => {
  it("refuses a commit on main and names the command to use instead", () => {
    const { work } = makeRepo();
    const before = git(work, "rev-parse", "HEAD").out;
    const result = commitFile(work, "notes.txt", "hello\n");
    expect(result.status).not.toBe(0);
    expect(result.out).toContain("refusing to commit on 'main'");
    expect(result.out).toContain("git switch -c <name> --no-track origin/main");
    expect(git(work, "rev-parse", "HEAD").out).toBe(before);
  });

  it("lets the same commit through on a branch", () => {
    const { work } = makeRepo();
    onBranch(work);
    expect(commitFile(work, "notes.txt", "hello\n").status).toBe(0);
  });
});

suite("pre-commit: SQL", () => {
  it.each([
    "security/new.sql",
    "new.sql",
    "supabase/functions/x/new.sql",
    "docs/other/new.sql",
    "security/été final.sql",
    "security/UPPER.SQL",
  ])("refuses a new SQL file at %s, and says which one", (path) => {
    const { work } = makeRepo();
    onBranch(work);
    const result = commitFile(work, path);
    expect(result.status).not.toBe(0);
    expect(result.out).toContain("refusing to add SQL outside");
    expect(result.out).toContain(path);
  });

  it.each([
    "supabase/migrations/20261103000000_x.sql",
    "drizzle/migrations/0009_x.sql",
    "docs/security/phase5/manual-sql/J_x/apply.sql",
  ])("accepts a new SQL file at %s", (path) => {
    const { work } = makeRepo();
    onBranch(work);
    expect(commitFile(work, path).status).toBe(0);
  });

  it("lets a tracked SQL file be edited or deleted wherever it lives", () => {
    const { work } = makeRepo();
    onBranch(work);
    writeFileSync(join(work, "security/old.sql"), "select 1; -- edited\n");
    expect(git(work, "add", "--", "security/old.sql").status).toBe(0);
    expect(git(work, "commit", "-q", "-m", "edit").status).toBe(0);
    expect(git(work, "rm", "-q", "--", "security/old.sql").status).toBe(0);
    expect(git(work, "commit", "-q", "-m", "delete").status).toBe(0);
  });

  it("treats a rename into a bad folder as an add, and a rename between allowed folders as fine", () => {
    const { work } = makeRepo();
    onBranch(work);
    expect(git(work, "mv", "supabase/migrations/a.sql", "security/a.sql").status).toBe(0);
    const bad = git(work, "commit", "-q", "-m", "move out");
    expect(bad.status).not.toBe(0);
    expect(bad.out).toContain("security/a.sql");

    expect(git(work, "reset", "-q").status).toBe(0);
    git(work, "checkout", "-q", "--", ".");
    rmSync(join(work, "security/a.sql"), { force: true });
    expect(git(work, "mv", "supabase/migrations/a.sql", "supabase/migrations/b.sql").status).toBe(0);
    expect(git(work, "commit", "-q", "-m", "rename inside").status).toBe(0);
  });
});

suite("pre-push", () => {
  it.each(["HEAD:main", "feature:main", "HEAD:refs/heads/main", ":main"])("refuses `git push origin %s` and leaves the remote alone", (spec) => {
    const { work, remoteRef } = makeRepo();
    onBranch(work);
    expect(commitFile(work, "notes.txt", "hello\n").status).toBe(0);
    const mainBefore = remoteRef("refs/heads/main").out;
    const result = git(work, "push", "origin", spec);
    expect(result.status).not.toBe(0);
    expect(result.out).toContain("pre-push: refusing to push"); // ours, not a server-side refusal
    expect(remoteRef("refs/heads/main").out).toBe(mainBefore);
  });

  it("refuses `git push origin main` too", () => {
    const { work, remoteRef } = makeRepo();
    // Git only calls pre-push when there is something to push, so main needs a commit the remote lacks: one made before the guards were
    // installed, or with --no-verify (which pre-commit cannot stop).
    writeFileSync(join(work, "notes.txt"), "hello\n");
    expect(git(work, "add", "--", "notes.txt").status).toBe(0);
    expect(git(work, "commit", "-q", "--no-verify", "-m", "a commit on main that skipped the guard").status).toBe(0);
    const mainBefore = remoteRef("refs/heads/main").out;
    const result = git(work, "push", "origin", "main");
    expect(result.status).not.toBe(0);
    expect(result.out).toContain("pre-push: refusing to push");
    expect(remoteRef("refs/heads/main").out).toBe(mainBefore);
  });

  it("publishes a branch with `git push -u origin <name>`", () => {
    const { work, remoteRef } = makeRepo();
    onBranch(work);
    expect(commitFile(work, "notes.txt", "hello\n").status).toBe(0);
    expect(git(work, "push", "-q", "-u", "origin", "feature").status).toBe(0);
    expect(remoteRef("refs/heads/feature").status).toBe(0);
  });
});

suite("chaining with the hook that was already there", () => {
  it("still runs the previous pre-push, which receives the refs being pushed", () => {
    const { work, hooks } = makeRepo({ previousPrePush: 0 });
    onBranch(work);
    expect(commitFile(work, "notes.txt", "hello\n").status).toBe(0);
    expect(git(work, "push", "-q", "-u", "origin", "feature").status).toBe(0);
    expect(readFileSync(join(hooks, "previous-push.log"), "utf8")).toContain("refs/heads/feature");
  });

  it("a previous hook that refuses still blocks a push our guard allows", () => {
    const { work, remoteRef } = makeRepo({ previousPrePush: 1 });
    onBranch(work);
    expect(commitFile(work, "notes.txt", "hello\n").status).toBe(0);
    expect(git(work, "push", "-q", "-u", "origin", "feature").status).not.toBe(0);
    expect(remoteRef("refs/heads/feature").status).not.toBe(0);
  });

  it("a checkout without scripts/git-hooks has nothing to run, is let through, and the previous hook still runs", () => {
    const { work, hooks } = makeRepo({ previousPrePush: 0 });
    rmSync(join(work, "scripts/git-hooks"), { recursive: true });
    expect(commitFile(work, "notes.txt", "hello\n").status).toBe(0); // on main: only the guard would have stopped it
    expect(git(work, "push", "-q", "origin", "main").status).toBe(0);
    expect(readFileSync(join(hooks, "previous-push.log"), "utf8")).toContain("refs/heads/main");
  });
});
