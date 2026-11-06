export const PROJECT = "13829021-1e3a-4e71-a40d-6e1509b43aff";
export const ENVIRONMENT = "40813aca-6a08-4e6f-acdb-7e8369adc3e5";
export const SERVICE = "f551861b-6b40-41d6-a152-8b57c9da8096";
export const SITE = "https://aimarketcap.tech";
const DEPLOYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Health = "unknown" | "up" | "degraded" | "down" | "paused";
export type Notice = "activated" | "outage" | "recovered";
export interface State {
  health: Health; checkedAt: number; lastTick: number; lease: string; leaseUntil: number;
  failures: number; incidentAt: number; outageSent: boolean; recoveryPending: boolean;
  activationSent: boolean; activationAttempts: number; recoveryAttempts: number;
  alertAttempts: number; day: string; attempts: number;
  lastAttemptAt: number; outcome: string;
  controlPlaneCheckedAt?: number;
}
export interface Store {
  load(): State;
  save(state: State, expectedLease?: string): boolean;
}
export interface Ports {
  now(): number;
  lease(): string;
  probe(): Promise<Health>;
  deployment(): Promise<{ projectId: string; environmentId: string; id: string; status: string }>;
  restart(id: string): Promise<boolean>;
  notify(kind: Notice, eventAt: number): Promise<boolean>;
}

function matchesScope(deployment: Awaited<ReturnType<Ports["deployment"]>>) {
  return deployment.projectId === PROJECT && deployment.environmentId === ENVIRONMENT && DEPLOYMENT_ID.test(deployment.id);
}
export function initialState(): State {
  return { health: "unknown", checkedAt: 0, lastTick: 0, lease: "", leaseUntil: 0,
    failures: 0, incidentAt: 0, outageSent: false, recoveryPending: false,
    activationSent: false, activationAttempts: 0, recoveryAttempts: 0,
    alertAttempts: 0, day: "", attempts: 0, lastAttemptAt: 0, outcome: "not_checked" };
}

export async function check(store: Store, ports: Ports, scheduledAt: number,
  config: { enabled: boolean; autoRecovery: boolean }): Promise<State> {
  const state = store.load();
  const now = ports.now();
  // Synchronous storage operations reserve a lease before any external await.
  if (state.leaseUntil > now || scheduledAt <= state.lastTick || scheduledAt > now + 60_000 || scheduledAt < now - 600_000) return state;
  state.lease = ports.lease(); state.leaseUntil = now + 120_000; state.lastTick = scheduledAt;
  if (!store.save(state)) throw new Error("Monitor lease could not be persisted");
  const lease = state.lease;
  const persist = () => {
    if (!store.save(state, lease)) throw new Error("Monitor lease was superseded");
  };
  try {
    if (!config.enabled) { state.health = "paused"; state.outcome = "monitor_paused"; return state; }
    let health: Health;
    try { health = await ports.probe(); } catch { health = "down"; }
    const previous = state.health;
    state.health = health; state.checkedAt = ports.now();
    if (health === "up") {
      state.failures = 0; state.outcome = "healthy";
      if (config.autoRecovery && (!state.controlPlaneCheckedAt || now - state.controlPlaneCheckedAt >= 21_600_000)) {
        state.controlPlaneCheckedAt = 0;
        if (!matchesScope(await ports.deployment())) { state.outcome = "scope_mismatch"; return state; }
        state.controlPlaneCheckedAt = ports.now();
      }
      if (state.outageSent && previous !== "up") { state.recoveryPending = true; state.recoveryAttempts = 0; }
      if (state.recoveryPending && state.recoveryAttempts < 3) {
        state.recoveryAttempts++; persist();
        if (await ports.notify("recovered", state.incidentAt)) {
          state.recoveryPending = false; state.outageSent = false;
        }
      }
      if (!state.activationSent && state.activationAttempts < 3) {
        state.activationAttempts++; persist();
        state.activationSent = await ports.notify("activated", 1);
      }
      return state;
    }
    if (previous === "up" || previous === "unknown" || previous === "paused") {
      state.incidentAt = now; state.outageSent = false; state.recoveryPending = false; state.alertAttempts = 0;
    }
    state.failures++;
    state.outcome = "awaiting_second_failure";
    if (state.failures < 2) return state;
    if (!state.outageSent && state.alertAttempts < 3) {
      state.alertAttempts++; persist();
      state.outageSent = await ports.notify("outage", state.incidentAt);
    }
    if (!config.autoRecovery) { state.outcome = "automatic_recovery_paused"; return state; }
    const day = new Date(now).toISOString().slice(0, 10);
    if (state.day !== day) { state.day = day; state.attempts = 0; }
    if (state.attempts >= 3 || (state.lastAttemptAt && now - state.lastAttemptAt < 1_800_000)) {
      state.outcome = "recovery_budget_exhausted"; return state;
    }
    const deployment = await ports.deployment();
    if (!matchesScope(deployment)) {
      state.outcome = "scope_mismatch"; return state;
    }
    // Never restart a healthy/deploying service or a different provider/database.
    if (deployment.status !== "CRASHED") { state.outcome = "service_not_crashed"; return state; }
    state.attempts++; state.lastAttemptAt = now; state.outcome = "restart_reserved";
    persist(); // Ambiguous control-plane responses still consume the restart budget.
    state.outcome = await ports.restart(deployment.id) ? "restart_requested" : "restart_rejected";
    return state;
  } catch {
    state.outcome = "control_plane_or_notification_unavailable";
    return state;
  } finally {
    state.leaseUntil = 0;
    persist();
  }
}

