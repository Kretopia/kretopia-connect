
-- Phase 3: Deprecate legacy tables
-- Drop the enforce_portfolio_limit trigger and function (was on portfolio_items)
DROP TRIGGER IF EXISTS enforce_portfolio_limit_trigger ON public.portfolio_items;
DROP FUNCTION IF EXISTS public.enforce_portfolio_limit();

-- Drop portfolio_reactions FK references if they exist
DROP TABLE IF EXISTS public.portfolio_reactions;

-- Drop the legacy tables
DROP TABLE IF EXISTS public.verified_credits CASCADE;
DROP TABLE IF EXISTS public.portfolio_items CASCADE;
