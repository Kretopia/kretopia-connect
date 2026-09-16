-- 1) Realtime: replace spoofable LIKE-based topic checks with strict ownership
DROP POLICY IF EXISTS "Authenticated can read own channel messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write to own channels" ON realtime.messages;

CREATE POLICY "Authenticated can read own channel messages"
ON realtime.messages FOR SELECT TO authenticated
USING (realtime.topic() = ('user:' || auth.uid()::text));

CREATE POLICY "Authenticated can write to own channels"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.topic() = ('user:' || auth.uid()::text));

-- 2) board-assets storage: path convention is <user_id>/<project_id>/<file>
DROP POLICY IF EXISTS "Authenticated users can upload board assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload board assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'board-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.user_has_project_access(((storage.foldername(name))[2])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "Project members can read board-assets" ON storage.objects;
CREATE POLICY "Project members can read board-assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'board-assets'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.user_has_project_access(((storage.foldername(name))[2])::uuid, auth.uid())
  )
);

-- 3) Fixed search_path on remaining mutable functions
ALTER FUNCTION public.get_tier_storage_limit(text) SET search_path = public;
ALTER FUNCTION public.persona_for_agent_kind(text) SET search_path = public;
ALTER FUNCTION public.touch_meetings_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.resolve_storage_owner(uuid, text) SET search_path = public;
ALTER FUNCTION public.calculate_network_tier(integer) SET search_path = public;