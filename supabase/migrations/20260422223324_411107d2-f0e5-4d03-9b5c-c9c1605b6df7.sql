-- Phase 1: Multi-select intent (max 2) + add 'hire' option
-- Add new array column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_intents text[] DEFAULT '{}'::text[];

-- Backfill from existing single-select primary_intent
UPDATE public.profiles
SET primary_intents = ARRAY[primary_intent]
WHERE primary_intent IS NOT NULL
  AND (primary_intents IS NULL OR array_length(primary_intents, 1) IS NULL);

-- Validation trigger: enforce enum values + max 2 items
CREATE OR REPLACE FUNCTION public.validate_primary_intents()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY['collaborate', 'gigs', 'fund', 'hire', 'manage'];
  v text;
BEGIN
  IF NEW.primary_intents IS NULL THEN
    NEW.primary_intents := '{}'::text[];
    RETURN NEW;
  END IF;

  IF array_length(NEW.primary_intents, 1) > 2 THEN
    RAISE EXCEPTION 'primary_intents: max 2 allowed';
  END IF;

  IF NEW.primary_intents IS NOT NULL THEN
    FOREACH v IN ARRAY NEW.primary_intents LOOP
      IF NOT (v = ANY(allowed)) THEN
        RAISE EXCEPTION 'primary_intents: invalid value %', v;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_primary_intents_trigger ON public.profiles;
CREATE TRIGGER validate_primary_intents_trigger
  BEFORE INSERT OR UPDATE OF primary_intents ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_primary_intents();

-- Drop old single-value constraint if it exists, then loosen primary_intent to also allow 'hire'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_primary_intent_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_primary_intent_check
  CHECK (primary_intent IS NULL OR primary_intent = ANY (ARRAY['collaborate','gigs','fund','hire','manage']));