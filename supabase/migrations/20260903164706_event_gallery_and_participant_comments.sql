-- Host-only event gallery, capped at 6 images. No new RLS needed: the
-- existing "Users can update their own jams" policy (created_by = auth.uid())
-- already restricts every column on this table, including this one, to the
-- host -- that's what "host only can add images" actually means at the data
-- layer, not a client-side-only rule.
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS gallery_image_urls TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.creative_jams
  DROP CONSTRAINT IF EXISTS creative_jams_gallery_max_6;
ALTER TABLE public.creative_jams
  ADD CONSTRAINT creative_jams_gallery_max_6
  CHECK (array_length(gallery_image_urls, 1) IS NULL OR array_length(gallery_image_urls, 1) <= 6);

-- Comments can now carry one image (participant-uploaded, alongside their
-- text). Nullable -- most comments stay text-only.
ALTER TABLE public.event_comments
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- "Only participants can comment" -- the existing INSERT policy only checked
-- auth.uid() = user_id (any signed-in user, RSVP'd or not). Tightened to
-- also require the commenter to actually be going/interested, or be the
-- event's host (hosts comment on their own events without RSVPing to them).
DROP POLICY IF EXISTS "Users can create comments" ON public.event_comments;
DROP POLICY IF EXISTS "Participants and host can create comments" ON public.event_comments;
CREATE POLICY "Participants and host can create comments"
  ON public.event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.creative_jams j
        WHERE j.id = event_comments.event_id AND j.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.jam_participants p
        WHERE p.jam_id = event_comments.event_id
          AND p.user_id = auth.uid()
          AND p.status <> 'cancelled'
      )
    )
  );
