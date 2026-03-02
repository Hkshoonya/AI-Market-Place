-- 013_affiliate_links.sql
-- Add affiliate URL columns to deployment_platforms and seed affiliate links

-- 1. Add affiliate_url and affiliate_tag columns
ALTER TABLE deployment_platforms ADD COLUMN IF NOT EXISTS affiliate_url text;
ALTER TABLE deployment_platforms ADD COLUMN IF NOT EXISTS affiliate_tag text;

-- 2. Seed affiliate URLs for target platforms (upsert pattern)
-- These use placeholder ?ref=aimarketcap until real affiliate IDs are obtained
UPDATE deployment_platforms SET
  affiliate_url = 'https://cloud.google.com/vertex-ai?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'gcp-vertex';

UPDATE deployment_platforms SET
  affiliate_url = 'https://aws.amazon.com/bedrock?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'aws-bedrock';

UPDATE deployment_platforms SET
  affiliate_url = 'https://azure.microsoft.com/en-us/products/ai-services?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'azure-ai';

UPDATE deployment_platforms SET
  affiliate_url = 'https://replicate.com?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'replicate';

UPDATE deployment_platforms SET
  affiliate_url = 'https://www.together.ai?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'together-ai';

UPDATE deployment_platforms SET
  affiliate_url = 'https://huggingface.co/inference-api?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'hf-inference';

UPDATE deployment_platforms SET
  affiliate_url = 'https://runpod.io?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'runpod';

UPDATE deployment_platforms SET
  affiliate_url = 'https://openrouter.ai?ref=aimarketcap',
  affiliate_tag = 'ref=aimarketcap',
  has_affiliate = true
WHERE slug = 'openrouter';
