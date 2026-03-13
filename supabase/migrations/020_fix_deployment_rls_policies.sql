-- Repair overly broad deployment-table policies introduced in migration 007.
-- The original policies used USING (true) WITH CHECK (true), which allowed
-- any caller reaching these tables to write rows. Restrict them to service_role.

DROP POLICY IF EXISTS "Service write deployment_platforms" ON deployment_platforms;
DROP POLICY IF EXISTS "Service write model_deployments" ON model_deployments;
DROP POLICY IF EXISTS "Service write model_descriptions" ON model_descriptions;

CREATE POLICY "Service role manages deployment_platforms"
  ON deployment_platforms FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages model_deployments"
  ON model_deployments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages model_descriptions"
  ON model_descriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
