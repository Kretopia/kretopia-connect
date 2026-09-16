# Kaen — Contractor Onboarding

**Role:** Trial Engineer (1-week paid trial)
**Reports to:** Founder
**Status:** Restricted access until trial passes

---

## 1. Access tiers

| System | Access | How |
|---|---|---|
| **GitHub** | Read-only on `main`; Write on `kaen/*` branches | Add as **collaborator with Triage** role, or fork-and-PR flow. Enable branch protection on `main` (require PR + 1 review). |
| **Lovable** | Editor on **staging remix**, no access to prod project | Invite `kaen197517@gmail.com` to the staging project only. |
| **Backend (Cloud)** | Via Lovable staging editor only. No direct dashboard, no service-role key. | Staging is seeded from `scripts/sanitized-export.sh` (no PII). |
| **Production DB** | ❌ None during trial | — |
| **Secrets / API keys** | ❌ None. He requests, you add. | Use `secrets--add_secret`; never paste keys in chat. |
| **Domains / DNS** | ❌ None | — |
| **Stripe / KrePay** | ❌ None | — |
| **Email (Resend)** | ❌ None | — |
| **Analytics / metrics** | Read-only screenshots on request | — |

---

## 2. What to send him on Day 1

1. Repo link + `Kretopia_Technical_Snapshot_v0.1.docx`
2. Staging preview URL (Lovable) + test creator account
3. This document
4. First ticket (small, scoped — see §4)

---

## 3. Guardrails (non-negotiable)

- **No force-pushes.** Branch protection on `main`.
- **PRs only.** No direct commits to `main`. You review + merge.
- **No new dependencies** without approval — flag `package.json` diffs in review.
- **No schema migrations** in trial week. Read-only queries in staging.
- **No touching**: `src/integrations/supabase/client.ts`, `.env`, `supabase/config.toml`, auth flow, RLS policies, payment code, edge functions handling money.
- **No AI keys, no third-party auth setup, no email templates** sent from prod.
- Any secret needed → he tells you, you add it via Lovable secrets.

---

## 4. Trial ticket (pick one)

Small, isolated, measurable. Suggestions:

- **SEO pass:** meta titles + descriptions across public routes (`/`, `/passport/*`, `/scout`, `/kreto`). Deliverable: PR with before/after Lighthouse SEO scores.
- **Passport polish:** empty-state components for Stamps / Co-signs / Press Kit. Frontend only.
- **Landing accessibility audit:** axe-core report + PR fixing top 10.

Budget: 5–8 hours. Fixed fee. Paid on merge.

---

## 5. Evaluation criteria

- Reads existing patterns before writing new ones
- PR is scoped, no drive-by refactors
- Uses semantic tokens (no hardcoded colors)
- Writes for mobile-first + safe-area
- Communicates blockers early
- No secret leaks, no console noise

---

## 6. If trial passes

- Grant **Write** on `main` via PR (still no direct push)
- Add to staging + a scoped prod-editor role in Lovable
- Formal contract, NDA, IP assignment
- Still no service-role key, no DNS, no payments code

## 7. If trial fails

- Revoke Lovable + GitHub access same day
- Rotate any secret he touched (`secrets--rotate_*`)
- Close open branches
