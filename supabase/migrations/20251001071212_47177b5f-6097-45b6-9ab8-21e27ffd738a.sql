-- Add payment intent tracking to milestones for escrow
ALTER TABLE public.milestones
ADD COLUMN payment_intent_id text,
ADD COLUMN escrow_status text DEFAULT 'none' CHECK (escrow_status IN ('none', 'authorized', 'captured', 'cancelled'));

COMMENT ON COLUMN public.milestones.payment_intent_id IS 'Stripe payment intent ID for escrow';
COMMENT ON COLUMN public.milestones.escrow_status IS 'Escrow status: none (no escrow), authorized (funds held), captured (payment complete), cancelled (refunded)';
