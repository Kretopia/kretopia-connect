
-- Phase A: Scout Stage upgrades — mode + privacy + invite-gated joining

ALTER TABLE public.curated_stages
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.curated_stages
  DROP CONSTRAINT IF EXISTS curated_stages_mode_check;
ALTER TABLE public.curated_stages
  ADD CONSTRAINT curated_stages_mode_check CHECK (mode IN ('audio','video'));

ALTER TABLE public.curated_stages
  DROP CONSTRAINT IF EXISTS curated_stages_visibility_check;
ALTER TABLE public.curated_stages
  ADD CONSTRAINT curated_stages_visibility_check CHECK (visibility IN ('public','unlisted','private'));

CREATE UNIQUE INDEX IF NOT EXISTS curated_stages_invite_token_idx
  ON public.curated_stages(invite_token) WHERE invite_token IS NOT NULL;

-- Backfill invite_token for any existing non-public stages so links keep working
UPDATE public.curated_stages
   SET invite_token = encode(gen_random_bytes(18), 'hex')
 WHERE invite_token IS NULL AND visibility <> 'public';

-- Invites table for private stages (email allowlist)
CREATE TABLE IF NOT EXISTS public.curated_stage_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.curated_stages(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid,
  token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  status text NOT NULL DEFAULT 'invited',
  invited_by uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT curated_stage_invites_status_check CHECK (status IN ('invited','accepted','revoked')),
  CONSTRAINT curated_stage_invites_unique UNIQUE (stage_id, email)
);

CREATE INDEX IF NOT EXISTS curated_stage_invites_stage_idx ON public.curated_stage_invites(stage_id);
CREATE INDEX IF NOT EXISTS curated_stage_invites_email_idx ON public.curated_stage_invites(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS curated_stage_invites_token_idx ON public.curated_stage_invites(token);

ALTER TABLE public.curated_stage_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "host can view invites" ON public.curated_stage_invites;
CREATE POLICY "host can view invites"
  ON public.curated_stage_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.curated_stages cs
       WHERE cs.id = curated_stage_invites.stage_id
         AND cs.host_user_id = auth.uid()
    )
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

DROP POLICY IF EXISTS "host can add invites" ON public.curated_stage_invites;
CREATE POLICY "host can add invites"
  ON public.curated_stage_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.curated_stages cs
       WHERE cs.id = curated_stage_invites.stage_id
         AND cs.host_user_id = auth.uid()
    )
    AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS "host can update invites" ON public.curated_stage_invites;
CREATE POLICY "host can update invites"
  ON public.curated_stage_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.curated_stages cs
       WHERE cs.id = curated_stage_invites.stage_id
         AND cs.host_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "host can remove invites" ON public.curated_stage_invites;
CREATE POLICY "host can remove invites"
  ON public.curated_stage_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.curated_stages cs
       WHERE cs.id = curated_stage_invites.stage_id
         AND cs.host_user_id = auth.uid()
    )
  );
