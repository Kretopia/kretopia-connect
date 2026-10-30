REVOKE ALL ON FUNCTION public.commit_ai_credit(uuid,text,integer,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ai_credit(uuid,text,integer,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_ai_credit_overview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_ai_credit(uuid,text,integer,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_credit(uuid,text,integer,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_overview(uuid) TO service_role;