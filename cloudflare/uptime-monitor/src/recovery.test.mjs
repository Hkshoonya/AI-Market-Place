import test from "node:test";
import assert from "node:assert/strict";
import { boundedJson, check, initialState, livePorts, PROJECT, ENVIRONMENT } from "./recovery.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const BASE = Date.parse("2026-11-06T12:00:00Z");
function fixture(overrides = {}) {
  let state = initialState(); let now = BASE; let lease = 0;
  const calls = { probe: 0, deployment: 0, restart: 0, notices: [] };
  const store = { load: () => structuredClone(state), save(next, expected) {
    if (expected && expected !== state.lease) return false;
    state = structuredClone(next); return true;
  } };
  const ports = { now: () => now, lease: () => `lease-${++lease}`,
    probe: async () => { calls.probe++; return "down"; },
    deployment: async () => { calls.deployment++; return { id: ID, projectId: PROJECT, environmentId: ENVIRONMENT, status: "CRASHED" }; },
    restart: async () => { calls.restart++; return true; },
    notify: async (kind, at) => { calls.notices.push({ kind, at }); return true; }, ...overrides };
  return { store, calls, ports, tick: async (minutes = 1, config = { enabled: true, autoRecovery: true }) => {
    now += minutes * 60_000; return check(store, ports, now, config);
  }, current: () => state, set: (patch) => { Object.assign(state, patch); } };
}

test("two consecutive failures are required and restart attempts have a cooldown", async () => {
  const f = fixture();
  assert.equal((await f.tick()).outcome, "awaiting_second_failure");
  assert.equal(f.calls.restart, 0);
  assert.equal((await f.tick()).outcome, "restart_requested");
  assert.equal(f.calls.restart, 1);
  await f.tick();
  assert.equal(f.calls.restart, 1);
  assert.equal(f.calls.notices.filter(x => x.kind === "outage").length, 1);
});

test("healthy services are never restarted and activation mail is sent once", async () => {
  const f = fixture({ probe: async () => "up" });
  await f.tick(); await f.tick();
  assert.equal(f.calls.deployment, 1); assert.equal(f.calls.restart, 0);
  assert.deepEqual(f.calls.notices.map(x => x.kind), ["activated"]);
});

test("degraded database/API responses do not restart a running or deploying app", async () => {
  for (const status of ["SUCCESS", "DEPLOYING", "BUILDING", "FAILED", "REMOVED"]) {
    const f = fixture({ probe: async () => "degraded", deployment: async () => ({ id: ID, projectId: PROJECT, environmentId: ENVIRONMENT, status }) });
    await f.tick(); assert.equal((await f.tick()).outcome, "service_not_crashed");
    assert.equal(f.calls.restart, 0);
  }
});

test("scope mismatch and invalid identifiers cannot restart any service", async () => {
  for (const bad of [{ projectId: "another-project" }, { environmentId: "another-environment" }, { id: "injected-query" }]) {
    const f = fixture({ deployment: async () => ({ id: ID, projectId: PROJECT, environmentId: ENVIRONMENT, status: "CRASHED", ...bad }) });
    await f.tick(); assert.equal((await f.tick()).outcome, "scope_mismatch");
    assert.equal(f.calls.restart, 0);
  }
});

test("attempts are capped at three daily, including ambiguous/rejected requests", async () => {
  const f = fixture({ restart: async () => { throw new Error("Ambiguous private control-plane error"); } });
  await f.tick(); await f.tick(); await f.tick(31); await f.tick(31); await f.tick(31);
  assert.equal(f.current().attempts, 3);
  assert.equal(f.current().outcome, "recovery_budget_exhausted");
  await f.tick(24 * 60);
  assert.equal(f.current().attempts, 1);
});

test("duplicate cron events and concurrent checks cannot acquire a second lease", async () => {
  const f = fixture(); let release;
  f.ports.probe = () => new Promise(resolve => { release = resolve; });
  const first = check(f.store, f.ports, BASE, { enabled: true, autoRecovery: true });
  const second = await check(f.store, f.ports, BASE, { enabled: true, autoRecovery: true });
  assert.equal(second.leaseUntil, BASE + 120_000);
  assert.equal(f.current().lastTick, BASE);
  release("up"); await first;
  await check(f.store, f.ports, BASE, { enabled: true, autoRecovery: true });
  assert.equal(f.calls.deployment, 1);
});

