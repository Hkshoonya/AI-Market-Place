import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const QUALITY_ESTIMATES = {
  "anthropic-claude-computer-use": 72,
  "openai-operator": 68,
  "openai-computer-use-preview": 65,
  "google-gemini-2-5-computer-use-preview-10-2025": 66,
  "multion-agent": 55,
  "browseruse-agent": 58,
  "microsoft-copilot-vision": 60,
  "hf-smolagents-web": 50,
  "twin-browser-agent": 52,
  "bytedance-ui-tars-1-5-7b": 62,
};

const MARKET_CAP_ESTIMATES = {
  "anthropic-claude-computer-use": 28_000_000,
  "openai-operator": 35_000_000,
  "openai-computer-use-preview": 12_000_000,
  "google-gemini-2-5-computer-use-preview-10-2025": 18_000_000,
  "multion-agent": 5_000_000,
  "browseruse-agent": 3_000_000,
  "microsoft-copilot-vision": 15_000_000,
  "hf-smolagents-web": 2_000_000,
  "twin-browser-agent": 1_500_000,
  "bytedance-ui-tars-1-5-7b": 8_000_000,
};

const POPULARITY_ESTIMATES = {
  "anthropic-claude-computer-use": 75,
  "openai-operator": 82,
  "openai-computer-use-preview": 60,
  "google-gemini-2-5-computer-use-preview-10-2025": 65,
  "multion-agent": 40,
  "browseruse-agent": 55,
  "microsoft-copilot-vision": 50,
  "hf-smolagents-web": 45,
  "twin-browser-agent": 30,
  "bytedance-ui-tars-1-5-7b": 48,
};

async function main() {
  // Get agentic_browser models
  const { data: agenticModels } = await supabase
    .from("models")
    .select("id, slug, name, provider, quality_score, popularity_score, market_cap_estimate")
    .eq("category", "agentic_browser")
    .eq("status", "active");

  console.log(`Found ${agenticModels?.length ?? 0} active agentic browser models\n`);

  // Update scores for models that don't have them
  for (const model of agenticModels || []) {
    const quality = QUALITY_ESTIMATES[model.slug] || null;
    const marketCap = MARKET_CAP_ESTIMATES[model.slug] || null;
    const popularity = POPULARITY_ESTIMATES[model.slug] || null;

    const updates = {};
    if (quality && !model.quality_score) updates.quality_score = quality;
    if (marketCap && !model.market_cap_estimate) updates.market_cap_estimate = marketCap;
    if (popularity && !model.popularity_score) updates.popularity_score = popularity;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("models").update(updates).eq("id", model.id);
      console.log(`  Updated ${model.name}: ${Object.keys(updates).join(", ")} ${error ? "ERR: " + error.message : "OK"}`);
    } else {
      console.log(`  ${model.name}: already has scores`);
    }
  }

  // Compute rankings for ALL active models (so ranks are accurate)
  const { data: allModels } = await supabase
    .from("models")
    .select("id, category, quality_score, market_cap_estimate, popularity_score")
    .eq("status", "active")
    .not("quality_score", "is", null);

  const withSignals = (allModels || []).filter((m) => Number(m.quality_score) > 0);

  const byMcap = [...withSignals].sort((a, b) => (Number(b.market_cap_estimate) || 0) - (Number(a.market_cap_estimate) || 0));
  const byQual = [...withSignals].sort((a, b) => Number(b.quality_score) - Number(a.quality_score));
  const byPop = [...withSignals].sort((a, b) => (Number(b.popularity_score) || 0) - (Number(a.popularity_score) || 0));

  const mcapRank = new Map(byMcap.map((m, i) => [m.id, i + 1]));
  const qualRank = new Map(byQual.map((m, i) => [m.id, i + 1]));
  const popRank = new Map(byPop.map((m, i) => [m.id, i + 1]));

  const composite = withSignals.map((m) => ({
    ...m,
    compositeRank:
      0.5 * (mcapRank.get(m.id) || withSignals.length) +
      0.3 * (qualRank.get(m.id) || withSignals.length) +
      0.2 * (popRank.get(m.id) || withSignals.length),
  }));

  composite.sort((a, b) => a.compositeRank - b.compositeRank);

  // Assign overall + category ranks
  const catGroups = new Map();
  const agenticIds = new Set((agenticModels || []).map((m) => m.id));
  let updatedCount = 0;

  for (let i = 0; i < composite.length; i++) {
    const m = composite[i];
    const overallRank = i + 1;
    if (!catGroups.has(m.category)) catGroups.set(m.category, 0);
    catGroups.set(m.category, catGroups.get(m.category) + 1);
    const categoryRank = catGroups.get(m.category);

    if (agenticIds.has(m.id)) {
      const { error } = await supabase
        .from("models")
        .update({ overall_rank: overallRank, category_rank: categoryRank })
        .eq("id", m.id);
      if (!error) updatedCount++;
    }
  }

  console.log(`\nRanked ${updatedCount} agentic browser models`);

  // Show final state
  const { data: final } = await supabase
    .from("models")
    .select("name, provider, category_rank, overall_rank, quality_score, market_cap_estimate, popularity_score")
    .eq("category", "agentic_browser")
    .eq("status", "active")
    .order("category_rank", { ascending: true });

  console.log("\n=== Agentic Browser Rankings ===");
  for (const m of final || []) {
    const mcap = Number(m.market_cap_estimate) / 1_000_000;
    console.log(
      `  #${m.category_rank} ${m.name} (${m.provider}) — Quality: ${m.quality_score}, MCap: $${mcap.toFixed(1)}M, Pop: ${m.popularity_score}, Overall: #${m.overall_rank}`
    );
  }
}

main().catch(console.error);
