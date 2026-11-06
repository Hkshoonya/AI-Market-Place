import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { decryptBackup, encryptBackup, encryptJson, fileDigest, loadBackupKey } from "./crypto.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    directory: { type: "string" },
    key: { type: "string" },
    container: { type: "string" },
    "create-key": { type: "boolean", default: false },
  },
});
const command = positionals[0];
const CLIENT_IMAGE = "postgres:17-alpine";

async function management(path, body) {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!url.hostname.endsWith(".supabase.co")) throw new Error("Expected the managed source project URL.");
  const ref = url.hostname.split(".")[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Source management request failed (HTTP ${response.status}).`);
  return response.json();
}

function child(command, args, options = {}) {
  const process = spawn(command, args, { ...options, stdio: ["pipe", "pipe", "pipe"] });
  process.stdin.on("error", () => {});
  // Tool stderr can include credentials, SQL rows or PII. Never forward it.
  process.stderr.resume();
  const done = new Promise((resolve, reject) => {
    process.once("error", () => reject(new Error(`${command} could not start.`)));
    process.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`)));
  });
  void done.catch(() => {});
  return { process, done };
}

async function capture(command, args, options) {
  const running = child(command, args, options);
  running.process.stdin.end();
  let result = "";
  for await (const chunk of running.process.stdout) result += chunk;
  await running.done;
  return result.trim();
}

async function sourceEnvironment(directory) {
  const url = new URL(process.env.DATABASE_URL);
  let host = url.hostname;
  let user = decodeURIComponent(url.username);
  let port = url.port || "5432";
  // Managed direct endpoints can be IPv6-only; use the documented session pooler.
  if (host.endsWith(".supabase.co") && host.startsWith("db.")) {
    const configurations = await management("/config/database/pooler");
    const rows = Array.isArray(configurations) ? configurations : [configurations];
    const session = rows.find((row) => row.pool_mode === "session") ?? rows[0];
    if (!session?.db_host || !session.db_user) throw new Error("Session pooler configuration is unavailable.");
    host = session.db_host;
    user = session.db_user;
    port = "5432";
  }
  const certificate = await fetch("https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt", { signal: AbortSignal.timeout(30000) });
  if (!certificate.ok) throw new Error("Source CA certificate download failed.");
  const pem = await certificate.text();
  if (createHash("sha256").update(pem).digest("hex") !== "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7") {
    throw new Error("Source CA certificate changed; review its new fingerprint.");
  }
  const certificatePath = join(directory, "source-ca.crt");
  await writeFile(certificatePath, pem, { flag: "wx", mode: 0o600 });
  return {
    ...process.env,
    PGHOST: host, PGPORT: port, PGUSER: user,
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1) || "postgres",
    PGSSLMODE: "verify-full", PGSSLROOTCERT: "/source-ca.crt", PGCONNECT_TIMEOUT: "15",
    AIMC_SOURCE_CERTIFICATE: certificatePath,
    PGAPPNAME: "aimarketcap-migration-readonly",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=0",
  };
}

function clientArgs(tool, args, env) {
  return ["run", "--rm", "--interactive", "--network", "host", "--volume", `${env.AIMC_SOURCE_CERTIFICATE}:/source-ca.crt:ro`, ...[
    "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE",
    "PGSSLROOTCERT", "PGCONNECT_TIMEOUT", "PGAPPNAME", "PGOPTIONS",
  ].flatMap((name) => ["--env", name]), CLIENT_IMAGE, tool, ...args];
}

async function inventory() {
  const query = `select json_build_object(
    'version',current_setting('server_version'),
    'database_bytes',pg_database_size(current_database()),
    'auth_users',(select count(*) from auth.users),
    'identities',(select count(*) from auth.identities),
    'storage_objects',(select count(*) from storage.objects),
    'storage_buckets',(select count(*) from storage.buckets),
    'public_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
    'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
    'extensions',(select json_agg(json_build_object('name',extname,'version',extversion)) from pg_extension)
  ) as inventory`;
  const rows = await management("/database/query", { query, read_only: true });
  return rows[0].inventory;
}

