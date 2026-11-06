import { fetchOfficialArenaSnapshot, planOfficialArenaImport } from "@/lib/data-sources/shared/official-arena";

/** Read-only preview; never imports adapters or gives the planner a database writer. */
async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const site = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !site) throw new Error("Load the local environment before running the preview");
  const ref = new URL(site).hostname.split(".")[0];
  const query = `select id,name,slug,provider from public.models where status='active'
    and (is_api_available=true or provider in ('OpenAI','Anthropic','Google','Meta','DeepSeek','Qwen',
      'Mistral AI','Moonshot AI','MiniMax','xAI','Z.ai','Cohere','Microsoft','NVIDIA','Alibaba Cloud'))
    order by id limit 10001`;
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Read-only catalog query failed (HTTP ${response.status})`); }
  const models: Array<{ id: string; name: string; slug: string; provider: string }> = await response.json();
  if (!Array.isArray(models) || models.length > 10000) throw new Error("Catalog preview bounds exceeded; no writes attempted");
  const previews = [];
  for (const subset of ["text", "vision"] as const) {
    const snapshot = await fetchOfficialArenaSnapshot(subset);
    const plan = planOfficialArenaImport(subset, snapshot.rows, models);
    previews.push({ subset, publicationDate: snapshot.publicationDate, revision: snapshot.revision,
      sha256: snapshot.sha256, bytes: snapshot.bytes, overallRows: snapshot.rows.length,
      exactMatchedSourceRows: plan.matchedRows, proposedRecords: plan.ratings.length,
      missingOrganizationRows: snapshot.rows.filter((row) => !row.organization).length,
      unmatchedCount: plan.unmatchedModels.length, unmatchedSample: plan.unmatchedModels.slice(0, 20),
      matchedSample: plan.ratings.slice(0, 10).map((rating) => ({
        model: models.find((model) => model.id === rating.model_id)?.name,
        rating: rating.elo_score, publicationDate: rating.snapshot_date,
      })) });
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true,
    catalogCandidates: models.length, scope: "API-available models and named core providers, not all community artifacts",
    previews }, null, 2));
}

main().catch(() => {
  console.error("Read-only Arena preview failed; no import or score writes were attempted.");
  process.exitCode = 1;
});
