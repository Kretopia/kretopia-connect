# Git guards

Two small hooks that exist because of one incident: on 2026-11-03 an automated "open a PR" run did a bulk add and pushed straight to
`main`, and 18 untracked production SQL scripts reached the public repository (commit `e649182dc`, taken back by PR 299). Nothing here
rewrites history; a mistake on a shared branch is repaired by adding a commit, not by erasing one.

| Hook | Refuses | Why |
|---|---|---|
| `pre-commit` | a commit while on `main` or `master` | work happens on a branch and reaches `main` through a pull request |
| `pre-commit` | a **new** (added, copied or renamed-in) `*.sql` outside `supabase/migrations/`, `drizzle/migrations/` and `docs/security/` | a production script is either a migration or a reviewed paste script; editing or deleting a tracked one is not blocked |
| `pre-push` | any push whose destination is `main` or `master` (`HEAD:main`, `feature:main`, `main`, a deletion) | the same rule, one step later, for a branch that was committed under another name |

## Install

```bash
sh scripts/install-git-hooks.sh            # install (idempotent)
sh scripts/install-git-hooks.sh --check    # exit 1 when not installed
sh scripts/install-git-hooks.sh --uninstall
```

The installer puts a small shim in the clone's hooks directory, which every worktree of the clone shares. The shim runs the guard from the
working tree the command runs in, then the hook that was already there (kept as `<hook>.before-kretopia-guard`: the existing `pre-push`
that blocks the frozen Buildathon repository and force-pushes keeps running). It never sets `core.hooksPath`, which would replace those
hooks. A checkout or branch that predates `scripts/git-hooks/` has nothing to run, so the shim lets it through.

## The way to work, so that none of this triggers

```bash
git switch -c <name> --no-track origin/main    # --no-track: the branch's upstream is never origin/main
git add -- <file> [<file> ...]                 # explicit paths; never `git add .`, `git add -A` or `git commit -a`
git add -f -- docs/<file>                      # docs/ is git-ignored; a tracked doc is added on purpose with -f
git commit
git push -u origin <name>                      # never `git push origin HEAD:main`
gh pr create --repo Kretopia/kretopia-connect
```

`gh` resolves the repository from `remote.origin.gh-resolved`, which in this clone points at the archived `Kretopia/kretopia-app`: always
pass `--repo`, or run `gh repo set-default Kretopia/kretopia-connect` once.

## What these hooks are not

They are a safety net on this machine, not a lock. `git commit --no-verify` and `git push --no-verify` skip them, a clone without them
installed has no guard, and a tool that pushes from elsewhere is not stopped. The lock is on GitHub: a branch protection rule or ruleset
for `main` that requires a pull request and does not let anyone push directly. Only a repository admin can set that; it is not set by
anything in this repository.
