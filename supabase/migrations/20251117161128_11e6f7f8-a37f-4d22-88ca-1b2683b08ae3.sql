
-- Add indexes for performance optimization on frequently queried columns

-- Opportunities table indexes (Discover page)
CREATE INDEX IF NOT EXISTS idx_opportunities_status_created_at 
ON opportunities(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_created_by 
ON opportunities(created_by);

-- Feed posts indexes (Spark page)
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_created 
ON feed_posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at 
ON feed_posts(created_at DESC);

-- Portfolio items indexes (Spark page)
CREATE INDEX IF NOT EXISTS idx_portfolio_user_created 
ON portfolio_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_created_at 
ON portfolio_items(created_at DESC);

-- Swipes indexes (Discover & Circle)
CREATE INDEX IF NOT EXISTS idx_swipes_user_target 
ON swipes(user_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_swipes_target_type 
ON swipes(target_type, user_id);

-- Connections indexes (Circle page)
CREATE INDEX IF NOT EXISTS idx_connections_user_status 
ON connections(user_id, status);

CREATE INDEX IF NOT EXISTS idx_connections_connected_status 
ON connections(connected_user_id, status);

CREATE INDEX IF NOT EXISTS idx_connections_both_users 
ON connections(user_id, connected_user_id, status);

-- Community members indexes
CREATE INDEX IF NOT EXISTS idx_community_members_user 
ON community_members(user_id, community_id);

CREATE INDEX IF NOT EXISTS idx_community_members_community 
ON community_members(community_id, user_id);

-- Community posts indexes
CREATE INDEX IF NOT EXISTS idx_community_posts_community_created 
ON community_posts(community_id, created_at DESC);

-- Profiles index for bulk lookups
CREATE INDEX IF NOT EXISTS idx_profiles_full_name 
ON profiles(full_name) WHERE full_name IS NOT NULL;
