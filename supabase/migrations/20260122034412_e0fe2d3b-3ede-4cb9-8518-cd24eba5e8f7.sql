-- AI Agent Settings per user
CREATE TABLE public.agent_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  mode TEXT NOT NULL DEFAULT 'suggestion' CHECK (mode IN ('suggestion', 'semi_autonomous', 'autonomous')),
  focus_areas JSONB NOT NULL DEFAULT '["growth", "opportunities", "productivity"]'::jsonb,
  email_automation BOOLEAN NOT NULL DEFAULT true,
  task_automation BOOLEAN NOT NULL DEFAULT true,
  document_generation BOOLEAN NOT NULL DEFAULT true,
  daily_action_limit INTEGER NOT NULL DEFAULT 10,
  auto_approve_low_risk BOOLEAN NOT NULL DEFAULT false,
  working_hours_start INTEGER DEFAULT 9,
  working_hours_end INTEGER DEFAULT 18,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_agent UNIQUE (user_id)
);

-- Agent Goals for tracking objectives
CREATE TABLE public.agent_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('connections', 'applications', 'profile', 'projects', 'custom')),
  target_value INTEGER NOT NULL DEFAULT 1,
  current_value INTEGER NOT NULL DEFAULT 0,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Agent Action Queue for pending/completed actions
CREATE TABLE public.agent_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id UUID REFERENCES public.agent_goals(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('email', 'task', 'document', 'notification', 'application', 'connection')),
  title TEXT NOT NULL,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executing', 'completed', 'failed', 'rejected')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_settings
CREATE POLICY "Users can view their own agent settings"
ON public.agent_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agent settings"
ON public.agent_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent settings"
ON public.agent_settings FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for agent_goals
CREATE POLICY "Users can view their own goals"
ON public.agent_goals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
ON public.agent_goals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
ON public.agent_goals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
ON public.agent_goals FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for agent_actions
CREATE POLICY "Users can view their own actions"
ON public.agent_actions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own actions"
ON public.agent_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own actions"
ON public.agent_actions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own actions"
ON public.agent_actions FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_agent_settings_updated_at
BEFORE UPDATE ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_goals_updated_at
BEFORE UPDATE ON public.agent_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_actions_updated_at
BEFORE UPDATE ON public.agent_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for action queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_actions;