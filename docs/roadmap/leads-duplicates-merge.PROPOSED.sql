-- ============================================================================
-- PROPOSED — NOT APPROVED — DO NOT RUN until the owner has approved
-- leads-duplicates-merge-proposal.md and saved the backup (preview query P2).
-- ============================================================================
-- Folds duplicate leads into one row per person, one phase at a time.
-- Same grouping, keeper and safety rules as leads-duplicates-merge-preview.sql:
-- read that file's header first. This script changes data:
--   1. fills the keeper's EMPTY fields (email, company, role, notes,
--      profile_url, avatar_url) from the copies it absorbs, and unions tags
--   2. re-points outreach_sequences.lead_id from each copy to its keeper
--      (otherwise ON DELETE SET NULL would silently unlink the sequence)
--   3. deletes the copies
-- Not carried over: a copy's notes when the keeper already has notes, and its
-- source / priority. They survive only in the backup export.
--
-- Safe by default:
--   * It ends in ROLLBACK, so running it as-is changes nothing and just
--     prints the counts it WOULD have applied. To apply: change the last
--     statement to COMMIT, nothing else.
--   * It refuses to run until `expected_copies` is set to the number the
--     preview (P1, row 'merge', later_copies) showed, and stops if the
--     live data no longer matches it.
--   * Every step asserts its row counts; any mismatch aborts everything.
--   * It takes a short write lock on public.leads (not outreach_sequences)
--     so no lead is added or edited while it runs: run it off-peak.
--   * It touches no other table and no schema (temp tables only).
--
-- Run phase 'email' first, re-run the preview, then phase 'name_company'.
-- Edit ONLY the two values in the settings below.
-- ============================================================================

BEGIN;

LOCK TABLE public.leads IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE leads_merge_settings ON COMMIT DROP AS
SELECT 'email'::text AS key_type,        -- <- 'email' (phase 1) or 'name_company' (phase 2)
       NULL::int     AS expected_copies; -- <- the preview's later_copies for 'merge'

CREATE TEMP TABLE leads_merge_plan ON COMMIT DROP AS
WITH settings AS (SELECT key_type FROM leads_merge_settings),
norm AS (
  SELECT l.*,
    NULLIF(lower(regexp_replace(coalesce(l.email,   ''), '^\s+|\s+$', '', 'g')), '') AS email_key,
    NULLIF(lower(regexp_replace(coalesce(l.name,    ''), '^\s+|\s+$', '', 'g')), '') AS name_key,
           lower(regexp_replace(coalesce(l.company, ''), '^\s+|\s+$', '', 'g'))       AS company_key,
    (l.stage <> 'cold' OR l.last_contacted_at IS NOT NULL OR l.next_follow_up_at IS NOT NULL) AS has_progress
  FROM public.leads l
),
keyed AS (
  SELECT n.*,
    CASE s.key_type
      WHEN 'email' THEN n.email_key
      WHEN 'name_company' THEN
        CASE WHEN n.name_key IS NOT NULL AND n.company_key <> '' AND n.name_key <> 'unknown'
             THEN n.name_key || '|' || n.company_key END
    END AS group_key
  FROM norm n CROSS JOIN settings s
),
grp AS (
  SELECT user_id, group_key,
         count(*)                                    AS n,
         count(*) FILTER (WHERE has_progress)        AS n_progress,
         count(DISTINCT coalesce(name_key, ''))      AS n_names,
         count(DISTINCT email_key)                   AS n_emails,
         count(DISTINCT type)                        AS n_types
  FROM keyed
  WHERE group_key IS NOT NULL
  GROUP BY user_id, group_key
  HAVING count(*) > 1
),
classified AS (
  SELECT k.id, k.user_id, k.group_key,
    CASE
      WHEN g.n_progress > 1 THEN 'manual'
      WHEN g.n_types    > 1 THEN 'manual'
      WHEN s.key_type = 'email'        AND g.n_names  > 1 THEN 'manual'
      WHEN s.key_type = 'name_company' AND g.n_emails > 1 THEN 'manual'
      ELSE 'merge'
    END AS verdict,
    row_number() OVER w AS rn,
    first_value(k.id) OVER w AS keeper_id
  FROM keyed k
  JOIN grp g USING (user_id, group_key)
  CROSS JOIN settings s
  WINDOW w AS (PARTITION BY k.user_id, k.group_key ORDER BY k.has_progress DESC, k.created_at, k.id)
)
SELECT user_id, group_key, keeper_id, id AS copy_id
FROM classified
WHERE verdict = 'merge' AND rn > 1;

-- The whole merge is one block: any failed check raises and aborts everything.
DO $$
DECLARE
  s            record;
  planned      int;
  keepers      int;
  linked       int;
  filled       int;
  repointed    int;
  still_linked int;
  deleted      int;
