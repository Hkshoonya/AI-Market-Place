-- Hugging Face discovery is broad and comparatively expensive. Official launch
-- feeds remain on tier 1; Hub metadata only needs the tier 2 cadence.
UPDATE public.data_sources
SET
  tier = 2,
  sync_interval_hours = 4,
  priority = 15,
  description = 'Hugging Face model discovery, structured weight metadata, downloads, likes, and trending signals',
  updated_at = now()
WHERE slug = 'huggingface';
