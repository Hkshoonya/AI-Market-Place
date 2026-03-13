-- Autonomous agent ledgers: structured issues plus deferred work tracking.

CREATE TABLE IF NOT EXISTS agent_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  source TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'escalated', 'ignored')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  detected_by TEXT NOT NULL,
  playbook TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_deferred_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  required_before TEXT,
  owner_hint TEXT,
  notes JSONB,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'planned', 'done', 'dropped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_issues_status_severity
  ON agent_issues (status, severity, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_issues_detected_by
  ON agent_issues (detected_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_deferred_items_status_area
  ON agent_deferred_items (status, area, updated_at DESC);

ALTER TABLE agent_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_deferred_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view agent issues" ON agent_issues;
CREATE POLICY "Admins can view agent issues"
  ON agent_issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can view deferred agent items" ON agent_deferred_items;
CREATE POLICY "Admins can view deferred agent items"
  ON agent_deferred_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role manages agent issues" ON agent_issues;
CREATE POLICY "Service role manages agent issues"
  ON agent_issues FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages deferred agent items" ON agent_deferred_items;
CREATE POLICY "Service role manages deferred agent items"
  ON agent_deferred_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS agent_issues_updated_at ON agent_issues;
CREATE TRIGGER agent_issues_updated_at
  BEFORE UPDATE ON agent_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agent_deferred_items_updated_at ON agent_deferred_items;
CREATE TRIGGER agent_deferred_items_updated_at
  BEFORE UPDATE ON agent_deferred_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO agent_deferred_items (slug, title, area, reason, risk_level, required_before, owner_hint, notes)
VALUES
  (
    'provider-routing-expansion',
    'Expand provider routing across every LLM-backed agent path',
    'agents',
    'Only the first autonomy slice is being migrated now; remaining LLM-backed paths must converge on the shared router.',
    'medium',
    'autonomous-maintenance-phase-2',
    'engineering',
    jsonb_build_object('phase', 'follow-up', 'category', 'provider-resilience')
  ),
  (
    'verifier-agent-rollout',
    'Introduce explicit verifier agent and remediation confirmation loop',
    'agents',
    'Safe self-healing requires verification and escalation before broader automation is enabled.',
    'high',
    'autonomous-remediation-enforcement',
    'engineering',
    jsonb_build_object('phase', 'follow-up', 'category', 'self-healing')
  ),
  (
    'admin-agent-ledger-dashboard',
    'Expose agent issues and deferred work in the admin UI',
    'admin',
    'Structured ledgers should be operator-visible so deferred and escalated work cannot disappear into logs.',
    'medium',
    'feature-freeze-before-next-shipping',
    'engineering',
    jsonb_build_object('phase', 'follow-up', 'category', 'observability')
  ),
  (
    'auto-pr-policy',
    'Decide whether agents may create PRs automatically',
    'agents',
    'Autonomous code changes need explicit policy and review boundaries before being enabled.',
    'medium',
    'autonomous-code-change-phase',
    'product',
    jsonb_build_object('phase', 'policy', 'category', 'governance')
  ),
  (
    'marketplace-fee-policy',
    'Decide when and how to introduce marketplace fees',
    'marketplace',
    'The marketplace is currently zero-fee; fee introduction should happen only after trust, liquidity, and autonomous commerce rules are mature.',
    'medium',
    'marketplace-monetization',
    'product',
    jsonb_build_object('phase', 'policy', 'category', 'economics')
  ),
  (
    'agent-native-commerce-brainstorm',
    'Re-brainstorm agent-native buyer and seller workflows before implementation',
    'marketplace',
    'The marketplace vision for bots and agents selling code, skills, agents, and MCP servers changes trust, fulfillment, and settlement assumptions and must be designed separately.',
    'high',
    'agent-native-marketplace-phase',
    'product',
    jsonb_build_object('phase', 'brainstorm-required', 'category', 'marketplace')
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
  updated_at = now();
