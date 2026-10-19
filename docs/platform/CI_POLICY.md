# CI policy

Workflow: `.github/workflows/ci.yml` (pull requests and pushes to `main`). It never deploys.

## What CI runs, in order, stopping at the first failure
1. `npm install` (see lockfile gap below)
2. `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): **blocking**
3. `npm run lint`: **advisory** (`continue-on-error`): `eslint .` has a large pre-existing error baseline
4. `npm test` (vitest): **blocking**, with 7 known-broken test files excluded by name in the workflow
5. `npm run build`: **blocking**

## Required before merge (GitHub branch protection on `main`)
- Require a pull request; no direct pushes to `main`, including administrators.
- Require the `CI / verify` status check to pass and the branch to be up to date.
- Require one approving review; dismiss stale approvals on new commits.
- Restrict force pushes and branch deletion on `main` (Lovable syncs from `main`; rewriting history loses project history).
- Lovable's bot commits to `main` directly. Either allow `gpt-engineer-app[bot]` as the only bypass actor, or route Lovable through a branch. Decide before enabling the rule.

## Rollback rule
- A merge that breaks production is reverted with `git revert <merge-sha>` in a new PR (never force-push).
- Frontend: revert, merge, then Publish in the Lovable project. Edge functions: see `DEPLOYMENT_RUNBOOK.md`. Migrations are never reverted by CI; a bad migration gets a written forward fix.
- Revert first, diagnose second, when a deploy causes a SEV1/SEV2 (`INCIDENT_RUNBOOK.md`).

## Known gaps (one line each)
- TODO: `package-lock.json` is stale (supabase-js 2.58.0 vs `^2.116.0` in `package.json`), and `bun.lock` points at Lovable's private registry, so `npm ci` and `bun install --frozen-lockfile` both fail outside Lovable. Regenerate the lock against the public registry, then switch CI to `npm ci`.
- TODO: no `.nvmrc`/`engines`; CI pins Node 22. Pin the same version in the repo.
- TODO: 7 excluded test files (`PWAInstallPrompt`, `ChapterProgressNav`, `ProjectNotes.continuity`, `VoiceFirstCreateModal`, `useAccountTone`, `cacheSweep`, `draftAndNoteSave`: 36 failing tests) and the lint baseline. Fix, then delete the excludes and `continue-on-error`.
- TODO: edge functions run in Deno and are not type-checked by `typecheck` (only their vitest tests run).