async function backup(directory, key) {
  await mkdir(directory, { mode: 0o700 });
  const env = await sourceEnvironment(directory);
  const connection = await capture("docker", clientArgs("psql", ["-XAt", "-v", "ON_ERROR_STOP=1", "-c", "show server_version_num"], env), { env });
  if (!connection.startsWith("17")) throw new Error("Source PostgreSQL major version changed; review client compatibility.");
  const baseline = await inventory();
  const outputs = [];
  for (const [name, tool, args] of [
    ["database.dump.enc", "pg_dump", ["--format=custom", "--compress=zstd:1", "--lock-wait-timeout=10000"]],
    ["roles.sql.enc", "pg_dumpall", ["--roles-only", "--no-role-passwords"]],
  ]) {
    console.log(`Exporting ${name} from the source in read-only mode.`);
    const running = child("docker", clientArgs(tool, args, env), { env });
    running.process.stdin.end();
    try {
      await encryptBackup(running.process.stdout, join(directory, name), key);
      await running.done;
    } catch (error) {
      running.process.kill("SIGTERM");
      await rm(join(directory, name), { force: true });
      throw error;
    }
    outputs.push(name);
  }
  await encryptJson(await management("/config/auth"), join(directory, "auth-config.json.enc"), key);
  outputs.push("auth-config.json.enc");
  const manifest = {
    format: 1, created_at: new Date().toISOString(),
    purpose: "rehearsal; final cutover requires a fresh export with all writers paused",
    source: baseline,
    configuration: { auth_exported: true, runtime_exported: false, oauth_provider_callback_update_required: true },
    storage: { external_object_copy_required: baseline.storage_objects > 0 },
    files: await Promise.all(outputs.map(async (name) => ({ name, sha256: await fileDigest(join(directory, name)), bytes: (await lstat(join(directory, name))).size }))),
  };
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ directory, encrypted_files: outputs.length, source: baseline }));
}

async function verify(directory, key, temporary) {
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  if (manifest.format !== 1 || !Array.isArray(manifest.files)) throw new Error("Invalid backup manifest.");
  for (const file of manifest.files) {
    if (!/^[a-z][a-z0-9.-]*\.enc$/.test(file.name)) throw new Error("Invalid backup filename.");
    if (await fileDigest(join(directory, file.name)) !== file.sha256) throw new Error("Backup checksum mismatch.");
    await decryptBackup(join(directory, file.name), join(temporary, file.name.slice(0, -4)), key);
  }
  const listing = child("docker", ["run", "--rm", "--interactive", "--network", "none", CLIENT_IMAGE, "pg_restore", "--list"]);
  createReadStream(join(temporary, "database.dump")).pipe(listing.process.stdin);
  let entries = 0;
  for await (const line of createInterface({ input: listing.process.stdout, crlfDelay: Infinity })) {
    if (/^\d+;/.test(line)) entries++;
  }
  await listing.done;
  console.log(JSON.stringify({ authenticated: true, archive_entries: entries, source: manifest.source, final_cutover_verified: false }));
}

