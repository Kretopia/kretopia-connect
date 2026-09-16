ALTER TABLE public.guest_studio_tokens
  ALTER COLUMN token SET DEFAULT translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_.');

UPDATE public.guest_studio_tokens
SET token = translate(token, '+/=', '-_.')
WHERE token ~ '[+/=]';