BEGIN
  SELECT * INTO s FROM leads_merge_settings;
  SELECT count(*), count(DISTINCT keeper_id) INTO planned, keepers FROM leads_merge_plan;

  IF s.key_type NOT IN ('email', 'name_company') THEN
    RAISE EXCEPTION 'key_type must be email or name_company, got %', s.key_type;
  END IF;
  IF s.expected_copies IS NULL THEN
    RAISE EXCEPTION 'Set expected_copies to the preview''s later_copies (merge row) first.';
  END IF;
  IF planned = 0 OR planned <> s.expected_copies THEN
    RAISE EXCEPTION 'Plan has % copies, expected %. The data changed or key_type differs from the preview: stop and re-run the preview.',
      planned, s.expected_copies;
  END IF;

  SELECT count(*) INTO linked
  FROM public.outreach_sequences q JOIN leads_merge_plan p ON q.lead_id = p.copy_id;

  -- 1. Fill the keepers' empty fields from their copies (earliest copy wins); union tags.
  WITH c AS (
    SELECT p.keeper_id,
      (array_agg(NULLIF(btrim(l.email),       '') ORDER BY l.created_at, l.id) FILTER (WHERE NULLIF(btrim(l.email),       '') IS NOT NULL))[1] AS email,
      (array_agg(NULLIF(btrim(l.company),     '') ORDER BY l.created_at, l.id) FILTER (WHERE NULLIF(btrim(l.company),     '') IS NOT NULL))[1] AS company,
      (array_agg(NULLIF(btrim(l.role),        '') ORDER BY l.created_at, l.id) FILTER (WHERE NULLIF(btrim(l.role),        '') IS NOT NULL))[1] AS role,
      (array_agg(NULLIF(btrim(l.notes),       '') ORDER BY l.created_at, l.id) FILTER (WHERE NULLIF(btrim(l.notes),       '') IS NOT NULL))[1] AS notes,
      (array_agg(NULLIF(btrim(l.profile_url), '') ORDER BY l.created_at, l.id) FILTER (WHERE NULLIF(btrim(l.profile_url), '') IS NOT NULL))[1] AS profile_url,
      (array_agg(NULLIF(btrim(l.avatar_url),  '') ORDER BY l.created_at, l.id) FILTER (WHERE NULLIF(btrim(l.avatar_url),  '') IS NOT NULL))[1] AS avatar_url,
      (SELECT array_agg(DISTINCT t ORDER BY t)
         FROM leads_merge_plan p2
         JOIN public.leads l2 ON l2.id = p2.copy_id
         CROSS JOIN LATERAL unnest(coalesce(l2.tags, '{}')) AS t
        WHERE p2.keeper_id = p.keeper_id) AS tags
    FROM leads_merge_plan p
    JOIN public.leads l ON l.id = p.copy_id
    GROUP BY p.keeper_id
  )
  UPDATE public.leads k SET
    email       = coalesce(NULLIF(btrim(k.email),       ''), c.email),
    company     = coalesce(NULLIF(btrim(k.company),     ''), c.company),
    role        = coalesce(NULLIF(btrim(k.role),        ''), c.role),
    notes       = coalesce(NULLIF(btrim(k.notes),       ''), c.notes),
    profile_url = coalesce(NULLIF(btrim(k.profile_url), ''), c.profile_url),
    avatar_url  = coalesce(NULLIF(btrim(k.avatar_url),  ''), c.avatar_url),
    tags        = ARRAY(SELECT DISTINCT t FROM unnest(coalesce(k.tags, '{}') || coalesce(c.tags, '{}')) AS t ORDER BY t)
  FROM c
  WHERE k.id = c.keeper_id;
  GET DIAGNOSTICS filled = ROW_COUNT;
  IF filled <> keepers THEN
    RAISE EXCEPTION 'Updated % keepers, expected %', filled, keepers;
  END IF;

  -- 2. Re-point outreach sequences from each copy to its keeper.
  UPDATE public.outreach_sequences q SET lead_id = p.keeper_id
  FROM leads_merge_plan p
  WHERE q.lead_id = p.copy_id;
  GET DIAGNOSTICS repointed = ROW_COUNT;
  IF repointed <> linked THEN
    RAISE EXCEPTION 'Re-pointed % sequences, expected %', repointed, linked;
  END IF;

  SELECT count(*) INTO still_linked
  FROM public.outreach_sequences q JOIN leads_merge_plan p ON q.lead_id = p.copy_id;
  IF still_linked <> 0 THEN
    RAISE EXCEPTION '% sequences still point at a copy: refusing to delete', still_linked;
  END IF;

  -- 3. Delete the copies.
  DELETE FROM public.leads l USING leads_merge_plan p WHERE l.id = p.copy_id;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  IF deleted <> planned THEN
    RAISE EXCEPTION 'Deleted % leads, expected %', deleted, planned;
  END IF;

  RAISE NOTICE 'key_type=%: % copies folded into % keepers; % outreach sequences re-pointed.',
    s.key_type, deleted, keepers, repointed;
END
$$;

-- Result check: no copy is left (0 rows expected here).
SELECT p.copy_id AS copy_still_present
FROM leads_merge_plan p
JOIN public.leads l ON l.id = p.copy_id;

ROLLBACK;   -- <- change to COMMIT only after the preview, the backup and the owner's approval
