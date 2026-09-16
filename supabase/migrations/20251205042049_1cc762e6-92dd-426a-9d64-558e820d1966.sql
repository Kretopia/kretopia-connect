-- Performance indexes for critical queries

-- Index for subscription tier filtering (used in discovery, features, limits)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier 
  ON profiles(subscription_tier);

-- Composite index for faster match lookups (used heavily in Circle)
CREATE INDEX IF NOT EXISTS idx_matches_users_composite 
  ON matches(user1_id, user2_id);

-- Composite index for faster connection queries
CREATE INDEX IF NOT EXISTS idx_connections_users_composite 
  ON connections(user_id, connected_user_id);

-- Index for notification queries by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, read, created_at DESC);

-- Index for portfolio items by user
CREATE INDEX IF NOT EXISTS idx_portfolio_items_user 
  ON portfolio_items(user_id, created_at DESC);

-- Index for swipes lookups
CREATE INDEX IF NOT EXISTS idx_swipes_user_target 
  ON swipes(user_id, target_id);

-- Index for analytics events queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_category_date 
  ON analytics_events(event_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_date 
  ON analytics_events(user_id, created_at DESC);