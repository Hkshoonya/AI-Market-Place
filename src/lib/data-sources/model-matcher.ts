/**
 * Model Name Matcher
 *
 * Maps free-text (news titles, tweets, summaries) → model UUIDs.
 * Used by news adapters and the backfill endpoint to populate `related_model_ids`.
 *
 * Strategy:
 * 1. Build a lookup table from all active models with generated aliases
 * 2. Generate aliases handling version dots, hyphens, size suffixes, parens
 * 3. Sort by alias length descending (specificity priority)
 * 4. Word-boundary matching: ensures "GPT-4" doesn't match in "GPT-4o"
 * 5. Longest-match-first with range tracking to prevent substring overlap
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface ModelLookupEntry {
  id: string;
  name: string;
  slug: string;
  provider: string;
  /** Aliases sorted by length descending */
  aliases: string[];
}

// --------------- Constants ---------------

/** Names that are too generic to match reliably in free text */
const SKIP_NAMES = new Set([
  "auto",
  "bodybuilder",
  "airflow",
  "darts",
  "anima",
  "axiom",
  "capybara",
  "chatterbot",
  "autogluon",
  // Generic words that happen to be model/repo names
  "datasets",
  "inference",
  "free",
  "vision",
  "supervision",
  "sonnet",
  "transformers",
  "accelerate",
  "evaluate",
  "optimum",
  "hub",
  "arena",
  "open",
  "chat",
  "base",
  "core",
  "edge",
  "lite",
  "mini",
  "nano",
  "next",
  "plus",
  "ultra",
  "turbo",
  "fast",
  "pro",
  "max",
  "spark",
  "storm",
  "atlas",
  "titan",
  "server",
  "agent",
  "agents",
  "model",
  "models",
  "benchmark",
  "safety",
  "alignment",
]);

/** Minimum alias length to include (avoids false positives from "R1", "o1") */
const MIN_ALIAS_LENGTH = 4;

// --------------- Alias Generation ---------------

/**
 * Generate name aliases for word-boundary matching.
 *
 * Examples:
 *   "Claude 3.5 Sonnet"  → ["claude 3.5 sonnet", "claude-3.5-sonnet", "claude-3-5-sonnet", ...]
 *   "GPT-4o"             → ["gpt-4o", "gpt 4o"]
 *   "DeepSeek-R1"        → ["deepseek-r1", "deepseek r1"]
 *   "Llama 4 Maverick"   → ["llama 4 maverick", "llama-4-maverick"]
 *   "Claude 3.7 Sonnet (thinking)" → ["claude 3.7 sonnet (thinking)", "claude 3.7 sonnet", ...]
 */
