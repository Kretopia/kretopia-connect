
-- ============================================
-- CLEANUP: Remove legacy Spark & Cre8 tables, triggers, and functions
-- ============================================

-- 1. Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS on_spark_response_created ON spark_responses;
DROP TRIGGER IF EXISTS on_spark_response_deleted ON spark_responses;
DROP TRIGGER IF EXISTS on_spark_like_created ON spark_likes;
DROP TRIGGER IF EXISTS on_spark_like_deleted ON spark_likes;
DROP TRIGGER IF EXISTS on_room_message_created ON spark_room_messages;
DROP TRIGGER IF EXISTS on_room_message_deleted ON spark_room_messages;
DROP TRIGGER IF EXISTS on_challenge_vote_insert ON challenge_votes;
DROP TRIGGER IF EXISTS on_challenge_vote_delete ON challenge_votes;
DROP TRIGGER IF EXISTS on_challenge_entry_insert ON challenge_entries;
DROP TRIGGER IF EXISTS on_leaderboard_update ON challenge_leaderboard;
DROP TRIGGER IF EXISTS on_feed_reaction_insert ON feed_clips;
DROP TRIGGER IF EXISTS notify_room_message ON spark_room_messages;

-- 2. Drop Spark tables (in dependency order)
DROP TABLE IF EXISTS spark_room_reactions CASCADE;
DROP TABLE IF EXISTS spark_room_messages CASCADE;
DROP TABLE IF EXISTS spark_room_members CASCADE;
DROP TABLE IF EXISTS spark_rooms CASCADE;
DROP TABLE IF EXISTS spark_likes CASCADE;
DROP TABLE IF EXISTS spark_responses CASCADE;
DROP TABLE IF EXISTS spark_prompts CASCADE;

-- 3. Drop Cre8/Challenge tables (in dependency order)
DROP TABLE IF EXISTS challenge_achievements CASCADE;
DROP TABLE IF EXISTS challenge_entry_swaps CASCADE;
DROP TABLE IF EXISTS challenge_votes CASCADE;
DROP TABLE IF EXISTS challenge_entries CASCADE;
DROP TABLE IF EXISTS challenge_leaderboard CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;

-- 4. Drop orphaned functions
DROP FUNCTION IF EXISTS public.update_spark_response_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_spark_like_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_room_message_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_entry_vote_count() CASCADE;
DROP FUNCTION IF EXISTS public.increment_leaderboard_entries() CASCADE;
DROP FUNCTION IF EXISTS public.update_leaderboard_on_vote() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_arena_rank(integer, integer, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.update_arena_rank() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_room_message() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_feed_reaction() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_feed_comment() CASCADE;
