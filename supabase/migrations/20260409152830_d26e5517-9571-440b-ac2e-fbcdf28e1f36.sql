
-- Fix magazine_articles: only author can create
DROP POLICY IF EXISTS "Authenticated users can create articles" ON public.magazine_articles;
CREATE POLICY "Authenticated users can create their own articles"
  ON public.magazine_articles
  FOR INSERT
  TO authenticated
  WITH CHECK (author_user_id = auth.uid());

-- Fix security definer views
ALTER VIEW public.conversation_list SET (security_invoker = true);
ALTER VIEW public.user_applications_view SET (security_invoker = true);

-- Fix mutable search_path on functions
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.prokind = 'f'
    AND NOT p.prosecdef
    AND (p.proconfig IS NULL OR NOT 'search_path=public' = ANY(p.proconfig))
    AND p.proname NOT LIKE 'pg_%'
    LIMIT 10
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter function %: %', func_record.proname, SQLERRM;
    END;
  END LOOP;
END;
$$;
