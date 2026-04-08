import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { computeBenchmarkCoverage } from "../src/lib/benchmark-coverage-compute";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const coverage = await computeBenchmarkCoverage(supabase);

  console.log(JSON.stringify(coverage, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
