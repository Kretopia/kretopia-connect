
-- Add unique constraint to connections table for upsert to work properly
ALTER TABLE public.connections 
ADD CONSTRAINT connections_user_connected_unique 
UNIQUE (user_id, connected_user_id);
