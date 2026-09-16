-- Owner-pays storage attribution for project-files bucket.
-- For project-files paths shaped like `<projectId>/...`, charge the project owner
-- instead of the uploading guest/collaborator.

CREATE OR REPLACE FUNCTION public.resolve_storage_owner(_owner uuid, _name text, _bucket text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_segment text;
  project_owner uuid;
  fallback_uuid uuid;
BEGIN
  first_segment := split_part(_name, '/', 1);

  -- Owner-pays rule: project-files bucket → project's created_by
  IF _bucket = 'project-files' AND first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT created_by INTO project_owner
      FROM public.projects
     WHERE id = first_segment::uuid
     LIMIT 1;
    IF project_owner IS NOT NULL THEN
      RETURN project_owner;
    END IF;
  END IF;

  -- Default: storage.objects.owner if set
  IF _owner IS NOT NULL THEN
    RETURN _owner;
  END IF;

  -- Fallback: first folder segment if it's a uuid
  BEGIN
    fallback_uuid := first_segment::uuid;
    RETURN fallback_uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

-- Update tracker + enforcer to pass bucket
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
    owner_id := public.resolve_storage_owner(NEW.owner, NEW.name, NEW.bucket_id);
    IF owner_id IS NULL THEN RETURN NEW; END IF;
    obj_size := COALESCE((NEW.metadata->>'size')::bigint, 0);
    UPDATE public.profiles
       SET storage_used_bytes = COALESCE(storage_used_bytes,0) + obj_size
     WHERE user_id = owner_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT EXISTS(SELECT 1 FROM public.tracked_storage_buckets WHERE bucket_id = OLD.bucket_id) INTO is_tracked;
    IF NOT is_tracked THEN RETURN OLD; END IF;
    owner_id := public.resolve_storage_owner(OLD.owner, OLD.name, OLD.bucket_id);
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
  owner_id := public.resolve_storage_owner(NEW.owner, NEW.name, NEW.bucket_id);
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

-- Recompute current usage so existing data matches new attribution
DO $$
BEGIN
  UPDATE public.profiles SET storage_used_bytes = 0;
  UPDATE public.profiles p
     SET storage_used_bytes = COALESCE(sub.total, 0)
    FROM (
      SELECT public.resolve_storage_owner(o.owner, o.name, o.bucket_id) AS owner_id,
             SUM(COALESCE((o.metadata->>'size')::bigint, 0)) AS total
        FROM storage.objects o
        JOIN public.tracked_storage_buckets t ON t.bucket_id = o.bucket_id
       GROUP BY 1
    ) sub
   WHERE p.user_id = sub.owner_id;
END $$;