import { DurableObject } from "cloudflare:workers";
import { check, initialState, livePorts, type State, type Store } from "./recovery";

export class WebsiteMonitor extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS monitor (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL)");
      this.ctx.storage.sql.exec("INSERT OR IGNORE INTO monitor VALUES (1, ?)", JSON.stringify(initialState()));
      // Verify each deployed revision without exposing a public restart endpoint.
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS bootstrap (revision TEXT PRIMARY KEY)");
      const seen = this.ctx.storage.sql.exec("SELECT revision FROM bootstrap WHERE revision=?", this.env.VERSION.id).toArray();
      if (!seen.length) {
        await this.ctx.storage.setAlarm(Date.now() + 1000);
        this.ctx.storage.sql.exec("INSERT OR IGNORE INTO bootstrap VALUES (?)", this.env.VERSION.id);
      }
    });
  }

  private store(): Store {
    return {
      load: () => JSON.parse(this.ctx.storage.sql.exec<{ state: string }>("SELECT state FROM monitor WHERE id=1").one().state) as State,
      save: (state, lease) => {
        const result = lease
          ? this.ctx.storage.sql.exec("UPDATE monitor SET state=? WHERE id=1 AND json_extract(state, '$.lease')=?", JSON.stringify(state), lease)
          : this.ctx.storage.sql.exec("UPDATE monitor SET state=? WHERE id=1", JSON.stringify(state));
        return result.rowsWritten === 1;
      },
    };
  }

  async check(scheduledAt: number) {
    const state = await check(this.store(), livePorts(this.env), scheduledAt, {
      enabled: this.env.MONITOR_ENABLED === "true", autoRecovery: this.env.AUTO_RECOVERY_ENABLED === "true",
    });
    console.log(JSON.stringify({ event: "uptime_check", health: state.health, failures: state.failures, outcome: state.outcome, attemptsToday: state.attempts }));
  }

  async alarm() {
    await this.check(Date.now());
  }

  status() {
    const state = this.store().load();
    return { service: "aimarketcap-uptime-monitor", version: this.env.VERSION.id, health: state.health, checkedAt: state.checkedAt,
      consecutiveFailures: state.failures, outcome: state.outcome,
      recoveryControlPlaneCheckedAt: state.controlPlaneCheckedAt ?? null,
      restartAttemptsToday: state.day === new Date().toISOString().slice(0, 10) ? state.attempts : 0 };
  }
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(env.MONITOR.getByName("aimarketcap.tech").check(controller.scheduledTime));
  },
  async fetch(request, env) {
    if (request.method !== "GET" || new URL(request.url).pathname !== "/") return new Response("Not found", { status: 404 });
    return Response.json(await env.MONITOR.getByName("aimarketcap.tech").status(), {
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });
  },
} satisfies ExportedHandler<Env>;
