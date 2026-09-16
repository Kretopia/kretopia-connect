
-- Spark Prompts table (daily/weekly prompts)
CREATE TABLE public.spark_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  prompt_type TEXT NOT NULL DEFAULT 'daily' CHECK (prompt_type IN ('daily', 'weekly_challenge')),
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  active_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  response_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Spark Responses table
CREATE TABLE public.spark_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt_id UUID NOT NULL REFERENCES public.spark_prompts(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL DEFAULT 'text' CHECK (response_type IN ('text', 'image', 'link')),
  content TEXT,
  media_url TEXT,
  link_url TEXT,
  link_title TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Spark Likes table
CREATE TABLE public.spark_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  response_id UUID NOT NULL REFERENCES public.spark_responses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, response_id)
);

-- Enable RLS
ALTER TABLE public.spark_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_likes ENABLE ROW LEVEL SECURITY;

-- Prompts: everyone can read
CREATE POLICY "Anyone can view active prompts" ON public.spark_prompts
  FOR SELECT USING (is_active = true);

-- Responses: anyone can read, authenticated users can create their own
CREATE POLICY "Anyone can view responses" ON public.spark_responses
  FOR SELECT USING (true);

CREATE POLICY "Users can create responses" ON public.spark_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses" ON public.spark_responses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own responses" ON public.spark_responses
  FOR DELETE USING (auth.uid() = user_id);

-- Likes: anyone can read, authenticated users can create/delete their own
CREATE POLICY "Anyone can view likes" ON public.spark_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like" ON public.spark_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike" ON public.spark_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update response count on prompts
CREATE OR REPLACE FUNCTION public.update_spark_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE spark_prompts SET response_count = response_count + 1 WHERE id = NEW.prompt_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE spark_prompts SET response_count = response_count - 1 WHERE id = OLD.prompt_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_spark_response_count_trigger
AFTER INSERT OR DELETE ON public.spark_responses
FOR EACH ROW EXECUTE FUNCTION public.update_spark_response_count();

-- Trigger to update like count on responses
CREATE OR REPLACE FUNCTION public.update_spark_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE spark_responses SET like_count = like_count + 1 WHERE id = NEW.response_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE spark_responses SET like_count = like_count - 1 WHERE id = OLD.response_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_spark_like_count_trigger
AFTER INSERT OR DELETE ON public.spark_likes
FOR EACH ROW EXECUTE FUNCTION public.update_spark_like_count();

-- Enable realtime for spark responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.spark_responses;

-- Add updated_at triggers
CREATE TRIGGER update_spark_prompts_updated_at
BEFORE UPDATE ON public.spark_prompts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spark_responses_updated_at
BEFORE UPDATE ON public.spark_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
