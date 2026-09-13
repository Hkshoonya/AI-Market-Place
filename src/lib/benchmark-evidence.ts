interface BenchmarkEvidenceClient {
  rpc: (name: "get_benchmark_evidence_model_ids") => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

type EvidenceRows = { related_model_ids: string[] }[];
const inFlight = new WeakMap<BenchmarkEvidenceClient, Promise<EvidenceRows>>();

async function readBenchmarkEvidenceRows(supabase: BenchmarkEvidenceClient): Promise<EvidenceRows> {
  const { data, error } = await supabase.rpc("get_benchmark_evidence_model_ids");

  if (error) {
    throw new Error(`Failed to fetch benchmark evidence summary: ${error.message}`);
  }
  if (!Array.isArray(data) || !data.every((id): id is string => typeof id === "string")) {
    throw new Error("Invalid benchmark evidence summary");
  }

  return [{ related_model_ids: data }];
}

/** Share overlapping audits for one client, but never cache results across runs. */
export function fetchBenchmarkEvidenceRows(supabase: BenchmarkEvidenceClient): Promise<EvidenceRows> {
  const pending = inFlight.get(supabase);
  if (pending) return pending;

  const request = readBenchmarkEvidenceRows(supabase).finally(() => {
    inFlight.delete(supabase);
  });
  inFlight.set(supabase, request);
  return request;
}
