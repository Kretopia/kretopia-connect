
-- Talent Manager Referral System
-- Tracks manager-talent relationships and ongoing commissions

CREATE TABLE public.talent_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id UUID NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  display_name TEXT,
  organization TEXT,
  total_referred INTEGER NOT NULL DEFAULT 0,
  total_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track which users were referred by which manager
CREATE TABLE public.talent_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.talent_managers(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL,
  referred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(manager_id, talent_user_id)
);

-- Track commissions earned on bookings
CREATE TABLE public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.talent_managers(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'gig',
  source_id TEXT,
  gross_amount NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.talent_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- Managers can view/manage their own records
CREATE POLICY "Managers can view own record" ON public.talent_managers
  FOR SELECT TO authenticated
  USING (manager_user_id = auth.uid());

CREATE POLICY "Managers can update own record" ON public.talent_managers
  FOR UPDATE TO authenticated
  USING (manager_user_id = auth.uid());

CREATE POLICY "Authenticated users can create manager profile" ON public.talent_managers
  FOR INSERT TO authenticated
  WITH CHECK (manager_user_id = auth.uid());

-- Anyone can view referral codes (for signup flow)
CREATE POLICY "Anyone can view active managers by referral code" ON public.talent_managers
  FOR SELECT TO anon
  USING (is_active = true);

-- Referrals policies
CREATE POLICY "Managers can view their referrals" ON public.talent_referrals
  FOR SELECT TO authenticated
  USING (manager_id IN (SELECT id FROM public.talent_managers WHERE manager_user_id = auth.uid()));

CREATE POLICY "System can insert referrals" ON public.talent_referrals
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Commission policies
CREATE POLICY "Managers can view their commissions" ON public.referral_commissions
  FOR SELECT TO authenticated
  USING (manager_id IN (SELECT id FROM public.talent_managers WHERE manager_user_id = auth.uid()));

CREATE POLICY "System can insert commissions" ON public.referral_commissions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_talent_managers_referral_code ON public.talent_managers(referral_code);
CREATE INDEX idx_talent_referrals_talent_user ON public.talent_referrals(talent_user_id);
CREATE INDEX idx_referral_commissions_manager ON public.referral_commissions(manager_id);
