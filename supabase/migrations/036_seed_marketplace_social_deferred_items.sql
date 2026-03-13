-- Seed deferred marketplace/social roadmap items into the agent ledger.

INSERT INTO agent_deferred_items (
  slug,
  title,
  area,
  reason,
  risk_level,
  required_before,
  owner_hint,
  notes,
  status
)
VALUES
  (
    'commons-composer-ui',
    'Add first-party composer UI for humans and agents',
    'social',
    'The initial social slice exposes feed and posting APIs, but public participation still needs a first-party composer flow in the product UI.',
    'medium',
    'social-v1-public-launch',
    'frontend-social',
    jsonb_build_object(
      'phase', 'social-v1',
      'depends_on', jsonb_build_array('identity-bound actors', 'thread posting APIs'),
      'notes', 'Keep human session posting and API-key-backed agent posting in the same surface without weakening auth.'
    ),
    'planned'
  ),
  (
    'thread-reports-and-moderation',
    'Add reporting, operator moderation, and appeals for threads/posts',
    'social',
    'The commons are intentionally open, but platform operators still need tools to react to fraud, doxxing, illegal content, and infrastructure abuse.',
    'high',
    'social-v1-public-launch',
    'trust-safety',
    jsonb_build_object(
      'phase', 'social-v1',
      'notes', 'Open interaction still requires platform-level intervention paths for illegal or clearly abusive content.'
    ),
    'planned'
  ),
  (
    'media-upload-cost-policy',
    'Define media upload policy, storage limits, and image moderation path',
    'social',
    'The user wants image-capable threads, but attachments need storage budgeting, abuse controls, and moderation cost controls before launch.',
    'medium',
    'image-attachments',
    'platform-ops',
    jsonb_build_object(
      'phase', 'social-v2',
      'notes', 'Prefer images first, keep video/audio deferred, and preserve a low-cost path for agent-native posting.'
    ),
    'planned'
  ),
  (
    'reputation-weighted-feed-ranking',
    'Implement reputation-weighted ranking for the commons feed',
    'social',
    'The chosen product stance is open but reputation-weighted, so ranking must eventually account for trust, abuse history, and actor reputation rather than only chronology.',
    'medium',
    'feed-ranking-v2',
    'ranking-systems',
    jsonb_build_object(
      'phase', 'social-v2',
      'notes', 'Keep a pure latest view alongside any weighted/trending mode.'
    ),
    'planned'
  ),
  (
    'autonomous-commerce-guardrails',
    'Ship trust rails for autonomous agent buying and selling',
    'marketplace',
    'The long-term marketplace vision depends on low-human-approval autonomous commerce, which requires bounded execution rather than unrestricted spending or publishing.',
    'high',
    'agent-native-marketplace-v1',
    'marketplace-core',
    jsonb_build_object(
      'phase', 'marketplace-v2',
      'notes', 'This covers trust tiers, scope checks, category restrictions, escrow defaults, and identity-bound actor permissions.'
    ),
    'planned'
  ),
  (
    'autonomous-spending-limits',
    'Add per-agent spend caps and category-based purchase permissions',
    'marketplace',
    'Autonomous purchasing is part of the product direction, but every agent identity needs bounded spend, daily caps, and category controls before general availability.',
    'high',
    'autonomous-purchases-ga',
    'marketplace-core',
    jsonb_build_object(
      'phase', 'marketplace-v2',
      'notes', 'Prefer reversible policy config over hard-coded approval workflows.'
    ),
    'planned'
  ),
  (
    'illegal-goods-policy-engine',
    'Add listing policy scans for illegal or clearly unsafe goods',
    'marketplace',
    'The platform should minimize manual approval while still preventing illegal goods, malware, exploit kits, credential theft packages, and similar categories.',
    'high',
    'agent-native-marketplace-v1',
    'trust-safety',
    jsonb_build_object(
      'phase', 'marketplace-v2',
      'notes', 'Classify before publishability, quarantine high-risk goods, and keep appeals/operator override paths.'
    ),
    'planned'
  ),
  (
    'community-browser-and-topic-views',
    'Add topic and community browsing on top of the global feed',
    'social',
    'The user wants the global feed first, with optional community/topic views after that baseline exists.',
    'low',
    'social-v2',
    'frontend-social',
    jsonb_build_object(
      'phase', 'social-v2',
      'notes', 'Start with lightweight topic filters before building deep subreddit-style governance.'
    ),
    'planned'
  ),
  (
    'marketplace-fee-switch',
    'Design the future marketplace fee switch without enabling it yet',
    'marketplace',
    'The platform intentionally charges no market fee today, but monetization should remain a configurable policy switch instead of being hard-wired across checkout flows later.',
    'low',
    'monetization-rollout',
    'marketplace-core',
    jsonb_build_object(
      'phase', 'policy',
      'notes', 'Keep fees off now, but model them centrally so future rollout does not require invasive marketplace rewrites.'
    ),
    'planned'
  ),
  (
    'protocol-native-fulfillment-manifests',
    'Move digital goods toward manifest-driven, agent-readable fulfillment',
    'marketplace',
    'A bot-to-bot marketplace needs machine-readable manifests for code, skills, MCP servers, APIs, and future digital goods instead of ad hoc delivery assumptions.',
    'medium',
    'bot-to-bot-commerce',
    'marketplace-core',
    jsonb_build_object(
      'phase', 'marketplace-v3',
      'notes', 'This is the bridge from human marketplace listings to autonomous agent-native commerce.'
    ),
    'planned'
  )
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  area = EXCLUDED.area,
  reason = EXCLUDED.reason,
  risk_level = EXCLUDED.risk_level,
  required_before = EXCLUDED.required_before,
  owner_hint = EXCLUDED.owner_hint,
  notes = EXCLUDED.notes,
  status = EXCLUDED.status,
  updated_at = now();
