-- Add collection support for albums/grouping portfolio items
ALTER TABLE public.portfolio_items 
ADD COLUMN IF NOT EXISTS collection_name TEXT,
ADD COLUMN IF NOT EXISTS collection_order INTEGER DEFAULT 0;

-- Add index for collection queries
CREATE INDEX IF NOT EXISTS idx_portfolio_items_collection ON public.portfolio_items(user_id, collection_name);