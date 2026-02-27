import type { DataSourceAdapter, SyncContext, SyncResult, HealthCheckResult } from "../types";
import { registerAdapter } from "../registry";

const adapter: DataSourceAdapter = {
  id: "arxiv",
  name: "arXiv Papers",
  outputTypes: ["news"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(_ctx: SyncContext): Promise<SyncResult> {
    // TODO: implement in Phase 37/38/39/40
    return {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [],
      metadata: { stub: true },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    return { healthy: true, latencyMs: 0, message: "Stub adapter — not yet implemented" };
  },
};

registerAdapter(adapter);
export default adapter;
