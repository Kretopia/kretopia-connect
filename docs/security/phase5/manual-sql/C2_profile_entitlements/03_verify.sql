-- LOT C2 -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app", after 02_apply.sql. One row; every column but the informational_ ones must be true.
-- WHAT THIS PROVES: the privileges recorded in the catalog, which is what PostgREST and Postgres enforce for a column write.
-- WHAT THIS DOES NOT PROVE: that a caller with a real session gets the HTTP answer you expect (the SQL Editor bypasses RLS and runs as postgres).

WITH four AS (SELECT unnest(ARRAY['project_credits', 'available_invites', 'invite_code_used', 'invited_by']) AS col)
SELECT
  NOT EXISTS (SELECT 1 FROM four WHERE has_column_privilege('authenticated', 'public.profiles', col, 'UPDATE'))  AS members_cannot_update_them,
  NOT EXISTS (SELECT 1 FROM four WHERE has_column_privilege('authenticated', 'public.profiles', col, 'INSERT'))  AS members_cannot_insert_them,
  NOT EXISTS (SELECT 1 FROM four WHERE has_column_privilege('anon', 'public.profiles', col, 'UPDATE')
                                    OR has_column_privilege('anon', 'public.profiles', col, 'INSERT'))           AS anon_cannot_write_them,
  NOT EXISTS (SELECT 1 FROM four WHERE NOT has_column_privilege('service_role', 'public.profiles', col, 'UPDATE')) AS service_role_still_updates_them,
  NOT (has_table_privilege('authenticated', 'public.profiles', 'UPDATE') OR has_table_privilege('authenticated', 'public.profiles', 'INSERT')) AS no_table_level_write_for_members,
  (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE')) >= 100                      AS ordinary_columns_still_editable,
  (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE'))                             AS informational_columns_members_can_update,
  current_user                                                                                                      AS informational_running_as;
