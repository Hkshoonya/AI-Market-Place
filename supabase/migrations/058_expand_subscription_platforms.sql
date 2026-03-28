-- Expand first-party subscription plan coverage for providers with official member plans.

INSERT INTO deployment_platforms (slug, name, type, base_url, has_affiliate, affiliate_commission)
VALUES
  ('minimax-coding-plan', 'MiniMax Coding Plan', 'subscription', 'https://www.minimax.io/pricing', false, null),
  ('kimi-code-membership', 'Kimi Code Membership', 'subscription', 'https://www.kimi.com/code/docs/en/benefits.html', false, null),
  ('glm-coding-plan', 'GLM Coding Plan', 'subscription', 'https://docs.z.ai/devpack/overview', false, null)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  base_url = EXCLUDED.base_url,
  has_affiliate = EXCLUDED.has_affiliate,
  affiliate_commission = EXCLUDED.affiliate_commission,
  updated_at = timezone('utc'::text, now());
