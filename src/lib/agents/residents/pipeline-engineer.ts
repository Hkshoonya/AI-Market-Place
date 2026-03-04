/**
 * Pipeline Engineer — Resident Agent
 *
 * Monitors data pipeline health, detects failures,
 * and attempts self-repair of broken data source adapters.
 *
 * Schedule: Every 6 hours (after T1 sync)
 * Capabilities: health_check, sync_repair, error_analysis, adapter_monitoring
 */

import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";
import { loadAllAdapters, getAdapter, listAdapters } from "../../data-sources/registry";
import { runSingleSync } from "../../data-sources/orchestrator";
import { resolveSecrets } from "../../data-sources/utils";
import type { DataSourceRecord } from "../../data-sources/types";

const pipelineEngineer: ResidentAgent = {
  slug: "pipeline-engineer",
  name: "Pipeline Engineer",

  async run(ctx: AgentContext): Promise<AgentTaskResult> {
    const { supabase, log } = ctx;
    const sb = supabase;
    const errors: string[] = [];
    const output: Record<string, unknown> = {
      healthChecks: [],
      failedSources: [],
      repairAttempts: [],
      summary: {},
    };

    try {
      // Step 1: Load all adapters
      await loadAllAdapters();
      const adapterIds = listAdapters();
      await log.info(`Loaded ${adapterIds.length} adapters`);

      // Step 2: Fetch all enabled data sources
      const { data: sources, error: srcErr } = await sb
        .from("data_sources")
        .select("*")
        .eq("is_enabled", true)
        .order("tier", { ascending: true });

      if (srcErr) {
        errors.push(`Failed to fetch data sources: ${srcErr.message}`);
        return { success: false, output, errors };
      }

      const dataSources = (sources ?? []) as DataSourceRecord[];
      await log.info(`Found ${dataSources.length} enabled data sources`);

      // Step 3: Health check all adapters
      const healthChecks: Record<string, unknown>[] = [];
      for (const source of dataSources) {
        const adapter = getAdapter(source.adapter_type);
        if (!adapter) {
          healthChecks.push({
            source: source.slug,
            healthy: false,
            message: `No adapter for type "${source.adapter_type}"`,
          });
          continue;
        }

        try {
          const secrets = resolveSecrets(source.secret_env_keys);
          const result = await adapter.healthCheck(secrets);
          healthChecks.push({
            source: source.slug,
            healthy: result.healthy,
            latencyMs: result.latencyMs,
            message: result.message,
          });

          if (!result.healthy) {
            await log.warn(`Health check failed for ${source.slug}: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          healthChecks.push({
            source: source.slug,
            healthy: false,
            message: `Health check error: ${msg}`,
          });
          await log.error(`Health check error for ${source.slug}: ${msg}`);
        }
      }
      output.healthChecks = healthChecks;

      // Step 4: Find recently failed sync jobs (last 24 hours)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: failedJobs } = await sb
        .from("sync_jobs")
        .select("*")
        .eq("status", "failed")
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      const failedSources = new Set<string>();
      for (const job of failedJobs ?? []) {
        failedSources.add(job.source);
      }
      output.failedSources = Array.from(failedSources);

      if (failedSources.size > 0) {
        await log.warn(
          `Found ${failedSources.size} failed sources in last 24h: ${Array.from(failedSources).join(", ")}`
        );
      } else {
        await log.info("No failed sync jobs in last 24 hours");
      }

      // Step 5: Attempt repair of failed sources
      const maxRepairs = (ctx.agent.config.max_repair_attempts as number) ?? 3;
      const repairAttempts: Record<string, unknown>[] = [];
      let repaired = 0;

      for (const slug of Array.from(failedSources).slice(0, maxRepairs)) {
        await log.info(`Attempting repair sync for: ${slug}`);
        try {
          const result = await runSingleSync(slug);
          const success = result.sourcesFailed === 0;
          repairAttempts.push({
            source: slug,
            success,
            recordsProcessed: result.details[0]?.recordsProcessed ?? 0,
            errors: result.details[0]?.errors?.map((e) => e.message) ?? [],
          });

          if (success) {
            repaired++;
            await log.info(`Successfully repaired: ${slug}`);
          } else {
            await log.warn(`Repair failed for: ${slug}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          repairAttempts.push({ source: slug, success: false, error: msg });
          await log.error(`Repair error for ${slug}: ${msg}`);
          errors.push(`Repair failed for ${slug}: ${msg}`);
        }
      }
      output.repairAttempts = repairAttempts;

      // Step 6: Summary
      const healthyCount = healthChecks.filter((h) => h.healthy).length;
      output.summary = {
        totalSources: dataSources.length,
        healthyAdapters: healthyCount,
        unhealthyAdapters: dataSources.length - healthyCount,
        failedInLast24h: failedSources.size,
        repairAttempts: repairAttempts.length,
        repairsSucceeded: repaired,
      };

      await log.info("Pipeline Engineer run complete", output.summary as Record<string, unknown>);

      return {
        success: errors.length === 0,
        output,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      await log.error(`Pipeline Engineer crashed: ${msg}`);
      return { success: false, output, errors };
    }
  },
};

registerAgent(pipelineEngineer);
export default pipelineEngineer;
