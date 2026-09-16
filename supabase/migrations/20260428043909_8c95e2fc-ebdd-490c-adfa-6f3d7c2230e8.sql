
-- 1. jam_participants: who checked them in
ALTER TABLE public.jam_participants
  ADD COLUMN IF NOT EXISTS checked_in_by UUID;

-- 2. creative_jams: revenue split + photo wall
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS co_host_revenue_split JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_wall_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. event_co_hosts
CREATE TABLE IF NOT EXISTS public.event_co_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  revenue_share_pct NUMERIC(5,2) DEFAULT 0 CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100),
  invited_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_co_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view co-hosts of events they can see"
  ON public.event_co_hosts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creative_jams cj
      WHERE cj.id = event_co_hosts.event_id
        AND (cj.is_public = true OR cj.created_by = auth.uid())
    )
  );

CREATE POLICY "Host can manage co-hosts"
  ON public.event_co_hosts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_co_hosts.event_id AND cj.created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_co_hosts.event_id AND cj.created_by = auth.uid())
  );

CREATE POLICY "Co-host can accept own invite"
  ON public.event_co_hosts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_event_co_hosts_event ON public.event_co_hosts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_co_hosts_user ON public.event_co_hosts(user_id);

-- 4. event_photos
CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photos of events they can see"
  ON public.event_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creative_jams cj
      WHERE cj.id = event_photos.event_id
        AND (cj.is_public = true OR cj.created_by = auth.uid()
             OR EXISTS (SELECT 1 FROM public.jam_participants jp WHERE jp.jam_id = cj.id AND jp.user_id = auth.uid()))
    )
  );

CREATE POLICY "Checked-in attendees and host can upload"
  ON public.event_photos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_photos.event_id AND cj.created_by = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.jam_participants jp
        WHERE jp.jam_id = event_photos.event_id
          AND jp.user_id = auth.uid()
          AND jp.checked_in_at IS NOT NULL
      )
    )
  );

CREATE POLICY "User can delete own photos"
  ON public.event_photos FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Host can delete any event photo"
  ON public.event_photos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_photos.event_id AND cj.created_by = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_event_photos_event ON public.event_photos(event_id, created_at DESC);

-- 5. event_promoter_rewards
CREATE TABLE IF NOT EXISTS public.event_promoter_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  promoter_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  awarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, referred_user_id)
);

ALTER TABLE public.event_promoter_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promoter can view own rewards"
  ON public.event_promoter_rewards FOR SELECT
  USING (auth.uid() = promoter_user_id);

CREATE POLICY "Host can view event rewards"
  ON public.event_promoter_rewards FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_promoter_rewards.event_id AND cj.created_by = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_promoter_rewards_event ON public.event_promoter_rewards(event_id);
CREATE INDEX IF NOT EXISTS idx_promoter_rewards_user ON public.event_promoter_rewards(promoter_user_id);

-- 6. event_reminders_sent (idempotency log)
CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL, -- 'reminder_24h' | 'reminder_1h' | 'recap_2h_after'
  channel TEXT NOT NULL, -- 'email' | 'push' | 'in_app'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, reminder_type, channel)
);

ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own reminders"
  ON public.event_reminders_sent FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_event_reminders_lookup ON public.event_reminders_sent(event_id, reminder_type);

-- 7. Trigger: auto-promote next waitlist entry when a participant cancels
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_id UUID;
BEGIN
  -- Only act on transitions to cancelled
  IF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND COALESCE(OLD.status,'') <> 'cancelled')
     OR (TG_OP = 'DELETE') THEN

    SELECT id INTO v_next_id
    FROM public.event_waitlist
    WHERE event_id = COALESCE(NEW.jam_id, OLD.jam_id)
      AND status = 'waiting'
    ORDER BY position ASC, created_at ASC
    LIMIT 1;

    IF v_next_id IS NOT NULL THEN
      UPDATE public.event_waitlist
      SET status = 'offered',
          offered_at = now(),
          expires_at = now() + interval '24 hours'
      WHERE id = v_next_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_cancel ON public.jam_participants;
CREATE TRIGGER trg_promote_waitlist_on_cancel
AFTER UPDATE OR DELETE ON public.jam_participants
FOR EACH ROW EXECUTE FUNCTION public.promote_waitlist_on_cancel();

-- 8. RPC: capacity-safe RSVP join. Returns 'joined' | 'waitlisted' | 'already' | 'full_no_waitlist'
CREATE OR REPLACE FUNCTION public.rsvp_to_event(
  p_event_id UUID,
  p_referred_by UUID DEFAULT NULL,
  p_referral_channel TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_max INTEGER;
  v_count INTEGER;
  v_waitlist_enabled BOOLEAN;
  v_existing TEXT;
  v_position INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT max_participants, waitlist_enabled
    INTO v_max, v_waitlist_enabled
  FROM public.creative_jams WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  -- Already in?
  SELECT status INTO v_existing
  FROM public.jam_participants
  WHERE jam_id = p_event_id AND user_id = v_user;

  IF v_existing IS NOT NULL AND v_existing <> 'cancelled' THEN
    RETURN 'already';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.jam_participants
  WHERE jam_id = p_event_id AND status <> 'cancelled';

  IF v_max IS NOT NULL AND v_count >= v_max THEN
    IF v_waitlist_enabled THEN
      SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
      FROM public.event_waitlist WHERE event_id = p_event_id;

      INSERT INTO public.event_waitlist (event_id, user_id, position, status)
      VALUES (p_event_id, v_user, v_position, 'waiting')
      ON CONFLICT DO NOTHING;
      RETURN 'waitlisted';
    ELSE
      RETURN 'full_no_waitlist';
    END IF;
  END IF;

  INSERT INTO public.jam_participants (jam_id, user_id, status, referred_by, referral_channel)
  VALUES (p_event_id, v_user, 'going', p_referred_by, p_referral_channel)
  ON CONFLICT (jam_id, user_id)
    DO UPDATE SET status = 'going',
                  referred_by = COALESCE(EXCLUDED.referred_by, jam_participants.referred_by),
                  referral_channel = COALESCE(EXCLUDED.referral_channel, jam_participants.referral_channel);

  -- Mark share-click attribution as converted
  IF p_referred_by IS NOT NULL THEN
    UPDATE public.event_share_clicks
       SET converted_to_rsvp = true
     WHERE event_id = p_event_id
       AND referrer_user_id = p_referred_by
       AND converted_to_rsvp = false;
  END IF;

  RETURN 'joined';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rsvp_to_event(UUID, UUID, TEXT) TO authenticated;