export async function boundedJson(response: Response, maxBytes = 32_768): Promise<unknown> {
  if (!response.ok) { await response.body?.cancel(); throw new Error("Upstream rejected request"); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing upstream body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > maxBytes) throw new Error("Upstream body exceeds limit");
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { await reader.cancel(); }
}

function transportFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const reason = /illegal invocation|incorrect this/i.test(message) ? "fetch_receiver"
    : /redirect/i.test(message) ? "redirect_option"
    : /abort|signal|timeout/i.test(message) ? "abort_signal"
    : /cache/i.test(message) ? "cache_option"
    : /different request|I\/O/i.test(message) ? "request_context"
    : /header/i.test(message) ? "header_validation"
    : /not a function/i.test(message) ? "missing_runtime_function"
    : /fetch failed/i.test(message) ? "fetch_failed"
    : "unclassified_transport";
  return { errorType: error instanceof Error ? error.name : "unknown", reason };
}

export function livePorts(env: Pick<Env, "RAILWAY_TOKEN" | "RESEND_API_KEY">,
  request: typeof fetch = (input, init) => globalThis.fetch(input, init)): Ports {
  async function railway(query: string): Promise<Record<string, unknown>> {
    const response = await request("https://backboard.railway.com/graphql/v2", {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
      headers: { "Project-Access-Token": env.RAILWAY_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body = await boundedJson(response) as { data?: Record<string, unknown>; errors?: unknown };
    console.log(JSON.stringify({ event: "control_plane_response", status: response.status, hasErrors: Boolean(body.errors) }));
    if (!body.data || body.errors) throw new Error("Control plane unavailable");
    return body.data;
  }
  return {
    now: () => Date.now(), lease: () => crypto.randomUUID(),
    async probe() {
      let apiStatus = 0;
      try {
        const response = await request(`${SITE}/api/health`, { redirect: "manual", cache: "no-store",
          headers: { "Cache-Control": "no-cache", "User-Agent": "aimc-uptime-monitor/1.0" }, signal: AbortSignal.timeout(15_000) });
        apiStatus = response.status;
        const body = await boundedJson(response, 8192) as { status?: string };
        if (body.status === "healthy" || body.status === "degraded") return "up";
      } catch (error) {
        console.log(JSON.stringify({ event: "api_probe_failed", status: apiStatus, ...transportFailure(error) }));
      }
      try {
        const response = await request(SITE, { method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000) });
        console.log(JSON.stringify({ event: "fallback_probe", status: response.status }));
        await response.body?.cancel();
        return response.ok ? "degraded" : "down";
      } catch (error) {
        console.log(JSON.stringify({ event: "fallback_probe_failed", ...transportFailure(error) }));
        return "down";
      }
    },
    async deployment() {
      const body = await railway(`query { projectToken { projectId environmentId } serviceInstance(environmentId:"${ENVIRONMENT}", serviceId:"${SERVICE}") { latestDeployment { id status } } }`);
      const scope = body.projectToken as { projectId: string; environmentId: string };
      const instance = body.serviceInstance as { latestDeployment: { id: string; status: string } };
      if (!scope || !instance?.latestDeployment) throw new Error("Missing control-plane deployment");
      return { ...scope, ...instance.latestDeployment };
    },
    async restart(id) {
      if (!DEPLOYMENT_ID.test(id)) throw new Error("Invalid deployment identifier");
      return (await railway(`mutation { deploymentRestart(id:"${id}") }`)).deploymentRestart === true;
    },
    async notify(kind, eventAt) {
      if (!env.RESEND_API_KEY) return false;
      const subject = { activated: "AI Market Cap uptime monitor is active", outage: "AI Market Cap health check alert", recovered: "AI Market Cap health checks recovered" }[kind];
      const message = { activated: "Independent checks are running every minute. Recovery is limited to this site's crashed Railway web service, with a cooldown and daily cap.",
        outage: "Two consecutive checks failed to establish API readiness. The recovery controller will only request a restart if Railway confirms this specific web service is crashed. Review the monitor and provider logs.",
        recovered: "The website health endpoint is responding successfully again. This does not certify all login, payment or data-update workflows." }[kind];
      try {
        const response = await request("https://api.resend.com/emails", { method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `aimc-uptime/${kind}/${eventAt}` },
          body: JSON.stringify({ from: "AI Market Cap <support@aimarketcap.tech>", to: ["harshit@wemakesense.co"], subject,
            text: `${subject}\n\n${message}\n\nhttps://aimarketcap.tech\nTransactional infrastructure notification.`,
            html: `<div style="font-family:sans-serif;max-width:600px"><img src="${SITE}/apple-icon" width="40" height="40" alt="AI Market Cap"><h1>${subject}</h1><p>${message}</p><p><a href="${SITE}">AI Market Cap</a></p><small>Transactional infrastructure notification.</small></div>` }),
        });
        const body = await boundedJson(response, 8192) as { id?: unknown };
        const accepted = typeof body.id === "string" && body.id.length > 0;
        console.log(JSON.stringify({ event: "notification_result", kind, accepted }));
        return accepted;
      } catch { return false; }
    },
  };
}
