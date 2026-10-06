-- ============================================================================
-- Likely duplicate rows already in public.leads — READ-ONLY report
-- ============================================================================
-- Every statement below is a plain SELECT. There is deliberately no UPDATE,
-- DELETE or DDL in this file. Run each query on its own (Supabase SQL editor,
-- or any read-only connection). Nothing here has been run against the real
-- database yet — see leads-duplicates-report.md.
--
-- "Same lead" follows the rule in supabase/functions/_shared/leadExtraction.ts
-- (the one the Lead Scout fix uses), per user (user_id), case and surrounding
-- spaces ignored:
--   1. same email, or
--   2. same name + same company (company may be empty on both).
-- Oldest row (created_at, then id) is the "original"; every later row that
-- matches an earlier one is a "later copy" — the row a merge would fold away.
--
-- Confidence, strongest first (a row gets the first one that applies):
--   high   : same email
--   medium : same name + same non-empty company
--   low    : same name, no company on either (two different "John Smith"s look
--            identical here), or the placeholder name "unknown" that
--            scout-leads uses when a result has no name
--
-- Small differences from the app: Postgres lower()/regexp whitespace trimming
-- can differ from JavaScript toLowerCase()/trim() on unusual Unicode.
--
-- PRIVACY: query 2 prints the matched email / name, i.e. other people's
-- contact details. Keep the output to yourself; to share it, replace
-- `key_value` with `md5(key_value)` in query 2.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Context: how big is the table? (so the counts below can be read as a share)
-- ----------------------------------------------------------------------------
SELECT
  count(*)                                                       AS total_leads,
  count(DISTINCT user_id)                                        AS users_with_leads,
  count(*) FILTER (WHERE btrim(coalesce(email, '')) = '')        AS leads_without_email,
  count(*) FILTER (WHERE btrim(coalesce(company, '')) = '')      AS leads_without_company,
  count(*) FILTER (WHERE source LIKE 'thrive-research:%')        AS auto_saved_by_scout,
  count(*) FILTER (WHERE source = 'AI Scout')                    AS saved_from_scout_button,
  min(created_at)                                                AS oldest_lead,
  max(created_at)                                                AS newest_lead
FROM public.leads;


-- ----------------------------------------------------------------------------
-- 1. Summary: later copies by confidence (the headline numbers)
-- ----------------------------------------------------------------------------
WITH norm AS (
  SELECT
    id, user_id, created_at,
    NULLIF(lower(regexp_replace(coalesce(email,   ''), '^\s+|\s+$', '', 'g')), '') AS email_key,
    NULLIF(lower(regexp_replace(coalesce(name,    ''), '^\s+|\s+$', '', 'g')), '') AS name_key,
           lower(regexp_replace(coalesce(company, ''), '^\s+|\s+$', '', 'g'))       AS company_key
  FROM public.leads
),
ranked AS (
  SELECT
    n.*,
    CASE WHEN email_key IS NOT NULL
         THEN row_number() OVER (PARTITION BY user_id, email_key ORDER BY created_at, id) END AS email_rank,
    CASE WHEN name_key IS NOT NULL
         THEN row_number() OVER (PARTITION BY user_id, name_key, company_key ORDER BY created_at, id) END AS name_rank
  FROM norm n
),
copies AS (
  SELECT
    user_id,
    CASE
      WHEN email_rank > 1                                                  THEN '1-high: same email'
      WHEN name_rank  > 1 AND company_key <> '' AND name_key <> 'unknown'  THEN '2-medium: same name + company'
      WHEN name_rank  > 1                                                  THEN '3-low: same name, no company'
    END AS confidence
  FROM ranked
)
SELECT
  confidence,
  count(*)                AS later_copies,
  count(DISTINCT user_id) AS users_affected
FROM copies
WHERE confidence IS NOT NULL
GROUP BY confidence
ORDER BY confidence;


