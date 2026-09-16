-- "Bible" item: org/workspace layer. Confirmed absent from this schema
-- entirely (no organizations/workspace table anywhere in
-- supabase/migrations prior to this file).
--
-- This adds the minimal, reversible foundation only:
--   - organizations: id, name, owner, plan/seat fields left for later.
--   - organization_members: who belongs to an org and at what role.
--   - a nullable org_id on profiles and projects (Kretopia's "studio"
--     workspace) so a future migration can start relating rows to an
--     org without a backfill or breaking change -- NULL org_id today
--     means "no change in behavior for any existing row."
--
-- Deliberately NOT done here (all genuine product decisions, not
-- schema/reversibility questions):
--   - Whether org membership grants automatic access to a member's
--     projects/opportunities (today's per-project owner/collaborator
--     model is untouched -- no existing RLS policy references org_id).
--   - Billing/seats/plan tier at the org level (Kretopia's subscription
--     model is entirely per-user today via profiles.subscription_tier).
--   - Any UI for creating/managing an organization -- none exists yet.
--   - Whether opportunity-publishing caps or AI rate limits should ever
--     be pooled at the org level instead of per-user (both of this
--     session's cap mechanisms are per-user only).
--
-- Every piece below is additive and safe to leave inert indefinitely: no
-- existing table's policy or query changes as a result of this
-- migration, and org_id is nullable everywhere it's added.

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper, same has_role()-style pattern already used
-- throughout this schema, to avoid RLS-policy self-recursion on
-- organization_members.
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org_id AND user_id = _user_id AND role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_org_admin(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO authenticated;

CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Owners can update their organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Authenticated users can create an organization"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their organization"
ON public.organizations FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Creating an org doesn't automatically seat the owner as a member row --
-- do that alongside the INSERT via this RPC rather than a trigger, so a
-- future org-creation flow has one clear entry point.
CREATE OR REPLACE FUNCTION public.create_organization(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  INSERT INTO public.organizations (name, owner_id)
  VALUES (trim(_name), auth.uid())
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, auth.uid(), 'owner');

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT) TO authenticated;

CREATE POLICY "Members can view their organization's roster"
ON public.organization_members FOR SELECT
TO authenticated
USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Org admins can manage membership"
ON public.organization_members FOR ALL
TO authenticated
USING (public.is_org_admin(org_id, auth.uid()))
WITH CHECK (public.is_org_admin(org_id, auth.uid()));

CREATE POLICY "Users can leave an organization"
ON public.organization_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Nullable org_id, additive, no backfill, no existing policy touched.
--
-- Side effect worth noting rather than "fixing": both profiles and
-- projects already had their table-level UPDATE grant REVOKEd and
-- replaced with an explicit per-existing-column re-GRANT
-- (20260904150000, 20260910190000) -- a brand new column added by
-- ALTER TABLE inherits no column-level grant automatically, so org_id
-- starts unwritable by `authenticated` on both tables by default. That's
-- the right default here: org assignment should go through a future
-- RPC (join/leave/transfer), not a raw PATCH, once that flow exists.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
