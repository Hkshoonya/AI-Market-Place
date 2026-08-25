export interface EvidenceProfileModel {
  description: string | null;
  short_description?: string | null;
  architecture: string | null;
  parameter_count: number | null;
  context_window: number | null;
  release_date: string | null;
  website_url: string | null;
  github_url: string | null;
  hf_model_id: string | null;
  hf_downloads: number;
  hf_likes: number;
  github_stars: number | null;
  quality_score: number | null;
  license: string | null;
  license_name: string | null;
  is_open_weights: boolean | null;
  is_api_available: boolean;
  data_refreshed_at: string | null;
}

export interface EvidenceProfileSignals {
  benchmarkCount: number;
  arenaCount: number;
  providerBenchmarkCount: number;
  pricingCount: number;
  deploymentCount: number;
  snapshotCount: number;
  newsCount: number;
  updateCount: number;
  metadataEvidenceCount: number;
}

export interface EvidenceDimension {
  key: "profile" | "evaluation" | "access" | "adoption" | "provenance";
  label: string;
  score: number;
  known: number;
  total: number;
}

export interface ModelEvidenceProfile {
  score: number;
  level: "Strong evidence" | "Developing evidence" | "Limited evidence";
  knownSignals: number;
  totalSignals: number;
  dimensions: EvidenceDimension[];
  missing: string[];
}

function buildDimension(
  key: EvidenceDimension["key"],
  label: string,
  signals: boolean[]
): EvidenceDimension {
  const known = signals.filter(Boolean).length;
  return {
    key,
    label,
    known,
    total: signals.length,
    score: Math.round((known / signals.length) * 100),
  };
}

export function buildModelEvidenceProfile(
  model: EvidenceProfileModel,
  signals: EvidenceProfileSignals
): ModelEvidenceProfile {
  const dimensions = [
    buildDimension("profile", "Technical profile", [
      Boolean(model.description || model.short_description),
      Boolean(model.architecture),
      model.parameter_count !== null,
      model.context_window !== null,
      Boolean(model.release_date),
    ]),
    buildDimension("evaluation", "Evaluation", [
      signals.benchmarkCount > 0,
      signals.arenaCount > 0,
      signals.providerBenchmarkCount > 0,
      model.quality_score !== null,
    ]),
    buildDimension("access", "Access & cost", [
      Boolean(model.website_url),
      Boolean(model.license || model.license_name),
      model.is_open_weights || model.is_api_available,
      signals.pricingCount > 0,
      signals.deploymentCount > 0,
    ]),
    buildDimension("adoption", "Adoption", [
      Boolean(model.hf_model_id),
      model.hf_downloads > 0 || model.hf_likes > 0,
      Boolean(model.github_url || (model.github_stars ?? 0) > 0),
      signals.snapshotCount > 0,
    ]),
    buildDimension("provenance", "Provenance", [
      signals.metadataEvidenceCount > 0,
      signals.newsCount > 0,
      signals.updateCount > 0,
      Boolean(model.data_refreshed_at),
    ]),
  ];

  const knownSignals = dimensions.reduce(
    (total, dimension) => total + dimension.known,
    0
  );
  const totalSignals = dimensions.reduce(
    (total, dimension) => total + dimension.total,
    0
  );
  const score = Math.round((knownSignals / totalSignals) * 100);
  const missing = [
    !model.description && !model.short_description ? "verified description" : null,
    model.parameter_count === null ? "parameter count" : null,
    model.context_window === null ? "context window" : null,
    signals.benchmarkCount + signals.arenaCount + signals.providerBenchmarkCount === 0
      ? "evaluation evidence"
      : null,
    signals.pricingCount === 0 ? "verified pricing" : null,
    signals.metadataEvidenceCount === 0 ? "independent metadata source" : null,
  ].filter((value): value is string => value !== null);

  return {
    score,
    level:
      score >= 75
        ? "Strong evidence"
        : score >= 50
          ? "Developing evidence"
          : "Limited evidence",
    knownSignals,
    totalSignals,
    dimensions,
    missing,
  };
}
