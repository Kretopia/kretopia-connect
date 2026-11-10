-- Host-editable, individually hideable sections of an Event page: Program (line-up), Venue notes, Policies and FAQ.
--
-- PREPARED FOR REVIEW, NOT APPLIED. Production still runs the legacy backend, which cannot receive migrations from this repo.
--
-- Why: the Event page showed these sections with text the code wrote (a "no line-up listed" line, generic policies, a fixed FAQ), and a
-- host had nowhere to edit any of it. Each section is one row here:
--   * content    what the host wrote (jsonb: {"text": "..."} for program, venue and policies; {"items": [{"question","answer"}]} for faq);
--   * is_visible the host's show/hide switch. Hiding keeps the content: turning it back on shows it again, nothing is deleted.
--
-- Who sees what is decided in the database, not only in the page:
--   * the TABLE can be read by the event's host only (every section, hidden or not), and written by the host only;
--   * everyone else reads the VIEW event_page_sections_public: it returns every section's visibility flag, but the content only for a
--     section that is visible. The words of a hidden section therefore cannot leak through another page, an export or a direct API read,
--     and the page can still tell that the Venue section is hidden (so it keeps the address off the hero, the exports and the structured
--     data it draws).
--   * NOT covered: the event's own address is a column of creative_jams (readable for public events, as it always was). Hiding the Venue
--     section keeps it off what the app draws; it is not an access control for that column. Hiding it from the API as well would need a
--     column-level change to creative_jams, which this migration does not make.
--
-- A section with no row keeps today's default text, so old events look as they did. Only the event's creator writes (same rule as
-- creative_jams: created_by = auth.uid()), and the content is bounded here as well as in the form.
--
-- Preflight (read-only):
--   SELECT to_regclass('public.event_page_sections'), to_regclass('public.event_page_sections_public');  -- NULL until applied
--
-- Rollback: DROP VIEW public.event_page_sections_public; DROP TABLE public.event_page_sections;
--   (events fall back to their default text; creative_jams is untouched)

CREATE TABLE IF NOT EXISTS public.event_page_sections (
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('program', 'venue', 'policies', 'faq')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(content) <= 24000),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, section)
);

ALTER TABLE public.event_page_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "The host reads their event's sections" ON public.event_page_sections;
CREATE POLICY "The host reads their event's sections"
  ON public.event_page_sections FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.creative_jams j WHERE j.id = event_id AND j.created_by = auth.uid()));

DROP POLICY IF EXISTS "The host adds their event's sections" ON public.event_page_sections;
CREATE POLICY "The host adds their event's sections"
  ON public.event_page_sections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.creative_jams j WHERE j.id = event_id AND j.created_by = auth.uid()));

DROP POLICY IF EXISTS "The host edits their event's sections" ON public.event_page_sections;
CREATE POLICY "The host edits their event's sections"
  ON public.event_page_sections FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.creative_jams j WHERE j.id = event_id AND j.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.creative_jams j WHERE j.id = event_id AND j.created_by = auth.uid()));

DROP POLICY IF EXISTS "The host removes their event's sections" ON public.event_page_sections;
CREATE POLICY "The host removes their event's sections"
  ON public.event_page_sections FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.creative_jams j WHERE j.id = event_id AND j.created_by = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_page_sections TO authenticated;

-- What everyone else reads: the flag for every section of a public event, the content only when the section is visible. The view runs with
-- its owner's rights (it must read the host-only table), so the redaction below is the whole of what it lets through.
CREATE OR REPLACE VIEW public.event_page_sections_public
WITH (security_barrier = true) AS
SELECT
  s.event_id,
  s.section,
  s.is_visible,
  CASE WHEN s.is_visible THEN s.content ELSE '{}'::jsonb END AS content
FROM public.event_page_sections s
JOIN public.creative_jams j ON j.id = s.event_id
WHERE j.is_public = true AND j.claim_status = 'claimed';

GRANT SELECT ON public.event_page_sections_public TO anon, authenticated;
