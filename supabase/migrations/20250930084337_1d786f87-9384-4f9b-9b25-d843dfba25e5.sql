-- Add social media stats columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN youtube_subscribers integer,
ADD COLUMN instagram_followers integer,
ADD COLUMN tiktok_followers integer,
ADD COLUMN spotify_listeners integer,
ADD COLUMN twitter_followers integer,
ADD COLUMN linkedin_connections integer,
ADD COLUMN total_engagement_rate numeric(5,2),
ADD COLUMN avg_views integer,
ADD COLUMN verified_metrics boolean DEFAULT false;