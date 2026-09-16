-- Add manager mode flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_manager_mode boolean DEFAULT false;

-- Add posted_by_manager_id to opportunities so managers can post on behalf of clients
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS posted_by_manager_id uuid REFERENCES public.talent_managers(id);
