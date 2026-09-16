
-- Create board_items table for mood board pins, sticky notes, and AI generated images
CREATE TABLE public.board_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'pin', -- 'pin' (mood board image), 'note' (sticky note), 'ai_image' (AI generated)
  title TEXT,
  content TEXT, -- text content for notes, AI prompt for ai_image
  image_url TEXT, -- URL for images
  color TEXT DEFAULT '#FEF3C7', -- sticky note color
  position_x NUMERIC DEFAULT 0,
  position_y NUMERIC DEFAULT 0,
  width NUMERIC DEFAULT 200,
  height NUMERIC DEFAULT 200,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.board_items ENABLE ROW LEVEL SECURITY;

-- RLS policies using project access function
CREATE POLICY "Users with project access can view board items"
ON public.board_items FOR SELECT
USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users with project access can create board items"
ON public.board_items FOR INSERT
WITH CHECK (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users with project access can update board items"
ON public.board_items FOR UPDATE
USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users with project access can delete board items"
ON public.board_items FOR DELETE
USING (public.user_has_project_access(project_id, auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_board_items_updated_at
BEFORE UPDATE ON public.board_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_items;

-- Create storage bucket for board uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('board-assets', 'board-assets', true);

-- Storage policies
CREATE POLICY "Board assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'board-assets');

CREATE POLICY "Authenticated users can upload board assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'board-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own board assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'board-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
