-- Close the write access that public.public_external_listings had.
--
-- Found 2026-10-29. The view runs with its owner's rights (it has to: the base table, external_listings, is service-role only) and it is a
-- plain single-table view, so Postgres treats it as auto-updatable: an INSERT, UPDATE or DELETE on the view is applied to the base table
-- with the OWNER's rights, past the base table's revokes and row level security. 20261029100000 ended with
-- `REVOKE ALL ON public.public_external_listings FROM PUBLIC`, which does not remove what Supabase's default privileges had already granted
-- to the anon and authenticated roles by name (arwdDxtm). Anyone holding the public key could therefore change or delete a published
-- listing through the REST API (for example point its apply_url somewhere else), and insert rows into the base table.
--
-- Fix: clients may only SELECT. service_role keeps full access (the edge functions use it). security_barrier keeps a client-supplied filter
-- from being evaluated against rows the view's own WHERE excludes (drafts, private, flagged), so they cannot be probed by error messages.
-- Idempotent. No data is changed. Not applied to production by the commit that adds this file.

REVOKE ALL ON public.public_external_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;
GRANT ALL ON public.public_external_listings TO service_role;

ALTER VIEW public.public_external_listings SET (security_barrier = true);
