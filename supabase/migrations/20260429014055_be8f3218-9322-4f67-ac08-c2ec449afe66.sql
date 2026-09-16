
-- 1. Add founding_member to user_badge enum
ALTER TYPE public.user_badge ADD VALUE IF NOT EXISTS 'founding_member';