-- ----------------------------------------------------------------------------
-- 2. The groups to review (one row per set of matching leads), biggest first
--    Review the first ~200; raise LIMIT if needed. Don't add up `copies` here
--    to get totals (a group of N rows is N-1 later copies): use query 1.
--    scout_autosave_plus_button = true is the exact signature of the bug the
--    Lead Scout fix closes: saved automatically by the search
--    ("thrive-research: …") AND again by the Save / Save All button ("AI Scout").
--    rows_with_progress > 0 means the user already worked at least one copy
--    (stage moved past 'cold', contacted, or follow-up scheduled): do NOT fold
--    those away blindly. linked_sequences counts outreach_sequences pointing at
--    the group's rows (their lead_id is set NULL if a linked row is deleted).
-- ----------------------------------------------------------------------------
WITH norm AS (
  SELECT
    id, user_id, created_at, source, stage, last_contacted_at, next_follow_up_at,
    NULLIF(lower(regexp_replace(coalesce(email,   ''), '^\s+|\s+$', '', 'g')), '') AS email_key,
    NULLIF(lower(regexp_replace(coalesce(name,    ''), '^\s+|\s+$', '', 'g')), '') AS name_key,
           lower(regexp_replace(coalesce(company, ''), '^\s+|\s+$', '', 'g'))       AS company_key
  FROM public.leads
),
links AS (
  SELECT lead_id, count(*) AS n
  FROM public.outreach_sequences
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id
),
members AS (
  SELECT 'email' AS key_type, user_id, email_key AS key_value, email_key, n.id, created_at, source,
         stage, last_contacted_at, next_follow_up_at, coalesce(l.n, 0) AS links
  FROM norm n LEFT JOIN links l ON l.lead_id = n.id
  WHERE email_key IS NOT NULL
  UNION ALL
  SELECT CASE WHEN company_key <> '' AND name_key <> 'unknown' THEN 'name+company' ELSE 'name only' END,
         user_id, name_key || ' | ' || company_key, email_key, n.id, created_at, source,
         stage, last_contacted_at, next_follow_up_at, coalesce(l.n, 0)
  FROM norm n LEFT JOIN links l ON l.lead_id = n.id
  WHERE name_key IS NOT NULL
)
SELECT
  key_type,
  user_id,
  key_value,                                   -- personal data: see PRIVACY above
  count(*)                                     AS copies,
  min(created_at)                              AS first_created,
  max(created_at)                              AS last_created,
  array_agg(id ORDER BY created_at, id)        AS lead_ids,
  array_agg(DISTINCT source) FILTER (WHERE source IS NOT NULL) AS sources,
  (bool_or(source LIKE 'thrive-research:%') AND bool_or(source = 'AI Scout'))
                                               AS scout_autosave_plus_button,
  count(*) FILTER (WHERE stage <> 'cold'
                      OR last_contacted_at IS NOT NULL
                      OR next_follow_up_at IS NOT NULL) AS rows_with_progress,
  sum(links)                                   AS linked_sequences
FROM members
GROUP BY key_type, user_id, key_value
HAVING count(*) > 1
   -- a name group whose members all share one email is the same set as an
   -- email group above: don't list it twice
   AND NOT (key_type <> 'email' AND bool_and(email_key IS NOT NULL) AND count(DISTINCT email_key) = 1)
ORDER BY copies DESC, key_type, first_created
LIMIT 200;


-- ----------------------------------------------------------------------------
-- 3. Who is most affected (later copies per user)
-- ----------------------------------------------------------------------------
WITH norm AS (
  SELECT
    id, user_id, created_at,
    NULLIF(lower(regexp_replace(coalesce(email,   ''), '^\s+|\s+$', '', 'g')), '') AS email_key,
    NULLIF(lower(regexp_replace(coalesce(name,    ''), '^\s+|\s+$', '', 'g')), '') AS name_key,
           lower(regexp_replace(coalesce(company, ''), '^\s+|\s+$', '', 'g'))       AS company_key
  FROM public.leads
),
ranked AS (
  SELECT
    n.*,
    CASE WHEN email_key IS NOT NULL
         THEN row_number() OVER (PARTITION BY user_id, email_key ORDER BY created_at, id) END AS email_rank,
    CASE WHEN name_key IS NOT NULL
         THEN row_number() OVER (PARTITION BY user_id, name_key, company_key ORDER BY created_at, id) END AS name_rank
  FROM norm n
)
SELECT
  user_id,
  count(*)                                                     AS total_leads,
  count(*) FILTER (WHERE email_rank > 1
                      OR (name_rank > 1 AND company_key <> '' AND name_key <> 'unknown')) AS likely_copies,
  count(*) FILTER (WHERE email_rank > 1)                       AS copies_same_email
FROM ranked
GROUP BY user_id
HAVING count(*) FILTER (WHERE email_rank > 1
                           OR (name_rank > 1 AND company_key <> '' AND name_key <> 'unknown')) > 0
ORDER BY likely_copies DESC
LIMIT 50;


-- ----------------------------------------------------------------------------
-- 4. Are copies still being created? Later copies by week of creation.
--    After the Lead Scout fix is deployed this should fall to ~0 for new weeks.
--    (Only the high and medium confidence buckets, to keep it clean.)
-- ----------------------------------------------------------------------------
WITH norm AS (
  SELECT
    id, user_id, created_at,
    NULLIF(lower(regexp_replace(coalesce(email,   ''), '^\s+|\s+$', '', 'g')), '') AS email_key,
    NULLIF(lower(regexp_replace(coalesce(name,    ''), '^\s+|\s+$', '', 'g')), '') AS name_key,
           lower(regexp_replace(coalesce(company, ''), '^\s+|\s+$', '', 'g'))       AS company_key
  FROM public.leads
),
ranked AS (
  SELECT
    n.*,
    CASE WHEN email_key IS NOT NULL
         THEN row_number() OVER (PARTITION BY user_id, email_key ORDER BY created_at, id) END AS email_rank,
    CASE WHEN name_key IS NOT NULL
         THEN row_number() OVER (PARTITION BY user_id, name_key, company_key ORDER BY created_at, id) END AS name_rank
  FROM norm n
)
SELECT
  date_trunc('week', created_at)::date AS week_starting,
  count(*)                             AS later_copies_created
FROM ranked
WHERE email_rank > 1
   OR (name_rank > 1 AND company_key <> '' AND name_key <> 'unknown')
GROUP BY 1
ORDER BY 1 DESC
LIMIT 26;
