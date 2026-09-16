-- Warning flagged by the deep security scan: the 'campaigns' table has two
-- overlapping public SELECT policies -- "Public can view approved active
-- campaigns" (correctly requires moderation_status = 'approved') and
-- "Public can view live campaigns" (allows any status in
-- active/funded/failed/completed with no moderation_status check at all).
-- Because RLS policies are combined with OR, the second policy completely
-- bypasses the moderation gate the first one was added to enforce.
--
-- Root cause: migration 20260419025805 added the moderation-gated policy and
-- tried to DROP the policies it was replacing, but named the wrong ones
-- ("Public can view active campaigns" / "Anyone can view active campaigns")
-- -- the actual older policy was named "Public can view live campaigns"
-- (from 20260419014818) and was never dropped, leaving both active ever
-- since.

DROP POLICY IF EXISTS "Public can view live campaigns" ON public.campaigns;