export function generateAliases(name: string): string[] {
  const aliases = new Set<string>();
  const nameLower = name.toLowerCase().trim();

  if (nameLower.length < MIN_ALIAS_LENGTH) return [];

  // 1. Name as-is (lowercase)
  aliases.add(nameLower);

  // 2. Space ↔ hyphen variants
  if (nameLower.includes(" ")) {
    aliases.add(nameLower.replace(/\s+/g, "-"));
  }
  if (nameLower.includes("-")) {
    aliases.add(nameLower.replace(/-/g, " "));
  }

  // 3. Version dot variants: "3.5" → "3-5"
  if (/\d\.\d/.test(nameLower)) {
    const dotToHyphen = nameLower.replace(/(\d)\.(\d)/g, "$1-$2");
    aliases.add(dotToHyphen);
    if (dotToHyphen.includes(" ")) {
      aliases.add(dotToHyphen.replace(/\s+/g, "-"));
    }
    if (dotToHyphen.includes("-")) {
      aliases.add(dotToHyphen.replace(/-/g, " "));
    }
  }

  // 4. Strip parenthetical qualifiers: "Claude 3.7 Sonnet (thinking)" → "claude 3.7 sonnet"
  if (nameLower.includes("(")) {
    const stripped = nameLower.replace(/\s*\([^)]*\)\s*/g, "").trim();
    if (stripped.length >= MIN_ALIAS_LENGTH && stripped !== nameLower) {
      aliases.add(stripped);
      if (stripped.includes(" ")) {
        aliases.add(stripped.replace(/\s+/g, "-"));
      }
    }
  }

  // 5. Strip "v" prefix from version: "Claude 3.5 Sonnet v2" — the "v2" is important, keep it
  // But also generate without trailing version qualifiers like " v1", "-v1"
  const noTrailingV = nameLower.replace(/[\s-]v\d+\s*$/, "").trim();
  if (noTrailingV !== nameLower && noTrailingV.length >= MIN_ALIAS_LENGTH) {
    aliases.add(noTrailingV);
  }

  // 6. Strip date suffixes from API names: "gpt-4o-2024-05-13" → "gpt-4o"
  //    Only do this for names that look like API identifiers (no spaces, has dates)
  if (!nameLower.includes(" ") && /\d{4}-\d{2}-\d{2}/.test(nameLower)) {
    const noDate = nameLower.replace(/-\d{4}-\d{2}-\d{2}.*$/, "").trim();
    if (noDate.length >= MIN_ALIAS_LENGTH) {
      // Don't add — this would create false matches with the parent model
      // e.g., "gpt-4o-2024-05-13" stripping to "gpt-4o" would conflict with the actual "GPT-4o" model
    }
  }

  // Filter out too-short aliases and sort by length desc
  return [...aliases]
    .filter((a) => a.length >= MIN_ALIAS_LENGTH)
    .sort((a, b) => b.length - a.length);
}

// --------------- Lookup Builder ---------------

/**
 * Build the full model lookup table from the database.
 * Call once per sync cycle, then pass to matchModelsInText().
 */
export async function buildModelLookup(
  supabase: SupabaseClient
): Promise<ModelLookupEntry[]> {
  const { data: models, error } = await supabase
    .from("models")
    .select("id, name, slug, provider")
    .eq("status", "active");

  if (error) {
    console.error("[model-matcher] Failed to fetch models:", error.message);
    return [];
  }

  const entries: ModelLookupEntry[] = [];

  for (const model of models ?? []) {
    const nameLower = model.name.toLowerCase().trim();

    // Skip names that are too generic
    if (SKIP_NAMES.has(nameLower)) continue;

    const aliases = generateAliases(model.name);
    if (aliases.length === 0) continue;

    entries.push({
      id: model.id,
      name: model.name,
      slug: model.slug,
      provider: model.provider,
      aliases,
    });
  }

  // Sort entries by longest alias first (specificity priority)
  // "GPT-4o Mini" entries process before "GPT-4o"
  entries.sort((a, b) => {
    const maxA = a.aliases[0]?.length ?? 0;
    const maxB = b.aliases[0]?.length ?? 0;
    return maxB - maxA;
  });

  return entries;
}

// --------------- Matching Engine ---------------

/** Check if a character is a word boundary (non-alphanumeric or string edge) */
function isBoundaryChar(ch: string | undefined): boolean {
  if (ch === undefined) return true; // string start/end
  return !/[a-z0-9]/i.test(ch);
}

interface MatchRange {
  start: number;
  end: number;
  modelId: string;
}

/**
 * Match text against all models, return matching UUIDs.
 *
 * Uses longest-match-first with range tracking to prevent overlap.
 * Word-boundary matching ensures "GPT-4" doesn't match in "GPT-4o".
 *
 * @param text - The text to search (title, summary, tweet body)
 * @param lookup - The lookup table from buildModelLookup()
 * @returns Array of unique model UUIDs found in text
 */
