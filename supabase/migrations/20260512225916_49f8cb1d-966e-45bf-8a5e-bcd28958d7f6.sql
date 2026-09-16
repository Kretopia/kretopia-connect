
CREATE OR REPLACE FUNCTION public.sync_general_admission_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wants_ga boolean;
  _existing_id uuid;
  _sold integer;
BEGIN
  _wants_ga := COALESCE(NEW.is_ticketed, false)
               AND COALESCE(NEW.ticket_price, 0) > 0
               AND (NEW.external_ticket_url IS NULL OR NEW.external_ticket_url = '');

  SELECT id, quantity_sold INTO _existing_id, _sold
  FROM public.event_ticket_tiers
  WHERE event_id = NEW.id AND name = 'General Admission'
  LIMIT 1;

  IF _wants_ga THEN
    IF _existing_id IS NULL THEN
      INSERT INTO public.event_ticket_tiers
        (event_id, name, description, price, currency, display_order)
      VALUES
        (NEW.id, 'General Admission', NULL,
         NEW.ticket_price, COALESCE(NEW.ticket_currency, 'USD'), 0);
    ELSE
      UPDATE public.event_ticket_tiers
      SET price = NEW.ticket_price,
          currency = COALESCE(NEW.ticket_currency, 'USD'),
          updated_at = now()
      WHERE id = _existing_id;
    END IF;
  ELSE
    -- Remove auto tier only if nothing has been sold
    IF _existing_id IS NOT NULL AND COALESCE(_sold, 0) = 0 THEN
      DELETE FROM public.event_ticket_tiers WHERE id = _existing_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_general_admission_tier ON public.creative_jams;
CREATE TRIGGER trg_sync_general_admission_tier
AFTER INSERT OR UPDATE OF is_ticketed, ticket_price, ticket_currency, external_ticket_url
ON public.creative_jams
FOR EACH ROW
EXECUTE FUNCTION public.sync_general_admission_tier();

-- Backfill: create GA tier for existing ticketed events with no tier yet
INSERT INTO public.event_ticket_tiers (event_id, name, price, currency, display_order)
SELECT cj.id, 'General Admission', cj.ticket_price, COALESCE(cj.ticket_currency, 'USD'), 0
FROM public.creative_jams cj
WHERE cj.is_ticketed = true
  AND COALESCE(cj.ticket_price, 0) > 0
  AND (cj.external_ticket_url IS NULL OR cj.external_ticket_url = '')
  AND NOT EXISTS (
    SELECT 1 FROM public.event_ticket_tiers t WHERE t.event_id = cj.id
  );
