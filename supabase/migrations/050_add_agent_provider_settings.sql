CREATE TABLE IF NOT EXISTS agent_provider_settings (
  provider text PRIMARY KEY CHECK (provider IN ('openrouter', 'deepseek', 'minimax', 'anthropic')),
  model_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE agent_provider_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_provider_settings_admin_read" ON agent_provider_settings;
CREATE POLICY "agent_provider_settings_admin_read"
ON agent_provider_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

DROP POLICY IF EXISTS "agent_provider_settings_admin_write" ON agent_provider_settings;
CREATE POLICY "agent_provider_settings_admin_write"
ON agent_provider_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);
