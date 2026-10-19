# Sentry plan

Status: `@sentry/react` ^10.17 is already installed and initialised in `src/main.tsx`. Browser only. No SDK is added by this plan.

## What exists today
- `Sentry.init` with `dsn: import.meta.env.VITE_SENTRY_DSN || ""`, `enabled: import.meta.env.PROD`, `environment: MODE`.
- `tracesSampleRate: 1.0` (every transaction), `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`.
- Replay runs with `maskAllText: false` and `blockAllMedia: false`: call screens, messages, invoices, and Passport data can be recorded in clear.
- No release tag, no source maps, nothing in Edge Functions.
- Second channel: `setupGlobalErrorLogging()` writes to `client_error_logs` (656 rows, latest today). Keep it; it works without a DSN.

## Changes to make (config only, one small PR, needs approval because it touches `src/main.tsx`)
1. Set `maskAllText: true` and `blockAllMedia: true` in `replayIntegration`.
2. Set `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0.01`; keep `replaysOnErrorSampleRate: 1.0` (masked).
3. Add `release` from the build (`import.meta.env.VITE_RELEASE`, the git SHA) so an issue maps to a commit.
4. `beforeSend`: drop `user.email`, `user.ip_address`, request bodies, and breadcrumbs from `/functions/v1/*` payloads. Keep `user.id` only.
5. Tags: `feature` in {`calls`, `recordings`, `match`, `passport`, `credits`, `payments`, `onboarding`}.

## Events to watch
| Event | Rule | Threshold | Route |
|---|---|---|---|
| Any new issue in production | Issue alert, first seen | any | Slack `#alerts` |
| Error spike | Error count, all issues | > 50 in 10 min | Slack, SEV3 |
| Calls broken | `feature:calls` events | >= 5 users in 10 min | page, SEV2 |
| Recording start failure | message "Recording failed" or `recording-error` | >= 3 in 15 min | Slack, SEV3 |
| Payment UI error | `feature:payments` unhandled | >= 1 | page, SEV2 |
| Crash-free sessions | Release health | < 99% over 1 h | Slack, SEV3 |
| Slow page | LCP p75 | > 4 s over 1 h | weekly review |
| Quota | Events or replays | > 80% of monthly plan | email owner |

## Edge Functions
Not instrumented. Errors reach the Supabase function logs only (`GRAFANA_SUPABASE_PLAN.md`). Adding `@sentry/deno` is a separate decision; not part of this plan.

## Secrets (names only)
`VITE_SENTRY_DSN` (Lovable project environment), `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (only if source maps are uploaded from CI). No value is stored in the repo.

## Setup
1. Create a Sentry project (platform React) and an alert owner group.
2. Put the DSN in the Lovable environment as `VITE_SENTRY_DSN`; publish; confirm the first test issue (throw in the console on a preview host with `enabled` overridden).
3. Create the alert rules in the table above.
4. Land the config PR (changes 1 to 5); publish; verify masking in one replay.
5. Optional: upload source maps from `ci.yml` using `SENTRY_AUTH_TOKEN` once CI builds the artefact that is published (today Lovable builds it, so this is not possible yet).

## Rollback
Empty `VITE_SENTRY_DSN` and publish: the SDK is disabled. Revert the config PR for sampling or masking. `client_error_logs` keeps working.
