
-- First delete duplicates, keeping the oldest
DELETE FROM credits
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, lower(project_name), lower(role), coalesce(source, ''))
    id
  FROM credits
  ORDER BY user_id, lower(project_name), lower(role), coalesce(source, ''), created_at ASC
);

-- Create unique index to prevent future duplicates
CREATE UNIQUE INDEX credits_dedup_idx ON credits (user_id, lower(project_name), lower(role), coalesce(source, ''));
