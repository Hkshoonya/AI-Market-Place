import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, upsertBatch } from "../utils";

const HF_PAPERS_API = "https://huggingface.co/api/daily_papers";

const KNOWN_PROVIDERS = [
  "OpenAI", "Anthropic", "Google", "DeepMind", "Meta", "Microsoft",
  "NVIDIA", "Mistral", "DeepSeek", "Alibaba", "Stability AI",
  "Hugging Face", "xAI", "Cohere", "AI21", "Amazon", "Apple",
];

interface HFPaper {
  paper: {
    id: string;
    title: string;
    summary: string;
    authors?: { name: string }[];
    publishedAt?: string;
    upvotes?: number;
  };
  publishedAt: string;
}

function detectProvider(title: string, summary: string): string | null {
  const text = `${title} ${summary}`.toLowerCase();
  for (const p of KNOWN_PROVIDERS) {
    if (text.includes(p.toLowerCase())) return p;
  }
  return null;
}

const adapter: DataSourceAdapter = {
  id: "hf-papers",
  name: "HF Daily Papers",
  outputTypes: ["news"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: { message: string; context?: string }[] = [];
    let recordsProcessed = 0;

    try {
      const res = await fetchWithRetry(HF_PAPERS_API, undefined, {
        signal: ctx.signal,
      });
      if (!res.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{ message: `HF Papers API returned ${res.status}` }],
        };
      }

      const papers = (await res.json()) as HFPaper[];
      recordsProcessed = papers.length;

      const records = papers.map((item) => {
        const p = item.paper;
        return {
          source: "hf-papers",
          source_id: p.id || "",
          title: (p.title || "Untitled").slice(0, 500),
          summary: (p.summary || "").slice(0, 2000),
          url: `https://huggingface.co/papers/${p.id}`,
          published_at: item.publishedAt || new Date().toISOString(),
          category: "research",
          related_provider: detectProvider(p.title || "", p.summary || ""),
          tags: ["huggingface", "daily-papers"],
          metadata: {
            upvotes: p.upvotes ?? 0,
            authors: (p.authors ?? []).slice(0, 10).map((a) => a.name),
          },
        };
      });

      if (records.length > 0) {
        const { errors: ue } = await upsertBatch(
          ctx.supabase,
          "model_news",
          records,
          "source,source_id"
        );
        errors.push(...ue);
      }
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err) });
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated: recordsProcessed,
      recordsUpdated: 0,
      errors,
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(HF_PAPERS_API);
      return { healthy: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Failed",
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