test("maintenance switches stop all monitoring or only automatic recovery", async () => {
  const f = fixture(); await f.tick(1, { enabled: false, autoRecovery: true });
  assert.equal(f.calls.probe, 0);
  await f.tick(1, { enabled: true, autoRecovery: false });
  assert.equal((await f.tick(1, { enabled: true, autoRecovery: false })).outcome, "automatic_recovery_paused");
  assert.equal(f.calls.deployment, 0); assert.equal(f.calls.restart, 0);
});

test("outage and recovery notifications are bounded and deduplicated", async () => {
  const f = fixture(); await f.tick(); await f.tick();
  f.ports.probe = async () => "up";
  await f.tick(); await f.tick();
  assert.equal(f.calls.notices.filter(x => x.kind === "outage").length, 1);
  assert.equal(f.calls.notices.filter(x => x.kind === "recovered").length, 1);
  const failed = fixture({ probe: async () => "up", notify: async () => false });
  for (let i = 0; i < 10; i++) await failed.tick();
  assert.equal(failed.current().activationAttempts, 3);
});

test("stale and future cron events are ignored", async () => {
  const f = fixture();
  await check(f.store, f.ports, BASE - 700_000, { enabled: true, autoRecovery: true });
  await check(f.store, f.ports, BASE + 120_000, { enabled: true, autoRecovery: true });
  assert.equal(f.calls.probe, 0);
});

test("provider bodies are bounded and failure details are not exposed", async () => {
  await assert.rejects(boundedJson(new Response("x".repeat(100)), 8), /exceeds limit/);
  await assert.rejects(boundedJson(new Response("private error body", { status: 403 })), /Upstream rejected request/);
});

test("live ports use fixed URLs, no redirects, and stable mail idempotency", async () => {
  const calls = [];
  const ports = livePorts({ RAILWAY_TOKEN: "fixture", RESEND_API_KEY: "fixture" }, async (url, options) => {
    calls.push({ url: String(url), ...options });
    if (String(url).includes("resend")) return Response.json({ id: "fixture" });
    return Response.json({ status: "healthy" });
  });
  assert.equal(await ports.probe(), "up");
  assert.equal(await ports.notify("outage", BASE), true);
  assert.equal(await ports.notify("outage", BASE), true);
  assert.equal(calls[0].url, "https://aimarketcap.tech/api/health");
  assert.equal(calls[1].headers["Idempotency-Key"], calls[2].headers["Idempotency-Key"]);
  assert.ok(calls.every(c => c.redirect === "manual"));
  await assert.rejects(ports.restart("injected"), /Invalid deployment identifier/);
});

test("edge-compatible manual redirects never establish readiness or forward credentials", async () => {
  const calls = [];
  const ports = livePorts({ RAILWAY_TOKEN: "fixture", RESEND_API_KEY: "fixture" }, async (url, options) => {
    assert.equal(options.redirect, "manual");
    calls.push(String(url));
    return new Response(null, { status: 302, headers: { Location: "https://untrusted.example.invalid" } });
  });
  assert.equal(await ports.probe(), "down");
  assert.equal(await ports.notify("outage", BASE), false);
  await assert.rejects(ports.deployment(), /Upstream rejected request/);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(url => !url.includes("untrusted")));
});

test("the default transport preserves the runtime global fetch receiver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    assert.equal(this, globalThis);
    return Response.json({ status: "healthy" });
  };
  try {
    assert.equal(await livePorts({ RAILWAY_TOKEN: "fixture", RESEND_API_KEY: "fixture" }).probe(), "up");
  } finally {
    globalThis.fetch = original;
  }
});

test("healthy probes periodically verify recovery scope without requesting restarts", async () => {
  const f = fixture({ probe: async () => "up" });
  await f.tick(); await f.tick();
  assert.equal(f.calls.deployment, 1);
  await f.tick(6 * 60);
  assert.equal(f.calls.deployment, 2);
  assert.equal(f.calls.restart, 0);
  const bad = fixture({ probe: async () => "up", deployment: async () => ({ id: ID, projectId: "another-project", environmentId: ENVIRONMENT, status: "SUCCESS" }) });
  const state = await bad.tick();
  assert.equal(state.health, "up");
  assert.equal(state.outcome, "scope_mismatch");
  assert.equal(state.controlPlaneCheckedAt, 0);
  assert.equal(bad.calls.restart, 0);
});
