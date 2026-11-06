import { createHmac, randomBytes } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildSupabaseAuthTemplatePatch } from "../supabase-auth-templates.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = join(root, "infra/self-host");
const { values } = parseArgs({ options: {
  "auth-config": { type: "string" }, "runtime-config": { type: "string" },
  "app-image": { type: "string" }, rehearsal: { type: "boolean", default: false },
  "runtime-dir": { type: "string" }, "state-dir": { type: "string" },
} });
const runtimeDirectory = resolve(values["runtime-dir"] ?? "/etc/aimarketcap");
const stateDirectory = resolve(values["state-dir"] ?? "/var/lib/aimarketcap");

function environment(values) {
  return Object.entries(values).map(([key, value]) => {
    const text = String(value ?? "");
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n\0]/.test(text)) throw new Error("Invalid environment entry.");
    return `${key}='${text.replaceAll("'", "\\'")}'`;
  }).join("\n") + "\n";
}

function token(secret, role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issued = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, iss: "supabase", iat: issued, exp: issued + 365 * 24 * 60 * 60 })}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function requireCredential(value) {
  if (typeof value !== "string" || value.length < 2 || /^(?:\*+|\[REDACTED\]|<.*>)$/i.test(value)) {
    throw new Error("A required source credential is missing or redacted.");
  }
  return value;
}

