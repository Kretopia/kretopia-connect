# Company Experience: where the gate stands, and the first server-side primitive

The program's rule: no Company Experience feature until its security gate is proven; when it begins, use the canonical workspace, project, user and role records, never silently merge personal and company data, enforce authorisation server-side, test owner, company admin, member, client or guest, revoked and unrelated user, and ship nothing that is only visual. This document is the state of that gate (matrix rows 1 to 3 and the dependants) and what has been built under it. **No schema, policy, grant, UI or product behaviour changed.**

## 1. What exists today (repository; production was not readable)
| Item | State |
|---|---|
| `organizations(id, name, owner_id)` and `organization_members(org_id, user_id, role in owner, admin, member)` | created by `20260912130000_minimal_org_workspace_layer.sql`, RLS enabled, **inert**: its header states no RLS references `org_id` and there is no UI and no billing |
| `is_org_member(_org_id, _user_id)` | SECURITY DEFINER helper in that migration; **no policy, function or UI uses it** (searched `supabase/functions`, `src`, later migrations) |
| `projects.org_id`, `profiles.org_id` | nullable; `20260913100000` excludes `org_id` from the client UPDATE grant on projects (clients cannot set it); no backfill |
| `engagements` | created `20260913140000`; `UNIQUE(project_id)`; the canonical engagement record |
| "Company" in the product today | an **account mode** per user (`BrandWorkHome`, the account-tone query, Company Studio through the existing project workspace, KrePay's Company presentation): a presentation of one user's own data, not an organization boundary |

So the product has company *presentation* but no company *authority*: no server rule says who belongs to a company, what a member may see, or what removing one revokes.

## 2. Gate status
| Gate (matrix) | Status | Why |
|---|---|---|
| 1. Company ownership boundary | **STUB, decision owed** | organization semantics are undecided in the migration's own header (D1 to D4 below) |
| 2. Membership and roles | **STUB: primitive built, not wired** | the rule now exists as a tested pure function; no consumer, policy or UI |
| 3. Project and engagement access | PARTIAL | `projectAccess.ts` strict (accepted only) is deployed in `main`; the match-participant branch and call-operator exceptions remain; the applied state of `20261009090200` is unverified |
| 4. Guest and client token scope | UNSAFE until M-C / M-D | SQL; not this slice |
| Company home, Work, Library, Calendar, Clients, Settings (rows 22 to 34) | **NOT STARTED**, correctly | each waits for rows 1 to 3 |

## 3. What was built: `_shared/orgAccess.ts` + 21 tests
Two pure decisions, no I/O, wired to nothing, covering exactly the matrix the program requires:
- `decideOrgAccess({ userId, orgId, membership, action })`: owner can do everything; an admin everything except `delete_company` and `transfer_ownership`; a member only `view_company`; **no membership row (never a member, or removed) is "not found" (404), not "forbidden"**, so a company's existence is not disclosed; another company's row, another user's row, an unknown role string and an unknown action are all denied; unauthenticated is 401.
- `decideCompanyProjectAccess({ …, projectOrgId, isAcceptedCollaborator })`: a project with **no `org_id` is personal and unreachable through any company role**; a project of another company is not found, even for its owner; the company owner and an admin reach their company's projects; a member, a client, a guest or a freelancer reach a company project **only as its accepted collaborator**, and learn nothing about a project they are not on.

The tests are the matrix: owner, admin, member, client or guest, revoked, unrelated, other-company, personal project, unknown action, `toString` / `__proto__` as an action (the test caught a prototype-key bug in the first version, now fixed).

## 4. Decisions owed (nothing below is assumed in code beyond what section 3 states)
| # | Decision | My recommendation | Why it matters |
|---|---|---|---|
| D1 | What is a company? | a workspace that owns projects through `projects.org_id`, set explicitly, never inferred | personal and company data must never merge silently |
| D2 | Roles at launch | owner only plus scoped members (CE p.32); keep `admin` in the schema, unused until enforced | CE forbids a role UI before enforcement |
| D3 | Does membership grant access to a member's *personal* projects? | **No.** A company reaches only projects whose `org_id` is the company's | the one rule that prevents a leak by design |
| D4 | Does a member see all company projects, or only those they collaborate on? | only those they collaborate on (scoped), unless owner or admin | what `decideCompanyProjectAccess` encodes today |
| D5 | Existing projects | no backfill; a project joins a company by an explicit act of its owner | `org_id` is nullable and unused |
| D6 | Billing and caps per company | per user for now | out of scope until D1 to D5 |

## 5. Order of work from here (each is its own slice; none started)
1. Decide D1 to D5.
2. A read-only inventory of the **production** org tables (columns, policies, grants, row counts), because only the repository was readable here.
3. RLS and policies for `organizations` and `organization_members` as a reviewed migration (proposal first), then a server route to create a company and add or remove a member that calls `decideOrgAccess`.
4. Only then a Company surface, reading company projects through `decideCompanyProjectAccess`; the first one is "Company Work" (matrix row 23), because it needs no new data.
5. Two-account tests on a real backend for owner, admin, member, client, revoked and unrelated user, before anything is shown.

## 6. Not done
No table, policy, grant, function route or screen was added. The primitive is unused until step 3. Whether production's `organization_members` has rows or policies is unknown from here.
