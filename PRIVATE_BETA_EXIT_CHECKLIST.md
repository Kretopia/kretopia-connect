# Kretopia — Private Beta Exit Checklist (Phase 13)

Rule: a step is complete only when a real account executed it and evidence exists. "The component renders" is not evidence.
Status values: `NOT RUN` · `PASS` · `FAIL` · `BLOCKED`

| # | Step | Route | Expected result | Actual | Evidence | Severity if failing | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Search a real name | `/` → `/search?q=` | results from own base + web, no redirect to home | | screenshot + network log | critical | | NOT RUN |
| 2 | Claim Passport | `/claim` | disambiguation → credit selection → email save creates account | | account id | critical | | NOT RUN |
| 3 | Verify email / magic link | auth email | link lands signed-in on Passport | | inbox screenshot | critical | | NOT RUN |
| 4 | Confirm / edit / remove credits | `/profile` | edits persist, AI suggestions labelled and removable | | before/after rows | critical | | NOT RUN |
| 5 | Request a Co-Sign | credit → request verification | share link out (WhatsApp/email), request row created | | link + row | high | | NOT RUN |
| 6 | Complete a Co-Sign as guest | `/credit-verify/:token` | confirm/deny recorded, evidence state changes, both users notified | | screenshots | high | | NOT RUN |
| 7 | See a real scouted opportunity | `/opportunities` | at least one real gig with source + match reasoning grounded in Passport data | | gig id | high | | NOT RUN |
| 8 | Apply to it | opportunity detail | application recorded, company sees applicant | | rows both sides | high | | NOT RUN |
| 9 | Hire → create Studio | `/desk` | Studio created from the opportunity with brief imported | | project id | high | | NOT RUN |
| 10 | Add milestone + budget | Studio → Money | milestone persists, amounts server-validated | | milestone id | high | | NOT RUN |
| 11 | Sandbox payment | KrePay | funds captured, status confirmed by webhook not client | | webhook event id | critical | | BLOCKED (sandbox creds) |
| 12 | Release / approve milestone | Studio | only payer or project client can release | | 403 for third account | critical | | NOT RUN |
| 13 | Review after delivery | project review | review recorded, cannot be forged by anon (see security gate C.2) | | row + failed anon attempt | high | | BLOCKED (RLS finding) |
| 14 | Stronger Passport | `/profile` | completed work appears as evidence-backed credit | | passport diff | high | | NOT RUN |
| 15 | Public Passport share | `/:handle` | loads signed-out, no PII beyond intended fields | | anon browser | high | | NOT RUN |
| 16 | VideoCall | Studio → call | one-click join, no duplicate session, tracks released on exit | | console + devices off | medium | | NOT RUN |

## Cross-cutting checks

| Check | Status |
|---|---|
| Mobile (390px) pass on landing / Search / Passport / Studio | NOT RUN |
| Keyboard-only navigation on auth + claim flow | NOT RUN |
| `prefers-reduced-motion` respected on landing animations | NOT RUN |
| Signed-out access to every protected route redirects, never 500s | NOT RUN |
| Third-account access attempts return 403, not data | NOT RUN |

## Blockers before this checklist can be completed

1. `curated_stages` RLS finding (SECURITY_RELEASE_GATE.md §C.1) — needs migration approval.
2. `review_requests` anon-update finding — needs migration approval (blocks step 13 honestly passing).
3. Payments sandbox credentials + explicit approval (blocks step 11).
