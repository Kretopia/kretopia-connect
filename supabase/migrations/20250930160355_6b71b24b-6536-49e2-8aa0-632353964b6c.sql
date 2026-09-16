-- Add storage tracking to profiles
ALTER TABLE profiles 
ADD COLUMN storage_used_bytes BIGINT DEFAULT 0,
ADD COLUMN storage_limit_bytes BIGINT DEFAULT 1073741824; -- 1GB in bytes (1024*1024*1024)

-- Create function to update storage usage when files are added
CREATE OR REPLACE FUNCTION update_user_storage_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles
    SET storage_used_bytes = storage_used_bytes + NEW.file_size
    WHERE user_id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.file_size)
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for automatic storage tracking
DROP TRIGGER IF EXISTS track_storage_usage ON project_files;
CREATE TRIGGER track_storage_usage
AFTER INSERT OR DELETE ON project_files
FOR EACH ROW
EXECUTE FUNCTION update_user_storage_usage();

-- Update storage limits based on subscription tier
UPDATE profiles 
SET storage_limit_bytes = CASE 
  WHEN subscription_tier = 'basic' THEN 10737418240  -- 10GB
  WHEN subscription_tier = 'premium' THEN 53687091200  -- 50GB
  ELSE 1073741824  -- 1GB for free tier
END;

-- Create a function to check storage availability before upload
CREATE OR REPLACE FUNCTION check_storage_available(
  user_id_param UUID,
  file_size_param BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage BIGINT;
  storage_limit BIGINT;
BEGIN
  SELECT storage_used_bytes, storage_limit_bytes
  INTO current_usage, storage_limit
  FROM profiles
  WHERE user_id = user_id_param;
  
  RETURN (current_usage + file_size_param) <= storage_limit;
END;
$$;