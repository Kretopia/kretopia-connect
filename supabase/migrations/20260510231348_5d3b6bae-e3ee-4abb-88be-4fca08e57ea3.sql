CREATE OR REPLACE FUNCTION public._admin_list_cron_jobs()
RETURNS TABLE(jobid bigint, jobname text, schedule text, command text, active boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = cron, public
AS $$ SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobname $$;
REVOKE ALL ON FUNCTION public._admin_list_cron_jobs() FROM PUBLIC;