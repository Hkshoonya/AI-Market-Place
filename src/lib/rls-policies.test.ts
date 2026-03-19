import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readMigration(filename: string) {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", filename),
    "utf8"
  );
}

describe("RLS policy regressions", () => {
  it("does not allow broad write access on deployment tables", () => {
    const phase6Migration = readMigration("007_phase6_market_cap_agent_deploy.sql");
    const repairMigration = readMigration("020_fix_deployment_rls_policies.sql");

    expect(phase6Migration).toContain(
      'CREATE POLICY "Service write deployment_platforms" ON deployment_platforms FOR ALL USING (true) WITH CHECK (true);'
    );
    expect(repairMigration).toContain(
      'CREATE POLICY "Service role manages deployment_platforms"'
    );
    expect(repairMigration).toContain(
      "USING (auth.role() = 'service_role')"
    );
    expect(repairMigration).toContain(
      "WITH CHECK (auth.role() = 'service_role')"
    );
    expect(repairMigration).not.toMatch(
      /CREATE POLICY "Service role manages deployment_platforms"[\s\S]*USING \(true\)[\s\S]*WITH CHECK \(true\)/m
    );
  });

  it("restricts all repaired deployment-table write policies to service_role", () => {
    const repairMigration = readMigration("020_fix_deployment_rls_policies.sql");

    for (const tableName of [
      "deployment_platforms",
      "model_deployments",
      "model_descriptions",
    ]) {
      expect(repairMigration).toContain(
        `CREATE POLICY "Service role manages ${tableName}"`
      );
    }

    const serviceRoleGuards = repairMigration.match(
      /USING \(auth\.role\(\) = 'service_role'\)|WITH CHECK \(auth\.role\(\) = 'service_role'\)/g
    );

    expect(serviceRoleGuards).toHaveLength(6);
  });
});
