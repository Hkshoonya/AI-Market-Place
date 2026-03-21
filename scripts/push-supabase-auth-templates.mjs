import { config as loadDotenv } from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildSupabaseAuthTemplatePatch } from "./supabase-auth-templates.mjs";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ quiet: true });

async function readProjectRef() {
  const fromEnv = process.env.SUPABASE_PROJECT_REF;
  if (fromEnv) return fromEnv.trim();
  const refPath = resolve("supabase/.temp/project-ref");
  return (await readFile(refPath, "utf8")).trim();
}

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN. Set it in the environment or .env.local before running this script.");
  }

  const projectRef = await readProjectRef();
  const patch = buildSupabaseAuthTemplatePatch();
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ projectRef, keys: Object.keys(patch) }, null, 2)}\n`);
    return;
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(`Supabase auth template update failed (${response.status}): ${await response.text()}`);
  }

  const result = await response.json();
  const summary = {
    projectRef,
    smtp_sender_name: result.smtp_sender_name,
    smtp_admin_email: result.smtp_admin_email,
    updatedKeys: Object.keys(patch).length,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
