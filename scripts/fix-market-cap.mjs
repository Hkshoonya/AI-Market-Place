// Fix market cap to be revenue-based using real provider user counts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Real provider Monthly Active User estimates (public data, press releases)
const PROVIDER_MAU = {
  'OpenAI': 400_000_000,
  'Anthropic': 50_000_000,
  'Google': 200_000_000,
  'google': 200_000_000,
  'Meta': 100_000_000,
  'Mistral AI': 15_000_000,
  'DeepSeek': 40_000_000,
  'xAI': 20_000_000,
  'Cohere': 5_000_000,
  'Amazon': 10_000_000,
  'Microsoft': 30_000_000,
  'NVIDIA': 8_000_000,
  'Perplexity': 25_000_000,
  'Alibaba / Qwen': 20_000_000,
  'Alibaba': 20_000_000,
  'Stability AI': 10_000_000,
  'AI21 Labs': 3_000_000,
  'Moonshot AI': 5_000_000,
  'Zhipu AI': 5_000_000,
  '01.AI': 3_000_000,
  'Together AI': 2_000_000,
  'Databricks': 5_000_000,
};

async function main() {
  // 1. Fetch all active models
  const { data: models, error } = await supabase
    .from('models')
    .select('id, name, provider, quality_score, is_open_weights')
    .eq('status', 'active');

  if (error) { console.error(error); return; }

  // 2. Fetch pricing for each model
  const { data: pricing } = await supabase
    .from('model_pricing')
    .select('model_id, input_price_per_million, output_price_per_million');

  const pricingMap = new Map();
  for (const p of (pricing || [])) {
    if (!pricingMap.has(p.model_id) || (p.input_price_per_million && p.input_price_per_million > (pricingMap.get(p.model_id)?.input_price_per_million || 0))) {
      pricingMap.set(p.model_id, p);
    }
  }

  // 3. Compute quality totals per provider
  const providerQualityTotals = {};
  for (const m of models) {
    const qs = Number(m.quality_score) || 30;
    providerQualityTotals[m.provider] = (providerQualityTotals[m.provider] || 0) + qs;
  }

  // 4. Compute revenue-based market cap for each model
  const updates = [];
  for (const m of models) {
    const providerMau = PROVIDER_MAU[m.provider] || 1_000_000; // Default 1M for unknown
    const qs = Number(m.quality_score) || 30;
    // Use quality^2 for power-law distribution (flagships capture most users)
    const qsSquared = qs * qs;
    const totalQsSquared = models
      .filter(x => x.provider === m.provider)
      .reduce((sum, x) => sum + Math.pow(Number(x.quality_score) || 30, 2), 0);
    const modelShare = qsSquared / (totalQsSquared || 1);

    // ARPU (monthly) based on pricing tier
    const mp = pricingMap.get(m.id);
    let arpu;
    if (mp && mp.input_price_per_million > 10) {
      arpu = 12; // Premium API model (o1, GPT-4.5, Claude Opus)
    } else if (mp && mp.input_price_per_million > 2) {
      arpu = 6; // Mid-tier API (GPT-4o, Claude Sonnet)
    } else if (mp && mp.input_price_per_million > 0) {
      arpu = 3; // Budget API (GPT-4o-mini, Haiku)
    } else {
      arpu = 1.5; // Free/open-weight (indirect revenue via ecosystem)
    }

    // Monthly revenue = MAU * model_share * ARPU
    const monthlyRevenue = Math.round(providerMau * modelShare * arpu);

    updates.push({ id: m.id, market_cap_estimate: monthlyRevenue });
  }

  // 5. Batch update
  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    for (const u of batch) {
      const { error: err } = await supabase
        .from('models')
        .update({ market_cap_estimate: u.market_cap_estimate })
        .eq('id', u.id);
      if (err) console.error(`Error updating ${u.id}:`, err.message);
      else updated++;
    }
  }

  // 6. Show top 15 by market cap
  const { data: top } = await supabase
    .from('models')
    .select('name, provider, market_cap_estimate, quality_score, popularity_score')
    .eq('status', 'active')
    .order('market_cap_estimate', { ascending: false, nullsFirst: false })
    .limit(15);

  console.log(`Updated ${updated} models. Top 15 by revenue-based market cap:`);
  console.table(top?.map(m => ({
    name: m.name,
    provider: m.provider,
    market_cap: `$${(Number(m.market_cap_estimate) / 1_000_000).toFixed(1)}M`,
    quality: Number(m.quality_score)?.toFixed(1),
    popularity: Number(m.popularity_score)?.toFixed(0),
  })));
}

main().catch(console.error);
