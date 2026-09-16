UPDATE public.pending_discoveries
SET status = 'dismissed', reviewed_at = now()
WHERE status = 'pending'
  AND source_domain IN ('instagram.com','tiktok.com','twitter.com','x.com','facebook.com','threads.net','snapchat.com','pinterest.com')
  OR (status='pending' AND source_url ~* 'linkedin\.com/in/');