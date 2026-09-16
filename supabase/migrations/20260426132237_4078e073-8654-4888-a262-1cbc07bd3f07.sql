-- Creator availability blocks: marked-out date ranges (booked, on hold, unavailable)
CREATE TABLE public.creator_availability_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'booked',
  label TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT availability_block_type_check CHECK (block_type IN ('booked','hold','unavailable')),
  CONSTRAINT availability_date_order CHECK (end_date >= start_date)
);

CREATE INDEX idx_avail_blocks_user ON public.creator_availability_blocks (user_id, start_date);

ALTER TABLE public.creator_availability_blocks ENABLE ROW LEVEL SECURITY;

-- Public can see public blocks
CREATE POLICY "Public availability blocks are viewable"
ON public.creator_availability_blocks
FOR SELECT
USING (is_public = true);

-- Owners can see all their blocks
CREATE POLICY "Owners view their own blocks"
ON public.creator_availability_blocks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owners insert their own blocks"
ON public.creator_availability_blocks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update their own blocks"
ON public.creator_availability_blocks
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Owners delete their own blocks"
ON public.creator_availability_blocks
FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_creator_availability_blocks_updated_at
BEFORE UPDATE ON public.creator_availability_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();