-- Grant explicit permissions to authenticated users for projects table
GRANT INSERT, SELECT, UPDATE, DELETE ON public.projects TO authenticated;

-- Ensure authenticated role can use sequences for ID generation
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;