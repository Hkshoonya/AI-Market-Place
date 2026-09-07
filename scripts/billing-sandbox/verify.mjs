import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { state, save, stripe, rest, app, origin, until, createUser, pause } from "./harness.mjs";

async function evidence(name, details = true) {
  const s = await state(); s.evidence = { ...s.evidence, [name]: details }; await save(s);
  console.log(JSON.stringify({ passed: name, details }));
}
async function ownedCustomer(user) {
  const [row] = await rest(`data_api_billing_customers?user_id=eq.${user.id}`);
  if (!row?.customer_id) return null;
  const customer = await stripe(`/customers/${row.customer_id}`);
  assert.equal(customer.metadata.user_id, user.id);
  assert.equal(customer.metadata.app, "aimarketcap");
  assert.equal(customer.metadata.purpose, "data_subscription");
  assert.equal(customer.livemode, false);
  assert.ok(customer.created >= Number((await state()).run.split("-").at(-1)) / 1000 - 1);
  await stripe(`/customers/${customer.id}`, { "metadata[test_run]": (await state()).run });
  return row;
}
async function guards() {
  const s = await state(); const user = s.users.primary;
  assert.equal((await app("/api/data-access/checkout", { method: "POST", body: { plan: "pro" } })).status, 401);
  assert.equal((await app("/api/data-access/checkout", { user, method: "POST", body: { plan: "pro" }, headers: { Origin: "https://foreign.example" } })).status, 403);
  assert.equal((await app("/api/data-access/checkout", { user, method: "POST", body: { plan: "pro", user_id: "another-user" } })).status, 400);
  const other = s.users.other ?? await createUser("other");
  const otherStatus = await app("/api/data-access/billing", { user: other });
  assert.equal(otherStatus.data.entitlement.plan.slug, "free");
  assert.equal(otherStatus.data.managed, false);
  assert.equal((await app("/api/data-access/portal", { user: other, method: "POST" })).status, 409);
  for (const token of [s.anon, other.session.access_token]) {
    const r = await fetch(`${origin}/rest/v1/data_api_billing_customers?select=user_id`, {
      headers: { apikey: s.anon, Authorization: `Bearer ${token}` },
    });
    assert.ok([401, 403].includes(r.status) || (r.ok && (await r.json()).length === 0));
  }
  await rest(`profiles?id=eq.${user.id}`, { method: "PATCH", body: { is_banned: true } });
  try {
    assert.equal((await app("/api/data-access/checkout", { user, method: "POST", body: { plan: "pro" } })).status, 403);
    assert.equal((await app("/api/data-access/portal", { user, method: "POST" })).status, 200);
  } finally { await rest(`profiles?id=eq.${user.id}`, { method: "PATCH", body: { is_banned: false } }); }
  assert.equal((await app("/api/auth/delete-account", { user, method: "POST", body: { confirmation: "DELETE" } })).status, 409);
  assert.equal((await rest(`profiles?id=eq.${user.id}&select=id`)).length, 1);
  await evidence("auth-origin-ownership-rls-ban-and-deletion-guards");
}
async function concurrent() {
  const user = await createUser("concurrent");
  const requests = await Promise.all([1, 2].map(() => app("/api/data-access/checkout", { user, method: "POST", body: { plan: "business" } })));
  assert.equal(requests.filter((r) => r.status === 200).length, 1);
  assert.equal(requests.filter((r) => r.status === 409).length, 1);
  const retry = await app("/api/data-access/checkout", { user, method: "POST", body: { plan: "business" } });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.url, requests.find((r) => r.status === 200).data.url);
  await ownedCustomer(user);
  await evidence("concurrent-checkout-and-retry-idempotency");
}
async function signed(event, valid = true, attempts = 0) {
  const s = await state(); const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(event);
  const signature = createHmac("sha256", valid ? s.webhookSecret : "invalid-local-secret").update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(`${origin}/api/webhooks/stripe/data-access`, { method: "POST", body,
    headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${timestamp},v1=${signature}` },
  });
  if (response.status === 409 && attempts < 10) {
    await response.arrayBuffer(); await pause(1000); return signed(event, valid, attempts + 1);
  }
  return { status: response.status, data: await response.json() };
}
async function replay() {
  const s = await state();
  const rows = await rest(`data_api_billing_events?user_id=eq.${s.users.primary.id}&select=event_id,event_type`);
  assert.ok(rows.length);
  const event = await stripe(`/events/${rows[0].event_id}`);
  assert.equal(event.livemode, false);
  assert.equal((await signed(event, false)).status, 400);
  assert.equal((await signed(event)).status, 200);
  assert.equal((await signed(event)).status, 200);
  const ignored = await signed({ ...event, livemode: true });
  assert.equal(ignored.status, 200); assert.equal(ignored.data.ignored, true);
  const after = await rest(`data_api_billing_events?user_id=eq.${s.users.primary.id}&select=event_id`);
  assert.equal(after.filter((r) => r.event_id === event.id).length, 1);
  await evidence("invalid-signature-test-live-isolation-and-real-event-replay", { resigning: "local test secret", auditRowsForEvent: 1 });
}
async function refund() {
  const s = await state(); const customer = await ownedCustomer(s.users.primary);
  const payments = await stripe(`/invoice_payments?invoice=${s.previousInvoice}&limit=2`);
  assert.equal(payments.data.length, 1);
  const paymentIntent = payments.data[0].payment.payment_intent;
  const intent = await stripe(`/payment_intents/${paymentIntent}`);
  assert.equal(intent.customer, customer.customer_id); assert.equal(intent.livemode, false);
  const refund = await stripe("/refunds", { payment_intent: paymentIntent, "metadata[test_run]": s.run }, "POST", `${s.run}-refund`);
  assert.equal(refund.status, "succeeded");
  await until(async () => (await rest(`data_api_billing_customers?user_id=eq.${s.users.primary.id}&select=access_hold`))[0].access_hold, 90000);
  const result = await app("/api/models?view=catalog", { headers: { Authorization: `Bearer ${s.apiKey}` } });
  assert.equal(result.status, 200); assert.equal(result.data.access.plan, "free");
  await evidence("real-refund-invoice-payments-linkage-and-persistent-hold", result.data.access);
}
async function cancellation() {
  const s = await state(); const customer = await ownedCustomer(s.users.other);
  const subscriptions = await stripe(`/subscriptions?customer=${customer.customer_id}&status=all&limit=2`);
  assert.equal(subscriptions.data.length, 1);
  const subscription = subscriptions.data[0];
  assert.equal(subscription.metadata.user_id, s.users.other.id);
  assert.equal(subscription.status, "active");
  const end = subscription.items.data[0].current_period_end;
  // The real portal used cancel_at rather than cancel_at_period_end in this run.
  assert.ok(subscription.cancel_at_period_end || subscription.cancel_at === end);
  const before = await app("/api/models?view=catalog", { headers: { Authorization: `Bearer ${s.otherApiKey}` } });
  assert.equal(before.status, 200); assert.equal(before.data.access.plan, "pro");
  assert.equal(subscription.test_clock, s.scaClock);
  const clock = await stripe(`/test_helpers/test_clocks/${s.scaClock}`);
  assert.ok(clock.name.startsWith(s.run)); assert.equal(clock.status, "ready");
  assert.ok(end > clock.frozen_time);
  await evidence("portal-cancellation-retains-access-until-period-end", before.data.access);
  await stripe(`/test_helpers/test_clocks/${s.scaClock}/advance`, { frozen_time: String(end + 7200) });
  await until(async () => {
    if ((await stripe(`/test_helpers/test_clocks/${s.scaClock}`)).status === "ready") return true;
    await pause(3000); return false;
  }, 150000);
  await until(async () => (await rest(`data_api_subscriptions?user_id=eq.${s.users.other.id}&select=status`))[0]?.status === "canceled");
  const after = await app("/api/models?view=catalog", { headers: { Authorization: `Bearer ${s.otherApiKey}` } });
  assert.equal(after.status, 200); assert.equal(after.data.access.plan, "free");
  await evidence("cancellation-at-period-end-revokes-api-access", after.data.access);
}
async function stale() {
  const s = await state();
  const rows = await rest(`data_api_billing_events?user_id=eq.${s.users.other.id}&event_type=eq.invoice.paid&select=event_id`);
  assert.ok(rows.length);
  const event = await stripe(`/events/${rows[0].event_id}`);
  const customer = await ownedCustomer(s.users.other);
  assert.equal(event.data.object.customer, customer.customer_id);
  assert.equal(event.livemode, false);
  assert.equal((await signed(event)).status, 200);
  const result = await app("/api/models?view=catalog", { headers: { Authorization: `Bearer ${s.otherApiKey}` } });
  assert.equal(result.status, 200); assert.equal(result.data.access.plan, "free");
  const subscription = (await rest(`data_api_subscriptions?user_id=eq.${s.users.other.id}&select=status`))[0];
  assert.equal(subscription.status, "canceled");
  await evidence("stale-paid-invoice-cannot-restore-canceled-access", result.data.access);
}
async function reconcile() {
  const s = await state();
  await ownedCustomer(s.users.primary);
  await rest(`data_api_billing_customers?user_id=eq.${s.users.primary.id}`, {
    method: "PATCH", body: { last_checked_at: new Date(Date.now() - 1200000).toISOString() },
  });
  assert.equal((await app("/api/cron/data-billing")).status, 401);
  const response = await app("/api/cron/data-billing", { headers: { Authorization: `Bearer ${s.cronSecret}` } });
  assert.equal(response.status, 200); assert.ok(response.data.checked >= 1);
  assert.equal(response.data.failed, 0);
  const customer = (await rest(`data_api_billing_customers?user_id=eq.${s.users.primary.id}&select=access_hold,last_checked_at`))[0];
  assert.equal(customer.access_hold, true);
  assert.ok(Date.parse(customer.last_checked_at) > Date.now() - 120000);
  await evidence("real-reconciliation-auth-and-persistent-refund-hold", { checked: response.data.checked, failed: response.data.failed });
}
async function cleanup() {
  const s = await state();
  for (const user of Object.values(s.users)) {
    const row = await ownedCustomer(user); if (!row) continue;
    if (row.checkout_session_id) {
      const session = await stripe(`/checkout/sessions/${row.checkout_session_id}`);
      assert.equal(session.customer, row.customer_id);
      if (session.status === "open") await stripe(`/checkout/sessions/${session.id}/expire`, {});
    }
    const subscriptions = await stripe(`/subscriptions?customer=${row.customer_id}&status=all&limit=100`);
    assert.equal(subscriptions.has_more, false);
    for (const subscription of subscriptions.data) {
      assert.equal(subscription.metadata.user_id, user.id);
      if (!["canceled", "incomplete_expired"].includes(subscription.status)) await stripe(`/subscriptions/${subscription.id}`, undefined, "DELETE");
    }
    await stripe(`/customers/${row.customer_id}`, undefined, "DELETE");
  }
  for (const id of [s.clock, s.scaClock].filter(Boolean)) {
    const clock = await stripe(`/test_helpers/test_clocks/${id}`);
    assert.ok(clock.name.startsWith(s.run));
    await stripe(`/test_helpers/test_clocks/${id}`, undefined, "DELETE");
  }
  for (const id of Object.values(s.prices)) {
    assert.equal((await stripe(`/prices/${id}`)).metadata.test_run, s.run);
    await stripe(`/prices/${id}`, { active: "false" });
  }
  for (const id of s.products) {
    assert.equal((await stripe(`/products/${id}`)).metadata.test_run, s.run);
    await stripe(`/products/${id}`, { active: "false" });
  }
  assert.equal((await stripe(`/billing_portal/configurations/${s.portal}`)).metadata.test_run, s.run);
  await stripe(`/billing_portal/configurations/${s.portal}`, { active: "false" });
  await evidence("test-objects-cleaned-up-no-live-writes");
}
const command = { guards, concurrent, replay, refund, cancellation, stale, reconcile, cleanup }[process.argv[2]];
if (!command) throw new Error("Usage: verify.mjs guards|concurrent|replay|refund|cancellation|stale|reconcile|cleanup");
try { await command(); } catch (error) {
  // Assertions report test labels only, never objects or secret-bearing provider errors.
  console.error(JSON.stringify({ failed: process.argv[2], type: error.name, operator: error.operator || null,
    location: error.stack?.match(/verify\.mjs:\d+:\d+/)?.[0],
    ...(typeof error.actual === "number" && typeof error.expected === "number" ? { actual: error.actual, expected: error.expected } : {}),
  }));
  process.exitCode = 1;
}
