import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const directory = process.env.AIMC_RUNTIME_DIR;
if (!directory) throw new Error("A private rehearsal runtime directory is required.");
const readiness = JSON.parse(await readFile(`${directory}/readiness.json`, "utf8"));
assert.equal(readiness.rehearsal_only, true, "Never run fixture authentication on production.");
const env = parseEnv(await readFile(`${directory}/stack.env`, "utf8"));
assert.equal(env.API_HOST, "api.aimc.test");
const api = "http://127.0.0.1:18080";
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(api, env.SERVICE_ROLE_KEY, options);
const client = createClient(api, env.ANON_KEY, options);
const created = [];
const password = randomBytes(24).toString("base64url") + "aA1!";
const email = `migration-${randomBytes(12).toString("hex")}@example.test`;
const headers = { apikey: env.ANON_KEY, Authorization: `Bearer ${env.ANON_KEY}` };

async function confirmationMessage() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const listing = await fetch("http://127.0.0.1:18025/api/v1/messages").then((r) => r.json());
    const message = listing.messages?.find((m) => m.To?.some((to) => to.Address === email));
    if (message) return fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`).then((r) => r.json());
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Fixture confirmation email was not delivered.");
}

try {
  assert.equal((await fetch(`${api}/rest/v1/profiles?select=id`)).status, 401);
  assert.equal((await fetch(`${api}/rest/v1/profiles?select=id`, { headers: { ...headers, Origin: "https://foreign.example.test" } })).status, 403);
  const privateStatus = (await fetch(`${api}/rest/v1/profiles?select=email`, { method: "HEAD", headers })).status;
  assert.ok([401, 403].includes(privateStatus));
  const signup = await client.auth.signUp({ email, password, options: { emailRedirectTo: "http://127.0.0.1:13000/auth/callback" } });
  assert.equal(signup.error, null);
  assert.ok(signup.data.user?.id);
  created.push(signup.data.user.id);
  assert.equal(signup.data.session, null);
  const mail = await confirmationMessage();
  assert.match(mail.HTML, /AI Market Cap/);
  assert.match(mail.HTML, /https:\/\/aimarketcap.tech\/apple-icon/);
  const link = /href="([^"]*\/auth\/v1\/verify[^\"]*)"/.exec(mail.HTML)?.[1]?.replaceAll("&amp;", "&");
  assert.ok(link);
  assert.equal(new URL(link).origin, api);
  const verified = await fetch(link, { redirect: "manual" });
  assert.ok([302, 303].includes(verified.status));
  assert.equal(new URL(verified.headers.get("location")).origin, "http://127.0.0.1:13000");
  const login = await client.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null);
  assert.equal((await client.auth.getUser()).data.user?.id, created[0]);
  const other = await admin.auth.admin.createUser({ email: `other-${randomBytes(10).toString("hex")}@example.test`, password, email_confirm: true });
  assert.equal(other.error, null);
  created.push(other.data.user.id);
  assert.equal((await client.from("profiles").update({ display_name: "Migration fixture" }).eq("id", created[0])).error, null);
  const cross = await client.from("profiles").update({ display_name: "Forbidden" }).eq("id", created[1]).select("id");
  assert.equal(cross.error, null);
  assert.deepEqual(cross.data, []);
  assert.ok((await client.from("profiles").update({ is_admin: true }).eq("id", created[0])).error);
  const profiles = await client.from("profiles").select("id,username").limit(2);
  assert.equal(profiles.error, null);
  const token = login.data.session.refresh_token;
  assert.equal((await client.auth.signOut()).error, null);
  assert.ok((await client.auth.refreshSession({ refresh_token: token })).error);
  console.log(JSON.stringify({ isolated_auth_smoke: { gateway_guards: true, profile_email_private: true,
    confirmation_email_branding: true, signup_requires_confirmation: true, password_login: true,
    tenant_isolation: true, self_privilege_escalation_denied: true, logout_revokes_refresh: true }, production_messages_sent: 0 }));
} finally {
  for (const id of created) {
    const result = await admin.auth.admin.deleteUser(id);
    assert.equal(result.error, null, "Fixture cleanup failed.");
  }
}
