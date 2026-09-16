-- Add unsubscribe token column to notification_preferences
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_token 
ON notification_preferences(unsubscribe_token);

-- Function to generate secure tokens
CREATE OR REPLACE FUNCTION generate_unsubscribe_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate token on insert
CREATE OR REPLACE FUNCTION set_unsubscribe_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unsubscribe_token IS NULL THEN
    NEW.unsubscribe_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS ensure_unsubscribe_token ON notification_preferences;

CREATE TRIGGER ensure_unsubscribe_token
BEFORE INSERT ON notification_preferences
FOR EACH ROW EXECUTE FUNCTION set_unsubscribe_token();

-- Backfill existing records with tokens
UPDATE notification_preferences 
SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
WHERE unsubscribe_token IS NULL;