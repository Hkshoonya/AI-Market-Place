import assert from "node:assert/strict";
import { test } from "node:test";
import { setupStripeTestCatalog } from "./setup-stripe-test-catalog.mjs";

const key = "sk_test_fixture";
const accountId = "acct_fixture";

function fixture() {
  const calls = [];
  const state = { products: [], prices: [], "billing_portal/configurations": [] };
  let writes = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, ...options });
    assert.equal(new URL(url).origin, "https://api.stripe.com");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    const path = new URL(url).pathname.replace("/v1/", "");
    let value;
    if (options.method === "GET") {
      value = path === "account" ? { id: accountId, settings: { dashboard: { display_name: "fixture" } } } : { data: state[path], has_more: false };
    } else {
      writes += 1;
      const body = Object.fromEntries(options.body);
      const common = { livemode: false, active: true, metadata: { app: body["metadata[app]"], plan_slug: body["metadata[plan_slug]"], purpose: body["metadata[purpose]"] } };
      if (path === "products") value = { ...common, id: body.id };
      else if (path === "prices") value = { ...common, id: `price_${writes}`, product: body.product, unit_amount: Number(body.unit_amount), currency: body.currency, recurring: { interval: body["recurring[interval]"], interval_count: 1 }, lookup_key: body.lookup_key };
      else if (path === "billing_portal/configurations") value = { ...common, id: "bpc_fixture", login_page: { enabled: false }, features: { subscription_cancel: { enabled: true, mode: "at_period_end" }, payment_method_update: { enabled: true }, invoice_history: { enabled: true } } };
      else if (path === "checkout/sessions") value = { ...common, id: `cs_test_${writes}`, mode: "subscription", amount_total: state.prices.find(p => p.id === body["line_items[0][price]"]).unit_amount, currency: "usd" };
      else if (path.endsWith("/expire")) value = { status: "expired", livemode: false, payment_status: "unpaid" };
      else throw new Error(`Unexpected write ${path}`);
      if (state[path]) state[path].push(value);
    }
    return { ok: true, status: 200, json: async () => value };
  };
  return { calls, state, fetchImpl, writes: () => writes };
}

test("live and publishable keys are refused before any network access", async () => {
  const f = fixture();
  for (const invalidKey of ["sk_live_fixture", "rk_live_fixture", "pk_test_fixture", "", undefined]) {
    await assert.rejects(setupStripeTestCatalog({ key: invalidKey, accountId, fetchImpl: f.fetchImpl, apply: true }), /test-mode/);
  }
  assert.equal(f.calls.length, 0);
});

test("wrong merchant is refused before any write", async () => {
  const f = fixture();
  await assert.rejects(setupStripeTestCatalog({ key, accountId: "acct_other", fetchImpl: f.fetchImpl, apply: true }), /does not match/);
  assert.equal(f.writes(), 0);
});

test("default invocation is a read-only plan", async () => {
  const f = fixture();
  const result = await setupStripeTestCatalog({ key, accountId, fetchImpl: f.fetchImpl });
  assert.equal(f.writes(), 0);
  assert.deepEqual(result.plans.map(p => p.monthlyAmountCents), [4900, 19900]);
  assert.equal(result.livePaymentsEnabled, false);
});

test("setup creates only namespaced test products, prices and a portal; repeat is idempotent", async () => {
  const f = fixture();
  await setupStripeTestCatalog({ key, accountId, fetchImpl: f.fetchImpl, apply: true });
  assert.equal(f.writes(), 5);
  await setupStripeTestCatalog({ key, accountId, fetchImpl: f.fetchImpl, apply: true });
  assert.equal(f.writes(), 5);
  assert.ok(f.calls.filter(c => c.method === "POST").every(c => c.headers["Idempotency-Key"]));
  assert.equal(f.calls.some(c => c.method === "POST" && /\/account|\/webhook|\/subscriptions|\/customers/.test(c.url)), false);
});

test("smoke sessions expire without collecting a payment or granting access", async () => {
  const f = fixture();
  const result = await setupStripeTestCatalog({ key, accountId, fetchImpl: f.fetchImpl, apply: true, smoke: true });
  assert.equal(result.smoke.length, 2);
  assert.ok(result.smoke.every(s => s.status === "expired" && s.paymentStatus === "unpaid"));
  assert.equal(f.calls.filter(c => c.url.endsWith("/expire")).length, 2);
});

test("an unrelated product colliding with the reserved ID is not changed", async () => {
  const f = fixture();
  f.state.products.push({ id: "aimc_data_pro_v1", active: true, livemode: false, metadata: { app: "another-product" } });
  await assert.rejects(setupStripeTestCatalog({ key, accountId, fetchImpl: f.fetchImpl, apply: true }), /unowned/);
  assert.equal(f.writes(), 0);
});

test("existing draft prices are never silently changed", async () => {
  const f = fixture();
  await setupStripeTestCatalog({ key, accountId, fetchImpl: f.fetchImpl, apply: true });
  f.state.prices[0].unit_amount = 1;
  await assert.rejects(setupStripeTestCatalog({ key, accountId, fetchImpl: f.fetchImpl, apply: true }), /differs from the draft/);
  assert.equal(f.writes(), 5);
});