async function main() {
  if ([runtimeDirectory, stateDirectory].some((path) => path === root || path.startsWith(root + "/"))) {
    throw new Error("Private runtime and database state must be outside the source repository.");
  }
  try { await access(join(runtimeDirectory, "stack.env")); throw new Error("Environment already exists; refusing to overwrite keys."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  let auth = {};
  let runtime = {};
  if (!values.rehearsal) {
    if (!values["auth-config"] || !values["runtime-config"] || !values["app-image"]?.includes("@sha256:")) {
      throw new Error("Production preparation requires private Auth/runtime JSON exports and an application image digest.");
    }
    auth = JSON.parse(await readFile(values["auth-config"], "utf8"));
    runtime = JSON.parse(await readFile(values["runtime-config"], "utf8"));
    for (const key of ["CRON_SECRET", "PROVIDER_CREDENTIALS_ENCRYPTION_KEY", "RESEND_API_KEY"]) requireCredential(runtime[key]);
    for (const key of ["smtp_host", "smtp_user", "smtp_pass"]) requireCredential(auth[key]);
    if (auth.external_google_enabled) {
      requireCredential(auth.external_google_client_id);
      requireCredential(auth.external_google_secret);
    }
  }
  const secret = randomBytes(48).toString("hex");
  const env = {
    AIMC_RUNTIME_DIR: runtimeDirectory,
    AIMC_STATE_DIR: stateDirectory,
    SITE_HOST: values.rehearsal ? "aimc.test" : "aimarketcap.tech",
    API_HOST: values.rehearsal ? "api.aimc.test" : "api.aimarketcap.tech",
    ACME_EMAIL: "support@aimarketcap.tech",
    AIMC_APP_IMAGE: values["app-image"] ?? "aimarketcap-selfhost-rehearsal:local",
    POSTGRES_PASSWORD: randomBytes(32).toString("hex"),
    JWT_SECRET: secret, ANON_KEY: token(secret, "anon"), SERVICE_ROLE_KEY: token(secret, "service_role"),
    SMTP_HOST: values.rehearsal ? "mailpit" : auth.smtp_host,
    SMTP_PORT: values.rehearsal ? "1025" : auth.smtp_port ?? "465",
    SMTP_USER: values.rehearsal ? "rehearsal" : auth.smtp_user,
    SMTP_PASS: values.rehearsal ? randomBytes(16).toString("hex") : auth.smtp_pass,
    SMTP_ADMIN_EMAIL: values.rehearsal ? "support@aimc.test" : auth.smtp_admin_email,
    GOOGLE_ENABLED: String(Boolean(auth.external_google_enabled)),
    GOOGLE_CLIENT_ID: auth.external_google_client_id ?? "", GOOGLE_SECRET: auth.external_google_secret ?? "",
    DB_MEMORY_LIMIT: "2048m", WEB_MEMORY_LIMIT: "2560m",
  };
  const templates = buildSupabaseAuthTemplatePatch();
  const templateEnvironment = {};
  await mkdir(join(runtimeDirectory, "auth-emails"), { recursive: true, mode: 0o700 });
  for (const [key, html] of Object.entries(templates)) {
    if (!key.startsWith("mailer_templates_") || !key.endsWith("_content")) continue;
    const kind = key.slice("mailer_templates_".length, -"_content".length);
    await writeFile(join(runtimeDirectory, "auth-emails", `${kind}.html`), html, { flag: "wx", mode: 0o644 });
    templateEnvironment[`GOTRUE_MAILER_TEMPLATES_${kind.toUpperCase()}`] = `http://gateway:8088/${kind}.html`;
    templateEnvironment[`GOTRUE_MAILER_SUBJECTS_${kind.toUpperCase()}`] = templates[`mailer_subjects_${kind}`];
    if (kind.endsWith("_notification")) {
      templateEnvironment[`GOTRUE_MAILER_NOTIFICATIONS_${kind.slice(0, -"_notification".length).toUpperCase()}_ENABLED`] = "true";
    }
  }
  // A 755 template directory permits the unprivileged proxy process to serve the HTML.
  // The parent runtime directory stays private on the host.
  const { chmod } = await import("node:fs/promises");
  await chmod(runtimeDirectory, 0o700);
  await chmod(join(runtimeDirectory, "auth-emails"), 0o755);
  await writeFile(join(runtimeDirectory, "auth-templates.env"), environment(templateEnvironment), { flag: "wx", mode: 0o600 });
  const application = Object.fromEntries(Object.entries(runtime).filter(([key]) => !key.startsWith("RAILWAY_") && /^[A-Z][A-Z0-9_]*$/.test(key)));
  await writeFile(join(runtimeDirectory, "application.env"), environment(application), { flag: "wx", mode: 0o600 });
  await writeFile(join(runtimeDirectory, "stack.env"), environment(env), { flag: "wx", mode: 0o600 });
  const lock = JSON.parse(await readFile(join(directory, "upstream.lock.json"), "utf8"));
  await mkdir(join(directory, "upstream"), { recursive: true, mode: 0o755 });
  for (const name of ["roles.sql", "jwt.sql", "webhooks.sql"]) {
    const response = await fetch(`https://raw.githubusercontent.com/supabase/supabase/${lock.commit}/docker/volumes/db/${name}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("Pinned upstream configuration download failed.");
    const content = await response.text();
    const path = join(directory, "upstream", name);
    try {
      if (await readFile(path, "utf8") !== content) throw new Error("Pinned upstream configuration differs.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await writeFile(path, content, { flag: "wx", mode: 0o644 });
    }
  }
  await writeFile(join(runtimeDirectory, "readiness.json"), JSON.stringify({
    prepared_at: new Date().toISOString(), rehearsal_only: values.rehearsal,
    source_data_restored: false, final_writer_freeze_verified: false,
    oauth_callback_verified: false, email_delivery_verified: false,
    offsite_restore_verified: false, renewal_date: "2026-11-20",
    cutover_target: "2026-11-18", supabase_cancellation_permitted: false,
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ prepared: true, rehearsal_only: values.rehearsal, runtime_directory: runtimeDirectory, state_directory: stateDirectory, branded_templates: 13, configuration: "private files; credentials were not printed", source_data_restored: false }));
}

main().catch((error) => {
  // These messages are controlled by this script; do not print underlying config/parser errors.
  console.error(error instanceof Error && /^(Environment already exists|Production preparation requires|A required source credential|Invalid environment entry|Pinned upstream configuration)/.test(error.message)
    ? error.message : "Preparation failed. Private files may exist; inspect locally without printing credentials.");
  process.exitCode = 1;
});
