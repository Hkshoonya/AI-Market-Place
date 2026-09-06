// Disposable local PostgreSQL only. Never connects to the configured Supabase project.
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const container = `aimc-runpod-schema-${process.pid}`;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}
const sqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-At",
];
const sql = (text) => docker(sqlArgs, text);
const user = "11111111-1111-4111-8111-111111111111";
const connection = "22222222-2222-4222-8222-222222222222";
const podId = (n) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const insert = (
  n,
  extra = "",
) => `INSERT INTO runpod_pods (id,user_id,provider_connection_id,external_account_id,model_key,gpu_type_id,gpu_name,gpu_memory_gb,volume_gb,gpu_price_per_hr,image_name,encrypted_api_key,quote_expires_at)
VALUES ('${podId(n)}','${user}','${connection}','account1','qwen3-8b','NVIDIA A40','A40',48,30,0.4,'pinned-image','encrypted',NOW()+interval '5 minutes') ${extra};`;

try {
  docker([
    "run",
    "--rm",
    "-d",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=disposable-local-only",
    "postgres:17-alpine",
  ]);
  for (let attempt = 0; attempt < 40; attempt++) {
    const ready = spawnSync("docker", [
      "exec",
      container,
      "pg_isready",
      "-U",
      "postgres",
    ]);
    if (ready.status === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL AS $$ SELECT current_user::text $$;
CREATE FUNCTION update_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
CREATE TABLE provider_connections (id UUID PRIMARY KEY,user_id UUID REFERENCES auth.users(id),provider TEXT CHECK(provider IN ('openrouter','replicate','huggingface')),external_account_id TEXT,status TEXT,encrypted_secret TEXT);
`);
  sql(
    await readFile(
      new URL(
        "../supabase/migrations/099_add_runpod_connected_pods.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  sql(
    `INSERT INTO auth.users VALUES ('${user}'); INSERT INTO provider_connections VALUES ('${connection}','${user}','runpod','account1','active','encrypted');`,
  );
  sql(insert(1));
  assert.equal(
    sql(`SELECT claim_runpod_quote('${podId(1)}','${user}');`).trim(),
    "t",
  );
  assert.equal(
    sql(`SELECT claim_runpod_quote('${podId(1)}','${user}');`).trim(),
    "f",
  );
  assert.equal(
    sql(
      `SELECT claim_runpod_quote('${podId(1)}','99999999-9999-4999-8999-999999999999');`,
    ).trim(),
    "f",
  );
  sql(`DO $$ BEGIN
    BEGIN UPDATE provider_connections SET external_account_id='different' WHERE id='${connection}'; RAISE EXCEPTION 'account switch unexpectedly allowed';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Terminate Runpod%' THEN RAISE; END IF; END;
    BEGIN DELETE FROM provider_connections WHERE id='${connection}'; RAISE EXCEPTION 'disconnect unexpectedly allowed';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Terminate Runpod%' THEN RAISE; END IF; END;
    BEGIN DELETE FROM auth.users WHERE id='${user}'; RAISE EXCEPTION 'account deletion unexpectedly allowed';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Terminate Runpod%' THEN RAISE; END IF; END;
  END $$;
  UPDATE provider_connections SET encrypted_secret='rotated-same-account',status='active' WHERE id='${connection}';`);
  sql(`UPDATE runpod_pods SET status='terminated' WHERE id='${podId(1)}';`);
  for (let n = 2; n <= 7; n++) sql(insert(n));
  function claim(n) {
    return new Promise((resolve, reject) => {
      const process = spawn("docker", sqlArgs);
      let output = "",
        errors = "";
      process.stdout.on("data", (chunk) => {
        output += chunk;
      });
      process.stderr.on("data", (chunk) => {
        errors += chunk;
      });
      process.on("error", reject);
      process.on("close", (code) =>
        code === 0 ? resolve(output.trim()) : reject(new Error(errors)),
      );
      process.stdin.end(`SELECT claim_runpod_quote('${podId(n)}','${user}');`);
    });
  }
  const results = await Promise.all([2, 3, 4, 5, 6, 7].map(claim));
  assert.equal(
    results.filter((value) => value === "t").length,
    3,
    "Concurrent claims must respect the three-Pod limit",
  );
  assert.equal(
    sql(
      "SELECT has_function_privilege('authenticated','claim_runpod_quote(uuid,uuid)','EXECUTE');",
    ).trim(),
    "f",
  );
  assert.equal(
    sql(
      "SELECT has_function_privilege('anon','claim_runpod_quote(uuid,uuid)','EXECUTE');",
    ).trim(),
    "f",
  );
  sql("GRANT SELECT, INSERT, UPDATE, DELETE ON runpod_pods TO authenticated;");
  assert.equal(
    sql("SET ROLE authenticated; SELECT count(*) FROM runpod_pods;").trim(),
    "SET\n0",
    "RLS must hide all control-plane rows from browser sessions",
  );
  sql(
    `UPDATE runpod_pods SET status='terminated'; DELETE FROM provider_connections WHERE id='${connection}';`,
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM runpod_pods WHERE provider_connection_id IS NOT NULL;",
    ).trim(),
    "0",
  );
  sql(`DELETE FROM auth.users WHERE id='${user}';`);
  assert.equal(sql("SELECT count(*) FROM runpod_pods;").trim(), "0");
  console.log(
    "Runpod schema verified: migration, RLS, RPC permissions, one-time claims, concurrent three-Pod limit, account switch guard, key rotation and terminal cleanup.",
  );
} finally {
  spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
}
