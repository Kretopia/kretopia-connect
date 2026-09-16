-- Create comment tables for all content types
CREATE TABLE IF NOT EXISTS public.portfolio_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.award_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_id UUID NOT NULL REFERENCES public.awards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.press_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  press_link_id UUID NOT NULL REFERENCES public.press_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create saved sparks table
CREATE TABLE IF NOT EXISTS public.saved_sparks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('portfolio', 'award', 'press', 'credit', 'post')),
  item_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

-- Enable RLS
ALTER TABLE public.portfolio_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.award_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.press_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_sparks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Users can view all comments" ON public.portfolio_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.portfolio_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.portfolio_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.portfolio_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view all comments" ON public.award_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.award_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.award_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.award_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view all comments" ON public.press_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.press_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.press_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.press_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view all comments" ON public.credit_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.credit_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.credit_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.credit_comments FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for saved sparks
CREATE POLICY "Users can view own saved sparks" ON public.saved_sparks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create saved sparks" ON public.saved_sparks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved sparks" ON public.saved_sparks FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_portfolio_comments_item ON public.portfolio_comments(portfolio_item_id);
CREATE INDEX idx_award_comments_item ON public.award_comments(award_id);
CREATE INDEX idx_press_comments_item ON public.press_comments(press_link_id);
CREATE INDEX idx_credit_comments_item ON public.credit_comments(credit_id);
CREATE INDEX idx_saved_sparks_user ON public.saved_sparks(user_id, item_type);