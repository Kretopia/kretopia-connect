# Functions callable by `anon`: triage

Production catalog, read-only, 2026-10-20. Nothing was changed. This replaces the "revoke `anon` EXECUTE on non-public RPCs" item in `SECURITY_BASELINE.md` with what the catalog actually shows.

## Numbers
- 278 `SECURITY DEFINER` functions in `public`; **all pin `search_path`** (0 unpinned).
- 183 are executable by `anon`; 98 of those are not trigger functions; **50 of those 98 show no auth check in their source** (no `auth.uid()`, `auth.role()`, `auth.jwt()`, role helper or service-role test). The other 48 do (a text match on the source, not a proof of correctness).

## The 50, classified
| Group | Count | Functions | Verdict |
|---|---|---|---|
| Token or code gated, public by design | 28 | `get_*_by_token`, `get_guest_*`, `get_project_for_guest`, `get_knock_status`, `get_curated_stage_by_invite`, `get_public_studio_recap`, `get_shared_thrive_document`, `increment_thrive_doc_views`, `complete_review_request`, `guest_drop_post`, `register_guest_session`, `guest_rsvp_upsert`, `get_ambassador_by_code`, `get_talent_manager_by_referral_code`, `get_public_profiles_safe`, `get_sitemap_profiles`, `get_founder_circle_count`, `get_nearby_gigs`, `get_nearby_jams`, `get_nearby_locations`, `get_or_create_guest_token_for_invite` | Anonymous pages need them. Keep. Two notes below. |
| Membership predicates used by RLS | 11 | `is_project_member`, `user_has_project_access`, `can_access_project`, `has_role`, `is_crew_member`, `is_event_host`, `is_event_project_member`, `is_meeting_host`, `is_meeting_member`, `is_room_member`, `user_can_view_call_transcript` | **Do not revoke yet.** See below. |
| Pure helpers | 10 | `calculate_distance`, `calculate_level`, `generate_*` (7 random-string or number generators), `resolve_storage_owner` | Harmless. `generate_invoice_number` reads the invoices table, so it tells an anonymous caller the next invoice number (volume leak, P3). |
| Event trigger | 1 | `log_grant_revoke_on_sensitive_tables` | Not callable as a function. |

## Why a blanket revoke would break things
1. **`PUBLIC` holds EXECUTE.** The ACL of these functions includes `=X/postgres` (PUBLIC) as well as `anon`. Revoking from `anon` alone changes nothing; the revoke has to target `PUBLIC`, then re-grant to `authenticated` and `service_role`.
2. **RLS calls these functions as the caller.** The membership predicates appear in many policies, and a large part of those policies are granted to the `public` role (which includes `anon`): `is_project_member` is used by 82 policies (78 open to the public role, e.g. share links, approvals, call sheets, setup state, music and content tables), `user_has_project_access` by 61 (28 open), `has_role` by 74 (22 open, including `storage.objects`), `user_can_view_call_transcript` by 3 (all open, `call_transcripts` and `call_action_items`), `is_event_host` and `is_room_member` by 2 each. If `anon` loses EXECUTE, an anonymous request to those tables stops returning zero rows and fails with `permission denied for function`, which can break anonymous pages (shared links, approvals, public event seating).
3. So the order has to be: retarget those policies from `public` to `authenticated` where anonymous access is not intended, test the anonymous pages, then revoke. That is a wide policy change (on the order of a hundred policies), not a one-line revoke.

## What the exposure really is
- The predicates answer "is user U a member of project/meeting/crew X?" for any pair of UUIDs. Both UUIDs would have to be known, so this is an oracle with a high bar: **P3**. `is_meeting_member` is the one already noted.
- `get_or_create_guest_token_for_invite(project, email)` returns a guest preview token for a pending invite when the caller supplies the project id and the invited email. Knowledge of those two values is the only check. Intended for the email-invite preview, but anyone holding a project id and guessing an invited address gets read-only guest access. **P2**; a fix would tie the token to the emailed link rather than to the address.
- `get_nearby_*` return rows with user or creator ids; whether they only return public rows was not reviewed.

## Recommendation
Do **not** run a blanket revoke. If wanted, in this order: (1) the predicates ignore a `_user_id` that is not the caller unless the caller is the service role (closes the oracle without touching policies; needs a pass over every call site that passes another user's id); (2) rework `get_or_create_guest_token_for_invite`; (3) only then consider retargeting policies from `public` to `authenticated`. Each is a database change and needs a written report and explicit approval first.
