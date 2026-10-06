-- ============================================================================
-- Duplicate leads: MERGE PREVIEW + BACKUP EXPORT — READ-ONLY
-- ============================================================================
-- Shows exactly what leads-duplicates-merge.PROPOSED.sql would do, without
-- doing it. Every statement is a SELECT. Run each query on its own; each one
-- carries the same plan, so the numbers agree.
--
-- Merge in two phases, in this order (edit the one `key_type` line in EVERY
-- query below, the same way each time):
--   'email'        phase 1: same email  (and the same name)
--   'name_company' phase 2: same name + same non-empty company (and no
--                           conflicting emails). Run the preview again first:
--                           phase 1 changes the table.
-- Low-confidence matches (same name, no company; the placeholder "unknown")
-- are never merged by this plan: they go to a person to look at.
--
-- A group is only marked 'merge' when ALL of these hold; otherwise it is
-- listed as 'manual: <why>' and left alone:
--   - at most one row in the group was ever worked (stage past 'cold',
--     contacted, or follow-up set)
--   - every row has the same type (client / collaborator)
--   - phase email: every row has the same name (a shared inbox such as
--     info@company.test can belong to several people)
--   - phase name_company: no two rows have different emails
-- Keeper = the worked row if there is one, otherwise the oldest.
-- Everything is per user (user_id).
--
-- PRIVACY: results contain other people's contact details. Keep them private.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- P1. What would happen: groups and rows by verdict. Only the 'merge' row
--     would be changed. Its `later_copies` is what the merge script would
--     delete, and the number it must be told to expect. The 'manual: ...' rows
--     are left alone (their later_copies are NOT deleted).
-- ----------------------------------------------------------------------------
WITH settings AS (SELECT 'email'::text AS key_type),     -- <- 'email' or 'name_company'
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
  SELECT k.*,
    CASE
      WHEN g.n_progress > 1 THEN 'manual: more than one copy was already worked'
      WHEN g.n_types    > 1 THEN 'manual: client vs collaborator'
      WHEN s.key_type = 'email'        AND g.n_names  > 1 THEN 'manual: same email, different names'
      WHEN s.key_type = 'name_company' AND g.n_emails > 1 THEN 'manual: same name + company, different emails'
      ELSE 'merge'
    END AS verdict,
    row_number() OVER w AS rn,
    first_value(k.id) OVER w AS keeper_id
  FROM keyed k
  JOIN grp g USING (user_id, group_key)
  CROSS JOIN settings s
  WINDOW w AS (PARTITION BY k.user_id, k.group_key ORDER BY k.has_progress DESC, k.created_at, k.id)
),
links AS (
  SELECT lead_id, count(*) AS n FROM public.outreach_sequences WHERE lead_id IS NOT NULL GROUP BY lead_id
)
SELECT
  c.verdict,
  count(DISTINCT (c.user_id, c.group_key))                      AS groups,
  count(*) FILTER (WHERE c.rn > 1)                              AS later_copies,
  count(DISTINCT c.user_id)                                     AS users,
  coalesce(sum(l.n) FILTER (WHERE c.rn > 1), 0)                 AS outreach_sequences_to_repoint
FROM classified c
LEFT JOIN links l ON l.lead_id = c.id
GROUP BY c.verdict
ORDER BY (c.verdict <> 'merge'), c.verdict;


-- ----------------------------------------------------------------------------
-- P2. BACKUP EXPORT — save this result (CSV / JSON) BEFORE running the merge.
--     One row per lead the merge keeps or removes, with the whole row in
--     `backup` (same ids, so a removed lead can be re-inserted from it).
-- ----------------------------------------------------------------------------
WITH settings AS (SELECT 'email'::text AS key_type),     -- <- same value as in P1
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
  SELECT k.*,
    CASE
      WHEN g.n_progress > 1 THEN 'manual: more than one copy was already worked'
      WHEN g.n_types    > 1 THEN 'manual: client vs collaborator'
      WHEN s.key_type = 'email'        AND g.n_names  > 1 THEN 'manual: same email, different names'
      WHEN s.key_type = 'name_company' AND g.n_emails > 1 THEN 'manual: same name + company, different emails'
      ELSE 'merge'
    END AS verdict,
    row_number() OVER w AS rn,
    first_value(k.id) OVER w AS keeper_id
  FROM keyed k
  JOIN grp g USING (user_id, group_key)
  CROSS JOIN settings s
  WINDOW w AS (PARTITION BY k.user_id, k.group_key ORDER BY k.has_progress DESC, k.created_at, k.id)
)
SELECT
  'lead'                                          AS table_name,
  c.user_id, c.group_key, c.keeper_id,
  c.id                                            AS row_id,
  CASE WHEN c.rn = 1 THEN 'keep (gets blanks filled)' ELSE 'remove' END AS action,
  to_jsonb(l)                                     AS backup
FROM classified c
JOIN public.leads l ON l.id = c.id
WHERE c.verdict = 'merge'
UNION ALL
SELECT                                            -- sequences that will be re-pointed to the keeper
  'outreach_sequences',
  c.user_id, c.group_key, c.keeper_id,
  s.id,
  'repoint lead_id ' || s.lead_id || ' -> ' || c.keeper_id,
  to_jsonb(s)
FROM classified c
JOIN public.outreach_sequences s ON s.lead_id = c.id
WHERE c.verdict = 'merge' AND c.rn > 1
ORDER BY 1 DESC, 2, 3, 6;


-- ----------------------------------------------------------------------------
-- P3. Left alone for a human: groups the plan will NOT merge, and why.
-- ----------------------------------------------------------------------------
WITH settings AS (SELECT 'email'::text AS key_type),     -- <- same value as in P1
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
)
SELECT
  CASE
    WHEN g.n_progress > 1 THEN 'manual: more than one copy was already worked'
    WHEN g.n_types    > 1 THEN 'manual: client vs collaborator'
    WHEN s.key_type = 'email'        AND g.n_names  > 1 THEN 'manual: same email, different names'
    WHEN s.key_type = 'name_company' AND g.n_emails > 1 THEN 'manual: same name + company, different emails'
  END AS reason,
  g.user_id, g.group_key, g.n AS rows_in_group,
  (SELECT array_agg(k.id ORDER BY k.created_at, k.id)
   FROM keyed k WHERE k.user_id = g.user_id AND k.group_key = g.group_key) AS lead_ids
FROM grp g CROSS JOIN settings s
WHERE g.n_progress > 1
   OR g.n_types    > 1
   OR (s.key_type = 'email'        AND g.n_names  > 1)
   OR (s.key_type = 'name_company' AND g.n_emails > 1)
ORDER BY reason, g.n DESC
LIMIT 500;
