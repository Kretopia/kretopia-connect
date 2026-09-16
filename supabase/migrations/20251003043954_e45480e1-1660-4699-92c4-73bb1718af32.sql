-- Add 'founder' to the user_badge enum
ALTER TYPE user_badge ADD VALUE IF NOT EXISTS 'founder';

-- Add membership_number column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership_number TEXT UNIQUE;

-- Function to generate unique membership number
CREATE OR REPLACE FUNCTION generate_membership_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  number_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate format: TH-XXXXXX (6 random digits)
    new_number := 'TH-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if number exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE membership_number = new_number) INTO number_exists;
    
    EXIT WHEN NOT number_exists;
  END LOOP;
  
  RETURN new_number;
END;
$$;

-- Trigger to auto-generate membership number for paid members
CREATE OR REPLACE FUNCTION assign_membership_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign number if subscription tier changes to paid and no number exists
  IF NEW.subscription_tier IN ('thriver', 'creator_pro') AND 
     (OLD.subscription_tier IS NULL OR OLD.subscription_tier = 'free') AND
     NEW.membership_number IS NULL THEN
    NEW.membership_number := generate_membership_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_membership_number_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_membership_number();