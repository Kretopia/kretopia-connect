-- Fix infinite recursion in community_members policies
DROP POLICY IF EXISTS "Admins can manage members" ON public.community_members;
DROP POLICY IF EXISTS "Members can view community members" ON public.community_members;