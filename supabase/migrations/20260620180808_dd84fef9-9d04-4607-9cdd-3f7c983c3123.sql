CREATE OR REPLACE FUNCTION public.gen_random_bytes(size integer)
RETURNS bytea
LANGUAGE sql
VOLATILE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT extensions.gen_random_bytes(size);
$$;

GRANT EXECUTE ON FUNCTION public.gen_random_bytes(integer) TO postgres, anon, authenticated, service_role;