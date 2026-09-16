-- ============================================================
-- UNIFIED STORAGE QUOTA SYSTEM
-- Tracks total bytes used per user across ALL "user content" buckets
-- via a single trigger on storage.objects, and enforces a hard cap
-- at upload time. Tier limits realigned with new pricing.
-- ============================================================

-- 1. Realign tier limits (1 TB for Founder, fix legacy values)
CREATE OR REPLACE FUNCTION public.get_tier_storage_limit(tier text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN tier = 'founder'          THEN 1099511627776::bigint  -- 1 TB
    WHEN tier = 'brand_enterprise' THEN  549755813888::bigint  -- 512 GB
    WHEN tier = 'creator_pro'      THEN  107374182400::bigint  -- 100 GB
    WHEN tier = 'brand_pro'        THEN  107374182400::bigint  -- 100 GB
    WHEN tier = 'pro'              THEN   26843545600::bigint  -- 25 GB (Creator)
    ELSE                                    2147483648::bigint -- 2 GB Spark/free
  END;
$$;

-- Backfill new caps for everyone
UPDATE public.profiles
SET storage_limit_bytes = public.get_tier_storage_limit(subscription_tier);

-- 2. Registry of buckets that COUNT toward the user quota.
--    Buckets not listed here are "system/free" (email-assets, campaign-media, etc.)
CREATE TABLE IF NOT EXISTS public.tracked_storage_buckets (
  bucket_id text PRIMARY KEY,
  description text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.tracked_storage_buckets (bucket_id, description) VALUES
  ('project-files',        'ThriveDesk project deliverables & vault'),
  ('portfolio',            'Profile portfolio uploads'),
  ('avatars',              'User avatars'),
  ('media',                'General user media'),
  ('event-photos',         'Event photo wall'),
  ('listing-images',       'Listings'),
  ('product-files',        'Product files'),
  ('outreach-media',       'Outreach attachments'),
  ('feedback-screenshots', 'User-submitted screenshots'),
  ('dispute-evidence',     'ThrivePay dispute evidence'),
  ('payment-proofs',       'ThrivePay receipts'),
  ('deal-memos',           'Deal memos'),
  ('partner-logos',        'Partner logos')
ON CONFLICT (bucket_id) DO NOTHING;

ALTER TABLE public.tracked_storage_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tracked buckets are readable by everyone" ON public.tracked_storage_buckets;
CREATE POLICY "Tracked buckets are readable by everyone"
ON public.tracked_storage_buckets FOR SELECT
USING (true);

-- 3. Resolve a storage.object owner to a profiles.user_id.
--    Buckets we control all use auth.uid() as `owner`. Fallback: first folder segment if it's a uuid.
CREATE OR REPLACE FUNCTION public.resolve_storage_owner(_owner uuid, _name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  first_segment text;
BEGIN
  IF _owner IS NOT NULL THEN RETURN _owner; END IF;
  first_segment := split_part(_name, '/', 1);
  BEGIN
    RETURN first_segment::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

-- 4. The unified usage tracker on storage.objects
CREATE OR REPLACE FUNCTION public.sync_user_storage_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  is_tracked boolean;
  obj_size bigint;
  owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS(SELECT 1 FROM public.tracked_storage_buckets WHERE bucket_id = NEW.bucket_id) INTO is_tracked;
    IF NOT is_tracked THEN RETURN NEW; END IF;
    owner_id := public.resolve_storage_owner(NEW.owner, NEW.name);
    IF owner_id IS NULL THEN RETURN NEW; END IF;
    obj_size := COALESCE((NEW.metadata->>'size')::bigint, 0);
    UPDATE public.profiles
       SET storage_used_bytes = COALESCE(storage_used_bytes,0) + obj_size
     WHERE user_id = owner_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT EXISTS(SELECT 1 FROM public.tracked_storage_buckets WHERE bucket_id = OLD.bucket_id) INTO is_tracked;
    IF NOT is_tracked THEN RETURN OLD; END IF;
    owner_id := public.resolve_storage_owner(OLD.owner, OLD.name);
    IF owner_id IS NULL THEN RETURN OLD; END IF;
    obj_size := COALESCE((OLD.metadata->>'size')::bigint, 0);
    UPDATE public.profiles
       SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes,0) - obj_size)
     WHERE user_id = owner_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_storage_usage ON storage.objects;
CREATE TRIGGER trg_sync_user_storage_usage
AFTER INSERT OR DELETE ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_storage_usage();

-- 5. HARD-BLOCK enforcement at upload time
CREATE OR REPLACE FUNCTION public.enforce_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  is_tracked boolean;
  obj_size bigint;
  owner_id uuid;
  used bigint;
  cap bigint;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tracked_storage_buckets WHERE bucket_id = NEW.bucket_id) INTO is_tracked;
  IF NOT is_tracked THEN RETURN NEW; END IF;
  owner_id := public.resolve_storage_owner(NEW.owner, NEW.name);
  IF owner_id IS NULL THEN RETURN NEW; END IF;
  obj_size := COALESCE((NEW.metadata->>'size')::bigint, 0);
  SELECT COALESCE(storage_used_bytes,0), COALESCE(storage_limit_bytes, 2147483648)
    INTO used, cap
    FROM public.profiles WHERE user_id = owner_id;
  IF used + obj_size > cap THEN
    RAISE EXCEPTION 'Storage quota exceeded: % of % used. Upgrade your plan or free up space.', used, cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_storage_quota ON storage.objects;
CREATE TRIGGER trg_enforce_storage_quota
BEFORE INSERT ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_storage_quota();

-- 6. Drop the old per-table trigger (project_files) — superseded by storage.objects trigger
DROP TRIGGER IF EXISTS track_storage_usage ON public.project_files;

-- 7. Recompute storage_used_bytes from CURRENT reality (one-time backfill)
CREATE OR REPLACE FUNCTION public.recompute_all_storage_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  WITH actual AS (
    SELECT public.resolve_storage_owner(o.owner, o.name) AS user_id,
           SUM(COALESCE((o.metadata->>'size')::bigint, 0)) AS total
      FROM storage.objects o
      JOIN public.tracked_storage_buckets t ON t.bucket_id = o.bucket_id
     WHERE public.resolve_storage_owner(o.owner, o.name) IS NOT NULL
     GROUP BY 1
  )
  UPDATE public.profiles p
     SET storage_used_bytes = COALESCE(a.total, 0)
    FROM actual a
   WHERE p.user_id = a.user_id;
  -- Anyone with no objects → 0
  UPDATE public.profiles SET storage_used_bytes = 0 WHERE storage_used_bytes IS NULL;
END;
$$;

SELECT public.recompute_all_storage_usage();

-- 8. Public RPC the client uses to read its own quota cheaply
CREATE OR REPLACE FUNCTION public.get_my_storage_quota()
RETURNS TABLE(used_bytes bigint, limit_bytes bigint, tier text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(storage_used_bytes,0), COALESCE(storage_limit_bytes, 2147483648), COALESCE(subscription_tier,'free')
  FROM public.profiles WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_storage_quota() TO authenticated;