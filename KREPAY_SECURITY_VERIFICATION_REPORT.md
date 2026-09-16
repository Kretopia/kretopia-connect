# KrePay — Security Verification (Migration A drift check)

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-23
**Status: NO PRIVILEGE DRIFT DETECTED.**

Verified live against the database (`has_table_privilege` / `has_column_privilege` /
`has_function_privilege`, ground truth rather than `information_schema` views):

| Check | Expected | Actual |
|---|---|---|
| `authenticated` UPDATE on `public.wallets` | false | **false** |
| `authenticated` UPDATE on `public.creator_wallets` | false | **false** |
| Table-level UPDATE on `public.profiles` | false (column allow-list only) | **false** |
| Owner can still edit `profiles.bio` | true | **true** |
| Client can edit `profiles.subscription_tier` | false | **false** |
| RLS on `public.notifications` | enabled | **enabled** |
| `anon` EXECUTE on new acceptance RPC | false | **false** |
| `authenticated` EXECUTE on new acceptance RPC | true | **true** |

## Payment-state integrity
- Balance, payout, KYC and Stripe identifier fields remain server-only; no client write path exists.
- Payout gate: `payouts_enabled` / `kyc_status` are only mutated by `stripe-wallet-webhook`
  using the service role, and only **after** signature verification.
- No unverified webhook can alter payment state: every handler verifies before mutating, and all
  three currently fail closed because their signing secrets are unset.
- Frontend never marks a payment successful; KrePay reads server-derived rows only.

## Notes on the new SECURITY DEFINER function
`public.accept_application_and_create_studio(uuid)` is definer-scoped on purpose (it must write
`projects`, `project_collaborators` and `notifications` atomically). It is not a permission
work-around: it performs its own authorization (`auth.uid()` must equal
`opportunities.created_by`), `anon` has EXECUTE revoked, and it writes nothing financial.

The project-wide linter reports 460 pre-existing `SECURITY DEFINER` advisories unrelated to this
change; they are unchanged in count/character by this migration and are tracked separately.
