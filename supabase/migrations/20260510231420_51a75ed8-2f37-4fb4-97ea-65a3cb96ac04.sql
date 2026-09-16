SELECT cron.alter_job(36, active := false);
SELECT cron.alter_job(26, active := false);
UPDATE public.profiles SET username = 'dezii' WHERE user_id = '7d36816a-332e-46cd-a0f5-4f2e63103a43' AND (username IS NULL OR username = '');
DROP FUNCTION IF EXISTS public._admin_list_cron_jobs();