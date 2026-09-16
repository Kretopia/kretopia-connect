CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT EXECUTE ON FUNCTION extensions.gen_random_bytes(integer) TO postgres, anon, authenticated, service_role;