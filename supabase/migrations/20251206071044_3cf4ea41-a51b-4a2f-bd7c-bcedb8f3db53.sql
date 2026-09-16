-- Fix unsubscribe token functions to use gen_random_uuid instead of gen_random_bytes
-- gen_random_bytes requires pgcrypto extension which may not be enabled
-- gen_random_uuid is always available in PostgreSQL 13+

CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use gen_random_uuid which is always available instead of gen_random_bytes
  RETURN replace(
    gen_random_uuid()::text || gen_random_uuid()::text,
    '-',
    ''
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_unsubscribe_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unsubscribe_token IS NULL THEN
    -- Use gen_random_uuid which is always available instead of gen_random_bytes
    NEW.unsubscribe_token := replace(
      gen_random_uuid()::text || gen_random_uuid()::text,
      '-',
      ''
    );
  END IF;
  RETURN NEW;
END;
$$;