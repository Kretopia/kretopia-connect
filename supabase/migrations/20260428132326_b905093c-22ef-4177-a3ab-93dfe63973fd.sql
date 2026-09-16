
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY scouted_by, source_url
           ORDER BY created_at DESC
         ) AS rn
  FROM public.creative_jams
  WHERE source_url IS NOT NULL AND scouted_by IS NOT NULL
)
DELETE FROM public.creative_jams
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS creative_jams_scout_source_unique
ON public.creative_jams (scouted_by, source_url)
WHERE source_url IS NOT NULL AND scouted_by IS NOT NULL;
