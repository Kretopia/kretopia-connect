ALTER TABLE public.magazine_articles 
  ADD COLUMN IF NOT EXISTS cover_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_zoom numeric NOT NULL DEFAULT 1;