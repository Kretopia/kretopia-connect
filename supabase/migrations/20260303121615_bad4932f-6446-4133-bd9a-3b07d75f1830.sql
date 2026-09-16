-- Manually create bidirectional connection for Gabrielle Roth (missed auto-connect)
SELECT public.create_bidirectional_connection(
  '4541f67e-d577-4d98-a2de-dbf0da2e791a'::uuid,
  'ef429714-ea32-4f08-a4f9-ef0226f1804b'::uuid,
  'accepted'
);