async function restoreRehearsal(container, temporary) {
  if (!/^aimc-migration-\d{8}-db-1$/.test(container)) throw new Error("Only isolated migration containers may be restored.");
  const [target] = JSON.parse(await capture("docker", ["inspect", container]));
  if (target.Config.Labels["io.aimarketcap.migration-rehearsal"] !== "true" || Object.values(target.NetworkSettings.Ports ?? {}).some((bindings) => Array.isArray(bindings) && bindings.length)) {
    throw new Error("Restore target is not an isolated rehearsal database.");
  }
  const query = (sql, database = "postgres") => capture("docker", ["exec", container, "psql", "-U", "supabase_admin", "-d", database, "-XAt", "-v", "ON_ERROR_STOP=1", "-c", sql]);
  const tables = await query("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
  const hasAuth = await query("select to_regclass('auth.users') is not null");
  const users = hasAuth === "t" ? await query("select count(*) from auth.users") : "0";
  if (tables !== "0" || users !== "0") throw new Error("Restore target already contains application data or users.");
  const roles = await readFile(join(temporary, "roles.sql"), "utf8");
  const existing = new Set(JSON.parse(await query("select json_agg(rolname) from pg_roles")));
  // Keep object ownership, but do not enable archived platform logins or passwords.
  for (const [, name] of roles.matchAll(/^CREATE ROLE ([a-z_][a-z0-9_]*);$/gm)) {
    if (!existing.has(name)) await query(`CREATE ROLE "${name}" NOLOGIN`);
  }
  const password = target.Config.Env.find((value) => value.startsWith("POSTGRES_PASSWORD="));
  if (!password) throw new Error("Rehearsal database credential is missing.");
  await query("DROP DATABASE postgres WITH (FORCE)", "template1");
  await query("CREATE DATABASE postgres OWNER supabase_admin TEMPLATE template0", "template1");
  const env = { ...process.env, PGPASSWORD: password.slice("POSTGRES_PASSWORD=".length) };
  const mount = `${join(temporary, "database.dump")}:/backup.dump:ro`;
  await capture("docker", ["run", "--rm", "--network", `container:${container}`, "--env", "PGPASSWORD", "--volume", mount,
    CLIENT_IMAGE, "pg_restore", "--host", "127.0.0.1", "--username", "supabase_admin", "--dbname", "postgres", "--single-transaction", "--exit-on-error", "--no-tablespaces", "/backup.dump"], { env });
  // Count COPY records without logging or buffering source rows. A live source
  // may keep changing; compare against the consistent snapshot inside the archive.
  const dump = child("docker", ["run", "--rm", "--network", "none", "--volume", mount, CLIENT_IMAGE, "pg_restore", "--data-only", "--file=-", "/backup.dump"]);
  dump.process.stdin.end();
  const counts = new Map();
  let table = null;
  for await (const line of createInterface({ input: dump.process.stdout, crlfDelay: Infinity })) {
    if (table) {
      if (line === "\\.") table = null;
      else counts.set(table, counts.get(table) + 1);
    } else {
      const match = /^COPY (public|auth)\.([a-z_][a-z0-9_]*) .* FROM stdin;$/.exec(line);
      if (match) { table = `${match[1]}.${match[2]}`; counts.set(table, 0); }
    }
  }
  await dump.done;
  if (counts.size < 86 || !counts.has("auth.users") || !counts.has("auth.identities")) throw new Error("Archive row-count inventory is incomplete.");
  for (const [name, expected] of counts) {
    if (Number(await query(`SELECT count(*) FROM ${name}`)) !== expected) throw new Error("Restored row counts differ from the archive.");
  }
  const inventory = JSON.parse(await query("select json_build_object('auth_users',(select count(*) from auth.users),'identities',(select count(*) from auth.identities),'public_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),'cron_enabled',current_setting('cron.launch_active_jobs'))"));
  console.log(JSON.stringify({ rehearsal_restore: inventory, archive_tables_row_count_verified: counts.size, production_cutover: false }));
}

async function main() {
  if (command === "inventory") {
    console.log(JSON.stringify(await inventory(), null, 2));
    return;
  }
  if (!["backup", "verify", "restore-rehearsal"].includes(command) || !values.directory || !values.key) {
    throw new Error("Usage: node --env-file=.env.local scripts/self-host/migrate.mjs inventory|backup|verify|restore-rehearsal --directory <private-path> --key <private-key-file> [--create-key] [--container <isolated-container>]");
  }
  const directory = resolve(values.directory);
  const keyPath = resolve(values.key);
  if (keyPath.startsWith(directory + "/")) throw new Error("Keep the backup key outside the archive directory.");
  await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
  await mkdir(dirname(keyPath), { recursive: true, mode: 0o700 });
  const key = await loadBackupKey(keyPath, { create: values["create-key"] });
  if (command === "backup") {
    await backup(directory, key);
  } else {
    const temporary = await mkdtemp(join(tmpdir(), "aimc-backup-verify-"));
    try {
      await verify(directory, key, temporary);
      if (command === "restore-rehearsal") await restoreRehearsal(values.container ?? "", temporary);
    }
    finally { await rm(temporary, { recursive: true, force: true }); }
  }
}

main().catch(() => {
  console.error("Migration operation failed. No credentials or source rows were logged. The source was not modified; inspect configuration and retry into a new backup directory.");
  process.exitCode = 1;
});
