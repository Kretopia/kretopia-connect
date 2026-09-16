-- One-time backfill: Award XP for all historical activities
-- This script checks existing activities and awards XP if not already awarded

-- 1. Award XP for all opportunities posted (50 XP each)
INSERT INTO xp_activities (user_id, activity_type, xp_earned, description, created_at)
SELECT 
  o.created_by as user_id,
  'opportunity_posted' as activity_type,
  50 as xp_earned,
  'Posted ' || o.title as description,
  o.created_at
FROM opportunities o
WHERE NOT EXISTS (
  SELECT 1 FROM xp_activities xa
  WHERE xa.user_id = o.created_by
  AND xa.activity_type = 'opportunity_posted'
  AND xa.description = 'Posted ' || o.title
);

-- 2. Award XP for all portfolio items (30 XP each)
INSERT INTO xp_activities (user_id, activity_type, xp_earned, description, created_at)
SELECT 
  pi.user_id,
  'portfolio_item_added' as activity_type,
  30 as xp_earned,
  'Added ' || pi.title as description,
  pi.created_at
FROM portfolio_items pi
WHERE NOT EXISTS (
  SELECT 1 FROM xp_activities xa
  WHERE xa.user_id = pi.user_id
  AND xa.activity_type = 'portfolio_item_added'
  AND xa.description = 'Added ' || pi.title
);

-- 3. Award XP for all connections (25 XP each, but only to the user who initiated)
INSERT INTO xp_activities (user_id, activity_type, xp_earned, description, created_at)
SELECT 
  c.user_id,
  'connection_made' as activity_type,
  25 as xp_earned,
  'Connection accepted' as description,
  c.created_at
FROM connections c
WHERE c.status = 'accepted'
AND NOT EXISTS (
  SELECT 1 FROM xp_activities xa
  WHERE xa.user_id = c.user_id
  AND xa.activity_type = 'connection_made'
  AND xa.created_at::date = c.created_at::date
  AND xa.description = 'Connection accepted'
);

-- 4. Award XP for all reviews received (150 XP each)
INSERT INTO xp_activities (user_id, activity_type, xp_earned, description, created_at)
SELECT 
  r.profile_id as user_id,
  'review_received' as activity_type,
  150 as xp_earned,
  'Received ' || r.rating || '-star review from ' || r.reviewer_name as description,
  r.created_at
FROM reviews r
WHERE r.status = 'approved'
AND NOT EXISTS (
  SELECT 1 FROM xp_activities xa
  WHERE xa.user_id = r.profile_id
  AND xa.activity_type = 'review_received'
  AND xa.description = 'Received ' || r.rating || '-star review from ' || r.reviewer_name
);

-- 5. Award XP for all completed milestones (200 XP each)
INSERT INTO xp_activities (user_id, activity_type, xp_earned, description, created_at)
SELECT 
  m.created_by as user_id,
  'milestone_completed' as activity_type,
  200 as xp_earned,
  'Completed milestone: ' || m.title as description,
  m.updated_at
FROM milestones m
WHERE m.status = 'completed' OR m.status = 'paid'
AND NOT EXISTS (
  SELECT 1 FROM xp_activities xa
  WHERE xa.user_id = m.created_by
  AND xa.activity_type = 'milestone_completed'
  AND xa.description = 'Completed milestone: ' || m.title
);

-- 6. Update all user XP totals based on xp_activities
UPDATE profiles p
SET xp = (
  SELECT COALESCE(SUM(xa.xp_earned), 0)
  FROM xp_activities xa
  WHERE xa.user_id = p.user_id
)
WHERE EXISTS (
  SELECT 1 FROM xp_activities xa WHERE xa.user_id = p.user_id
);

-- Note: The level will be auto-updated by the update_level_from_xp trigger