export function matchModelsInText(
  text: string,
  lookup: ModelLookupEntry[]
): string[] {
  if (!text || text.length < MIN_ALIAS_LENGTH) return [];

  const normalizedText = text.toLowerCase();
  const matchedRanges: MatchRange[] = [];
  const matchedIds = new Set<string>();

  // Process entries in order (longest alias first due to sort in buildModelLookup)
  for (const entry of lookup) {
    for (const alias of entry.aliases) {
      // Quick check: skip if alias can't possibly be in text
      if (alias.length > normalizedText.length) continue;

      let searchFrom = 0;
      while (searchFrom <= normalizedText.length - alias.length) {
        const idx = normalizedText.indexOf(alias, searchFrom);
        if (idx === -1) break;

        // Check word boundaries
        const charBefore = idx > 0 ? normalizedText[idx - 1] : undefined;
        const charAfter =
          idx + alias.length < normalizedText.length
            ? normalizedText[idx + alias.length]
            : undefined;

        if (isBoundaryChar(charBefore) && isBoundaryChar(charAfter)) {
          // Check if this range is subsumed by an existing longer match
          const isSubsumed = matchedRanges.some(
            (m) => idx >= m.start && idx + alias.length <= m.end
          );

          if (!isSubsumed) {
            matchedRanges.push({
              start: idx,
              end: idx + alias.length,
              modelId: entry.id,
            });
            matchedIds.add(entry.id);
          }
        }

        searchFrom = idx + 1;
      }

      // If we already found this model via a longer alias, skip shorter ones
      if (matchedIds.has(entry.id)) break;
    }
  }

  return [...matchedIds];
}

// --------------- Provider Detection ---------------

/** Known AI providers and keywords for provider detection */
const PROVIDER_KEYWORDS: Record<string, string[]> = {
  OpenAI: ["openai", "gpt-", "dall-e", "codex", "o1-", "o3-", "o4-"],
  Anthropic: ["anthropic", "claude"],
  Google: ["google", "deepmind", "gemini", "gemma", "imagen", "veo"],
  Meta: ["meta ai", "llama", "codellama"],
  "Mistral AI": ["mistral", "mixtral", "pixtral", "codestral", "devstral", "ministral"],
  DeepSeek: ["deepseek"],
  xAI: ["xai", "grok"],
  Cohere: ["cohere", "command r", "command a"],
  Microsoft: ["microsoft", "phi-", "wizardlm"],
  "Stability AI": ["stability", "stable diffusion", "sdxl"],
  NVIDIA: ["nvidia", "nemotron"],
  Amazon: ["amazon", "nova pro", "nova lite", "nova micro", "nova premier"],
  Perplexity: ["perplexity", "sonar"],
  "Alibaba Cloud": ["alibaba", "qwen"],
  "Hugging Face": ["hugging face", "huggingface"],
};

/**
 * Detect the most likely provider from text.
 * Returns null if no provider can be confidently detected.
 */
function detectProvider(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [provider, keywords] of Object.entries(PROVIDER_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return provider;
    }
  }
  return null;
}

// --------------- Full Pipeline ---------------

/**
 * Full news-to-model resolution pipeline.
 *
 * Analyzes title + summary text to find related models and detect provider.
 *
 * @param title - News item title
 * @param summary - News item summary/body (may be null)
 * @param metadata - Adapter metadata (may contain provider info)
 * @param lookup - Model lookup table from buildModelLookup()
 * @returns Related model IDs and detected provider
 */
export function resolveNewsRelations(
  title: string | null,
  summary: string | null,
  metadata: Record<string, unknown> | null,
  lookup: ModelLookupEntry[]
): { modelIds: string[]; provider: string | null } {
  // Combine title and summary for matching
  const searchText = [title, summary].filter(Boolean).join(" ");

  // Find matching models
  const modelIds = matchModelsInText(searchText, lookup);

  // Detect provider: prefer metadata > matched models > text detection
  let provider: string | null = null;

  // 1. From adapter metadata
  if (metadata?.provider && typeof metadata.provider === "string") {
    provider = metadata.provider;
  }

  // 2. From matched models (use first match's provider)
  if (!provider && modelIds.length > 0) {
    const firstMatch = lookup.find((e) => e.id === modelIds[0]);
    if (firstMatch) {
      provider = firstMatch.provider;
    }
  }

  // 3. From text keywords
  if (!provider) {
    provider = detectProvider(searchText);
  }

  return { modelIds, provider };
}
