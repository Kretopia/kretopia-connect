# Role-Aware Financial Visibility — Dashboard

## The gap this closes

`StudioProjectsDashboard`'s `canSeeMoney` prop existed but was never
passed by `WorkHome.tsx` — always defaulted to `true`. `StudioCardsGrid`
had no such prop at all; it rendered the pay dot for every project
unconditionally. Both are real gaps: `CreatorWorkHome`'s project query
(`supabase.from("projects").select("*")`, no `created_by` filter) is
already known to return every Project the viewer has *any* access to —
owner, collaborator, client, or guest — not just ones they own, so a
single global flag can never correctly gate a list that mixes roles.

## What changed

Added `moneyVisibleByProject?: Record<string, boolean>` to both
`StudioProjectsDashboard` and `StudioCardsGrid`. Convention: **missing
from the map = not visible** (fail closed), not the reverse — a caller
that doesn't know a project's role yet should never accidentally show
money by omission.

`WorkHome.tsx`'s `CreatorWorkHome` computes the map in a new effect:
projects the viewer created (`created_by === user.id`) resolve to
`true` locally, no RPC needed; every other project calls
`can_see_milestone_money(_project_id, _user_id)` — the same RPC
`useProjectData.ts` already relies on for the single-Project financial
merge (finding-1 work, earlier this session) — capped at 100 projects,
same pattern already used for the `recentCollaborators` effect just
above it in the same file.

Consumers updated:
- `StudioProjectsDashboard`: per-row pay dot, per-row `nextAction()`
  copy, and the aggregate `needsInvoice`/`awaitingPayment` tile counts
  now all key off `moneyVisible(id)` instead of the old global flag —
  including the counts, so a hidden project's invoice status can't leak
  through an aggregate number even if its row is hidden.
- `StudioCardsGrid`: both the hero `FeatureCard` and the regular grid
  cards now pass `pay={moneyVisible(id) ? invoicesByProject[id] :
  undefined}` — the existing `{pay && (...)}` render guards do the rest.

## Role → visibility mapping (unchanged, just now actually enforced)

From `can_see_milestone_money`'s own SQL: `get_project_role(...) IN
('owner', 'creative', 'collaborator')`. Client and guest roles do not
see money. This mapping was already the intended design from
finding-1's work earlier this session — this pass wires the frontend
dashboard up to actually respect it, it doesn't change the mapping
itself.

## Update: migration applied, feature confirmed live

The migration failed twice on first application
(`project_collaborators_role_check` violated by pre-existing rows with
`role = 'collaborator'` and `role = 'owner'` — neither anticipated by
the original grep-based audit; see the migration file's own updated
header comment for the fix). Once the cleanup `UPDATE` was run and
committed as its own statement (isolating it from the constraint-add
statement's transaction) and the full migration re-applied, all four
RPCs (`can_see_milestone_money`, `get_project_role`,
`get_project_financials`, `get_project_milestone_financials`) resolved
`200` against the live project.

Re-verified live in the browser, not just via REST: reloaded `/desk`
as the same test account (role `"collaborator"` on its one Project, per
`get_project_role`) — the "Needs an invoice"/"Awaiting payment" tiles
and the row-level "No invoice" pay label are showing again, correctly,
because `collaborator` is in `can_see_milestone_money`'s allowed set.
This is the real, correct end-state, not the fail-closed default this
report originally documented.

**Not yet re-tested**: the actual client/guest-hidden case (a second
account with a non-money role on the same Project) — this test session
still only has one identity's access to verify against. The
fail-closed default (§ above, now historical) at least demonstrated the
hidden path works when the RPC is unreachable; the RPC's own role
branching (`client`/`guest` → `false`) hasn't been exercised live yet,
only read from its SQL definition.

## Tests

`StudioProjectsDashboard.test.tsx` gained two cases: per-project gating
with a mixed-role list (one visible, one not, in the same render), and
the fail-closed default when a project id is simply absent from the
map. `StudioCardsGrid.tsx` has no existing test file (pre-existing gap,
not one this pass closed) — verified by code read instead.

## What would close this out

1. ~~Apply the migration~~ — done.
2. Real two-account test: an owner and a client/guest-role collaborator
   on the same Project, both viewing `/desk` — the owner's dashboard row
   for that Project shows the pay dot, the collaborator's does not.
3. Confirm the aggregate "Needs an invoice"/"Awaiting payment" tile
   counts on the collaborator's dashboard don't include Projects they
   can't see money on.

Items 2 and 3 still need a second real identity with a client/guest
role to test against — not available in this session.
