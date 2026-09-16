-- Enforce portfolio item limit at DB level for free tier users
CREATE OR REPLACE FUNCTION public.enforce_portfolio_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count INTEGER;
  user_tier TEXT;
  max_items INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Pro and founder users have no limit
  IF user_tier IN ('pro', 'founder') THEN
    RETURN NEW;
  END IF;

  -- Free tier limit
  max_items := 5;

  -- Count existing items
  SELECT COUNT(*) INTO current_count
  FROM portfolio_items
  WHERE user_id = NEW.user_id;

  IF current_count >= max_items THEN
    RAISE EXCEPTION 'Portfolio limit reached. Free accounts can have up to % items. Upgrade to Pro for unlimited.', max_items;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_portfolio_limit_trigger
  BEFORE INSERT ON public.portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_portfolio_limit();
