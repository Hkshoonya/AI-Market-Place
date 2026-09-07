import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { parse } from "dotenv";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const directory = path.join(root, "output/billing-sandbox");
export const origin = "http://127.0.0.1:3412";
const statePath = path.join(directory, "state.json");
const version = "2026-02-25.clover";
const prefix = "aimc-billing-sandbox";

export async function state() { return JSON.parse(await readFile(statePath, "utf8")); }
export async function save(value) { await writeFile(statePath, JSON.stringify(value, null, 2), { mode: 0o600 }); }
export async function testKey() {
  const local = parse(await readFile(path.join(root, ".env.local")));
  const key = process.env.STRIPE_TEST_SECRET_KEY || local.STRIPE_TEST_SECRET_KEY || local.STRIPE_SECRET_KEY;
  if (!/^(?:sk|rk)_test_[A-Za-z0-9]+$/.test(key || "")) throw new Error("Refusing missing or non-test Stripe key");
  return key;
}
export async function stripe(route, body, method = body ? "POST" : "GET", idempotencyKey) {
  if (!route.startsWith("/") || route.startsWith("//")) throw new Error("Invalid test API path");
  const response = await fetch(`https://api.stripe.com/v1${route}`, {
    method, headers: { Authorization: `Bearer ${await testKey()}`, "Stripe-Version": version,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    }, body: body ? new URLSearchParams(body) : undefined, redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  const value = await response.json();
  if (!response.ok) {
    // Never print provider errors, which can include credentials/customer data.
    throw new Error(`Stripe test request failed: ${method} ${route.split("?")[0]} HTTP ${response.status} (${value.error?.code || value.error?.type || "unknown"})`);
  }
  if (value.livemode === true) throw new Error("Unexpected live object in test run");
  return value;
}
export function sql(statement) {
  return execFileSync("docker", ["exec", "-i", `${prefix}-db`, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
    { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
export async function rest(route, { method = "GET", body, token } = {}) {
  const s = await state();
  const response = await fetch(`${origin}/rest/v1/${route}`, { method,
    headers: { apikey: s.anon, Authorization: `Bearer ${token || s.service}`, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Local database request failed: ${response.status} ${data?.code || "unknown"}`);
  return data;
}
export async function app(route, { user, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${origin}${route}`, { method, redirect: "manual",
    headers: { Origin: origin, "Content-Type": "application/json", ...(user ? { Cookie: user.cookie } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(90_000),
  });
  return { status: response.status, headers: Object.fromEntries(response.headers), data: await response.json().catch(() => null) };
}
export async function pause(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }
export async function until(fn, timeout = 90_000) {
  const end = Date.now() + timeout;
  do { const value = await fn(); if (value) return value; await pause(1000); } while (Date.now() < end);
  throw new Error("Test condition timed out");
}
function jwt(secret, role) {
  const now = Math.floor(Date.now() / 1000);
  const message = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ role, iss: "supabase", iat: now, exp: now + 86400 })).toString("base64url")}`;
  return `${message}.${createHmac("sha256", secret).update(message).digest("base64url")}`;
}
function docker(args, env = {}) {
  const input = Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n");
  const envFile = path.join(directory, `.docker-env-${randomUUID()}`);
  if (input) writeFileSync(envFile, input, { mode: 0o600 });
  try {
    return execFileSync("docker", args.map((arg) => arg === "/dev/stdin" ? envFile : arg), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } finally { if (input) unlinkSync(envFile); }
}
async function init() {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try { await state(); throw new Error("A sandbox state already exists; inspect/clean it before initializing again"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const account = await stripe("/account");
  if (account.id !== "acct_1SxKRxAneuEOaTi3") throw new Error("Unexpected sandbox merchant");
  const secret = randomBytes(48).toString("hex");
  const s = { run: `aimc-billing-${Date.now()}`, accountId: account.id, dbPassword: randomBytes(24).toString("hex"),
    jwtSecret: secret, anon: jwt(secret, "anon"), service: jwt(secret, "service_role"),
    cronSecret: randomBytes(32).toString("hex"), users: {}, products: [], prices: {}, events: [],
  };
  await save(s);
  // A private bridge permits localhost port publishing; no database port is exposed.
  docker(["network", "create", prefix]);
  docker(["run", "-d", "--rm", "--name", `${prefix}-db`, "--network", prefix, "--env-file", "/dev/stdin", "postgres:17-alpine"], { POSTGRES_PASSWORD: s.dbPassword });
  await until(() => { try { return docker(["exec", `${prefix}-db`, "pg_isready", "-U", "postgres"]).includes("accepting connections"); } catch { return false; } });
  sql("CREATE SCHEMA auth; ALTER ROLE postgres SET search_path = auth, public;");
  await startAuth();
  await until(async () => { try { return (await fetch("http://127.0.0.1:3415/health")).ok; } catch { return false; } });
  sql(await readFile(path.join(root, "scripts/billing-sandbox/schema.sql"), "utf8"));
  sql(await readFile(path.join(root, "scripts/billing-sandbox/support.sql"), "utf8"));
  for (const migration of ["021_cron_single_run_lock.sql", "062_add_workspace_sessions.sql", "087_add_data_api_subscriptions.sql", "090_repair_data_api_quota_conflict_target.sql", "099_add_data_api_stripe_billing.sql"]) {
    sql("SET search_path=public;\n" + await readFile(path.join(root, "supabase/migrations", migration), "utf8"));
  }
  sql("GRANT SELECT, INSERT, UPDATE ON public.workspace_sessions TO authenticated;");
  sql(`UPDATE public.data_api_billing_settings SET account_id='${account.id}', livemode=FALSE;
    UPDATE public.data_api_plans SET checkout_enabled=TRUE WHERE slug IN ('pro','business');
    GRANT SELECT ON public.data_api_plans TO anon;`);
  await startRest();
  for (const [plan, amount] of [["pro", 4900], ["business", 19900]]) {
    const product = await stripe("/products", { name: `AIMC SANDBOX ${plan} ${s.run}`, "metadata[app]": "aimarketcap", "metadata[purpose]": "data_subscription", "metadata[test_run]": s.run }, "POST", `${s.run}-product-${plan}`);
    s.products.push(product.id); await save(s);
    const price = await stripe("/prices", { product: product.id, currency: "usd", unit_amount: String(amount), "recurring[interval]": "month", "metadata[test_run]": s.run }, "POST", `${s.run}-price-${plan}`);
    s.prices[plan] = price.id; await save(s);
  }
  const portal = await stripe("/billing_portal/configurations", {
    "features[subscription_cancel][enabled]": "true", "features[subscription_cancel][mode]": "at_period_end",
    "features[subscription_update][enabled]": "false", "features[invoice_history][enabled]": "true", "features[payment_method_update][enabled]": "true",
    "login_page[enabled]": "false", "metadata[app]": "aimarketcap", "metadata[purpose]": "data_subscription", "metadata[test_run]": s.run,
    "business_profile[headline]": "AIMC sandbox billing verification", default_return_url: `${origin}/settings/billing`,
  }, "POST", `${s.run}-portal`);
  s.portal = portal.id; await save(s);
  console.log(JSON.stringify({ initialized: true, testMode: true, localOnly: true, run: s.run }));
}
export async function startAuth() {
  const s = await state();
  docker(["run", "-d", "--name", `${prefix}-auth`, "--network", prefix, "-p", "127.0.0.1:3415:9999", "--env-file", "/dev/stdin", "public.ecr.aws/supabase/gotrue:v2.188.1"], {
    GOTRUE_DB_DRIVER: "postgres", DATABASE_URL: `postgres://postgres:${s.dbPassword}@${prefix}-db:5432/postgres?sslmode=disable`,
    GOTRUE_DB_DATABASE_URL: `postgres://postgres:${s.dbPassword}@${prefix}-db:5432/postgres?sslmode=disable`, DB_NAMESPACE: "auth",
    GOTRUE_JWT_SECRET: s.jwtSecret, GOTRUE_JWT_AUD: "authenticated", GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated", GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_API_HOST: "0.0.0.0", PORT: "9999", GOTRUE_SITE_URL: origin, API_EXTERNAL_URL: `${origin}/auth/v1`,
    GOTRUE_DISABLE_SIGNUP: "true", GOTRUE_EXTERNAL_EMAIL_ENABLED: "true", GOTRUE_MAILER_AUTOCONFIRM: "true", GOTRUE_LOG_LEVEL: "error",
  });
}
export async function startRest() {
  const s = await state();
  docker(["run", "-d", "--rm", "--name", `${prefix}-rest`, "--network", prefix, "-p", "127.0.0.1:3416:3000", "--env-file", "/dev/stdin", "public.ecr.aws/supabase/postgrest:v14.10"], {
    PGRST_DB_URI: `postgres://postgres:${s.dbPassword}@${prefix}-db:5432/postgres`, PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon", PGRST_JWT_SECRET: s.jwtSecret, PGRST_LOG_LEVEL: "error",
  });
}
async function serve() {
  const s = await state();
  const local = parse(await readFile(path.join(root, ".env.local")));
  const env = { ...process.env, ...Object.fromEntries(Object.keys(local).map((key) => [key, ""])),
    NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: s.anon, SUPABASE_SERVICE_ROLE_KEY: s.service,
    NEXT_PUBLIC_SITE_URL: origin, NEXT_PUBLIC_E2E_MSW: "false", NODE_ENV: "development", RATE_LIMIT_BACKEND: "memory",
    CRON_RUNNER_MODE: "disabled", CRON_SECRET: s.cronSecret, NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED: "false",
    DATA_API_BILLING_ENABLED: "true", DATA_API_BILLING_RECONCILE_ENABLED: "true", DATA_API_BILLING_MODE: "test",
    STRIPE_SECRET_KEY: await testKey(), STRIPE_EXPECTED_ACCOUNT_ID: s.accountId, STRIPE_DATA_PRO_PRICE_ID: s.prices.pro,
    STRIPE_DATA_BUSINESS_PRICE_ID: s.prices.business, STRIPE_DATA_PORTAL_CONFIGURATION_ID: s.portal, STRIPE_DATA_WEBHOOK_SECRET: s.webhookSecret,
    NEXT_TELEMETRY_DISABLED: "1", SENTRY_AUTH_TOKEN: "", RESEND_API_KEY: "",
  };
  if (!s.webhookSecret) throw new Error("Start the Stripe listener before the application");
  const next = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3413"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  const log = await import("node:fs").then((fs) => fs.createWriteStream(path.join(directory, "app.log"), { mode: 0o600 }));
  next.stdout.pipe(log); next.stderr.pipe(log);
  const gateway = createServer((req, res) => {
    const url = req.url || "/";
    const auth = url.startsWith("/auth/v1/"); const rest = url.startsWith("/rest/v1/");
    const upstream = httpRequest({ host: "127.0.0.1", port: auth ? 3415 : rest ? 3416 : 3413,
      path: auth ? url.slice(8) : rest ? url.slice(8) : url, method: req.method, headers: { ...req.headers, host: "127.0.0.1:3412" },
    }, (response) => { res.writeHead(response.statusCode || 502, response.headers); response.pipe(res); });
    upstream.on("error", () => { res.writeHead(502); res.end("Local sandbox upstream unavailable"); }); req.pipe(upstream);
  });
  gateway.on("upgrade", (req, socket, head) => {
    const upstream = httpRequest({ host: "127.0.0.1", port: 3413, path: req.url,
      headers: req.headers, method: req.method });
    upstream.on("upgrade", (response, peer, upstreamHead) => {
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${response.rawHeaders.reduce((lines, value, index, all) => index % 2 ? lines : `${lines}${value}: ${all[index + 1]}\r\n`, "")}\r\n`);
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) peer.write(head);
      socket.pipe(peer).pipe(socket);
      peer.on("error", () => socket.destroy()); socket.on("error", () => peer.destroy());
    });
    upstream.on("error", () => socket.destroy()); upstream.end();
  });
  gateway.listen(3412, "127.0.0.1", () => console.log("Billing sandbox listening on 127.0.0.1:3412; no production connections configured"));
  const stop = () => { next.kill("SIGTERM"); gateway.close(); log.end(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
async function listen() {
  const binary = path.join(directory, "bin/stripe");
  const listener = spawn(binary, ["listen", "--forward-to", `${origin}/api/webhooks/stripe/data-access`, "--events", "customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,invoice.paid,invoice.payment_failed,charge.refunded,charge.dispute.created", "--color", "off"], {
    env: { ...process.env, STRIPE_API_KEY: await testKey(), XDG_CONFIG_HOME: path.join(directory, "cli-config") }, stdio: ["ignore", "pipe", "pipe"],
  });
  let pending = ""; let ready = false;
  const handle = async (chunk) => {
    pending += chunk.toString();
    const match = /whsec_[A-Za-z0-9]+/.exec(pending);
    if (match && !ready) { ready = true; const s = await state(); s.webhookSecret = match[0]; await save(s); console.log("Stripe test webhook listener ready; signing secret stored privately"); }
    if (pending.length > 8000) pending = pending.slice(-4000);
    const lines = chunk.toString().split("\n").filter((line) => /\[(200|400|409|500|502|503)\]/.test(line));
    for (const line of lines) console.log(line.replace(/whsec_[A-Za-z0-9]+/g, "[REDACTED]"));
  };
  listener.stdout.on("data", handle); listener.stderr.on("data", handle);
  listener.on("exit", (code) => { if (!ready) console.error("Stripe listener exited before becoming ready", code); process.exitCode = code || 0; });
  process.on("SIGINT", () => listener.kill("SIGTERM")); process.on("SIGTERM", () => listener.kill("SIGTERM"));
}
export async function createUser(label) {
  const s = await state();
  const email = `${label}-${s.run}@example.com`; const password = randomBytes(24).toString("base64url");
  const created = await fetch(`${origin}/auth/v1/admin/users`, { method: "POST", headers: { Authorization: `Bearer ${s.service}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "AIMC Sandbox Tester" } }) });
  if (!created.ok) throw new Error(`Local test user creation failed: ${created.status}`);
  const user = await created.json();
  await rest("profiles", { method: "POST", body: { id: user.id, username: label, display_name: "AIMC Sandbox Tester", is_banned: false } });
  const login = await fetch(`${origin}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: s.anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`Real local login failed: ${login.status}`);
  const session = await login.json();
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const result = { id: user.id, email, password, session, cookie: `sb-127-auth-token=${cookieValue}`, cookieValue };
  s.users[label] = result; await save(s); return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = { init, serve, listen }[process.argv[2]];
  if (!command) throw new Error("Usage: node scripts/billing-sandbox/harness.mjs init|listen|serve");
  try { await command(); } catch (error) { console.error(error.message.replace(/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g, "[REDACTED]")); process.exitCode = 1; }
}
