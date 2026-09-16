
-- Phase 2: Migrate data from portfolio_items and verified_credits into unified credits table

-- 1. Migrate portfolio_items → credits
INSERT INTO credits (
  user_id, project_name, role, source, source_id, media_type, primary_media_url,
  thumbnail_url, description, tags, credit_category, view_count, metadata,
  is_featured, created_at, updated_at
)
SELECT
  pi.user_id,
  pi.title,
  'Creator',
  'portfolio',
  pi.id::text,
  pi.media_type,
  pi.media_url,
  pi.thumbnail_url,
  pi.description,
  pi.tags,
  COALESCE(pi.category, 'Other'),
  COALESCE(pi.view_count, 0),
  jsonb_build_object(
    'embed_code', pi.embed_code,
    'collection_name', pi.collection_name,
    'collection_order', pi.collection_order,
    'migrated_from', 'portfolio_items',
    'original_id', pi.id
  ),
  COALESCE(pi.featured, false),
  pi.created_at,
  pi.updated_at
FROM portfolio_items pi
WHERE NOT EXISTS (
  SELECT 1 FROM credits c
  WHERE c.source = 'portfolio' AND c.source_id = pi.id::text
);

-- 2. Migrate verified_credits → credits
INSERT INTO credits (
  user_id, project_name, role, source, source_id, platform,
  verification_status, verification_url, year, credit_category,
  metadata, created_at, updated_at
)
SELECT
  vc.user_id,
  vc.title,
  COALESCE(vc.role, 'Contributor'),
  COALESCE(vc.source, 'import'),
  vc.source_id,
  vc.source,
  CASE WHEN vc.verified_at IS NOT NULL THEN 'verified' ELSE 'pending' END,
  vc.verification_url,
  vc.year,
  COALESCE(vc.credit_type, 'Other'),
  jsonb_build_object(
    'migrated_from', 'verified_credits',
    'original_id', vc.id,
    'original_metadata', vc.metadata,
    'verified_at', vc.verified_at
  ),
  vc.created_at,
  vc.created_at
FROM verified_credits vc
WHERE NOT EXISTS (
  SELECT 1 FROM credits c
  WHERE c.source_id = vc.source_id AND c.user_id = vc.user_id AND c.source = COALESCE(vc.source, 'import')
);
