interface ProviderMetricModel {
  capability_score?: number | string | null;
  quality_score?: number | string | null;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function getCapabilityMetricValue(model: ProviderMetricModel) {
  return toNumber(model.capability_score) ?? toNumber(model.quality_score);
}

export function averageCapabilityMetric(models: ProviderMetricModel[]) {
  const values = models
    .map((model) => getCapabilityMetricValue(model))
    .filter((value): value is number => value != null);

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
