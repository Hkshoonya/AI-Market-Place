import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const API_VERSION = "2026-01-28.clover";
const APP = "aimarketcap";
const SITE = "https://aimarketcap.tech";
const PLANS = [
  { slug: "pro", name: "Data Pro", amount: 4900, requests: 100000 },
  { slug: "business", name: "Data Business", amount: 19900, requests: 1000000 },
];

export async function setupStripeTestCatalog({ key, accountId, apply = false, smoke = false, fetchImpl = fetch }) {
  // No live override: this tool cannot modify a live merchant or charge a card.
  if (!/^(?:sk|rk)_test_[A-Za-z0-9]+$/.test(key ?? "")) throw new Error("A test-mode Stripe server key is required. Live keys are refused.");
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId ?? "")) throw new Error("Supply the expected Stripe account ID with --account.");
  if (smoke && !apply) throw new Error("--smoke requires --apply and creates then expires test Checkout sessions only.");

  async function request(path, body, idempotencyKey) {
    const response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Version": API_VERSION,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? new URLSearchParams(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(`Stripe ${body ? "POST" : "GET"} ${path.split("?")[0]} failed (HTTP ${response.status}). Inspect Stripe Workbench; credentials and provider error bodies are not logged.`);
    return value;
  }

  async function list(path) {
    const results = [];
    let cursor;
    for (let page = 0; page < 100; page += 1) {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("starting_after", cursor);
      const result = await request(`${path}?${params}`);
      if (!Array.isArray(result.data)) throw new Error(`Invalid Stripe ${path} list`);
      results.push(...result.data);
      if (!result.has_more) return results;
      cursor = result.data.at(-1)?.id;
      if (!cursor) throw new Error(`Invalid Stripe ${path} pagination`);
    }
    throw new Error(`Stripe ${path} list exceeded the inspection limit; no partial catalogue is accepted.`);
  }

  function requireOwnedTestObject(object, idPrefix) {
    if (!object || typeof object.id !== "string" || !object.id.startsWith(idPrefix) || !/^[A-Za-z0-9_]+$/.test(object.id) || object.livemode !== false || object.metadata?.app !== APP) {
      throw new Error("Refusing an unowned, malformed or non-test Stripe object.");
    }
    return object;
  }

  const account = await request("account");
  if (account.id !== accountId) throw new Error("Stripe account does not match --account. No changes made.");
  const products = await list("products");
  const prices = await list("prices");
  const portals = await list("billing_portal/configurations");
  const result = {
    accountId: account.id,
    accountName: account.settings?.dashboard?.display_name ?? null,
    mode: "test",
    applied: apply,
    apiVersion: API_VERSION,
    plans: [],
    portalConfigurationId: null,
    smoke: [],
    livePaymentsEnabled: false,
  };

  for (const plan of PLANS) {
    const productId = `aimc_data_${plan.slug}_v1`;
    const lookup = `aimc_data_${plan.slug}_usd_monthly_v1`;
    let product = products.find((item) => item.id === productId);
    if (!product && apply) {
      product = await request("products", {
        id: productId,
        name: `AI Market Cap ${plan.name}`,
        description: `Test-only draft: ${plan.requests.toLocaleString("en-US")} data API requests per calendar month. GPU and model inference charges are separate. No production access is granted by this test product.`,
        url: `${SITE}/pricing`,
        statement_descriptor: "WMS AIMARKETCAP",
        "metadata[app]": APP,
        "metadata[plan_slug]": plan.slug,
        "metadata[setup_status]": "test_only_draft",
      }, `${account.id}:${productId}`);
    }
    if (product) {
      requireOwnedTestObject(product, "aimc_data_");
      if (product.active !== true || product.metadata.plan_slug !== plan.slug) throw new Error(`Test product ${productId} was changed or disabled. Review it rather than overriding it.`);
    }

    let price = prices.find((item) => item.lookup_key === lookup);
    if (!price && apply) {
      price = await request("prices", {
        product: product.id,
        currency: "usd",
        unit_amount: String(plan.amount),
        "recurring[interval]": "month",
        lookup_key: lookup,
        "metadata[app]": APP,
        "metadata[plan_slug]": plan.slug,
      }, `${account.id}:${lookup}`);
    }
    if (price) {
      requireOwnedTestObject(price, "price_");
      if (price.active !== true || price.product !== productId || price.currency !== "usd" || price.unit_amount !== plan.amount || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.metadata.plan_slug !== plan.slug) {
        throw new Error(`Test price ${lookup} differs from the draft. No price is overwritten or migrated automatically.`);
      }
    }
    result.plans.push({ slug: plan.slug, monthlyAmountCents: plan.amount, productId: product?.id ?? null, priceId: price?.id ?? null, action: product && price ? "configured" : "would_create" });

    if (smoke) {
      const session = await request("checkout/sessions", {
        mode: "subscription",
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        "payment_method_types[0]": "card",
        success_url: `${SITE}/pricing?stripe_setup=test`,
        cancel_url: `${SITE}/pricing?stripe_setup=cancelled`,
        "metadata[app]": APP,
        "metadata[purpose]": "setup_probe",
        "subscription_data[metadata][app]": APP,
        "subscription_data[metadata][purpose]": "setup_probe",
      }, `${account.id}:aimc-setup-probe:${randomUUID()}`);
      requireOwnedTestObject(session, "cs_test_");
      const expired = await request(`checkout/sessions/${session.id}/expire`, {}, `${session.id}:expire`);
      if (expired.status !== "expired" || expired.livemode !== false) throw new Error("Test Checkout expiration could not be verified. Check test-mode Checkout Sessions in Stripe.");
      if (session.mode !== "subscription" || session.amount_total !== plan.amount || session.currency !== "usd") throw new Error("Test Checkout did not match the draft plan.");
      result.smoke.push({ plan: plan.slug, amountTotal: session.amount_total, status: expired.status, paymentStatus: expired.payment_status });
    }
  }

  const matchingPortals = portals.filter((item) => item.metadata?.app === APP && item.metadata?.purpose === "data_api");
  if (matchingPortals.length > 1) throw new Error("Multiple AIMC test portal configurations exist. Review before making changes.");
  let portal = matchingPortals[0];
  if (!portal && apply) {
    portal = await request("billing_portal/configurations", {
      "business_profile[headline]": "AI Market Cap by WeMakeSense",
      "business_profile[privacy_policy_url]": `${SITE}/privacy`,
      "business_profile[terms_of_service_url]": `${SITE}/terms`,
      default_return_url: `${SITE}/settings/api-keys`,
      "features[invoice_history][enabled]": "true",
      "features[payment_method_update][enabled]": "true",
      "features[subscription_cancel][enabled]": "true",
      "features[subscription_cancel][mode]": "at_period_end",
      "features[subscription_update][enabled]": "false",
      "login_page[enabled]": "false",
      "metadata[app]": APP,
      "metadata[purpose]": "data_api",
    }, `${account.id}:aimc-data-portal-v1`);
  }
  if (portal) {
    requireOwnedTestObject(portal, "bpc_");
    if (portal.active !== true || portal.features?.subscription_cancel?.enabled !== true || portal.features.subscription_cancel.mode !== "at_period_end" || portal.features?.payment_method_update?.enabled !== true || portal.features?.invoice_history?.enabled !== true || portal.login_page?.enabled !== false) {
      throw new Error("AIMC test portal settings differ from the reviewed setup. Review rather than overwrite.");
    }
    result.portalConfigurationId = portal.id;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values } = parseArgs({ options: { account: { type: "string" }, apply: { type: "boolean" }, smoke: { type: "boolean" } } });
    const result = await setupStripeTestCatalog({ key: process.env.STRIPE_SECRET_KEY, accountId: values.account, apply: values.apply, smoke: values.smoke });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Stripe test setup failed");
    process.exitCode = 1;
  }
}
